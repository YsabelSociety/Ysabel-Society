import { fetchPublicInstagramPhoto } from '@/lib/public-instagram-photo';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
const cache = new Map<string,{expires:number; bytes:Uint8Array; type:string}>();
const sessions = new Map<string,{expires:number; profiles:Promise<Set<string>>}>();
export async function GET(req: Request) {
  const missing=()=>new Response(null,{status:404,headers:{'Cache-Control':'private, max-age=300'}});
  try {
    const username=new URL(req.url).searchParams.get('username') || '';
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return missing();
    const cookie=(req.headers.get('cookie') || '').split(';').map(v=>v.trim()).filter(v=>v.startsWith('ys_marketing_session=')).join('; ');
    if(!cookie) return new Response(null,{status:401});
    const sessionKey=createHash('sha256').update(cookie).digest('hex');
    let session=sessions.get(sessionKey);
    if(!session || session.expires<Date.now()) {
      if(sessions.size>=10)sessions.delete(sessions.keys().next().value!);
      session={expires:Date.now()+30000,profiles:(async()=>{
        const auth=await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/community?kind=message',{
          headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),
        });
        if(!auth.ok || !auth.headers.get('content-type')?.includes('application/json')) throw new Error('Sign in first');
        const data=await auth.json();
        return new Set<string>((data.records || []).filter((p:{source:string;username?:string})=>p.source==='instagram' && p.username).map((p:{username:string})=>p.username.toLowerCase()));
      })()};sessions.set(sessionKey,session);
    }
    if(!(await session.profiles).has(username.toLowerCase())) return missing();
    const key=username.toLowerCase(); let entry=cache.get(key);
    if(!entry || entry.expires<Date.now()) {
      cache.delete(key);
      const url=await fetchPublicInstagramPhoto(username,6000); if(!url) return missing();
      const image=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(6000)});
      const type=(image.headers.get('content-type') || '').split(';')[0];
      if(!image.ok || !['image/jpeg','image/png','image/webp'].includes(type)) return missing();
      const reader=image.body?.getReader(); if(!reader)return missing();
      const chunks:Uint8Array[]=[];let size=0;
      try {while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>1000000)return missing();chunks.push(p.value);}}finally{await reader.cancel().catch(()=>{});}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      entry={bytes,type,expires:Date.now()+30*60000};
      if(cache.size>=50)cache.delete(cache.keys().next().value!);
      cache.set(key,entry);
    }
    return new Response(entry.bytes as BodyInit,{headers:{'Content-Type':entry.type,'Cache-Control':'private, max-age=1800','X-Content-Type-Options':'nosniff'}});
  } catch {return missing();}
}
