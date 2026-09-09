import { identity, json, apiError } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/admin-access';
import { beginInstagramLogin, instagramLoginSettings, saveInstagramLogin } from '@/lib/server/instagram-login';
import {
  connectInstagramMessaging,
  setInstagramInboxSync,
  readInstagramMessaging,
  diagnoseInstagramMessaging,
} from '@/lib/server/instagram-messaging';

export async function GET() {
  try {
    const owner = (await requireAdmin()).userId;
    const grant = await readInstagramMessaging(owner);
    return json({ ...(await instagramLoginSettings(owner)), ...(
      grant
        ? {
            connected: true,
            username: grant.username,
            connectedAt: grant.connectedAt,
            autoSync: grant.autoSync !== false,
            route: 'direct-instagram',
          }
        : { connected: false }) });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const owner = (await requireAdmin(req)).userId;
    const raw = await req.text();
    if (raw.length > 10000)
      throw new Error('INPUT:Connection details are too long.');
    const body = JSON.parse(raw);
    if (body.op === 'auto-sync') return json(await setInstagramInboxSync(owner, body.enabled === true));
    if (body.op === 'login-setup') return json(await saveInstagramLogin(owner, body));
    if (body.op === 'login') {
      const result = await beginInstagramLogin(owner, req);
      return Response.json({url:result.url},{headers:{'Set-Cookie':result.cookie,'Cache-Control':'private, no-store'}});
    }
    return json(
      body.op === 'diagnose'
        ? await diagnoseInstagramMessaging(owner)
        : await connectInstagramMessaging(owner, body),
    );
  } catch (e) {
    return apiError(e);
  }
}
