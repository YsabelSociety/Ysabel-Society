import { enrichReviews } from '../../../../lib/review-enrichment';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const json = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req: Request) {
  const allowedOrigins=new Set(['https://ysabelsociety.com','https://www.ysabelsociety.com']);
  const local=new URL(req.url); if(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(local.hostname)) allowedOrigins.add(local.origin);
  if(!allowedOrigins.has(req.headers.get('origin')||'')) return json({error:'Invalid origin'},403);
  const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('ys_marketing_session=')).join('; ');
  if(!cookie) return json({error:'Sign in first'},401);
  try {
    const raw=await req.text();
    if(raw.length>12000) return json({error:'Request too large'},413);
    const {items}=JSON.parse(raw);
    if(!Array.isArray(items)||items.length>8) return json({error:'Invalid selection'},400);
    const auth=await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/community?kind=review',{headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!auth.ok||!auth.headers.get('content-type')?.includes('application/json')) return json({error:'Sign in again'},401);
    const data=await auth.json();
    if(!Array.isArray(data.records)) return json({error:'Reviews unavailable'},503);
    const records=await enrichReviews(data.records) as Array<{source?:string;kind?:string;accountId?:string;id?:string;avatar?:string;reviewPhotos?:{url:string}[]}>;
    const images=await Promise.all(items.map(async (item) => {
      const r=records.find(r=>r.source==='gbp'&&r.kind==='review'&&r.accountId===item.accountId&&r.id===item.id);
      const index=item.photoIndex;
      const photos=r?.reviewPhotos as {url:string}[]|undefined;
      const url=index===undefined?r?.avatar:(Number.isInteger(index)&&index>=0?photos?.[index]?.url:null);
      if(typeof url!=='string') return null;
      const u=new URL(url);
      if(u.protocol!=='https:'||u.username||u.password||u.port||!/(^|\.)googleusercontent\.com$/.test(u.hostname)) return null;
      try {
        const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(8000)});
        const type=(response.headers.get('content-type')||'').split(';')[0];
        if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type)||!response.body) return null;
        const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();return null;}chunks.push(value);}
        return {accountId:item.accountId,id:item.id,photoIndex:index,data:`data:${type};base64,${Buffer.concat(chunks).toString('base64')}`};
      } catch {return null;}
    }));
    return json({images:images.filter(Boolean)});
  } catch {return json({error:'Review images could not be loaded'},503);}
}


