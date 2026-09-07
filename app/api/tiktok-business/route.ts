import { identity, apiError, json } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/admin-access';
import {
  businessConnectionStatus,
  saveBusinessApp,
  startBusinessAuthorization,
} from '@/lib/server/tiktok-business';
export async function GET(req: Request) {
  try {
    const user = await requireAdmin();
    return json(await businessConnectionStatus(user.userId, req));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await requireAdmin(req),
      raw = await req.text();
    if (raw.length > 12000)
      throw new Error('INPUT:Connection settings are too large.');
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error('INPUT:Invalid connection settings.');
    }
    if (body.op === 'save')
      return json(await saveBusinessApp(user.userId, body, req));
    if (body.op === 'authorize') {
      const r = await startBusinessAuthorization(user.userId, req);
      return Response.json(
        { url: r.url },
        {
          headers: {
            'Set-Cookie': r.cookie,
            'Cache-Control': 'private, no-store',
          },
        },
      );
    }
    throw new Error('INPUT:Choose a valid connection action.');
  } catch (e) {
    return apiError(e);
  }
}
