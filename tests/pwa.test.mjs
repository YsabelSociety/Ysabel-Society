import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
assert.equal(manifest.scope,'/marketingdata/');
assert.equal(manifest.start_url,manifest.scope);
assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const p=readFileSync('public'+icon.src.replace('/marketingdata',''));const n=Number(icon.sizes.split('x')[0]);assert.equal(p.readUInt32BE(16),n);assert.equal(p.readUInt32BE(20),n);}
const handlers={};let fail=false;const sentinel=new Response('online');
vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://ysabelsociety.com'},addEventListener:(k,v)=>handlers[k]=v},URL,Response,fetch:async()=>{if(fail)throw Error('offline');return sentinel;}});
let response;const run=(path,mode)=>{response=undefined;handlers.fetch({request:{url:'https://ysabelsociety.com'+path,mode},respondWith:p=>response=p});};
run('/marketingdata/api/inbox','cors');assert.equal(response,undefined);
run('/','navigate');assert.equal(response,undefined);
run('/marketingdata/','navigate');assert.equal(await response,sentinel);
fail=true;run('/marketingdata/','navigate');const offline=await response;assert.equal(offline.status,503);assert.equal(offline.headers.get('cache-control'),'no-store');assert.match(await offline.text(),/Connect to the internet/);
console.log('PWA manifest, icon dimensions, scope, online navigation and private API isolation passed.');
