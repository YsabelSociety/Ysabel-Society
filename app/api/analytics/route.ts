import {
  database,
  identity,
  apiError,
  json,
  requireDate,
} from '@/lib/server/db';
import { filterDaily, type Daily } from '@/lib/analytics';
export async function GET(req: Request) {
  try {
    const user = await identity(),
      q = new URL(req.url).searchParams;
    const start = requireDate(q.get('start')),
      end = requireDate(q.get('end')),
      unit = q.get('unit') || 'All Ysabel';
    if (start > end) throw new Error('INPUT:Invalid date range.');
    const db = database();
    const accounts = await db
      .prepare(
        'SELECT id,channel FROM platform_accounts WHERE owner=? AND enabled=1 AND last_sync IS NOT NULL',
      )
      .bind(user.userId)
      .all();
    if (!accounts.results.length)
      return json({
        mode: 'demo',
        rows: filterDaily(unit, { start, end }),
        coverage: [],
        label: 'Demo Data',
      });
    const records = await db
      .prepare(
        'SELECT m.normalized FROM account_metrics_daily m JOIN platform_accounts a ON a.id=m.account_id WHERE a.owner=? AND a.enabled=1 AND m.date>=? AND m.date<=?',
      )
      .bind(user.userId, start, end)
      .all();
    const rows = records.results
      .map((r: any) => JSON.parse(r.normalized) as Daily)
      .filter((r) => unit === 'All Ysabel' || r.unit === unit);
    return json({
      mode: 'live',
      rows,
      coverage: accounts.results.map((a: any) => a.channel),
      label: 'Live data · connected sources only',
    });
  } catch (e) {
    return apiError(e);
  }
}
