import { identity } from '@/lib/server/db';
import { siteOrigin } from '@/lib/server/connector-oauth';
import {
  businessCookie,
  finishBusinessAuthorization,
} from '@/lib/server/tiktok-business';
export async function GET(req: Request) {
  let status = 'failed';
  try {
    const user = await identity();
    await finishBusinessAuthorization(user.userId, req);
    status = 'authorized';
  } catch {}
  return new Response(null, {
    status: 303,
    headers: {
      Location: siteOrigin(req) + '/tiktok-business?status=' + status,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': businessCookie('', req, true),
    },
  });
}
