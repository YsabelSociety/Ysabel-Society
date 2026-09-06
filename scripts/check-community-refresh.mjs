import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('lib/server/community-sync.ts','utf8');
const ast=ts.createSourceFile('community-sync.ts',source,ts.ScriptTarget.ES2022,true);
function compile(name,deps) {
  const node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);
  const text=ts.transpileModule(node.getText(ast).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function('deps','const {'+Object.keys(deps).join(',')+'}=deps;'+text+';return '+name)(deps);
}
let calls=[],saved=[],statuses=[];
const context={accountId:'ysabel-page',externalId:'ysabel-page',apiVersion:'v25.0',accessToken:'fixture-only'};
const sync=compile('syncMessages',{
 readInstagramMessaging:async()=>null,
 ensureStillLinked:async()=>{}, linkedContext:async()=>context,
 graphGet:async()=>({id:'ysabel-page'}),
 database:()=>({prepare:()=>({bind:()=>({first:async()=>({cursor:'older-page',account_id:'ysabel-page'})})})}),
 readConversationList:async(_c,_p,_s,after,attempt,size)=>{
  calls.push({after,size});
  return {data:[{id:'thread-'+calls.length}],paging:{next:'provider-cursor',cursors:{after:'next-'+calls.length}}};
 },
 saveCommunityStatus:async(_o,s)=>statuses.push(s),
 saveCommunity:async(_o,r)=>saved.push(...r),
 graphBatch:async(_c,paths)=>paths.map(p=>p.includes('/messages')?{body:{data:[{id:p.split('/')[0]+'-message',created_time:'2026-09-07T00:00:00Z',from:{id:'customer',name:'Customer'},to:{data:[{id:'ysabel-page'}]},message:'Enquiry'}]}}:{body:{first_name:'Customer'}}),
 safeProfileURL:()=>'', instagramConversationMessages:async()=>({}), instagramMessageBatch:async()=>[]
});
await sync('owner','facebook',false,true);
assert.equal(calls.length,1); assert.equal(calls[0].size,10); assert.equal(calls[0].after,'');
assert.equal(statuses.at(-1).cursor,'next-1'); assert.equal(saved.some(r=>r.kind==='message'),true);
calls=[]; saved=[]; statuses=[];
await sync('owner','facebook',true,false);
assert.equal(calls.length,10); assert.equal(calls[0].size,50); assert.equal(calls[0].after,'older-page');
assert.equal(statuses.at(-1).cursor,'next-10');
console.log('PASS: automatic inbox checks are bounded, latest conversations refresh first, saved cursors and manual history continuation remain intact.');
