import { identity, json, apiError, requireText } from '@/lib/server/db';
import {
  historyStatus,
  startHistory,
  stepHistory,
} from '@/lib/server/history-import';
export async function GET() {
  try {
    return json(await historyStatus((await identity()).userId));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const owner = (await identity(req)).userId,
      body = (await req.json()) as Record<string, unknown>,
      source = requireText(body.source, 30);
    if (body.op === 'start')
      return json(await startHistory(owner, source, body.restart === true));
    if (body.op === 'step') return json(await stepHistory(owner, source));
    throw new Error('INPUT:Choose a history import action.');
  } catch (e) {
    return apiError(e);
  }
}
