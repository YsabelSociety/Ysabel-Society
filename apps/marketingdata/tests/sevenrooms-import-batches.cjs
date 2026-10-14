const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../../../node_modules/typescript');
const file=path.resolve(__dirname,'../lib/sevenrooms-import-batches.ts'),exportsObject={};
new Function('exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exportsObject);
const {importSevenRoomsBatches}=exportsObject;
test('imports each batch once with at most three active writes and exact final progress',async()=>{
 let active=0,maximum=0;const visited=[],progress=[];
 await importSevenRoomsBatches(8,async batch=>{active++;maximum=Math.max(active,maximum);visited.push(batch);await new Promise(resolve=>setTimeout(resolve,2));active--;},n=>progress.push(n));
 assert.equal(maximum,3);assert.deepEqual(visited,[0,1,2,3,4,5,6,7]);assert.deepEqual(progress,[3,6,8]);assert.equal(active,0);
});
test('a failed batch stops new work and waits for other active writes before resuming',async()=>{
 const visited=[];let active=0;
 await assert.rejects(importSevenRoomsBatches(8,async batch=>{visited.push(batch);active++;try{if(batch===1)throw new Error('Access expired');await new Promise(resolve=>setTimeout(resolve,3));}finally{active--; }},()=>{}),/Access expired/);
 assert.deepEqual(visited,[0,1,2]);assert.equal(active,0);
});
