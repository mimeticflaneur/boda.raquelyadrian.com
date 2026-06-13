'use strict';

/**
 * Logica compartida de la boda (sin estado, sin red, sin disco).
 * ----------------------------------------------------------------------------
 * La usan TANTO el backend autoalojado (server/server.js, guarda en ficheros)
 * COMO las funciones serverless de Vercel (api/*, guardan en Upstash Redis).
 * Asi la validacion, las estadisticas, el CSV y el panel se comportan igual en
 * los dos sitios: una sola fuente de verdad.
 */

const crypto = require('crypto');

const MENUS = ['carne', 'pescado', 'vegano'];
const SI_NO = ['si', 'no'];
const BOM = '\uFEFF';

// ---------------------------------------------------------------------------
// Saneado / validacion basica
// ---------------------------------------------------------------------------
function clean(v, max) {
  if (v === undefined || v === null) return '';
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

// ---------------------------------------------------------------------------
// Normalizacion del RSVP y de las canciones
// ---------------------------------------------------------------------------
function normalizeRsvp(d) {
  d = d || {};
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

function normalizeSong(d) {
  d = d || {};
  const cancion = clean(d.cancion, 200);
  if (!cancion) return { error: 'Falta la cancion' };
  return {
    rec: {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      cancion,
      artista: clean(d.artista, 160),
      nombre: clean(d.nombre, 120)
    }
  };
}

// ---------------------------------------------------------------------------
// Estadisticas (catering / autobus)
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

module.exports = {
  MENUS, SI_NO, BOM,
  clean, oneOf, isEmail, esc,
  normalizeRsvp, normalizeSong,
  buildStats, csvCell, rsvpCsv, songsCsv,
  adminLogin, renderAdmin
};
