const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require(path.join(root,'apps/marketingdata/node_modules/typescript'));
const model={};new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'apps/marketingdata/lib/website-geography.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(model);
const city=(id,country,lat,region)=>[id,'Springfield',country,lat,0,['springfield'],[region]];
test('city mapping cannot mix countries or guess between same-name towns',()=>{
 const references=new Map([['US',[city('us-1','US',1,'illinois'),city('us-2','US',2,'massachusetts')]],['GB',[city('gb-1','GB',3,'scotland')]]]);
 const base={city:'Springfield',sessions:1,activeUsers:1,engagedSessions:0};
 const result=model.locateCities([{...base,countryId:'US',region:'Illinois'},{...base,countryId:'US'},{...base,countryId:'GB'},{...base,countryId:'XK'}],references);
 assert.deepEqual(result.points.map(x=>x.lat),[1,3]);assert.equal(result.unmapped.length,2);
});
test('unknown locations and missing values remain explicit; CSV is safe to open',()=>{
 assert.equal(model.locationName('(not set)'),'Location not reported');assert.equal(model.countryCode({countryId:'(not set)'}),'');
 const csv=model.geographyCSV([{country:'=HYPERLINK("evil")',countryId:'XX',city:'A, B',sessions:0,activeUsers:null,engagedSessions:2}]);
 assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));assert.ok(csv.includes('"A, B"'));assert.ok(csv.includes('"0","","2"'));
});
