const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript');
function load(file,requireModule,globals={}) {
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('require','exports',...Object.keys(globals),js)(requireModule,exports,...Object.values(globals));return exports;
}
test('homepage links retain the specific platform and measurement',()=>{
 const {dashboardDestination}=load('lib/dashboard-navigation.ts',()=>{});
 for(const [channel,metric,page] of [['Instagram','views','Performance'],['Facebook','profileViews','Performance'],['TikTok','profileViews','Performance'],['Website','pageViews','Website'],['Website','sessions','Website'],['Google Business','search','Google Business'],['Google Business','maps','Google Business'],['Google Business','reviews','Google Business'],['All','reach','Performance']]) assert.deepEqual(dashboardDestination(channel,metric),{page,channel,metric});
});
test('reopening retained Performance switches the platform and exits a previous Stories view',()=>{
 const slots=[],effects=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},useMemo(fn){return fn();},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){slots[i]={deps};effects.push(fn);}}};
 const jsx=(type,props)=>({type,props});
 const mod=load('components/ysabel/analytics-pages.tsx',id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='@/lib/analytics'?{CHANNELS:['Instagram','Facebook','TikTok','Website','Google Business']}:new Proxy({},{get:()=>()=>null}));
 const props={rows:[],previous:[],data:{posts:[],annotations:[],busy:false,ready:true},unit:'Ysabel Society',range:{start:'2026-10-01',end:'2026-10-07'}};
 function render(navigation){cursor=0;let tree=mod.PerformancePage({...props,navigation});while(effects.length)effects.shift()();cursor=0;return mod.PerformancePage({...props,navigation});}
 function walk(n,match){if(!n||typeof n!=='object')return null;if(match(n))return n;for(const c of [n.props?.children].flat(Infinity)){const v=walk(c,match);if(v)return v;}return null;}
 let tree=render({id:1,page:'Performance',channel:'Instagram',metric:'views'});assert.equal(tree.props['data-platform'],'Instagram');
 const sub=walk(tree,n=>n.props?.value==='Overview'&&typeof n.props?.onValueChange==='function');sub.props.onValueChange('Stories');
 tree=render({id:2,page:'Performance',channel:'Facebook',metric:'profileViews'});assert.equal(tree.props['data-platform'],'Facebook');assert.ok(walk(tree,n=>n.props?.value==='Overview'));
 tree=render({id:3,page:'Performance',channel:'TikTok',metric:'views'});assert.equal(tree.props['data-platform'],'TikTok');
});
test('metric jump waits for its visible platform and lazy anchor rather than focusing hidden homepage data',()=>{
 let effect,observer,selected=false;const calls=[];
 const hidden={closest:()=>({hidden:true})};
 const visible={closest:()=>null,scrollIntoView:()=>calls.push('scroll'),focus:()=>calls.push('focus')};
 const root={querySelector:()=>selected?{}:null,querySelectorAll:()=>[hidden,visible]};
 class Observer{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}}
 const {useDashboardNavigation}=load('components/ysabel/use-dashboard-navigation.ts',()=>({useEffect:fn=>effect=fn}),{document:{body:{},querySelector:()=>root},window:{setTimeout:()=>1},CSS:{escape:s=>s},MutationObserver:Observer,requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame:()=>{},clearTimeout:()=>{}});
 useDashboardNavigation({id:1,page:'Performance',channel:'Instagram',metric:'views'},'Performance');effect();assert.deepEqual(calls,[]);
 selected=true;observer.fn();assert.deepEqual(calls,['scroll','focus']);assert.equal(observer.disconnected,true);
});
