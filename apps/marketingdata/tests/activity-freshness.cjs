const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript');
function load(name){const exp={};new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exp);return exp;}
const {activitySeries}=load('activity-series'),{latestMetricDate,suppliedMetricRows}=load('source-status');
const range={start:'2026-10-01',end:'2026-10-07'};
const rows=[{channel:'Website',date:'2026-10-01',pageViews:0,available:['pageViews']},{channel:'Website',date:'2026-10-05',pageViews:25,available:['pageViews']},{channel:'Website',date:'2026-10-07',pageViews:0,available:['sessions']},{channel:'Website',date:'2026-09-30',pageViews:500,available:['pageViews']}];
test('current-period timeline includes today without inventing missing activity or leaking older dates',()=>{const data=activitySeries(rows,'Website','pageViews',range);assert.equal(data.length,7);assert.equal(data[0].value,0);assert.equal(data.at(-1).date,'2026-10-07');assert.equal(data.at(-1).value,null);assert.equal(data.reduce((sum,row)=>sum+(row.value||0),0),25);});
test('connection checks and unrelated metrics never redatestamp a metric',()=>{assert.equal(latestMetricDate(rows,'pageViews'),'2026-10-05');assert.equal(suppliedMetricRows(rows,'pageViews').length,3);});
test('an empty period remains empty rather than showing artificial zeros',()=>{assert.ok(activitySeries([],'Website','pageViews',range).every(p=>p.value===null));});
