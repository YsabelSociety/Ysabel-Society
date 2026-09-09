import { identity } from '@/lib/server/db';
import { siteOrigin } from '@/lib/server/connector-oauth';
import { finishInstagramLogin, instagramLoginCookie } from '@/lib/server/instagram-login';
export async function GET(req: Request) {
  let status = 'failed';
  try { await finishInstagramLogin((await identity()).userId, req); status = 'authorized'; } catch { /* Preserve the existing connection on a failed or cancelled exchange. */ }
  return new Response(null, {status:303,headers:{
    Location:siteOrigin(req)+'/?instagramLogin='+status+'#Inbox',
    'Set-Cookie':instagramLoginCookie('',new URL(req.url).protocol==='https:',true),
    'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',
  }});
}
