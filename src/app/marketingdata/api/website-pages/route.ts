import catalog from '@/data/website-pages.json';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const noCache={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request){
 const cookie=(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>/^ys_marketing_session=[a-f0-9]{64}$/.test(value));
 if(!cookie)return Response.json({error:'Sign in to view published page data.'},{status:401,headers:noCache});
 try{const validation=await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/state',{headers:{cookie},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12000)});await validation.body?.cancel();if(validation.status!==200)return Response.json({error:'Your Ysabel session could not be verified.'},{status:validation.status>=500?503:401,headers:noCache});return Response.json(catalog,{headers:noCache});}
 catch{return Response.json({error:'Published pages could not be loaded. Please retry.'},{status:503,headers:noCache});}
}
