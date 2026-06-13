'use strict';

/**
 * Backend de la boda de Raquel & Adrian.
 * ----------------------------------------------------------------------------
 * Sin dependencias externas: usa SOLO modulos nativos de Node (http, fs, path,
 * crypto). No hay `npm install` que pueda fallar, ni binarios nativos que
 * compilar. Arranca en cualquier sitio con Node 18+.
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
 * Configuracion por variables de entorno (ver server/.env.example):
 *     PORT, HOST, ADMIN_TOKEN, ALLOW_ORIGIN, DATA_DIR
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const MENUS = ['carne', 'pescado', 'vegano'];
const SI_NO = ['si', 'no'];

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function clean(v, max) {
  if (v === undefined || v === null) return '';
  // Elimina caracteres de control y recorta a `max`.
  return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 500);
}
function oneOf(v, list, fallback) {
  const x = clean(v, 20).toLowerCase();
  return list.includes(x) ? x : (fallback !== undefined ? fallback : '');
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

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
// Normalizacion / validacion del RSVP
// ---------------------------------------------------------------------------
function normalizeRsvp(d) {
  const asistencia = oneOf(d.asistencia, SI_NO);
  if (!asistencia) return { error: 'Selecciona si asistiras o no.' };

  const nombre = clean(d.nombre, 120);
  const email = clean(d.email, 160).toLowerCase();
  if (!nombre) return { error: 'Falta el nombre.' };
  if (!email || !isEmail(email)) return { error: 'El email no es valido.' };

  const rec = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    asistencia,
    nombre,
    email
  };

  if (asistencia === 'si') {
    rec.telefono = clean(d.telefono, 40);
    rec.preboda = oneOf(d.preboda, SI_NO, 'no');
    rec.menu = oneOf(d.menu, MENUS);
    rec.alergias = clean(d.alergias, 300);

    let n = parseInt(d.num_acompanantes, 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    if (n > 10) n = 10;
    rec.num_acompanantes = n;

    rec.acompanantes = [];
    const arr = Array.isArray(d.acompanantes) ? d.acompanantes : [];
    for (let i = 0; i < n; i++) {
      const g = arr[i] || {};
      rec.acompanantes.push({
        nombre: clean(g.nombre, 120),
        contacto: clean(g.contacto, 160),
        menu: oneOf(g.menu, MENUS)
      });
    }

    rec.transporte_ida = oneOf(d.transporte_ida, SI_NO, 'no');
    rec.transporte_vuelta = oneOf(d.transporte_vuelta, SI_NO, 'no');
  }

  return { rec };
}

// ---------------------------------------------------------------------------
// Estadisticas para catering / autobus
// ---------------------------------------------------------------------------
function buildStats(rows) {
  const s = {
    total: rows.length, si: 0, no: 0, preboda: 0,
    menu: { carne: 0, pescado: 0, vegano: 0, sin_elegir: 0 },
    bus_ida: 0, bus_vuelta: 0,
    comensales: 0, acompanantes: 0
  };
  for (const r of rows) {
    if (r.asistencia === 'si') {
      s.si++;
      if (r.preboda === 'si') s.preboda++;
      if (s.menu[r.menu] !== undefined) s.menu[r.menu]++; else s.menu.sin_elegir++;
      if (r.transporte_ida === 'si') s.bus_ida++;
      if (r.transporte_vuelta === 'si') s.bus_vuelta++;
      s.comensales++;
      for (const g of (r.acompanantes || [])) {
        s.acompanantes++;
        s.comensales++;
        if (s.menu[g.menu] !== undefined) s.menu[g.menu]++; else s.menu.sin_elegir++;
      }
    } else {
      s.no++;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Exportacion CSV (con BOM para que Excel lea bien los acentos)
// ---------------------------------------------------------------------------
const BOM = '\uFEFF';
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rsvpCsv(rows) {
  const head = ['fecha', 'asistencia', 'nombre', 'email', 'telefono', 'preboda',
    'menu', 'alergias', 'num_acompanantes', 'acompanantes', 'transporte_ida', 'transporte_vuelta'];
  const lines = [head.join(',')];
  for (const r of rows) {
    const acc = (r.acompanantes || [])
      .map(g => `${g.nombre || '??'} (${g.menu || '-'}${g.contacto ? ', ' + g.contacto : ''})`)
      .join(' | ');
    lines.push([
      r.ts, r.asistencia, r.nombre, r.email, r.telefono || '', r.preboda || '',
      r.menu || '', r.alergias || '', r.num_acompanantes || 0, acc,
      r.transporte_ida || '', r.transporte_vuelta || ''
    ].map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n');
}
function songsCsv(rows) {
  const lines = ['fecha,cancion,artista,nombre'];
  for (const r of rows) {
    lines.push([r.ts, r.cancion, r.artista || '', r.nombre || ''].map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Panel de administracion (HTML)
// ---------------------------------------------------------------------------
function adminLogin() {
  return `<!doctype html><meta charset="utf-8"><title>Panel - R&A</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:18vh auto;padding:1.5rem;color:#2b2622}
h1{font-weight:500}input,button{font:inherit;padding:.7rem 1rem;width:100%;box-sizing:border-box;margin:.4rem 0;border:1px solid #ccc;border-radius:6px}
button{background:#9c4a2e;color:#fff;border:none;cursor:pointer}</style>
<h1>Panel de la boda</h1><p>Introduce el token de administracion.</p>
<form method="GET" action="/admin"><input name="token" type="password" placeholder="Token" autofocus>
<button type="submit">Entrar</button></form>`;
}

function renderAdmin(rsvps, songs, token) {
  const s = buildStats(rsvps);
  const q = 'token=' + encodeURIComponent(token || '');
  const badge = v => `<span class="b">${esc(v)}</span>`;

  const rsvpRows = rsvps.map(r => {
    const acc = (r.acompanantes || []).length
      ? '<ul class="acc">' + r.acompanantes.map(g =>
          `<li>${esc(g.nombre || '??')} - ${esc(g.menu || '-')}${g.contacto ? ' / ' + esc(g.contacto) : ''}</li>`
        ).join('') + '</ul>'
      : '-';
    const bus = r.asistencia === 'si'
      ? `${r.transporte_ida === 'si' ? 'ida' : '-'} / ${r.transporte_vuelta === 'si' ? 'vuelta' : '-'}`
      : '-';
    return `<tr class="${r.asistencia === 'no' ? 'no' : ''}">
      <td class="dt">${esc((r.ts || '').slice(0, 16).replace('T', ' '))}</td>
      <td>${r.asistencia === 'si' ? 'SI' : 'NO'}</td>
      <td><strong>${esc(r.nombre)}</strong><br><span class="mut">${esc(r.email)}${r.telefono ? ' / ' + esc(r.telefono) : ''}</span></td>
      <td>${r.preboda === 'si' ? badge('preboda') : ''}</td>
      <td>${r.menu ? esc(r.menu) : ''}${r.alergias ? `<br><span class="mut">! ${esc(r.alergias)}</span>` : ''}</td>
      <td>${acc}</td>
      <td>${bus}</td>
    </tr>`;
  }).join('');

  const songRows = songs.map(r =>
    `<tr><td class="dt">${esc((r.ts || '').slice(0, 16).replace('T', ' '))}</td>
     <td><strong>${esc(r.cancion)}</strong></td><td>${esc(r.artista || '')}</td>
     <td class="mut">${esc(r.nombre || '')}</td></tr>`
  ).join('');

  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel - R&A</title>
<style>
:root{--ink:#2b2622;--sienna:#9c4a2e;--rule:#e6e1da;--mut:#8a8580}
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;color:var(--ink);margin:0;background:#faf8f5}
header{padding:1.5rem 2rem;border-bottom:1px solid var(--rule);display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
h1{font-size:1.2rem;font-weight:600;margin:0}main{padding:2rem;max-width:1200px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem}
.card{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:1rem 1.2rem}
.card .n{font-size:1.8rem;font-weight:600;color:var(--sienna)}.card .l{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.tools a{display:inline-block;margin-right:.6rem;padding:.5rem .9rem;background:var(--ink);color:#fff;text-decoration:none;border-radius:6px;font-size:.85rem}
h2{font-size:1rem;margin:2rem 0 .8rem;border-bottom:1px solid var(--rule);padding-bottom:.4rem}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--rule);border-radius:10px;overflow:hidden;font-size:.85rem}
th,td{text-align:left;padding:.6rem .7rem;border-bottom:1px solid var(--rule);vertical-align:top}
th{background:#f3efe9;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
tr.no{opacity:.55}.mut{color:var(--mut);font-size:.8em}.dt{white-space:nowrap;color:var(--mut)}
.b{display:inline-block;background:var(--sienna);color:#fff;border-radius:4px;padding:1px 6px;font-size:.7rem}
ul.acc{margin:0;padding-left:1rem}ul.acc li{font-size:.82em}
.empty{color:var(--mut);padding:1rem}
</style>
<header><h1>Raquel &amp; Adrian - Panel</h1>
<div class="tools"><a href="/export/rsvp.csv?${q}">Descargar RSVP (CSV)</a><a href="/export/canciones.csv?${q}">Descargar canciones (CSV)</a></div>
</header>
<main>
<div class="cards">
  <div class="card"><div class="n">${s.comensales}</div><div class="l">Comensales</div></div>
  <div class="card"><div class="n">${s.si}</div><div class="l">Confirman</div></div>
  <div class="card"><div class="n">${s.no}</div><div class="l">No asisten</div></div>
  <div class="card"><div class="n">${s.preboda}</div><div class="l">Preboda (11 jun)</div></div>
  <div class="card"><div class="n">${s.menu.carne}/${s.menu.pescado}/${s.menu.vegano}</div><div class="l">Carne/Pesc./Veg.</div></div>
  <div class="card"><div class="n">${s.bus_ida}/${s.bus_vuelta}</div><div class="l">Bus ida/vuelta</div></div>
</div>
<h2>Confirmaciones (${rsvps.length})</h2>
${rsvps.length ? `<table><thead><tr><th>Fecha</th><th>Asiste</th><th>Invitado</th><th>Preboda</th><th>Menu / alergias</th><th>Acompanantes</th><th>Bus</th></tr></thead><tbody>${rsvpRows}</tbody></table>` : '<p class="empty">Aun no hay confirmaciones.</p>'}
<h2>Sugerencias de canciones (${songs.length})</h2>
${songs.length ? `<table><thead><tr><th>Fecha</th><th>Cancion</th><th>Artista</th><th>De</th></tr></thead><tbody>${songRows}</tbody></table>` : '<p class="empty">Aun no hay sugerencias.</p>'}
</main></html>`;
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
const BLOCKED = [path.join(ROOT_DIR, 'server'), path.join(ROOT_DIR, '.git')];

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
      const cancion = clean(data.cancion, 200);
      if (!cancion) { sendJson(res, 422, { ok: false, error: 'Falta la cancion' }); return; }
      const rec = {
        id: crypto.randomUUID(), ts: new Date().toISOString(),
        cancion, artista: clean(data.artista, 160), nombre: clean(data.nombre, 120),
        ip: clientIp(req)
      };
      appendNdjson(SONGS_FILE, rec);
      console.log(`[CANCION] ${rec.cancion}${rec.artista ? ' - ' + rec.artista : ''}`);
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
