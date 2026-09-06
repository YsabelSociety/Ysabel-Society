import { identity } from '@/lib/server/db';
import { connectorGroup } from '@/lib/connector-catalog';
import { finishOAuth, siteOrigin } from '@/lib/server/connector-oauth';
import { APP_BASE } from '@/lib/app-path';
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  let provider = '';
  let status = 'failed';
  try {
    const user = await identity(),
      group = connectorGroup((await params).provider);
    provider = group.id;
    await finishOAuth(user.userId, group.id, req);
    status = 'authorized';
  } catch {}
  const response = Response.redirect(
    siteOrigin(req) + '/connections?provider=' + provider + '&status=' + status,
    303,
  );
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  if (provider)
    headers.set(
      'Set-Cookie',
      `ys_oauth_${provider}=; HttpOnly; SameSite=Lax; Path=${APP_BASE}/api/oauth/${provider}; Max-Age=0${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`,
    );
  return new Response(null, { status: 303, headers });
}
