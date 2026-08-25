'use strict';

/**
 * Pruebas de estres del "data ingest" de la boda.
 * ----------------------------------------------------------------------------
 * Todo lo que un invitado escribe pasa por lib/core.js antes de guardarse, de
 * exportarse a CSV o de pintarse en el panel. Aqui se le mete de todo —basura,
 * cadenas kilometricas, emojis, intentos de inyeccion, tipos imposibles— y se
 * comprueba que:
 *
 *   1. Nunca lanza una excepcion (una excepcion = confirmacion perdida).
 *   2. Lo que sale cumple SIEMPRE las mismas reglas (menus validos, plazas de
 *      autobus que no superan al grupo, acompanantes cuadrados...).
 *   3. Nadie puede colar HTML en el panel ni formulas en el CSV.
 *
 * Sin dependencias: se ejecuta con `npm test` o `node test/ingest.test.js`.
 */

const {
  MENUS, isEmail,
  normalizeRsvp, normalizeSong, applyRsvpEdit,
  buildStats, flattenPersons,
  rsvpCsv, personasCsv, songsCsv,
  renderAdmin
} = require('../lib/core');

// ---------------------------------------------------------------------------
// Mini-arnes de pruebas
// ---------------------------------------------------------------------------
let pasadas = 0;
const fallos = [];
const resumen = [];

