import { identity, database, apiError } from '@/lib/server/db';
import { unseal } from '@/lib/server/connector-vault';
import { providerPhotoURL } from '@/lib/profile-photo';
import type { CommunityRecord } from '@/lib/community';
export async function GET(req: Request) {
  try {
    const owner=(await identity()).userId, q=new URL(req.url).searchParams, source=q.get('source'), id=q.get('id');
    if (!['facebook','instagram'].includes(source || '') || !id || id.length>250) throw new Error('INPUT:Invalid profile.');
    const row=await database().prepare("SELECT encrypted FROM community_records WHERE owner=? AND source=? AND kind='profile' AND id=?").bind(owner,source,id).first<{encrypted:string}>();
    if (!row) return new Response(null,{status:404});
    const profile=await unseal<CommunityRecord>(row.encrypted,owner+':community:'+source+':profile:'+id);
    let url=providerPhotoURL(profile.avatar);
    for(let n=0;url && n<3;n++) {
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000)});
      if ([301,302,303,307,308].includes(response.status)) { url=providerPhotoURL(new URL(response.headers.get('location') || '',url).href); continue; }
      const type=(response.headers.get('content-type') || '').split(';')[0];
      if (!response.ok || !['image/jpeg','image/png','image/webp','image/gif'].includes(type) || Number(response.headers.get('content-length'))>1500000) break;
      // Bounded streaming prevents oversized upstream images exhausting a Worker.
      const reader=response.body?.getReader(); if(!reader) break;
      const chunks:Uint8Array[]=[]; let size=0;
      while(true) {const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1500000){await reader.cancel();return new Response(null,{status:413});}chunks.push(r.value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
    }
    return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
  } catch(e) {return apiError(e);}
}
