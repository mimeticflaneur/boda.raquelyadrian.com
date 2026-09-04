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
        menu: oneOf(g.menu, MENUS),
        alergias: clean(g.alergias, 200)
      });
    }

    rec.transporte = oneOf(d.transporte, SI_NO, 'no');
    let tp = parseInt(d.transporte_personas, 10);
    if (!Number.isFinite(tp) || tp < 0) tp = 0;
    if (rec.transporte === 'si') {
      const maxP = 1 + rec.num_acompanantes;
      if (tp < 1) tp = 1;
      if (tp > maxP) tp = maxP;
    } else {
      tp = 0;
    }
    rec.transporte_personas = tp;
  }

  return { rec };
}

// Fusion segura: ignora las claves que envenenarian el prototipo del objeto
// resultante (JSON.parse si crea una propiedad propia llamada "__proto__").
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function safeMerge(base, patch) {
  const out = {};
  for (const src of [base || {}, patch || {}]) {
    if (!src || typeof src !== 'object') continue;
    for (const k of Object.keys(src)) {
      if (UNSAFE_KEYS.has(k)) continue;
      out[k] = src[k];
    }
  }
  return out;
}

// Aplica una edicion (desde el panel) sobre un registro existente: fusiona,
// vuelve a validar todo y conserva id, fecha original y metadatos.
function applyRsvpEdit(existing, patch) {
  existing = (existing && typeof existing === 'object') ? existing : {};
  const merged = safeMerge(existing, patch);
  if (Array.isArray(merged.acompanantes)) {
    merged.num_acompanantes = merged.acompanantes.length;
  }
  const { rec, error } = normalizeRsvp(merged);
  if (error) return { error };
  rec.id = existing.id;
  rec.ts = existing.ts;
  if (existing.ip) rec.ip = existing.ip;
  if (existing.ua) rec.ua = existing.ua;
  rec.editado = new Date().toISOString();
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
    bus: 0, bus_personas: 0,
    comensales: 0, acompanantes: 0, alergias: 0
  };
  for (const r of rows) {
    if (r.asistencia === 'si') {
      s.si++;
      if (r.preboda === 'si') s.preboda++;
      if (s.menu[r.menu] !== undefined) s.menu[r.menu]++; else s.menu.sin_elegir++;
      if (r.transporte === 'si') { s.bus++; s.bus_personas += (r.transporte_personas || 0); }
      s.comensales++;
      if (r.alergias) s.alergias++;
      for (const g of (r.acompanantes || [])) {
        s.acompanantes++;
        s.comensales++;
        if (g.alergias) s.alergias++;
        if (s.menu[g.menu] !== undefined) s.menu[g.menu]++; else s.menu.sin_elegir++;
      }
    } else {
      s.no++;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Vista "una linea por persona": el titular y, debajo, cada acompanante como
// dependiente suyo. Es la vista principal del panel y del CSV de personas.
// ---------------------------------------------------------------------------
function flattenPersons(rsvps) {
  const out = [];
  for (const r of rsvps) {
    out.push({
      registro: r.id, ts: r.ts, editado: r.editado || '',
      tipo: 'titular', dependiente_de: '',
      asistencia: r.asistencia, nombre: r.nombre,
      contacto: [r.email, r.telefono].filter(Boolean).join(' / '),
      preboda: r.asistencia === 'si' ? (r.preboda || 'no') : '',
      menu: r.menu || '', alergias: r.alergias || '',
      transporte: r.asistencia === 'si' ? (r.transporte || 'no') : '',
      transporte_personas: r.transporte === 'si' ? (r.transporte_personas || 0) : ''
    });
    if (r.asistencia === 'si') {
      for (const g of (r.acompanantes || [])) {
        out.push({
          registro: r.id, ts: r.ts, editado: r.editado || '',
          tipo: 'acompanante', dependiente_de: r.nombre,
          asistencia: 'si', nombre: g.nombre || '(sin nombre)',
          contacto: g.contacto || '',
          preboda: '', menu: g.menu || '', alergias: g.alergias || '',
          transporte: '', transporte_personas: ''
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exportacion CSV (con BOM para que Excel lea bien los acentos)
// ---------------------------------------------------------------------------
// Excel y LibreOffice ejecutan como formula toda celda que empiece por = + - @
// (o por tabulador / retorno de carro). Se antepone un apostrofo para que la
// celda se lea siempre como texto: asi un invitado no puede colar una formula
// en el CSV que abriremos nosotros. Tambien evita que un telefono "+34 600..."
// de error al abrirlo.
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rsvpCsv(rows) {
  const head = ['fecha', 'asistencia', 'nombre', 'email', 'telefono', 'preboda',
    'menu', 'alergias', 'num_acompanantes', 'acompanantes', 'transporte', 'transporte_personas'];
  const lines = [head.join(',')];
  for (const r of rows) {
    const acc = (r.acompanantes || [])
      .map(g => `${g.nombre || '??'} (${g.menu || '-'}${g.contacto ? ', ' + g.contacto : ''}${g.alergias ? ', alergias: ' + g.alergias : ''})`)
      .join(' | ');
    lines.push([
      r.ts, r.asistencia, r.nombre, r.email, r.telefono || '', r.preboda || '',
      r.menu || '', r.alergias || '', r.num_acompanantes || 0, acc,
      r.transporte || '', r.transporte === 'si' ? (r.transporte_personas || 0) : ''
    ].map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n');
}
// Una linea por persona, con la dependencia explicita.
function personasCsv(rsvps) {
  const head = ['fecha', 'tipo', 'dependiente_de', 'asistencia', 'nombre', 'contacto',
    'preboda', 'menu', 'alergias', 'transporte', 'transporte_personas', 'registro'];
  const lines = [head.join(',')];
  for (const p of flattenPersons(rsvps)) {
    lines.push([
      p.ts, p.tipo, p.dependiente_de, p.asistencia, p.nombre, p.contacto,
      p.preboda, p.menu, p.alergias, p.transporte, p.transporte_personas, p.registro
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
// Panel de administracion (HTML) — misma estetica editorial que la web:
// papel calido, sienna, Bodoni Moda para display y Jost para interfaz.
// ---------------------------------------------------------------------------
const ADMIN_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400;1,6..96,500&family=Jost:ital,wght@0,300;0,400;0,500&display=swap" rel="stylesheet">`;

const ADMIN_CSS = `
:root{--ink:#111;--paper:#f5f2ec;--warm:#eae5db;--dark:#161413;--sienna:#9e4a2f;--sienna-soft:#c17a5a;--mute:#6b6661;--rule:rgba(0,0,0,0.09)}
*{box-sizing:border-box;margin:0}
body{font-family:'Jost',sans-serif;font-weight:300;background:var(--paper);color:var(--ink);min-height:100vh}
body::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.35;
  background-image:radial-gradient(rgba(17,17,17,0.045) 1px,transparent 1px);background-size:22px 22px}
a{color:inherit}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(1rem,4vw,2.5rem) 5rem;position:relative}
header.top{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:1rem;
  padding:2.2rem 0 1.6rem;border-bottom:1px solid var(--ink)}
.brand{display:flex;align-items:baseline;gap:1rem}
.brand h1{font-family:'Bodoni Moda',serif;font-weight:400;font-size:clamp(1.6rem,3vw,2.1rem);letter-spacing:-.01em}
.brand h1 em{font-style:italic;color:var(--sienna)}
.brand .tag{font-size:.62rem;text-transform:uppercase;letter-spacing:.3em;color:var(--mute)}
.tools{display:flex;gap:.5rem;flex-wrap:wrap}
.tools a{font-size:.6rem;text-transform:uppercase;letter-spacing:.2em;text-decoration:none;
  border:1px solid var(--ink);padding:.55rem .9rem;transition:all .25s}
.tools a:hover{background:var(--ink);color:var(--paper)}
.tools a.accent{background:var(--ink);color:var(--paper)}
.tools a.accent:hover{background:var(--sienna);border-color:var(--sienna)}
.tools a.salir{border-color:var(--rule);color:var(--mute)}
.tools a.salir:hover{background:var(--sienna);border-color:var(--sienna);color:var(--paper)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;margin:2rem 0 2.6rem;
  border:1px solid var(--rule);background:#fffdf9}
.card{padding:1.15rem 1.2rem 1rem;border-right:1px solid var(--rule)}
.card:last-child{border-right:none}
.card .n{font-family:'Bodoni Moda',serif;font-size:2rem;line-height:1;color:var(--ink)}
.card .n small{font-size:1rem;color:var(--mute)}
.card.hl .n{color:var(--sienna)}
.card .l{font-size:.58rem;text-transform:uppercase;letter-spacing:.18em;color:var(--mute);margin-top:.45rem}
h2.sec{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.25rem;margin:2.6rem 0 1rem;display:flex;align-items:baseline;gap:.7rem}
h2.sec em{font-style:italic;color:var(--sienna)}
h2.sec .count{font-family:'Jost',sans-serif;font-size:.62rem;letter-spacing:.2em;color:var(--mute);text-transform:uppercase}
h2.sec::after{content:'';flex:1;height:1px;background:var(--rule)}
table{width:100%;border-collapse:collapse;font-size:.84rem;background:#fffdf9;border:1px solid var(--rule)}
th{font-size:.58rem;text-transform:uppercase;letter-spacing:.18em;color:var(--mute);font-weight:500;
  text-align:left;padding:.7rem .75rem;border-bottom:1px solid var(--ink);background:var(--warm)}
td{padding:.65rem .75rem;border-bottom:1px solid var(--rule);vertical-align:top}
tr:last-child td{border-bottom:none}
tr.dep td{background:rgba(234,229,219,0.45)}
tr.dep td:first-child{padding-left:1.8rem}
tr.off td{opacity:.5}
tr:hover td{background:rgba(158,74,47,0.05)}
.nm{font-weight:400;font-size:.92rem}
.nm .ct{display:block;font-size:.72rem;color:var(--mute);margin-top:.1rem}
.chip{display:inline-block;font-size:.58rem;text-transform:uppercase;letter-spacing:.14em;
  padding:.18rem .5rem;border:1px solid currentColor;border-radius:99px;white-space:nowrap}
.chip.tit{color:var(--sienna)}
.chip.dep{color:var(--mute);border-style:dashed}
.chip.no{color:#8a3b2b;background:rgba(158,74,47,.07);border-color:transparent}
.chip.ok{color:#3d5a3d;background:rgba(61,90,61,.08);border-color:transparent}
.al{color:var(--sienna);font-size:.78rem}
.dt{white-space:nowrap;color:var(--mute);font-size:.72rem}
.dt .ed{display:block;font-style:italic;font-size:.65rem;color:var(--sienna-soft)}
.acts{white-space:nowrap;text-align:right}
.btn{font-family:'Jost',sans-serif;font-size:.58rem;text-transform:uppercase;letter-spacing:.16em;
  background:none;border:1px solid var(--rule);padding:.35rem .6rem;cursor:pointer;color:var(--mute);transition:all .2s}
.btn:hover{border-color:var(--ink);color:var(--ink)}
.btn.danger:hover{border-color:var(--sienna);color:var(--sienna)}
.empty{padding:2.2rem;text-align:center;color:var(--mute);font-style:italic;background:#fffdf9;border:1px solid var(--rule)}
.tblwrap{overflow-x:auto}
/* --- modal de edicion --- */
.overlay{position:fixed;inset:0;background:rgba(17,17,17,.45);backdrop-filter:blur(2px);
  display:none;align-items:flex-start;justify-content:center;padding:4vh 1rem;overflow-y:auto;z-index:50}
.overlay.open{display:flex}
.modal{background:var(--paper);border:1px solid var(--ink);max-width:640px;width:100%;padding:2rem clamp(1.2rem,3vw,2.4rem) 2.2rem;position:relative}
.modal::before{content:'';position:absolute;inset:6px;border:1px solid var(--rule);pointer-events:none}
.modal h3{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.5rem;margin-bottom:.2rem}
.modal h3 em{font-style:italic;color:var(--sienna)}
.modal .sub{font-size:.72rem;color:var(--mute);margin-bottom:1.4rem}
.f{margin-bottom:1.05rem}
.f label{display:block;font-size:.58rem;text-transform:uppercase;letter-spacing:.18em;color:var(--mute);margin-bottom:.3rem}
.f input,.f select{width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--rule);background:transparent;
  font-family:'Jost',sans-serif;font-weight:300;font-size:.95rem;color:var(--ink);border-radius:0;-webkit-appearance:none}
.f select{cursor:pointer;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Cpath d='M2 3l3 4 3-4' stroke='%236b6661' fill='none' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right center}
.f input:focus,.f select:focus{outline:none;border-bottom-color:var(--sienna)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 1.4rem}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.gblock{border:1px solid var(--rule);background:#fffdf9;padding:1rem 1rem .4rem;margin-bottom:.8rem;position:relative}
.gblock .gtit{font-size:.58rem;text-transform:uppercase;letter-spacing:.18em;color:var(--sienna);margin-bottom:.6rem}
.gblock .rm{position:absolute;top:.6rem;right:.6rem}
.addg{width:100%;padding:.6rem;border:1px dashed var(--rule);background:none;cursor:pointer;
  font-family:'Jost',sans-serif;font-size:.62rem;text-transform:uppercase;letter-spacing:.18em;color:var(--mute);transition:all .2s}
.addg:hover{border-color:var(--sienna);color:var(--sienna)}
.mact{display:flex;gap:.7rem;justify-content:flex-end;margin-top:1.6rem}
.mact .save{background:var(--ink);color:var(--paper);border:1px solid var(--ink);padding:.7rem 1.6rem;
  font-family:'Jost',sans-serif;font-size:.62rem;text-transform:uppercase;letter-spacing:.2em;cursor:pointer;transition:all .25s}
.mact .save:hover{background:var(--sienna);border-color:var(--sienna)}
.mact .cancel{background:none;border:1px solid var(--rule);padding:.7rem 1.2rem;
  font-family:'Jost',sans-serif;font-size:.62rem;text-transform:uppercase;letter-spacing:.2em;cursor:pointer;color:var(--mute)}
.mact .cancel:hover{border-color:var(--ink);color:var(--ink)}
.err{display:none;color:var(--sienna);font-size:.78rem;margin-top:.8rem}
.foot{margin-top:3.5rem;padding-top:1.2rem;border-top:1px solid var(--rule);display:flex;justify-content:space-between;
  font-size:.6rem;text-transform:uppercase;letter-spacing:.2em;color:var(--mute)}
.orn{font-family:'Bodoni Moda',serif;color:var(--sienna)}
`;

// Pantalla de acceso. `motivo` distingue los tres estados que antes eran
// indistinguibles: primera visita, token equivocado y —el peor— ADMIN_TOKEN
// sin configurar en el servidor, que dejaba al usuario en un bucle de login
// sin explicacion posible.
function adminLogin(motivo) {
  const sinConfigurar = motivo === 'sin-configurar';
  const aviso = sinConfigurar
    ? `<p class="aviso aviso-fatal">El panel no tiene token de acceso configurado, así que
       ahora mismo no puede entrar nadie.<br><br>Solución: en Vercel, entra en el proyecto →
       <b>Settings</b> → <b>Environment Variables</b>, crea <b>ADMIN_TOKEN</b> con la
       contraseña que quieras y vuelve a desplegar.</p>`
    : (motivo === 'incorrecto'
      ? '<p class="aviso">Ese token no es correcto. Inténtalo otra vez.</p>'
      : '');

  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Panel — R&A</title>
${ADMIN_FONTS}
<style>${ADMIN_CSS}
.login{max-width:400px;margin:14vh auto 0;padding:2.4rem 2.2rem;background:var(--paper);border:1px solid var(--ink);position:relative}
.login::before{content:'';position:absolute;inset:6px;border:1px solid var(--rule);pointer-events:none}
.login h1{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.7rem;text-align:center}
.login h1 em{font-style:italic;color:var(--sienna)}
.login p.sub{font-size:.72rem;color:var(--mute);text-align:center;margin:.4rem 0 1.6rem;text-transform:uppercase;letter-spacing:.18em}
.login input{width:100%;padding:.7rem 0;border:none;border-bottom:1px solid var(--rule);background:transparent;
  font-family:'Jost',sans-serif;font-size:1rem;text-align:center;letter-spacing:.1em}
.login input:focus{outline:none;border-bottom-color:var(--sienna)}
.login button{width:100%;margin-top:1.4rem;padding:.85rem;background:var(--ink);color:var(--paper);border:none;cursor:pointer;
  font-family:'Jost',sans-serif;font-size:.62rem;text-transform:uppercase;letter-spacing:.25em;transition:background .25s}
.login button:hover{background:var(--sienna)}
.aviso{font-size:.82rem;line-height:1.6;color:var(--sienna);background:rgba(158,74,47,.07);
  border-left:2px solid var(--sienna);padding:.8rem .9rem;margin-bottom:1.4rem;text-align:left}
.aviso-fatal b{font-weight:500}
</style>
<body><form class="login" method="POST" action="/admin">
<h1>Raquel <em>&amp;</em> Adri&aacute;n</h1><p class="sub">Panel de la boda</p>
${aviso}
${sinConfigurar ? '' : `<input name="token" type="password" placeholder="Token de acceso" autofocus autocomplete="current-password">
<button type="submit">Entrar</button>`}
</form></body></html>`;
}

// El panel ya no necesita el token: la sesion va en una cookie HttpOnly que el
// navegador manda sola, tanto en las descargas de CSV como en las llamadas a
// la API. Asi el token no aparece ni en la URL ni en el codigo de la pagina.
function renderAdmin(rsvps, songs) {
  const s = buildStats(rsvps);
  const persons = flattenPersons(rsvps);

  const rows = persons.map(p => {
    const isDep = p.tipo === 'acompanante';
    const off = p.asistencia === 'no';
    const rel = off
      ? '<span class="chip no">No asiste</span>'
      : (isDep
        ? '<span class="chip dep">Dependiente de ' + esc(p.dependiente_de) + '</span>'
        : '<span class="chip tit">Titular</span>');
    const preboda = p.preboda === 'si' ? '<span class="chip ok">Preboda</span>' : (p.preboda === 'no' ? '<span style="color:var(--mute)">—</span>' : '');
    const bus = p.transporte === 'si' ? (p.transporte_personas + ' pers.') : (p.transporte === 'no' ? '—' : '');
    const fecha = '<span class="dt">' + esc((p.ts || '').slice(0, 16).replace('T', ' ')) +
      (p.editado ? '<span class="ed">editado</span>' : '') + '</span>';
    const acts = isDep
      ? '<button class="btn" onclick="openEdit(\'' + p.registro + '\')">Editar</button>'
      : '<button class="btn" onclick="openEdit(\'' + p.registro + '\')">Editar</button> ' +
        '<button class="btn danger" onclick="delResp(\'' + p.registro + '\', this)">Eliminar</button>';
    return '<tr class="' + (isDep ? 'dep' : '') + (off ? ' off' : '') + '">' +
      '<td class="nm">' + esc(p.nombre) + (p.contacto ? '<span class="ct">' + esc(p.contacto) + '</span>' : '') + '</td>' +
      '<td>' + rel + '</td>' +
      '<td>' + (p.menu ? esc(p.menu) : '') + '</td>' +
      '<td>' + (p.alergias ? '<span class="al">' + esc(p.alergias) + '</span>' : '') + '</td>' +
      '<td>' + preboda + '</td>' +
      '<td>' + bus + '</td>' +
      '<td>' + fecha + '</td>' +
      '<td class="acts">' + acts + '</td></tr>';
  }).join('');

  const songRows = songs.map(r =>
    '<tr><td class="nm">' + esc(r.cancion) + '</td><td>' + esc(r.artista || '') + '</td>' +
    '<td style="color:var(--mute)">' + esc(r.nombre || '') + '</td>' +
    '<td><span class="dt">' + esc((r.ts || '').slice(0, 16).replace('T', ' ')) + '</span></td>' +
    '<td class="acts"><button class="btn danger" onclick="delSong(\'' + r.id + '\', this)">Eliminar</button></td></tr>'
  ).join('');

  const dataJson = JSON.stringify(rsvps).replace(/</g, '\\u003c');

  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Panel — R&A</title>
${ADMIN_FONTS}
<style>${ADMIN_CSS}</style>
<body><div class="wrap">
<header class="top">
  <div class="brand"><h1>Raquel <em>&amp;</em> Adrián</h1><span class="tag">Panel · 12.06.2027</span></div>
  <nav class="tools">
    <a class="accent" href="/export/personas.csv">CSV por persona</a>
    <a href="/export/rsvp.csv">CSV respuestas</a>
    <a href="/export/canciones.csv">CSV canciones</a>
    <a href="/admin?logout=1" class="salir">Salir</a>
  </nav>
</header>

<div class="cards">
  <div class="card hl"><div class="n">${s.comensales}</div><div class="l">Comensales</div></div>
  <div class="card"><div class="n">${s.si}<small> +${s.acompanantes}</small></div><div class="l">Titulares + acomp.</div></div>
  <div class="card"><div class="n">${s.no}</div><div class="l">No asisten</div></div>
  <div class="card"><div class="n">${s.preboda}</div><div class="l">Preboda · 11 jun</div></div>
  <div class="card"><div class="n">${s.menu.carne}·${s.menu.pescado}·${s.menu.vegano}</div><div class="l">Carne · Pescado · Vegano</div></div>
  <div class="card"><div class="n">${s.bus_personas}</div><div class="l">Personas en bus</div></div>
  <div class="card"><div class="n">${s.alergias}</div><div class="l">Con alergias</div></div>
</div>

<h2 class="sec">Invitados <em>persona a persona</em> <span class="count">${persons.length} filas · ${rsvps.length} respuestas</span></h2>
${persons.length ? `<div class="tblwrap"><table>
<thead><tr><th>Invitado</th><th>Relación</th><th>Menú</th><th>Alergias</th><th>Preboda</th><th>Autobús</th><th>Registrado</th><th></th></tr></thead>
<tbody>${rows}</tbody></table></div>` : '<div class="empty">Aún no hay confirmaciones.</div>'}

<h2 class="sec">Canciones <em>sugeridas</em> <span class="count">${songs.length}</span></h2>
${songs.length ? `<div class="tblwrap"><table>
<thead><tr><th>Canción</th><th>Artista</th><th>De</th><th>Fecha</th><th></th></tr></thead>
<tbody>${songRows}</tbody></table></div>` : '<div class="empty">Aún no hay sugerencias.</div>'}

<footer class="foot"><span>Los datos son vuestros — exportables siempre</span><span class="orn">R&A</span></footer>
</div>

<div class="overlay" id="ov" onclick="if(event.target===this)closeEdit()">
  <div class="modal">
    <h3>Editar <em>respuesta</em></h3>
    <p class="sub" id="m-sub"></p>
    <form id="m-form" onsubmit="saveEdit(event)">
      <div class="grid2">
        <div class="f"><label>Asistencia</label>
          <select id="m-asistencia" onchange="toggleSi()"><option value="si">Sí, asiste</option><option value="no">No asiste</option></select></div>
        <div class="f"><label>Nombre</label><input id="m-nombre" required></div>
        <div class="f"><label>Email</label><input id="m-email" type="email" required></div>
        <div class="f si"><label>Teléfono</label><input id="m-telefono"></div>
        <div class="f si"><label>Preboda (vie 11)</label>
          <select id="m-preboda"><option value="si">Sí</option><option value="no">No</option></select></div>
        <div class="f si"><label>Menú</label>
          <select id="m-menu"><option value="">—</option><option value="carne">Carne</option><option value="pescado">Pescado</option><option value="vegano">Vegano</option></select></div>
        <div class="f si"><label>Alergias e intolerancias</label><input id="m-alergias"></div>
        <div class="f si"><label>Autobús</label>
          <select id="m-transporte" onchange="togglePers()"><option value="si">Sí</option><option value="no">No</option></select></div>
        <div class="f si" id="f-pers"><label>Personas en el bus</label><input id="m-personas" type="number" min="1" max="11"></div>
      </div>
      <div class="si">
        <div class="f" style="margin-bottom:.5rem"><label>Acompañantes (dependientes de esta respuesta)</label></div>
        <div id="m-acomps"></div>
        <button type="button" class="addg" onclick="addAcomp()">+ Añadir acompañante</button>
      </div>
      <p class="err" id="m-err"></p>
      <div class="mact">
        <button type="button" class="cancel" onclick="closeEdit()">Cancelar</button>
        <button type="submit" class="save" id="m-save">Guardar cambios</button>
      </div>
    </form>
  </div>
</div>

<script>
var DATA = ${dataJson};
var CUR = null;

function byId(id){ for(var i=0;i<DATA.length;i++) if(DATA[i].id===id) return DATA[i]; return null; }
function $(id){ return document.getElementById(id); }

function toggleSi(){
  var si = $('m-asistencia').value === 'si';
  var els = document.querySelectorAll('.si');
  for(var i=0;i<els.length;i++) els[i].style.display = si ? '' : 'none';
  if(si) togglePers();
}
function togglePers(){
  $('f-pers').style.display = $('m-transporte').value === 'si' ? '' : 'none';
}

function acompBlock(i, g){
  g = g || {};
  var h = '<div class="gblock" data-i="'+i+'">'
    + '<div class="gtit">Acompañante</div>'
    + '<button type="button" class="btn danger rm" onclick="this.parentNode.remove()">Quitar</button>'
    + '<div class="grid2">'
    + '<div class="f"><label>Nombre</label><input class="ga-nombre" value="'+escA(g.nombre)+'"></div>'
    + '<div class="f"><label>Contacto</label><input class="ga-contacto" value="'+escA(g.contacto)+'"></div>'
    + '<div class="f"><label>Menú</label><select class="ga-menu">'
    + opt('',g.menu,'—')+opt('carne',g.menu,'Carne')+opt('pescado',g.menu,'Pescado')+opt('vegano',g.menu,'Vegano')
    + '</select></div>'
    + '<div class="f"><label>Alergias</label><input class="ga-alergias" value="'+escA(g.alergias)+'"></div>'
    + '</div></div>';
  return h;
}
function opt(v, cur, label){ return '<option value="'+v+'"'+(v===(cur||'')?' selected':'')+'>'+label+'</option>'; }
function escA(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function addAcomp(){
  var div = document.createElement('div');
  div.innerHTML = acompBlock(Date.now(), {});
  $('m-acomps').appendChild(div.firstChild);
}

function openEdit(id){
  var r = byId(id); if(!r) return;
  CUR = id;
  $('m-sub').textContent = 'Registrado el ' + (r.ts||'').slice(0,16).replace('T',' ') + (r.editado ? ' · última edición ' + r.editado.slice(0,16).replace('T',' ') : '');
  $('m-asistencia').value = r.asistencia || 'si';
  $('m-nombre').value = r.nombre || '';
  $('m-email').value = r.email || '';
  $('m-telefono').value = r.telefono || '';
  $('m-preboda').value = r.preboda || 'no';
  $('m-menu').value = r.menu || '';
  $('m-alergias').value = r.alergias || '';
  $('m-transporte').value = r.transporte || 'no';
  $('m-personas').value = r.transporte_personas || 1;
  var box = $('m-acomps'); box.innerHTML = '';
  var acc = r.acompanantes || [];
  for(var i=0;i<acc.length;i++){
    var d = document.createElement('div'); d.innerHTML = acompBlock(i, acc[i]); box.appendChild(d.firstChild);
  }
  $('m-err').style.display = 'none';
  toggleSi();
  $('ov').classList.add('open');
}
function closeEdit(){ $('ov').classList.remove('open'); CUR = null; }

function collect(){
  var acomps = [];
  var blocks = document.querySelectorAll('#m-acomps .gblock');
  for(var i=0;i<blocks.length;i++){
    var b = blocks[i];
    acomps.push({
      nombre: b.querySelector('.ga-nombre').value.trim(),
      contacto: b.querySelector('.ga-contacto').value.trim(),
      menu: b.querySelector('.ga-menu').value,
      alergias: b.querySelector('.ga-alergias').value.trim()
    });
  }
  return {
    asistencia: $('m-asistencia').value,
    nombre: $('m-nombre').value.trim(),
    email: $('m-email').value.trim(),
    telefono: $('m-telefono').value.trim(),
    preboda: $('m-preboda').value,
    menu: $('m-menu').value,
    alergias: $('m-alergias').value.trim(),
    acompanantes: acomps,
    num_acompanantes: acomps.length,
    transporte: $('m-transporte').value,
    transporte_personas: parseInt($('m-personas').value, 10) || 1
  };
}

function api(path, body){
  // La cookie de sesion viaja sola al ser mismo origen; no hace falta token.
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r){
    if(r.status === 401){ location.href = '/admin'; return { ok: false, j: {} }; }
    return r.json().then(function(j){ return { ok: r.ok && j.ok !== false, j: j }; });
  });
}

function saveEdit(ev){
  ev.preventDefault();
  if(!CUR) return;
  var btn = $('m-save'); var t = btn.textContent;
  btn.textContent = 'Guardando…'; btn.disabled = true;
  api('/api/update', { tipo: 'rsvp', id: CUR, datos: collect() }).then(function(res){
    if(res.ok){ location.reload(); }
    else {
      btn.textContent = t; btn.disabled = false;
      var e = $('m-err'); e.textContent = (res.j && res.j.error) || 'No se pudo guardar.'; e.style.display = 'block';
    }
  }).catch(function(){
    btn.textContent = t; btn.disabled = false;
    var e = $('m-err'); e.textContent = 'Error de conexión.'; e.style.display = 'block';
  });
}

function delResp(id, btn){
  var r = byId(id); if(!r) return;
  var extra = (r.acompanantes && r.acompanantes.length) ? ' y sus ' + r.acompanantes.length + ' acompañante(s)' : '';
  if(!confirm('¿Eliminar la respuesta de "' + r.nombre + '"' + extra + '? Esta acción no se puede deshacer.')) return;
  btn.textContent = '…'; btn.disabled = true;
  api('/api/delete', { tipo: 'rsvp', id: id }).then(function(res){
    if(res.ok) location.reload(); else { btn.textContent = 'Eliminar'; btn.disabled = false; alert('No se pudo eliminar.'); }
  }).catch(function(){ btn.textContent = 'Eliminar'; btn.disabled = false; alert('Error de conexión.'); });
}
function delSong(id, btn){
  if(!confirm('¿Eliminar esta sugerencia?')) return;
  btn.textContent = '…'; btn.disabled = true;
  api('/api/delete', { tipo: 'canciones', id: id }).then(function(res){
    if(res.ok) location.reload(); else { btn.textContent = 'Eliminar'; btn.disabled = false; alert('No se pudo eliminar.'); }
  }).catch(function(){ btn.textContent = 'Eliminar'; btn.disabled = false; alert('Error de conexión.'); });
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeEdit(); });
</script>
</body></html>`;
}

module.exports = {
  MENUS, SI_NO, BOM,
  clean, oneOf, isEmail, esc,
  normalizeRsvp, normalizeSong, applyRsvpEdit,
  buildStats, flattenPersons,
  csvCell, rsvpCsv, personasCsv, songsCsv,
  adminLogin, renderAdmin
};
