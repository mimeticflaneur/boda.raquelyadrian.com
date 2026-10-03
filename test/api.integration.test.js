'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRedis } = require('./helpers/redis-rest');
const core = require('../lib/core');
const store = require('../lib/store');
const handlers = Object.fromEntries(['rsvp','admin','update','delete','stats','export','health'].map(k => [k, require('../api/' + k)]));
let redis;
const originalEnv = { ...process.env };
const token = 'test-only-admin-' + crypto.randomUUID();
const payload = (i = 0) => ({ asistencia: 'si', nombre: `Prueba ${i} Ñ`, email: `test${i}@example.invalid`, telefono: i % 2 ? '+56912345678' : '+34600111222', preboda: 'si', menu: 'carne', num_acompanantes: 1, acompanantes: [{ nombre: 'Acompañante', menu: 'vegano', alergias: 'Prueba sin datos reales' }], transporte: 'si', transporte_personas: 2, request_id: crypto.randomUUID() });
async function call(name, { method = 'POST', body = {}, headers = {}, query = {} } = {}) {
  const req = { method, body, headers: { 'x-forwarded-for': body.email || 'local-test', ...headers }, query };
  const res = { code: 200, headers: {}, status(n) { this.code = n; return this; }, setHeader(k,v) { this.headers[k.toLowerCase()] = v; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; }, end() { return this; } };
  await handlers[name](req, res); return res;
}
before(async () => { redis = await startRedis(); process.env.UPSTASH_REDIS_REST_URL = redis.url; process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only'; process.env.ADMIN_TOKEN = token; });
after(async () => { for (const k of Object.keys(process.env)) if (!(k in originalEnv)) delete process.env[k]; Object.assign(process.env, originalEnv); if(redis) await redis.close(); });
const auth = { 'x-admin-token': token };

test('ingesta real: 300 grupos simultáneos, todos persistidos, panel y CSV coinciden', async () => {
  const results = await Promise.all(Array.from({ length: 300 }, (_, i) => call('rsvp', { body: payload(i) })));
  assert.ok(results.every(r => r.code === 200 && r.body.id));
  const rows = await store.readAll('rsvp'); assert.equal(rows.length, 300); assert.equal(new Set(rows.map(r=>r.id)).size, 300);
  const stats = await call('stats', { method: 'GET', headers: auth }); assert.equal(stats.body.stats.comensales, 600); assert.equal(stats.body.stats.bus_personas, 600);
  const admin = await call('admin', { method: 'GET', headers: auth }); assert.equal(admin.code,200); assert.match(admin.body,/600 filas · 300 respuestas/);
  const csv = await call('export', { method:'GET', headers:auth, query:{type:'personas'} }); assert.equal(csv.body.split('\r\n').length,601);
});
test('20 reintentos simultáneos guardan una sola respuesta y devuelven el mismo recibo', async()=>{
  const p=payload(301); const before=(await store.readAll('rsvp')).length;
  const results=await Promise.all(Array.from({length:20},()=>call('rsvp',{body:p})));
  assert.ok(results.every(r=>r.code===200)); assert.equal(new Set(results.map(r=>r.body.id)).size,1);
  assert.equal((await store.readAll('rsvp')).length,before+1);
  const conflict=await call('rsvp',{body:{...p,nombre:'Cambio'},headers:{'x-forwarded-for':'another-test'}});assert.equal(conflict.code,409);
});
test('autobús limitado al grupo, rechazo sin teléfono, sin menú y acompañantes incompletos',async()=>{
  for(const patch of [{telefono:''},{telefono:'600111222'},{telefono:'+56600'},{menu:''},{preboda:''},{acompanantes:[]},{acompanantes:[{menu:'carne'}]}]) {
    const r=await call('rsvp',{body:{...payload(400),...patch}});assert.equal(r.code,422,JSON.stringify(patch));
  }
  const r=await call('rsvp',{body:{...payload(401),transporte_personas:100}});assert.equal(r.code,200);
  const rec=(await store.readAll('rsvp')).find(x=>x.id===r.body.id);assert.equal(rec.transporte_personas,2);
  const no=await call('rsvp',{body:{asistencia:'no',nombre:'Ausencia',email:'absent@example.invalid'}});assert.equal(no.code,200);
});
test('acceso por formulario URL-encoded, cookie firmada, CSV protegido y cierre de sesión',async()=>{
  assert.equal((await call('admin',{method:'GET'})).code,401);
  const bad=await call('admin',{body:'token=incorrecto',headers:{'content-type':'application/x-www-form-urlencoded'}});assert.equal(bad.code,401);
  const login=await call('admin',{body:new URLSearchParams({token}).toString(),headers:{'content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-forwarded-proto':'https'}});
  assert.equal(login.code,303);assert.equal(login.headers.location,'/admin');
  const cookie=login.headers['set-cookie'];assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);assert.ok(!cookie.includes(token));
  const panel=await call('admin',{method:'GET',headers:{cookie:cookie.split(';')[0]}});assert.equal(panel.code,200);assert.ok(!panel.body.includes(token));
  assert.equal((await call('export',{method:'GET',headers:{cookie:cookie.split(';')[0]}})).code,200);
  const logout=await call('admin',{method:'GET',query:{logout:'1'}});assert.match(logout.headers['set-cookie'],/Max-Age=0/);
  for(const endpoint of ['stats','export','update','delete']) assert.equal((await call(endpoint)).code,401);
});
test('ediciones y borrados simultáneos no desplazan ni sobrescriben otros registros',async()=>{
  const rows=(await store.readAll('rsvp')).slice(0,100);
  await Promise.all(rows.map((r,i)=>i%2 ? store.updateById('rsvp',r.id,{...r,nombre:'Editado '+i},r):store.deleteById('rsvp',r.id)));
  const after=await store.readAll('rsvp');
  for(let i=0;i<rows.length;i++){const r=after.find(x=>x.id===rows[i].id);if(i%2)assert.equal(r.nombre,'Editado '+i);else assert.equal(r,undefined);}
});
test('dos administradores: detección de versión obsoleta y CAS atómico',async()=>{
  const r=(await store.readAll('rsvp'))[0];
  const edits=await Promise.allSettled([store.updateById('rsvp',r.id,{...r,nombre:'Primera'},r),store.updateById('rsvp',r.id,{...r,nombre:'Segunda'},r)]);
  assert.equal(edits.filter(x=>x.status==='fulfilled').length,1);assert.equal(edits.find(x=>x.status==='rejected').reason.status,409);
  const stale=await call('update',{headers:auth,body:{tipo:'rsvp',id:r.id,version:'old',datos:{nombre:'No sobrescribir'}}});assert.equal(stale.code,409);
});
test('editar y eliminar desde API actualiza estadísticas y CSV; teléfono antiguo se conserva sin inventar país',async()=>{
  const old={...core.normalizeRsvp(payload(999)).rec,telefono:'600111222'};await store.append('rsvp',old);
  const edit=await call('update',{headers:auth,body:{tipo:'rsvp',id:old.id,datos:{nombre:'Corregido'}}});assert.equal(edit.code,200);
  assert.equal((await store.readAll('rsvp')).find(r=>r.id===old.id).telefono,'600111222');
  const changed=await call('update',{headers:auth,body:{tipo:'rsvp',id:old.id,datos:{telefono:'911111111'}}});assert.equal(changed.code,422);
  const deleted=await call('delete',{headers:auth,body:{tipo:'rsvp',id:old.id}});assert.equal(deleted.code,200);assert.ok(!(await store.readAll('rsvp')).some(r=>r.id===old.id));
});
test('límite por IP y salud verifican operaciones reales de Redis',async()=>{
  const results=await Promise.all(Array.from({length:22},()=>store.overLimit('stress','one-ip',20,3600)));
  assert.equal(results.filter(Boolean).length,2);
  const r=await call('health',{method:'GET'});assert.equal(r.code,200);assert.equal(r.headers['cache-control'],'no-store');
});
