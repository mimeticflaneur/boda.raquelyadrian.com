'use strict';

/**
 * Almacenamiento para las funciones serverless de Vercel.
 * ----------------------------------------------------------------------------
 * Usa Upstash Redis a traves de su API REST (HTTP), llamada con `fetch` nativo.
 * Sin dependencias npm. Persistente y gratuito a este volumen.
 *
 * Las variables de entorno las inyecta Vercel automaticamente al conectar una
 * base de datos Redis (Upstash) desde la pestana Storage del proyecto. El nombre
 * exacto depende del "prefijo" que elijas al conectar, asi que en vez de fijar
 * un nombre concreto, detectamos las credenciales de forma flexible:
 *   1) Nombres habituales: UPSTASH_REDIS_REST_URL / _TOKEN o KV_REST_API_URL / _TOKEN
 *   2) Si no, cualquier variable cuyo valor sea una URL https://...upstash.io
 *      (la REST URL) y cualquier *_REST_*TOKEN que no sea de solo lectura.
 * Asi funciona con cualquier prefijo sin tener que tocar nada.
 *
 * Cada confirmacion o cancion se guarda como una linea JSON dentro de una lista
 * de Redis (RPUSH); leer todo es LRANGE 0 -1. Misma idea que el NDJSON del
 * backend autoalojado, distinto soporte.
 */

const KEYS = { rsvp: 'boda:rsvp', canciones: 'boda:canciones' };

function findEnv(pred) {
  for (const k of Object.keys(process.env)) {
    const v = process.env[k];
    if (v && pred(k, v)) return v;
  }
  return '';
}

// Resuelve la URL y el token de Upstash en tiempo de ejecucion (no al cargar el
// modulo), para no depender del orden de inyeccion de variables en Vercel.
function resolveCreds() {
  const env = process.env;
  const url =
    env.UPSTASH_REDIS_REST_URL ||
    env.KV_REST_API_URL ||
    findEnv((k, v) => /URL$/i.test(k) && /^https:\/\/\S*upstash\.io/i.test(v)) ||
    findEnv((k, v) => /^https:\/\/\S*upstash\.io/i.test(v));
  const token =
    env.UPSTASH_REDIS_REST_TOKEN ||
    env.KV_REST_API_TOKEN ||
    findEnv((k) => /REST/i.test(k) && /TOKEN$/i.test(k) && !/READ_?ONLY/i.test(k));
  return { url: url || '', token: token || '' };
}

function isConfigured() {
  const { url, token } = resolveCreds();
  return Boolean(url && token);
}

async function redis(command) {
  const { url, token } = resolveCreds();
  if (!url || !token) {
    throw new Error('Redis no configurado: conecta Upstash Redis en Vercel (Storage)');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Redis ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.result;
}

// Anade un registro (objeto) al final de la lista correspondiente.
async function append(kind, obj) {
  const key = KEYS[kind];
  if (!key) throw new Error('Tipo de almacen desconocido: ' + kind);
  await redis(['RPUSH', key, JSON.stringify(obj)]);
}

// Devuelve todos los registros de un tipo, en orden cronologico.
async function readAll(kind) {
  const key = KEYS[kind];
  if (!key) throw new Error('Tipo de almacen desconocido: ' + kind);
  const result = await redis(['LRANGE', key, '0', '-1']);
  if (!Array.isArray(result)) return [];
  return result
    .map(s => { try { return JSON.parse(s); } catch { return null; } })
    .filter(r => r && typeof r === 'object');
}

// Localiza la posicion en la lista del registro con ese id.
async function findIndexById(key, id) {
  const list = await redis(['LRANGE', key, '0', '-1']);
  if (!Array.isArray(list)) return -1;
  return list.findIndex(s => {
    try { const o = JSON.parse(s); return o && o.id === id; } catch { return false; }
  });
}

// Sustituye el registro con ese id por uno nuevo (edicion desde el panel).
async function updateById(kind, id, obj) {
  const key = KEYS[kind];
  if (!key) throw new Error('Tipo de almacen desconocido: ' + kind);
  const idx = await findIndexById(key, id);
  if (idx < 0) return false;
  await redis(['LSET', key, String(idx), JSON.stringify(obj)]);
  return true;
}

// Elimina el registro con ese id: se marca con un valor unico (LSET) y se
// retira con LREM, que borra por valor exacto.
async function deleteById(kind, id) {
  const key = KEYS[kind];
  if (!key) throw new Error('Tipo de almacen desconocido: ' + kind);
  const idx = await findIndexById(key, id);
  if (idx < 0) return false;
  const tomb = JSON.stringify('__boda_borrado__' + id);
  await redis(['LSET', key, String(idx), tomb]);
  await redis(['LREM', key, '1', tomb]);
  return true;
}

module.exports = { isConfigured, append, readAll, updateById, deleteById };
