export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const origin = 'https://ysabel-mailsignal.netlify.app';
const noCache = {'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
async function relay(request: Request, context: {params:Promise<{path:string[]}>}) {
  const {path} = await context.params;
  if (!path.length || path.length > 3 || path.some(part=>!/^[-a-z0-9]+$/i.test(part))) return Response.json({error:'Unknown email action.'},{status:404,headers:noCache});
  const route = path.join('/');
  const cookie = (request.headers.get('cookie') || '').split(';').map(value=>value.trim()).find(value=>value.startsWith('ys_marketing_session='));
  if (!cookie) return Response.json({error:'Sign in to Ysabel Society to view email activity.'},{status:401,headers:noCache});
  if (!['GET','HEAD'].includes(request.method)) {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Reopen this action inside Ysabel Society.'},{status:403,headers:noCache});
    if (Number(request.headers.get('content-length') || 0) > 4500000) return Response.json({error:'This file is too large.'},{status:413,headers:noCache});
  }
  try {
    // Always validate the Ysabel session. A saved MailSignal key can retain its
    // original management actions; keyless devices receive only the scoped
    // reports and Gmail refresh bridge, never a reusable administrator key.
    const validation = await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/state',{headers:{cookie},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12000)});
    await validation.body?.cancel();
    if(validation.status!==200) return Response.json({error:'Your Ysabel session has expired. Sign in again.'},{status:validation.status>=500?503:401,headers:noCache});
    const authorization = request.headers.get('authorization');
    const headers = new Headers();
    let target: URL;
    if (authorization?.startsWith('Bearer ') && route !== 'snapshot') {
      // These paths are the existing MailSignal API, not arbitrary forwarding.
      if (!/^(status|messages(?:\/[a-f0-9]{32}(?:\/(?:outcome|activate))?)?|documents(?:\/[a-f0-9]{32})?|integrations|gmail\/(?:sync|connect|disconnect))$/.test(route)) return Response.json({error:'Unknown email action.'},{status:404,headers:noCache});
      target = new URL('/mailsignal/api/' + route,origin); headers.set('authorization',authorization);
    } else {
      const read = request.method==='GET' && ['status','snapshot','messages','documents','integrations'].includes(route);
      if(!read && !(request.method==='POST' && route==='gmail/sync')) return Response.json({error:'Open the original email workspace to manage this action.'},{status:403,headers:noCache});
      target = new URL('/mailsignal/api/dashboard/' + route,origin);
      headers.set('x-ysabel-dashboard-session',cookie.slice('ys_marketing_session='.length));
    }
    if(request.headers.get('content-type')) headers.set('content-type',request.headers.get('content-type')!);
    const result=await fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000)} as RequestInit);
    const responseHeaders = new Headers(noCache);
    responseHeaders.set('Content-Type',result.headers.get('content-type') || 'application/json');
    return new Response(result.body,{status:result.status,headers:responseHeaders});
  } catch {
    return Response.json({error:'Email activity could not be refreshed. Your saved records remain on the server.'},{status:503,headers:noCache});
  }
}
export {relay as GET,relay as POST,relay as DELETE};
