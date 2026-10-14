const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'apps/marketingdata/node_modules/typescript'));
const exportsObject={};new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/sevenrooms-marketing-copy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exportsObject);
const {collectMarketingEmails:collect}=exportsObject;
test('copy collects the entire audience beyond both table and export page sizes',async()=>{
 const calls=[];const result=await collect(async page=>{calls.push(page);return {count:1002,rows:Array.from({length:page===1?1000:2},(_,i)=>({email:`guest${(page-1)*1000+i}@example.com`}))};});
 assert.deepEqual(calls,[1,2]);assert.equal(result.count,1002);assert.equal(new Set(result.emails).size,1002);
});
test('email formatting preserves one address after lowercase/trim normalization',async()=>{
 const result=await collect(async()=>({count:1,rows:[{email:' Guest@Example.com '},{email:'guest@example.com'}]}));assert.deepEqual(result.emails,['guest@example.com']);
});
test('a partial response, changed audience or invalid address is rejected instead of copied',async()=>{
 await assert.rejects(collect(async()=>({count:100,rows:[{email:'guest@example.com'}]})),/full email audience/);
 await assert.rejects(collect(async page=>({count:page===1?1001:1002,rows:page===1?Array.from({length:1000},(_,i)=>({email:`guest${i}@example.com`})):[{email:'last@example.com'}]})),/audience changed/);
 await assert.rejects(collect(async()=>({count:1,rows:[{email:'not-an-email'}]})),/invalid address/);
});
test('an empty scoped audience stays empty',async()=>assert.deepEqual(await collect(async()=>({count:0,rows:[]})),{emails:[],count:0}));
