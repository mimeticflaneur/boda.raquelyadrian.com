'use strict';
const {test}=require('node:test'); const assert=require('node:assert/strict');
const phone=require('../assets/phone'); const api=require('../lib/api'); const core=require('../lib/core');
const store=require('../lib/store'); const client=require('../assets/ingest-client');
test('teléfonos: España, Chile, otros países, pegado internacional, ceros y entradas inválidas',()=>{
  for(const [n,p,want] of [['600 111 222','+34','+34600111222'],['9 1234 5678','+56','+56912345678'],['+56 9 1234 5678','+56','+56912345678'],['0034600111222','+34','+34600111222'],['(415) 555-2671','+1','+14155552671'],['20 7946 0958','+44','+442079460958']])assert.equal(phone.normalize(n,p).value,want);
  for(const [n,p] of [['600111222',''],['','+34'],['123','+56'],['+56912345678','+34'],['abc600111222','+34'],['9999999999999999','+1'],['600111222','+000'],[{},'+34']])assert.ok(phone.normalize(n,p).error);
});
test('parseo del login y payloads anómalos',()=>{
  assert.deepEqual(api.getBody({body:'token=a%2Bb%26c',headers:{'content-type':'application/x-www-form-urlencoded'}}),{token:'a+b&c'});
  for(const body of ['{',null,[],false])assert.deepEqual(api.getBody({body,headers:{}}),{});
  assert.ok(core.applyRsvpEdit({},null).error);
});
test('sesiones firmadas: falsificación, caducidad, cambio de token y ausencia de configuración',()=>{
  const prev=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN='unit-test-secret';
  const c=api.sessionCookie(process.env.ADMIN_TOKEN,{headers:{}}).split(';')[0].split('=')[1];
  assert.ok(api.sessionOk(c));assert.equal(api.sessionOk(c.replace(/^v1\.\d+/, 'v1.1')),false);assert.equal(api.sessionOk(c+'x'),false);
  process.env.ADMIN_TOKEN='changed';assert.equal(api.sessionOk(c),false);delete process.env.ADMIN_TOKEN;assert.equal(api.tokenOk('unit-test-secret'),false);
  if(prev!==undefined)process.env.ADMIN_TOKEN=prev;
});
test('no empareja credenciales de bases diferentes',()=>{
  const env={...process.env};for(const k of Object.keys(process.env))if(/REST/.test(k))delete process.env[k];
  process.env.ONE_REST_URL='https://one.upstash.io';process.env.TWO_REST_TOKEN='two';assert.equal(store.isConfigured(),false);
  process.env.ONE_REST_TOKEN='one';assert.equal(store.resolveCreds().token,'one');
  for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);
});
test('errores HTTP, JSON y red nunca se presentan como confirmación guardada',async()=>{
  const saved=global.fetch;
  for(const response of [new Response('<html>Error</html>'),Response.json({error:'fallo'}),Response.json({}),Response.json({ok:true}),Response.json({ok:false},{status:503})]){
    global.fetch=async()=>response;assert.equal((await client.post('/api/rsvp',{})).ok,false);
  }
  global.fetch=async()=>Response.json({ok:true,id:'receipt'});assert.equal((await client.post('/api/rsvp',{})).ok,true);
  global.fetch=async()=>{throw new TypeError('fetch failed')};await assert.rejects(()=>client.post('/api/rsvp',{}));global.fetch=saved;
});
test('Redis rechaza fallos y lecturas inválidas en lugar de anunciar éxito o cero invitados',async()=>{
  const saved=global.fetch;const env={...process.env};process.env.UPSTASH_REDIS_REST_URL='https://test.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='test';
  try {
    for(const payload of [{error:'ERR'},{},{result:null}]){
      global.fetch=async()=>Response.json(payload);await assert.rejects(()=>store.append('rsvp',{id:'test'}));await assert.rejects(()=>store.readAll('rsvp'));
    }
    global.fetch=async()=>Response.json({result:['bad json']});await assert.rejects(()=>store.readAll('rsvp'));
    global.fetch=async()=>{throw new TypeError('fetch failed')};
    const res={code:200,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};
    await require('../api/health')({headers:{}},res);assert.equal(res.code,503);assert.equal(res.body.ok,false);
  } finally {global.fetch=saved;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
});
test('un reintento conserva su id; cambiar el contenido crea otro sin almacenar datos de invitados',async()=>{
  const a=await client.submissionId({nombre:'Uno'});assert.equal(await client.submissionId({nombre:'Uno'}),a);assert.notEqual(await client.submissionId({nombre:'Dos'}),a);
});
