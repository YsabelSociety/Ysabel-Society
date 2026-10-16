// Keep the complete MailSignal workspace on Ysabel's existing origin, where its
// saved browser connection and its /mailsignal API already live. Only this
// authenticated document can be framed, and only by the same Ysabel origin.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const backend = 'https://ysabel-society-intelligence.arberhalili1.chatgpt.site';
const source = 'https://ysabel-mailsignal.netlify.app/mailsignal';
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
function unavailable(status: number, message: string) {
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Marketing</title><body><h1>Email Marketing</h1><p>' + message + '</p><a href="/marketingdata/login" target="_top">Open Ysabel sign-in</a></body></html>', {
    status, headers:{...privateHeaders, 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"},
  });
}
export async function GET(request: Request) {
  const cookie = (request.headers.get('cookie') || '').split(';').map(part=>part.trim()).filter(part=>part.startsWith('ys_marketing_session=')).join('; ');
  if (!cookie) return unavailable(401, 'Sign in to your Ysabel workspace to continue.');
  try {
    // Validate the existing dashboard session without granting access or
    // forwarding any MailSignal key, browser authorization header or PIN.
    const session = await fetch(backend + '/marketingdata/api/state', {
      headers:{cookie}, cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(15000),
    });
    await session.body?.cancel();
    if (session.status !== 200) return unavailable([401,403,302,303,307,308].includes(session.status) ? 401 : 503, 'Your Ysabel session could not be verified. Reopen the app to continue.');
    const response = await fetch(source, {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(25000)});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return unavailable(502, 'MailSignal is temporarily unavailable. Refresh this workspace shortly.');
    const html = await response.text();
    if (!html.includes('/mailsignal/app.js') || !html.includes('connect-form')) return unavailable(502, 'MailSignal returned an unexpected page. Open the original workspace to check its status.');
    const headers = new Headers(privateHeaders);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    // Preserve MailSignal's restrictions, changing only the document's embedding
    // policy from DENY to SAMEORIGIN. The original public route is untouched.
    const csp = response.headers.get('content-security-policy') || "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; worker-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";
    const directives = csp.split(';').map(value=>value.trim()).filter(value=>value && !/^frame-ancestors(?:\s|$)/i.test(value));
    headers.set('Content-Security-Policy', [...directives, "frame-ancestors 'self'"].join('; '));
    headers.set('X-Ysabel-Email-Marketing', 'mailsignal-original');
    return new Response(request.method === 'HEAD' ? null : html, {headers});
  } catch {
    return unavailable(503, 'The Email Marketing connection is taking longer than expected. Refresh this workspace shortly.');
  }
}
export const HEAD = GET;
