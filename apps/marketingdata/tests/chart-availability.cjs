const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript'),cache=new Map();
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file);const exp={};cache.set(file,exp);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',js)(id=>id.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(file),id))+'.ts'):id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id),exp);return exp;}
const model=load('lib/chart-availability.ts');
const row=available=>({channel:'TikTok',date:'2026-10-07',views:0,followers:1779,available});
test('automatic chart selection opens on a metric actually supplied by that source',()=>{
 assert.equal(model.selectedChartMetric([row(['followers'])],'views'),'followers');
 assert.deepEqual(model.availableChartMetrics([row(['followers'])]),['followers']);
});
test('supplied zero is a usable chart metric, while a missing value never becomes zero',()=>{
 assert.equal(model.selectedChartMetric([row(['views','followers'])],'views'),'views');
 assert.deepEqual(model.availableChartMetrics([row([])]),[]);
 assert.equal(model.selectedChartMetric([],'views'),'views');
});
test('a chart dedicated to a named metric never substitutes a different number',()=>{
 assert.equal(model.selectedChartMetric([row(['followers'])],'views','views'),'views');
});