function check(nombre, fn) {
  try {
    fn();
    pasadas++;
  } catch (e) {
    fallos.push({ nombre, error: e.message });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'condicion falsa');
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'valores distintos'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

// ---------------------------------------------------------------------------
// Material hostil para el fuzzing
// ---------------------------------------------------------------------------
const LARGA = 'a'.repeat(10000);
const ACENTOS = 'ñÁéíóú'.repeat(2000);

const VALORES = [
  undefined, null, '', '   ', 0, -1, 1.5, NaN, Infinity, -Infinity,
  true, false, [], {}, [1, 2, 3], { a: 1 }, () => 1,
  'si', 'SI', ' Si ', 'no', 'NO', 'sí', 'quiza', 'carne', 'CARNE', 'pescado',
  'vegano', 'marisco', '0', '1', '5', '11', '-3', '99999', '3.7', '1e309',
  LARGA, ACENTOS, '👰🏻‍♀️🤵🏻‍♂️💍', 'Mª José Ñoño-Pérez',
  'salto\nde\nlinea', 'tab\there', 'nulo\u0000byte', 'del\u007f',
  'con,coma', 'con;punto', 'con"comilla', "con'apostrofo",
  '=1+1', '+34600111222', '-2+3', '@SUM(A1:A9)', '=HYPERLINK("http://x","clic")',
  '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', '</script>',
  "' OR 1=1 --", '${7*7}', '{{7*7}}', '__proto__', 'constructor',
  'a@b.c', 'nombre.apellido@dominio.es', 'no-es-un-email', 'a@b', '@b.c',
  'a b@c.d', 'a@b.c ', ' A@B.C '
];

// Generador deterministra (mismo resultado en cada ejecucion: si falla, falla
// siempre y se puede depurar).
let semilla = 20270612;
function rnd() {
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla / 2147483648;
}
function elige(arr) { return arr[Math.floor(rnd() * arr.length)]; }

// Los tres campos obligatorios se rellenan con algo valido la mitad de las
// veces; si no, casi ningun payload aleatorio pasaria la validacion y el
// fuzzing solo probaria el camino de los rechazos.
const VALIDOS = {
  asistencia: ['si', 'no', 'SI', ' Si ', 'NO'],
  nombre: ['Raquel', 'Adrián Zapatera', 'Mª José Ñoño-Pérez', 'O\'Hara "Pepe"', '👰🏻‍♀️'],
  email: ['a@b.c', 'invitado@ejemplo.es', 'Nombre.Apellido@Dominio.ES']
};
function campo(nombre) {
  return (rnd() < 0.55 && VALIDOS[nombre]) ? elige(VALIDOS[nombre]) : elige(VALORES);
}

function payloadAleatorio() {
  const p = {
    asistencia: campo('asistencia'),
    nombre: campo('nombre'),
    email: campo('email'),
    telefono: elige(VALORES),
    preboda: elige(VALORES),
    menu: elige(VALORES),
    alergias: elige(VALORES),
    num_acompanantes: elige(VALORES),
    transporte: elige(VALORES),
    transporte_personas: elige(VALORES)
  };
  const forma = rnd();
  if (forma < 0.6) {
    const n = Math.floor(rnd() * 14);
    p.acompanantes = [];
    for (let i = 0; i < n; i++) {
      p.acompanantes.push(rnd() < 0.15 ? elige(VALORES) : {
        nombre: elige(VALORES), contacto: elige(VALORES),
        menu: elige(VALORES), alergias: elige(VALORES)
      });
    }
  } else if (forma < 0.8) {
    p.acompanantes = elige(VALORES);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Invariantes: lo que TIENE que cumplir todo registro guardado
// ---------------------------------------------------------------------------
const SIN_CONTROL = /[\u0000-\u001f\u007f]/;

function compruebaInvariantes(rec) {
  assert(['si', 'no'].includes(rec.asistencia), 'asistencia invalida: ' + rec.asistencia);
  assert(typeof rec.nombre === 'string' && rec.nombre.length > 0, 'nombre vacio');
  assert(rec.nombre.length <= 120, 'nombre sin recortar: ' + rec.nombre.length);
  assert(isEmail(rec.email), 'email invalido: ' + rec.email);
  assert(typeof rec.id === 'string' && rec.id.length === 36, 'id no es un uuid');
  assert(!isNaN(Date.parse(rec.ts)), 'fecha invalida');

  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'string') assert(!SIN_CONTROL.test(v), `caracter de control en ${k}`);
  }

  if (rec.asistencia === 'no') {
    assertEq(rec.menu, undefined, 'un "no" no deberia traer menu');
    assertEq(rec.acompanantes, undefined, 'un "no" no deberia traer acompanantes');
    return;
  }

  assert(MENUS.includes(rec.menu) || rec.menu === '', 'menu invalido: ' + rec.menu);
  assert(['si', 'no'].includes(rec.preboda), 'preboda invalida: ' + rec.preboda);
  assert(Number.isInteger(rec.num_acompanantes), 'num_acompanantes no entero');
  assert(rec.num_acompanantes >= 0 && rec.num_acompanantes <= 10, 'num_acompanantes fuera de rango: ' + rec.num_acompanantes);
  assert(Array.isArray(rec.acompanantes), 'acompanantes no es lista');
  assertEq(rec.acompanantes.length, rec.num_acompanantes, 'acompanantes descuadrados');

  for (const g of rec.acompanantes) {
    assert(g && typeof g === 'object', 'acompanante no es objeto');
    assert(MENUS.includes(g.menu) || g.menu === '', 'menu de acompanante invalido: ' + g.menu);
    for (const [k, v] of Object.entries(g)) {
      assert(typeof v === 'string', `campo ${k} de acompanante no es texto`);
      assert(!SIN_CONTROL.test(v), `caracter de control en acompanante.${k}`);
    }
    assert(g.nombre.length <= 120, 'nombre de acompanante sin recortar');
  }

  assert(['si', 'no'].includes(rec.transporte), 'transporte invalido: ' + rec.transporte);
  assert(Number.isInteger(rec.transporte_personas), 'plazas no enteras');
  if (rec.transporte === 'no') {
    assertEq(rec.transporte_personas, 0, 'plazas sin autobus');
  } else {
    assert(rec.transporte_personas >= 1, 'autobus con 0 plazas');
    assert(rec.transporte_personas <= 1 + rec.num_acompanantes,
      `mas plazas (${rec.transporte_personas}) que personas (${1 + rec.num_acompanantes})`);
  }
}

// ---------------------------------------------------------------------------
// 1 · Casos normales
// ---------------------------------------------------------------------------
check('acepta una confirmacion completa', () => {
  const { rec, error } = normalizeRsvp({
    asistencia: 'si', nombre: 'Raquel Ejemplo', email: 'Raquel@Ejemplo.ES',
    telefono: '600 11 22 33', preboda: 'si', menu: 'pescado', alergias: 'marisco',
    num_acompanantes: 2,
    acompanantes: [
      { nombre: 'Uno', menu: 'carne' },
      { nombre: 'Dos', menu: 'vegano', alergias: 'lactosa' }
    ],
    transporte: 'si', transporte_personas: 3
  });
  assert(!error, 'no deberia dar error: ' + error);
  compruebaInvariantes(rec);
  assertEq(rec.email, 'raquel@ejemplo.es', 'el email deberia normalizarse a minusculas');
  assertEq(rec.transporte_personas, 3);
});

check('acepta un "no asistire" minimo', () => {
  const { rec, error } = normalizeRsvp({ asistencia: 'no', nombre: 'Luis', email: 'luis@ejemplo.es' });
  assert(!error, 'no deberia dar error');
  compruebaInvariantes(rec);
});

check('rechaza lo que falta', () => {
  assert(normalizeRsvp({}).error, 'deberia exigir asistencia');
  assert(normalizeRsvp({ asistencia: 'si' }).error, 'deberia exigir nombre');
  assert(normalizeRsvp({ asistencia: 'si', nombre: 'A' }).error, 'deberia exigir email');
  assert(normalizeRsvp({ asistencia: 'si', nombre: 'A', email: 'roto' }).error, 'deberia validar el email');
  assert(normalizeRsvp(null).error, 'deberia soportar null');
  assert(normalizeSong({}).error, 'deberia exigir la cancion');
});

check('recorta el grupo a un maximo razonable', () => {
  const { rec } = normalizeRsvp({
    asistencia: 'si', nombre: 'A', email: 'a@b.c',
    num_acompanantes: 500, acompanantes: new Array(500).fill({ nombre: 'X', menu: 'carne' })
  });
  compruebaInvariantes(rec);
  assertEq(rec.num_acompanantes, 10, 'deberia toparse en 10');
});

check('nunca deja pedir mas plazas de autobus que personas', () => {
  const { rec } = normalizeRsvp({
    asistencia: 'si', nombre: 'A', email: 'a@b.c',
    num_acompanantes: 1, acompanantes: [{ nombre: 'B', menu: 'carne' }],
    transporte: 'si', transporte_personas: 99
  });
  compruebaInvariantes(rec);
  assertEq(rec.transporte_personas, 2, 'deberia recortarse al tamano del grupo');
});

// ---------------------------------------------------------------------------
// 2 · Fuzzing masivo
// ---------------------------------------------------------------------------
const VUELTAS = 20000;

check(`aguanta ${VUELTAS} confirmaciones basura sin romperse`, () => {
  let aceptados = 0, rechazados = 0;
  for (let i = 0; i < VUELTAS; i++) {
    const p = payloadAleatorio();
    let res;
    try {
      res = normalizeRsvp(p);
    } catch (e) {
      throw new Error(`excepcion en la vuelta ${i}: ${e.message} · entrada: ${JSON.stringify(p).slice(0, 300)}`);
    }
    if (res.error) { rechazados++; continue; }
    aceptados++;
    try {
      compruebaInvariantes(res.rec);
    } catch (e) {
      throw new Error(`invariante rota en la vuelta ${i}: ${e.message} · entrada: ${JSON.stringify(p).slice(0, 300)}`);
    }
  }
  assert(aceptados > 1000, `apenas se acepto nada (${aceptados}), el fuzzing no esta probando el camino bueno`);
  assert(rechazados > 1000, `apenas se rechazo nada (${rechazados}), la validacion no esta filtrando`);
  resumen.push(`${aceptados} confirmaciones aceptadas y ${rechazados} rechazadas, todas con las reglas intactas`);
});

check('aguanta canciones basura', () => {
  for (let i = 0; i < 3000; i++) {
    const p = { cancion: elige(VALORES), artista: elige(VALORES), nombre: elige(VALORES) };
    const res = normalizeSong(p);
    if (res.error) continue;
    assert(res.rec.cancion.length > 0 && res.rec.cancion.length <= 200, 'cancion mal recortada');
    assert(!SIN_CONTROL.test(res.rec.cancion), 'caracter de control en la cancion');
  }
});

check('aguanta ediciones basura desde el panel', () => {
  const base = normalizeRsvp({
    asistencia: 'si', nombre: 'Base', email: 'base@ejemplo.es',
    num_acompanantes: 1, acompanantes: [{ nombre: 'Acomp', menu: 'carne' }],
    transporte: 'si', transporte_personas: 2
  }).rec;

  for (let i = 0; i < 5000; i++) {
    const patch = payloadAleatorio();
    let res;
    try {
      res = applyRsvpEdit(base, patch);
    } catch (e) {
      throw new Error(`excepcion editando en la vuelta ${i}: ${e.message}`);
    }
    if (res.error) continue;
    compruebaInvariantes(res.rec);
    assertEq(res.rec.id, base.id, 'la edicion no debe cambiar el id');
    assertEq(res.rec.ts, base.ts, 'la edicion no debe cambiar la fecha original');
    assert(res.rec.editado, 'deberia marcar la fecha de edicion');
  }
});

// ---------------------------------------------------------------------------
// 3 · Intentos de inyeccion
// ---------------------------------------------------------------------------
check('no se puede envenenar el prototipo', () => {
  const veneno = JSON.parse('{"__proto__":{"colado":"si"},"asistencia":"si","nombre":"A","email":"a@b.c"}');
  normalizeRsvp(veneno);
  const base = normalizeRsvp({ asistencia: 'si', nombre: 'A', email: 'a@b.c' }).rec;
  applyRsvpEdit(base, JSON.parse('{"__proto__":{"colado":"si"}}'));
  assertEq({}.colado, undefined, 'Object.prototype contaminado');
  assertEq(Object.prototype.colado, undefined, 'Object.prototype contaminado');
});

check('el panel no ejecuta HTML de los invitados', () => {
  const malo = '<script>alert(1)</script>';
  const rsvps = [normalizeRsvp({
    asistencia: 'si', nombre: malo, email: 'a@b.c', alergias: '"><img src=x onerror=alert(1)>',
    num_acompanantes: 1, acompanantes: [{ nombre: '</script><script>alert(2)</script>', menu: 'carne' }]
  }).rec];
  const songs = [normalizeSong({ cancion: malo, artista: malo, nombre: malo }).rec];

  const html = renderAdmin(rsvps, songs, 'token-de-prueba');
  // Lo que importa no es que el texto "onerror" aparezca (aparece, escapado y
  // visible como texto), sino que el navegador no pueda abrir ninguna etiqueta.
  assert(!html.includes(malo), 'el <script> del invitado ha llegado crudo al panel');
  assert(!/<img/i.test(html), 'una etiqueta <img> del invitado ha llegado cruda');
  assert(html.includes('&lt;img'), 'la etiqueta deberia quedar escapada como texto');
  assertEq((html.match(/<script/gi) || []).length, 1, 'hay mas etiquetas <script> de las que deberia');
  assertEq((html.match(/<\/script>/gi) || []).length, 1, 'alguien ha cerrado el <script> del panel');
  assert(html.includes('\\u003c'), 'el JSON embebido deberia escapar los <');
});

check('el CSV no ejecuta formulas de Excel', () => {
  const rsvps = [normalizeRsvp({
    asistencia: 'si', nombre: '=HYPERLINK("http://malo","pincha")', email: 'a@b.c',
    telefono: '+34600111222', alergias: '@SUM(A1:A9)',
    num_acompanantes: 1, acompanantes: [{ nombre: '-2+3', menu: 'carne', alergias: '=1+1' }]
  }).rec];

  for (const csv of [rsvpCsv(rsvps), personasCsv(rsvps)]) {
    for (const fila of parseCsv(csv).slice(1)) {
      for (const celda of fila) {
        assert(!/^[=+\-@\t\r]/.test(celda), 'celda ejecutable en el CSV: ' + celda);
      }
    }
  }
  const csvCanciones = songsCsv([normalizeSong({ cancion: '=cmd|calc', artista: '', nombre: '' }).rec]);
  assert(csvCanciones.includes("'=cmd|calc"), 'la formula deberia ir neutralizada');
});

// ---------------------------------------------------------------------------
// 4 · Exportacion y estadisticas sobre volumen real
// ---------------------------------------------------------------------------
function parseCsv(texto) {
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
  const filas = [];
  let fila = [], celda = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++; } else comillas = false;
      } else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; }
    else if (c === '\r') { /* el salto real es \n */ }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += c;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

