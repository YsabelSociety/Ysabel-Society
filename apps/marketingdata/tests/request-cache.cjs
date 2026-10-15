const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript'),exp={};
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/request-cache.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exp);
test('duplicate reads share one request and exact scope, including zero counts',async()=>{
 const cache=exp.createRequestCache();let calls=0,resolve;
 const first=cache.read('all|october',()=>{calls++;return new Promise(done=>resolve=done);});
 const second=cache.read('all|october',()=>{throw Error('Duplicate request');});
 await Promise.resolve();assert.equal(calls,1);resolve({count:0});assert.deepEqual(await first,{count:0});assert.deepEqual(await second,{count:0});
 assert.deepEqual(await cache.read('all|october',()=>{throw Error('Reload');}),{count:0});
 assert.equal(cache.peek('garden|october'),undefined);
});
test('an import invalidates old work without blanking the current scoped view',async()=>{
 const cache=exp.createRequestCache();await cache.read('venue',async()=>({count:1}));cache.invalidate();
 let complete;const old=cache.read('venue',()=>new Promise(done=>complete=done));await Promise.resolve();cache.invalidate();
 assert.deepEqual(cache.peek('venue'),{count:1});await cache.read('venue',async()=>({count:2}));complete({count:0});await old;
 assert.deepEqual(cache.peek('venue'),{count:2},'An older request cannot replace an imported result');
});
test('failed requests are retried and the memory bound evicts old scopes',async()=>{
 const cache=exp.createRequestCache(2);await assert.rejects(cache.read('one',async()=>{throw Error('offline');}),/offline/);
 assert.equal(await cache.read('one',async()=>1),1);await cache.read('two',async()=>2);await cache.read('three',async()=>3);
 assert.equal(cache.peek('one'),undefined);cache.clear();assert.equal(cache.peek('two'),undefined);
});
