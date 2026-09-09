import { identity } from '@/lib/server/db';
import { siteOrigin } from '@/lib/server/connector-oauth';
import { finishInstagramLogin, instagramLoginCookie } from '@/lib/server/instagram-login';
import { saveCommunityStatus } from '@/lib/server/community-store';
export async function GET(req: Request) {
  let status = 'failed';
  let owner='';
  try { owner=(await identity()).userId; await finishInstagramLogin(owner, req); status = 'authorized'; }
  catch(e) {
    if (owner) {
      const detail=e instanceof Error && e.message.startsWith('INPUT:') ? e.message.slice(6) : 'Instagram sign-in could not finish. Try again from Access & import.';
      try {await saveCommunityStatus(owner,{source:'instagram',kind:'message',state:'needs-attention',detail});}catch { /* Still return to the inbox if status storage is unavailable. */ }
    }
  }
  return new Response(null, {status:303,headers:{
    Location:siteOrigin(req)+'/?instagramLogin='+status+'#Inbox',
    'Set-Cookie':instagramLoginCookie('',new URL(req.url).protocol==='https:',true),
    'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',
  }});
}
