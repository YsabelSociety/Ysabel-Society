const assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync('components/ysabel/use-inbox-sync.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let cleanup,tick,visible;const calls=[],pending=[],events=[];
const document={visibilityState:'visible',addEventListener:(name,fn)=>visible=fn,removeEventListener:()=>{}};
const context={exports:{},require:()=>({useEffect:fn=>cleanup=fn()}),AbortController,AbortSignal,document,Event,
window:{dispatchEvent:e=>events.push(e.type)},setInterval:(fn,ms)=>{assert.equal(ms,60000);tick=fn;return 1;},clearInterval:()=>{},
fetch:(url,init)=>{calls.push(JSON.parse(init.body).source);return new Promise(resolve=>pending.push(resolve));}};
vm.runInNewContext(js,context);context.exports.useInboxSync(true);
assert.deepEqual(calls,['instagram','facebook'],'both platforms start immediately and independently');
tick();assert.equal(calls.length,2,'no overlapping import per platform');
pending[1]({ok:true});
setImmediate(()=>{tick();assert.deepEqual(calls,['instagram','facebook','facebook'],'slow Instagram must not block Facebook');
document.visibilityState='hidden';tick();assert.equal(calls.length,3);cleanup();console.log('PASS: inbox login import, separate platform concurrency, 60-second polling and hidden-tab pause');});
