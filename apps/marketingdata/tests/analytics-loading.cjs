const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript');
const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../components/ysabel/use-analytics.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
const range={start:'2026-10-01',end:'2026-10-07'};
const daily=[{date:'2026-10-01',channel:'Instagram',views:0,available:['views']}];
function mount(){
 const slots=[],pending=[],requests=[];let cursor=0,props={unit:'Ysabel Society',range,comparison:'No Comparison'},value;
 const window=Object.assign(new EventTarget(),{setTimeout:()=>0}),document=Object.assign(new EventTarget(),{hidden:false});
 const react={
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},
  useRef(initial){const i=cursor++;if(!slots[i])slots[i]={current:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};pending.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}}
 };
 const exp={};new Function('require','exports','window','document',js)(id=>{
  if(id==='react')return react;
  if(id==='@/lib/read-with-retry')return {readWithRetry:(url,options)=>new Promise((resolve,reject)=>requests.push({url,signal:options.signal,resolve:body=>resolve(Response.json(body)),reject}))};
  if(id==='@/lib/analytics')return {filterDaily:()=>[],previousRange:r=>r,comparablePrevious:(_current,previous)=>previous};
  throw new Error(id);
 },exp,window,document);
 function render(next={}){props={...props,...next};cursor=0;value=exp.useSourceAnalytics(props.unit,props.range,props.comparison);while(pending.length)pending.shift()();return value;}
 const report={mode:'live',rows:daily,coverage:['Instagram'],sourceStatus:[{channel:'Instagram'}],posts:[{id:'story',linkClicks:16}],monthlyPosts:[],tables:[{kind:'audience'}]};
 render();return {render,requests,report,refresh:()=>window.dispatchEvent(new Event('ysabel:sources-updated')),unmount:()=>slots.forEach(s=>s?.cleanup?.())};
}
test('fast daily totals never claim that content details are loaded or empty',async t=>{
 const h=mount();t.after(h.unmount);h.requests.find(r=>r.url.includes('dailyOnly')).resolve({mode:'live',rows:daily});await flush();
 let state=h.render();assert.equal(state.ready,true);assert.equal(state.rows[0].views,0);assert.equal(state.detailsPending,true);assert.equal(state.detailsReady,false);
 h.requests.find(r=>!r.url.includes('dailyOnly')).resolve(h.report);await flush();state=h.render();assert.equal(state.detailsReady,true);assert.equal(state.posts[0].linkClicks,16);assert.equal(state.tables.length,1);
 h.refresh();h.render();assert.equal(h.render().detailsReady,true,'Background refresh keeps valid content visible');assert.equal(h.render().posts.length,1);
 h.requests.slice(2).forEach(r=>r.resolve(r.url.includes('dailyOnly')?{mode:'live',rows:daily}:h.report));await flush();assert.equal(h.render().detailsReady,true);
});
test('a failed full report retains valid totals and reports the missing detail load',async t=>{
 const h=mount();t.after(h.unmount);h.requests.find(r=>r.url.includes('dailyOnly')).resolve({mode:'live',rows:daily});await flush();h.requests.find(r=>!r.url.includes('dailyOnly')).reject(new Error('temporary outage'));await flush();
 const state=h.render();assert.equal(state.rows.length,1);assert.equal(state.detailsReady,false);assert.equal(state.detailsPending,true);assert.equal(state.error,'temporary outage');
});
test('changing dates aborts old requests and never displays old content as new-period data',async t=>{
 const h=mount();t.after(h.unmount);const old=h.requests.slice();h.render({range:{start:'2026-09-01',end:'2026-09-30'}});assert.ok(old.every(r=>r.signal.aborted));
 old.forEach(r=>r.resolve(h.report));await flush();assert.equal(h.render().ready,false);assert.deepEqual(h.render().posts,[]);
 const newer=h.requests.slice(2);newer.forEach(r=>r.resolve({...h.report,posts:[{id:'september'}]}));await flush();assert.equal(h.render().posts[0].id,'september');
});
