'use strict';

const crypto = require('crypto');
const KEYS = { rsvp: 'boda:rsvp', canciones: 'boda:canciones' };

function resolveCreds() {
  const env = process.env;
  const pairs = [
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ...Object.keys(env).filter(k => /REST(?:_API)?_URL$/.test(k))
      .map(k => [k, k.replace(/URL$/, 'TOKEN')])
  ];
  for (const [u, t] of pairs) {
    if (env[u]?.trim() && env[t]?.trim()) return { url: env[u].trim().replace(/\/$/, ''), token: env[t].trim() };
  }
  return { url: '', token: '' };
}
function isConfigured() { const c = resolveCreds(); return Boolean(c.url && c.token); }
function keyFor(kind) {
  if (!KEYS[kind]) throw new Error('Tipo de almacén desconocido');
  return KEYS[kind];
}
async function redis(command) {
  const { url, token } = resolveCreds();
  if (!url || !token) throw new Error('Redis no configurado');
  const res = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const json = await res.json();
  if (!json || json.error || !Object.hasOwn(json, 'result')) throw new Error('Respuesta de Redis inválida o comando rechazado');
  return json.result;
}
async function ping() {
  if (await redis(['PING']) !== 'PONG') throw new Error('Redis no responde correctamente');
}
async function overLimit(kind, ip, max, windowSec) {
  if (!ip) return false;
  try {
    const key = `boda:rl:${kind}:${crypto.createHash('sha256').update(ip).digest('hex')}`;
    const script = `local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;
    return Number(await redis(['EVAL', script, '1', key, String(windowSec)])) > max;
  } catch (e) {
    console.error('Rate limit no disponible:', e.cause?.code || e.message);
    return false;
  }
}
async function append(kind, obj) {
  const n = await redis(['RPUSH', keyFor(kind), JSON.stringify(obj)]);
  if (!Number.isInteger(n) || n < 1) throw new Error('Guardado no confirmado');
}

// La deduplicación y la escritura suceden en una sola operación: un reintento
// tras perder la respuesta HTTP devuelve el mismo recibo sin duplicar invitados.
async function appendOnce(kind, obj, requestId) {
  if (!requestId) { await append(kind, obj); return obj.id; }
  const { id, ts, ip, ua, ...fields } = obj;
  const hash = crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  const dedupKey = `boda:submission:${kind}:${requestId}`;
  const script = `local previous = redis.call('GET', KEYS[2])
if previous then
  local saved = cjson.decode(previous)
  if saved.hash ~= ARGV[2] then return {'conflict'} end
  return {'ok', saved.id}
end
redis.call('RPUSH', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], cjson.encode({hash=ARGV[2], id=ARGV[3]}), 'EX', 604800)
return {'ok', ARGV[3]}`;
  const result = await redis(['EVAL', script, '2', keyFor(kind), dedupKey, JSON.stringify(obj), hash, obj.id]);
  if (result?.[0] === 'conflict') { const e = new Error('La solicitud ya se utilizó con otros datos. Recarga e inténtalo de nuevo.'); e.status = 409; throw e; }
  if (result?.[0] !== 'ok' || typeof result[1] !== 'string') throw new Error('Guardado no confirmado');
  return result[1];
}
async function readAll(kind) {
  const result = await redis(['LRANGE', keyFor(kind), '0', '-1']);
  if (!Array.isArray(result)) throw new Error('Lectura de Redis inválida');
  // Nunca convertir una lectura rota en un panel falsamente vacío.
  return result.map(s => {
    const r = JSON.parse(s);
    if (!r || typeof r !== 'object' || Array.isArray(r) || !r.id) throw new Error('Registro ilegible en Redis');
    return r;
  });
}

// Se busca por id dentro del script atómico; borrar una fila nunca desplaza
// el índice de otra operación. La edición comprueba además la versión leída.
async function updateById(kind, id, obj, expected) {
  const script = `local rows = redis.call('LRANGE', KEYS[1], 0, -1)
for i, row in ipairs(rows) do
  local ok, record = pcall(cjson.decode, row)
  if ok and type(record) == 'table' and record.id == ARGV[1] then
    if ARGV[3] ~= '' and row ~= ARGV[3] then return -1 end
    redis.call('LSET', KEYS[1], i-1, ARGV[2])
    return 1
  end
end
return 0`;
  const result = await redis(['EVAL', script, '1', keyFor(kind), id, JSON.stringify(obj), expected ? JSON.stringify(expected) : '']);
  if (result === -1) { const e = new Error('Otra sesión ha modificado esta respuesta. Recarga el panel antes de editarla.'); e.status = 409; throw e; }
  return result === 1;
}
async function deleteById(kind, id) {
  const script = `local rows = redis.call('LRANGE', KEYS[1], 0, -1)
for _, row in ipairs(rows) do
  local ok, record = pcall(cjson.decode, row)
  if ok and type(record) == 'table' and record.id == ARGV[1] then
    return redis.call('LREM', KEYS[1], 1, row)
  end
end
return 0`;
  return (await redis(['EVAL', script, '1', keyFor(kind), id])) === 1;
}
module.exports = { resolveCreds, isConfigured, ping, append, appendOnce, readAll, updateById, deleteById, overLimit };
