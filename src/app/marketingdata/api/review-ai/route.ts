import { aiStore, AI_MODEL, analysisKey, analyzeReview } from '../../../../lib/review-ai';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const upstream='https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function handle(req:Request) {
  try {
    if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin) return json({error:'Invalid request origin.'},403);
    const cookie=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>/^ys_marketing_(session|admin)=/.test(v)).join('; ');
    if(!cookie) return json({error:'Sign in first.'},401);
    const auth=await fetch(upstream+'community?kind=review',{headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!auth.ok||!auth.headers.get('content-type')?.includes('application/json')) return json({error:'Sign in again.'},401);
    const data=await auth.json();
    if(!Array.isArray(data.records)) return json({error:'Reviews are unavailable.'},503);
    const records=data.records.filter((r:{source:string;kind:string})=>r.source==='gbp'&&r.kind==='review');
    const s=aiStore(), config=await s.get('config',{type:'json'});
    const key=process.env.OPENAI_API_KEY||config?.key;
    const analyses=await s.get('analyses',{type:'json'});
    const pending=records.filter((r:Parameters<typeof analysisKey>[0])=>!analyses?.[analysisKey(r)]);
    if(req.method==='GET') return json({configured:!!key,model:AI_MODEL,total:records.length,completed:records.length-pending.length,pending:pending.length});
    const raw=await req.text();
    if(raw.length>2000) return json({error:'Request too large.'},413);
    const body=JSON.parse(raw);
    if(body.op==='configure') {
      const admin=await fetch(upstream+'admin-access',{headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!admin.ok || !(await admin.json()).unlocked) return json({error:'Unlock administrator access with your PIN first.'},403);
      if(typeof body.key!=='string'||!/^sk-[A-Za-z0-9_-]{20,500}$/.test(body.key)) return json({error:'Enter a valid OpenAI API key.'},400);
      const check=await fetch('https://api.openai.com/v1/models/'+AI_MODEL,{headers:{Authorization:'Bearer '+body.key},signal:AbortSignal.timeout(15000)});
      if(!check.ok) return json({error:'This key could not access the review model. Check the key and model permissions.'},400);
      await s.setJSON('config',{key:body.key});
      return json({configured:true});
    }
    if(body.op!=='analyze') return json({error:'Unknown operation.'},400);
    if(!key) return json({error:'Connect your OpenAI API key first.'},409);
    // Only saved reviews can be analyzed, and completed hashes are never billed again.
    const batch=pending.slice(0,2);
    const results=await Promise.allSettled(batch.map((r:Parameters<typeof analyzeReview>[0])=>analyzeReview(r,key)));
    const error=results.find(r=>r.status==='rejected');
    const completed=results.filter(r=>r.status==='fulfilled'&&r.value).length;
    if(error?.status==='rejected') return json({error:error.reason instanceof Error?error.reason.message:'Analysis failed.',completed},502);
    return json({completed,remaining:pending.length-completed,total:records.length});
  } catch { return json({error:'The review AI service is unavailable. Your original reviews are safe; retry later.'},503); }
}
export {handle as GET,handle as POST};
