import { identity, json, apiError, secrets } from '@/lib/server/db';
import { constantEqual } from '@/lib/password';
import {
  readRefresh,
  startRefresh,
  stepRefresh,
} from '@/lib/server/refresh-jobs';

async function principal(req: Request) {
  const bearer = req.headers.get('authorization');
  if (bearer) {
    const settings = secrets();
    const expected = settings.MARKETING_SYNC_SECRET;
    if (
      !expected ||
      expected.length < 40 ||
      !settings.MARKETING_OWNER_ID ||
      !constantEqual(bearer, 'Bearer ' + expected)
    )
      throw new Error('UNAUTHORIZED');
    return { owner: settings.MARKETING_OWNER_ID, scheduled: true };
  }
  return { owner: (await identity(req)).userId, scheduled: false };
}
export async function GET(req: Request) {
  try {
    const { owner } = await principal(req);
    return json({
      job: await readRefresh(owner),
      schedule: secrets().MARKETING_SYNC_SCHEDULE || null,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const { owner, scheduled } = await principal(req);
    const raw = await req.text();
    if (raw.length > 2000) throw new Error('INPUT:Invalid refresh request.');
    const body = JSON.parse(raw);
    if (body.op === 'start')
      return json(
        await startRefresh(
          owner,
          scheduled
            ? 'scheduled'
            : body.force === true
              ? 'manual'
              : 'automatic',
          scheduled || body.force === true,
        ),
      );
    if (body.op === 'step' && typeof body.id === 'string')
      return json(await stepRefresh(owner, body.id));
    throw new Error('INPUT:Choose a valid refresh action.');
  } catch (e) {
    return apiError(e);
  }
}
