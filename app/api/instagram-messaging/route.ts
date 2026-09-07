import { identity, json, apiError } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/admin-access';
import {
  connectInstagramMessaging,
  readInstagramMessaging,
  diagnoseInstagramMessaging,
} from '@/lib/server/instagram-messaging';

export async function GET() {
  try {
    const grant = await readInstagramMessaging((await requireAdmin()).userId);
    return json(
      grant
        ? {
            connected: true,
            username: grant.username,
            connectedAt: grant.connectedAt,
          }
        : { connected: false },
    );
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
    return json(
      body.op === 'diagnose'
        ? await diagnoseInstagramMessaging(owner)
        : await connectInstagramMessaging(owner, body),
    );
  } catch (e) {
    return apiError(e);
  }
}