function lote(n) {
  const out = [];
  for (let i = 0; out.length < n; i++) {
    const p = payloadAleatorio();
    p.asistencia = rnd() < 0.85 ? 'si' : 'no';
    p.nombre = 'Invitado ' + out.length + ' ' + elige(VALORES);
    p.email = 'invitado' + out.length + '@ejemplo.es';
    const { rec } = normalizeRsvp(p);
    if (rec) out.push(rec);
  }
  return out;
}

check('las cuentas del panel cuadran con 2000 confirmaciones', () => {
  const filas = lote(2000);
  const s = buildStats(filas);
  const personas = flattenPersons(filas);

  assertEq(s.total, filas.length, 'total descuadrado');
  assertEq(s.si + s.no, filas.length, 'si + no no suma el total');
  assertEq(s.comensales, s.si + s.acompanantes, 'comensales descuadrados');
  assertEq(personas.length, s.total + s.acompanantes, 'la vista por persona no cuadra');
  assertEq(
    s.menu.carne + s.menu.pescado + s.menu.vegano + s.menu.sin_elegir,
    s.comensales,
    'los menus no suman los comensales'
  );
  assert(s.bus_personas <= s.comensales, 'mas plazas de autobus que comensales');
  assert(s.bus <= s.si, 'mas peticiones de bus que asistentes');
});

check('el CSV sobrevive a 2000 confirmaciones con texto hostil', () => {
  const filas = lote(2000);

  const csvR = parseCsv(rsvpCsv(filas));
  assertEq(csvR.length, filas.length + 1, 'el CSV de respuestas ha perdido o duplicado filas');
  const columnas = csvR[0].length;
  for (const f of csvR) assertEq(f.length, columnas, 'fila con distinto numero de columnas');

  const csvP = parseCsv(personasCsv(filas));
  assertEq(csvP.length, flattenPersons(filas).length + 1, 'el CSV por persona ha perdido filas');
});

check('el panel se pinta con 2000 confirmaciones', () => {
  const filas = lote(2000);
  const html = renderAdmin(filas, [], 'token');
  assert(html.length > 1000, 'panel vacio');
  assertEq((html.match(/<script/gi) || []).length, 1, 'etiquetas <script> de mas');
});

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------
console.log('');
for (const f of fallos) console.log('  ✗ ' + f.nombre + '\n      ' + f.error);
for (const r of resumen) console.log('  · ' + r);
console.log(`  ${pasadas} pruebas superadas, ${fallos.length} fallidas`);
console.log('');
process.exit(fallos.length ? 1 : 0);
