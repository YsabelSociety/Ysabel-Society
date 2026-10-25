import type {ReportTable} from './reporting';
export type PublicWebsitePage={path:string;title:string;kind:string;trackingEnabled:boolean};
export function publicPageKey(value:string){try{const url=new URL(value,'https://ysabelsociety.com');if(!['ysabelsociety.com','www.ysabelsociety.com'].includes(url.hostname)||!/^https?:$/.test(url.protocol))return null;return url.pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';}catch{return null;}}
export function publicPageMetrics(page:PublicWebsitePage,tables:ReportTable[]){
 const key=publicPageKey(page.path);
 const views=tables.find(table=>table.key==='website-pages'&&table.source==='ga4'),landing=tables.find(table=>table.key==='website-landing'&&table.source==='ga4');
 const total=(table:ReportTable|undefined,dimension:string,metric:string)=>{if(key===null)return null;const rows=table?.rows.filter(row=>typeof row[dimension]==='string'&&publicPageKey(String(row[dimension]))===key&&typeof row[metric]==='number');return rows?.length?rows.reduce((sum,row)=>sum+Number(row[metric]),0):null;};
 return{views:total(views,'pagePath','screenPageViews'),engagementSeconds:total(views,'pagePath','userEngagementDuration'),landingVisits:total(landing,'landingPage','sessions'),observedAt:views?.observedAt,period:views?.period,partial:Boolean(views?.truncated||landing?.truncated)};
}
