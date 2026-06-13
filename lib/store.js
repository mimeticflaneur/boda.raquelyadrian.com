'use strict';

/**
 * Almacenamiento para las funciones serverless de Vercel.
 * ----------------------------------------------------------------------------
 * Usa Upstash Redis a traves de su API REST (HTTP), llamada con `fetch` nativo.
 * Sin dependencias npm. Persistente y gratuito a este volumen.
 *
 * Las variables de entorno las inyecta Vercel automaticamente al conectar una
 * base de datos Redis (Upstash) desde la pestana Storage del proyecto. Aceptamos
 * los dos nombres habituales (Upstash y Vercel KV):
 *     UPSTASH_REDIS_REST_URL  / UPSTASH_REDIS_REST_TOKEN
 *     KV_REST_API_URL         / KV_REST_API_TOKEN
 *
 * Cada confirmacion o cancion se guarda como una linea JSON dentro de una lista
 * de Redis (RPUSH), igual que las lineas de un fichero NDJSON. Leer todo es
 * LRANGE 0 -1. Misma idea que el backend autoalojado, distinto soporte.
 */

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const KEYS = { rsvp: 'boda:rsvp', canciones: 'boda:canciones' };

function isConfigured() {
  return Boolean(URL_ && TOKEN);
}

async function redis(command) {
  if (!isConfigured()) {
    throw new Error('Redis no configurado: falta UPSTASH_REDIS_REST_URL / _TOKEN');
  }
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
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
    .filter(Boolean);
}

module.exports = { isConfigured, append, readAll };
