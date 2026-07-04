'use strict';

/**
 * Backend autoalojado de la boda de Raquel & Adrian.
 * ----------------------------------------------------------------------------
 * Sin dependencias externas: usa SOLO modulos nativos de Node (http, fs, path).
 * No hay `npm install` que pueda fallar, ni binarios nativos que compilar.
 * Arranca en cualquier sitio con Node 18+.
 *
 * Almacena las confirmaciones (RSVP) y las sugerencias de canciones en ficheros
 * NDJSON dentro de DATA_DIR. Cada linea es un JSON: un fichero de texto que
 * puedes copiar, mover, versionar o importar a Excel/Sheets cuando quieras.
 * 100% portable y sin dependencia de ningun proveedor.
 *
 * Ademas sirve el sitio estatico (index.html + assets), de modo que con un solo
 * comando tienes la web entera funcionando:
 *
 *     node server/server.js      ->   http://localhost:3000
 *
 * La logica de validacion, estadisticas, CSV y panel vive en ../lib/core.js,
 * compartida con las funciones serverless de Vercel (carpeta api/). Aqui solo
 * cambia el almacenamiento (ficheros en disco) y el propio servidor HTTP.
 *
 * Configuracion por variables de entorno (ver server/.env.example):
 *     PORT, HOST, ADMIN_TOKEN, ALLOW_ORIGIN, DATA_DIR
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  clean, normalizeRsvp, normalizeSong, applyRsvpEdit,
  buildStats, rsvpCsv, personasCsv, songsCsv, adminLogin, renderAdmin
} = require('../lib/core');

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'cambia-este-token';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const ROOT_DIR = path.resolve(__dirname, '..'); // sitio estatico (raiz del repo)
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const RSVP_FILE = path.join(DATA_DIR, 'rsvp.ndjson');
const SONGS_FILE = path.join(DATA_DIR, 'canciones.ndjson');
const MAX_BODY = 256 * 1024; // 256 KB por peticion

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Almacenamiento en disco (NDJSON)
// ---------------------------------------------------------------------------
function appendNdjson(file, obj) {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}
function readNdjson(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}
// Reescribe el fichero completo de forma atomica (tmp + rename). Se usa al
// editar o borrar desde el panel; a escala de una boda es instantaneo.
function rewriteNdjson(file, rows) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  fs.renameSync(tmp, file);
}
function fileFor(tipo) {
  return tipo === 'canciones' ? SONGS_FILE : (tipo === 'rsvp' ? RSVP_FILE : null);
}

// ---------------------------------------------------------------------------
// Utilidades HTTP
// ---------------------------------------------------------------------------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { req.destroy(); reject(new Error('payload-too-large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}
function authed(req, u) {
  const t = u.searchParams.get('token') || req.headers['x-admin-token'] || '';
  return Boolean(t) && t === ADMIN_TOKEN;
}

// ---------------------------------------------------------------------------
// Servir ficheros estaticos (la web)
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json'
};
const BLOCKED = [path.join(ROOT_DIR, 'server'), path.join(ROOT_DIR, '.git'), path.join(ROOT_DIR, 'lib')];

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { send(res, 400, 'Bad request'); return; }
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT_DIR, rel));
  if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + path.sep)) {
    send(res, 403, 'Forbidden'); return;
  }
  if (BLOCKED.some(b => filePath === b || filePath.startsWith(b + path.sep))) {
    send(res, 404, 'Not found'); return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { send(res, 404, 'Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = u.pathname;
  const isApi = pathname.startsWith('/api/');

  // CORS para la API
  if (isApi) {
    const ch = corsHeaders();
    for (const k in ch) res.setHeader(k, ch[k]);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  }

  try {
    // --- Salud ---
    if (pathname === '/api/health') {
      sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
      return;
    }

    // --- RSVP ---
    if (pathname === '/api/rsvp') {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'Metodo no permitido' }); return; }
      const raw = await readBody(req);
      let data;
      try { data = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, error: 'JSON invalido' }); return; }

      // Honeypot anti-bots: si el campo trampa viene relleno, fingimos exito.
      if (clean(data.website, 100)) { sendJson(res, 200, { ok: true }); return; }

      const { rec, error } = normalizeRsvp(data);
      if (error) { sendJson(res, 422, { ok: false, error }); return; }
      rec.ip = clientIp(req);
      rec.ua = clean(req.headers['user-agent'], 200);
      appendNdjson(RSVP_FILE, rec);
      console.log(`[RSVP] ${rec.asistencia.toUpperCase()} - ${rec.nombre} <${rec.email}>` +
        (rec.asistencia === 'si' ? ` / menu ${rec.menu || '-'} / +${rec.num_acompanantes} acomp.` : ''));
      sendJson(res, 200, { ok: true, id: rec.id });
      return;
    }

    // --- Sugerencia de cancion ---
    if (pathname === '/api/cancion') {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'Metodo no permitido' }); return; }
      const raw = await readBody(req);
      let data;
      try { data = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, error: 'JSON invalido' }); return; }
      if (clean(data.website, 100)) { sendJson(res, 200, { ok: true }); return; }
      const { rec, error } = normalizeSong(data);
      if (error) { sendJson(res, 422, { ok: false, error }); return; }
      rec.ip = clientIp(req);
      appendNdjson(SONGS_FILE, rec);
      console.log(`[CANCION] ${rec.cancion}${rec.artista ? ' - ' + rec.artista : ''}`);
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- Edicion desde el panel (protegido) ---
    if (pathname === '/api/update') {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'Metodo no permitido' }); return; }
      if (!authed(req, u)) { sendJson(res, 401, { ok: false, error: 'No autorizado' }); return; }
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, error: 'JSON invalido' }); return; }
      if (body.tipo !== 'rsvp') { sendJson(res, 422, { ok: false, error: 'Solo se pueden editar respuestas de RSVP.' }); return; }
      const id = String(body.id || '');
      const rows = readNdjson(RSVP_FILE);
      const idx = rows.findIndex(r => r.id === id);
      if (idx < 0) { sendJson(res, 404, { ok: false, error: 'Registro no encontrado.' }); return; }
      const { rec, error } = applyRsvpEdit(rows[idx], body.datos || {});
      if (error) { sendJson(res, 422, { ok: false, error }); return; }
      rows[idx] = rec;
      rewriteNdjson(RSVP_FILE, rows);
      console.log(`[EDIT] ${rec.nombre} <${rec.email}>`);
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- Borrado desde el panel (protegido) ---
    if (pathname === '/api/delete') {
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'Metodo no permitido' }); return; }
      if (!authed(req, u)) { sendJson(res, 401, { ok: false, error: 'No autorizado' }); return; }
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { sendJson(res, 400, { ok: false, error: 'JSON invalido' }); return; }
      const file = fileFor(body.tipo);
      const id = String(body.id || '');
      if (!file || !id) { sendJson(res, 422, { ok: false, error: 'Faltan tipo o id.' }); return; }
      const rows = readNdjson(file);
      const rest = rows.filter(r => r.id !== id);
      if (rest.length === rows.length) { sendJson(res, 404, { ok: false, error: 'Registro no encontrado.' }); return; }
      rewriteNdjson(file, rest);
      console.log(`[DELETE] ${body.tipo} ${id}`);
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- Estadisticas (protegido) ---
    if (pathname === '/api/stats') {
      if (!authed(req, u)) { sendJson(res, 401, { ok: false, error: 'No autorizado' }); return; }
      sendJson(res, 200, { ok: true, stats: buildStats(readNdjson(RSVP_FILE)) });
      return;
    }

    // --- Panel de administracion ---
    if (pathname === '/admin') {
      if (!authed(req, u)) { send(res, 401, adminLogin(), { 'Content-Type': 'text/html; charset=utf-8' }); return; }
      const rsvps = readNdjson(RSVP_FILE).reverse();
      const songs = readNdjson(SONGS_FILE).reverse();
      send(res, 200, renderAdmin(rsvps, songs, u.searchParams.get('token')), { 'Content-Type': 'text/html; charset=utf-8' });
      return;
    }

    // --- Exportaciones CSV (protegido) ---
    if (pathname === '/export/rsvp.csv') {
      if (!authed(req, u)) { send(res, 401, 'No autorizado'); return; }
      send(res, 200, rsvpCsv(readNdjson(RSVP_FILE)),
        { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rsvp.csv"' });
      return;
    }
    if (pathname === '/export/personas.csv') {
      if (!authed(req, u)) { send(res, 401, 'No autorizado'); return; }
      send(res, 200, personasCsv(readNdjson(RSVP_FILE)),
        { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="personas.csv"' });
      return;
    }
    if (pathname === '/export/canciones.csv') {
      if (!authed(req, u)) { send(res, 401, 'No autorizado'); return; }
      send(res, 200, songsCsv(readNdjson(SONGS_FILE)),
        { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="canciones.csv"' });
      return;
    }

    // --- API desconocida ---
    if (isApi) { sendJson(res, 404, { ok: false, error: 'No encontrado' }); return; }

    // --- Resto: sitio estatico ---
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Metodo no permitido'); return; }
    serveStatic(req, res, pathname);
  } catch (e) {
    if (e && e.message === 'payload-too-large') { sendJson(res, 413, { ok: false, error: 'Demasiados datos' }); return; }
    console.error('Error:', e);
    if (isApi) sendJson(res, 500, { ok: false, error: 'Error del servidor' });
    else send(res, 500, 'Error del servidor');
  }
});

server.listen(PORT, HOST, () => {
  console.log('\n  Backend de la boda en marcha');
  console.log(`  -> Web:    http://localhost:${PORT}/`);
  console.log(`  -> Panel:  http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
  console.log(`  -> Datos:  ${DATA_DIR}`);
  if (ADMIN_TOKEN === 'cambia-este-token') {
    console.log('  (!) Usa un ADMIN_TOKEN propio en produccion (variable de entorno).');
  }
  console.log('');
});
