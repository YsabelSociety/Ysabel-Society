import { identity, json, apiError } from '@/lib/server/db';
import {
  connectInstagramMessaging,
  readInstagramMessaging,
} from '@/lib/server/instagram-messaging';

export async function GET() {
  try {
    const grant = await readInstagramMessaging((await identity()).userId);
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
    const owner = (await identity(req)).userId;
    const raw = await req.text();
    if (raw.length > 10000)
      throw new Error('INPUT:Connection details are too long.');
    return json(await connectInstagramMessaging(owner, JSON.parse(raw)));
  } catch (e) {
    return apiError(e);
  }
}
