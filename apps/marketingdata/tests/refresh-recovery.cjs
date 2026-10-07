const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript');
const source=fs.readFileSync(path.join(__dirname,'../components/ysabel/use-auto-refresh.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flush=()=>new Promise(setImmediate);
function mount(t) {
  let effect;
  const values=[];
  const react={useState:(initial)=>[initial,value=>values.push(value)],useRef:initial=>({current:initial}),useEffect:fn=>effect=fn};
  const exp={};new Function('require','exports','window','document',js)(id=>id==='react'?react:{appPath:p=>'/marketingdata'+p},exp,new EventTarget(),Object.assign(new EventTarget(),{visibilityState:'visible',hidden:false}));
  const api=exp.useAutoRefresh(true); const cleanup=effect();t.after(cleanup);return {api,values};
}
test('an interrupted sync resumes the saved job automatically',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const calls=[];
  t.mock.method(globalThis,'fetch',async(_url,options={})=>{
    if(!options.body)return Response.json({schedule:null});
    const body=JSON.parse(options.body);calls.push(body);
    if(calls.length===1)return Response.json({error:'temporary outage'},{status:503});
    return Response.json({id:'existing-job',status:body.op==='step'?'complete':'running',updatedAt:'2026-10-07T03:00:00Z',completed:body.op==='step'?1:0,tasks:[{kind:'reports',source:'gbp',state:body.op==='step'?'complete':'pending'}]});
  });
  mount(t); await flush();await flush();
  assert.equal(calls.length,1); t.mock.timers.tick(30000);await flush();await flush();
  assert.deepEqual(calls[1],{op:'start',force:false,scope:'all'});
  assert.deepEqual(calls[2],{op:'step',id:'existing-job'});
});
test('denied sync access does not start a retry loop',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,options={})=>{if(!options.body)return Response.json({schedule:null});calls++;return Response.json({error:'sign in'},{status:401});});
  mount(t);await flush();await flush();t.mock.timers.tick(30000);await flush();assert.equal(calls,1);
});
