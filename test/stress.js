'use strict';

// Carga a través de HTTP contra los handlers reales y un Redis efímero.
// No admite URL externa: nunca se dirige a producción ni usa sus credenciales.
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { startRedis } = require('./helpers/redis-rest');
const store = require('../lib/store');
const handlers = Object.fromEntries(['rsvp', 'admin', 'update', 'delete', 'stats', 'export', 'health', 'cancion', 'check-ingestion'].map(k => [k, require('../api/' + k)]));
const originalEnv = { ...process.env };
const originalError = console.error;
const report = { node: process.version, environment: 'HTTP y Redis locales aislados', phases: [], expectedServerErrors: 0 };
const token = crypto.randomUUID();
const auth = { 'x-admin-token': token };
const dropped = new Set();
let offline = false, redis, proxy, server, base;
console.error = () => { report.expectedServerErrors++; };

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => server && new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
const menus = ['carne', 'pescado', 'vegano'];
const payload = i => ({
  asistencia: 'si', nombre: `Grupo de prueba ${i} Ñ`, email: `stress-${i}@example.invalid`,
  telefono: i % 2 ? '+56912345678' : '+34600111222', preboda: i % 2 ? 'si' : 'no',
  menu: menus[i % 3], num_acompanantes: i % 4,
  acompanantes: Array.from({ length: i % 4 }, (_, j) => ({ nombre: `Acompañante ${i} ${j}`, menu: menus[(i + j + 1) % 3] })),
  transporte: i % 2 ? 'si' : 'no', transporte_personas: i % 4 + 1, request_id: crypto.randomUUID()
});
async function call(path, { body, headers = {}, method } = {}) {
  const started = performance.now();
  const response = await fetch(base + path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': body?.email || crypto.randomUUID(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000)
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch (_) {}
  return { status: response.status, data, text, ms: performance.now() - started };
}
async function pool(items, concurrency, action) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    while (cursor < items.length) { const i = cursor++; results[i] = await action(items[i], i); }
  }));
  return results;
}
async function phase(name, action) {
  const started = performance.now();
  const details = await action();
  const result = { name, seconds: +((performance.now() - started) / 1000).toFixed(3), ...details };
  report.phases.push(result); console.log(JSON.stringify(result));
}
function metrics(results) {
  const sorted = results.map(r => r.ms).sort((a, b) => a - b);
  return { requests: results.length, p50ms: +sorted[Math.floor(sorted.length * .5)].toFixed(1), p95ms: +sorted[Math.floor(sorted.length * .95)].toFixed(1), maxMs: +sorted.at(-1).toFixed(1) };
}
async function main() {
  redis = await startRedis();
  proxy = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      if (offline) { res.writeHead(503); res.end('{"error":"simulated outage"}'); return; }
      const command = JSON.parse(raw);
      const response = await fetch(redis.url, { method: 'POST', headers: { Authorization: 'Bearer test-only' }, body: raw });
      const body = await response.text();
      const key = command[0] === 'EVAL' && command[2] === '2' ? command[4] : '';
      if (dropped.delete(key)) { res.destroy(); return; }
      res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(body);
    } catch (e) { res.writeHead(503); res.end('{"error":"proxy error"}'); }
  });
  await listen(proxy);
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${proxy.address().port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only'; process.env.ADMIN_TOKEN = token; process.env.CRON_SECRET = token;
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const handler = handlers[url.pathname.replace(/^\/api\//, '')];
      if (!handler) { res.writeHead(404); res.end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      req.body = Buffer.concat(chunks).toString(); req.query = Object.fromEntries(url.searchParams);
      res.status = status => { res.statusCode = status; return res; };
      res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
      res.send = value => res.end(value);
      await handler(req, res);
    } catch (_) { res.writeHead(500); res.end('{"ok":false,"error":"handler exception"}'); }
  });
  await listen(server); base = `http://127.0.0.1:${server.address().port}`;

  await phase('3000 grupos, 100 solicitudes en vuelo', async () => {
    const groups = Array.from({ length: 3000 }, (_, i) => payload(i));
    const results = await pool(groups, 100, body => call('/api/rsvp', { body }));
    assert.ok(results.every(r => r.status === 200 && r.data?.id));
    assert.equal(new Set(results.map(r => r.data.id)).size, 3000);
    const rows = await store.readAll('rsvp'); assert.equal(rows.length, 3000);
    const stats = (await call('/api/stats', { headers: auth })).data.stats;
    assert.equal(stats.comensales, 7500); assert.equal(stats.acompanantes, 4500); assert.equal(stats.bus_personas, 4500);
    const expectedMenus = { carne: 0, pescado: 0, vegano: 0 };
    for (const g of groups) for (const p of [g, ...g.acompanantes]) expectedMenus[p.menu]++;
    for (const menu of menus) assert.equal(stats.menu[menu], expectedMenus[menu]);
    const exports = await call('/api/export?type=personas', { headers: auth });
    assert.equal(exports.status, 200); assert.equal(exports.text.split('\r\n').length, 7501);
    const panel = await call('/api/admin', { headers: auth }); assert.equal(panel.status, 200); assert.match(panel.text, /7500 filas · 3000 respuestas/);
    return { ...metrics(results), groups: 3000, persons: 7500, duplicates: 0, missing: 0 };
  });
  await phase('500 envíos: 100 grupos con cinco reintentos concurrentes', async () => {
    const before = (await store.readAll('rsvp')).length;
    const groups = Array.from({ length: 100 }, (_, i) => payload(i + 4000));
    const results = await pool(groups.flatMap(p => Array(5).fill(p)), 100, body => call('/api/rsvp', { body }));
    assert.ok(results.every(r => r.status === 200)); assert.equal(new Set(results.map(r => r.data.id)).size, 100);
    assert.equal((await store.readAll('rsvp')).length, before + 100);
    return { ...metrics(results), saved: 100, duplicates: 0 };
  });
  await phase('50 conexiones perdidas después del guardado y 50 reintentos', async () => {
    const before = (await store.readAll('rsvp')).length;
    const groups = Array.from({ length: 50 }, (_, i) => payload(i + 5000));
    for (const g of groups) dropped.add('boda:submission:rsvp:' + g.request_id);
    const failed = await pool(groups, 25, body => call('/api/rsvp', { body }));
    assert.ok(failed.every(r => r.status === 503 && r.data.ok === false));
    const retry = await pool(groups, 25, body => call('/api/rsvp', { body }));
    assert.ok(retry.every(r => r.status === 200)); assert.equal((await store.readAll('rsvp')).length, before + 50);
    return { failedResponses: 50, recovered: 50, duplicates: 0 };
  });
  await phase('Caída de Redis: 20 envíos y recuperación', async () => {
    const before = (await store.readAll('rsvp')).length;
    const groups = Array.from({ length: 20 }, (_, i) => payload(i + 6000));
    offline = true;
    const results = await pool(groups, 20, body => call('/api/rsvp', { body }));
    assert.ok(results.every(r => r.status === 503 && !r.data.ok));
    for (const path of ['/api/admin', '/api/health', '/api/stats', '/api/export']) assert.ok((await call(path, { headers: auth })).status >= 500);
    offline = false;
    assert.equal((await store.readAll('rsvp')).length, before);
    const recovered = await pool(groups, 20, body => call('/api/rsvp', { body })); assert.ok(recovered.every(r => r.status === 200));
    assert.equal((await store.readAll('rsvp')).length, before + 20);
    return { failedWithoutFalseSuccess: 20, recovered: 20 };
  });
  await phase('300 ediciones y 150 borrados, 20 solicitudes en vuelo', async () => {
    const rows = (await store.readAll('rsvp')).slice(0, 450);
    const results = await pool(rows, 20, (r, i) => i < 150
      ? call('/api/delete', { headers: auth, body: { tipo: 'rsvp', id: r.id } })
      : call('/api/update', { headers: auth, body: { tipo: 'rsvp', id: r.id, version: r.editado || r.ts, datos: { nombre: `Editado ${i}` } } }));
    assert.ok(results.every(r => r.status === 200));
    const after = new Map((await store.readAll('rsvp')).map(r => [r.id, r]));
    rows.forEach((r, i) => i < 150 ? assert.equal(after.has(r.id), false) : assert.equal(after.get(r.id).nombre, `Editado ${i}`));
    return { ...metrics(results), edited: 300, deleted: 150, wrongRecordsChanged: 0 };
  });
  await phase('50 administradores editan la misma versión', async () => {
    const rec = (await store.readAll('rsvp'))[0];
    const results = await pool(Array.from({ length: 50 }, (_, i) => i), 50, i => call('/api/update', { headers: auth, body: { tipo: 'rsvp', id: rec.id, version: rec.editado || rec.ts, datos: { nombre: `Conflicto ${i}` } } }));
    assert.equal(results.filter(r => r.status === 200).length, 1); assert.equal(results.filter(r => r.status === 409).length, 49);
    return { saved: 1, conflictsReported: 49 };
  });
  await phase('1000 entradas inválidas', async () => {
    const patches = [{ telefono: '600111222' }, { telefono: '+56123' }, { menu: '' }, { preboda: '' }, { transporte: '' }, { num_acompanantes: 11 }, { num_acompanantes: '1e1', acompanantes: Array.from({ length: 10 }, () => ({ nombre: 'X', menu: 'carne' })) }, { num_acompanantes: '' }, { nombre: {} }, { email: 'incorrecto' }];
    const before = (await store.readAll('rsvp')).length;
    const results = await pool(Array.from({ length: 1000 }, (_, i) => ({ ...payload(i + 7000), ...patches[i % patches.length] })), 100, body => call('/api/rsvp', { body }));
    assert.ok(results.every(r => r.status === 422)); assert.equal((await store.readAll('rsvp')).length, before);
    return { ...metrics(results), rejected: 1000, saved: 0 };
  });
  await phase('100 solicitudes desde una IP', async () => {
    const results = await pool(Array.from({ length: 100 }, (_, i) => payload(i + 9000)), 100, body => call('/api/rsvp', { body, headers: { 'x-forwarded-for': 'shared-network-test' } }));
    assert.equal(results.filter(r => r.status === 200).length, 20); assert.equal(results.filter(r => r.status === 429).length, 80);
    return { saved: 20, limited: 80 };
  });
  await phase('Registro ilegible y acceso sin autorización', async () => {
    for (const path of ['/api/admin', '/api/stats', '/api/export', '/api/update', '/api/delete']) {
      const method = /update|delete/.test(path) ? 'POST' : 'GET';
      assert.equal((await call(path, { method })).status, 401);
    }
    await redis.command(['RPUSH', 'boda:rsvp', 'intentional-invalid-json']);
    assert.equal((await call('/api/admin', { headers: auth })).status, 503);
    assert.equal((await call('/api/check-ingestion', { headers: { authorization: `Bearer ${token}` } })).status, 503);
    await redis.command(['LREM', 'boda:rsvp', 1, 'intentional-invalid-json']);
    assert.equal((await call('/api/check-ingestion', { headers: { authorization: `Bearer ${token}` } })).status, 200);
    return { unauthorizedRejected: 5, corruptedDataDetected: true, recovered: true };
  });
  report.ok = true;
  report.finalRecords = (await store.readAll('rsvp')).length;
}

main().catch(error => { report.ok = false; report.error = error.message; originalError(error); process.exitCode = 1; }).finally(async () => {
  await close(server); await close(proxy); if (redis) await redis.close();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv);
  console.error = originalError;
  if (process.env.STRESS_REPORT) fs.writeFileSync(process.env.STRESS_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, phases: report.phases.length, finalRecords: report.finalRecords, expectedServerErrors: report.expectedServerErrors }));
});
