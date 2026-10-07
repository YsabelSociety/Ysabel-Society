const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../node_modules/typescript');
const exp = {};
const source = fs.readFileSync(path.join(__dirname, '../lib/read-with-retry.ts'), 'utf8');
new Function('exports', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exp);
const {readWithRetry} = exp;

test('healthy reads are immediate and preserve a real zero', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({views:0});});
  const response=await readWithRetry('/analytics');
  assert.equal(calls,1); assert.deepEqual(await response.json(),{views:0});
});
test('temporary service failure recovers with the complete saved report', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'/analytics?start=2026-10-01'); assert.equal(options.cache,'no-store');
    return ++calls===1 ? Response.json({error:'unavailable'},{status:503}) : Response.json({rows:[{date:'2026-10-01',views:120}]});
  });
  const response=await readWithRetry('/analytics?start=2026-10-01');
  assert.equal(calls,2); assert.equal((await response.json()).rows[0].views,120);
});
test('authorization and input errors are not retried', async t => {
  for(const status of [400,401,403]) {
    let calls=0; t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status});});
    assert.equal((await readWithRetry('/analytics')).status,status); assert.equal(calls,1);
  }
});
test('going offline retries a saved-data read', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{if(++calls===1)throw new TypeError('network'); return Response.json({rating:4.2});});
  assert.equal((await (await readWithRetry('/rating')).json()).rating,4.2); assert.equal(calls,2);
});
test('navigation aborts recovery without another request', async t => {
  let calls=0; const controller=new AbortController();
  t.mock.method(globalThis,'fetch',async()=>{calls++;setTimeout(()=>controller.abort(),20);return new Response(null,{status:503});});
  await assert.rejects(readWithRetry('/analytics',{signal:controller.signal}),{name:'AbortError'}); assert.equal(calls,1);
});
test('persistent failures are bounded and stay errors, never empty successful reports', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:'unavailable'},{status:503});});
  const response=await readWithRetry('/analytics');
  assert.equal(calls,4); assert.equal(response.ok,false); assert.deepEqual(await response.json(),{error:'unavailable'});
});
