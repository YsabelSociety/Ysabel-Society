import { calendarDate } from '@/lib/sync-window';
import {
  database,
  identity,
  apiError,
  json,
  requireDate,
} from '@/lib/server/db';
import {
  filterDaily,
  consolidateDaily,
  BRAND_NAME,
  type Daily,
} from '@/lib/analytics';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { googlePeriodTable } from '@/lib/google-business';
export async function GET(req: Request) {
  try {
    const user = await identity(),
      q = new URL(req.url).searchParams;
    const start = requireDate(q.get('start')),
      end = requireDate(q.get('end')),
      unit = BRAND_NAME;
    if (start > end) throw new Error('INPUT:Invalid date range.');
    const db = database();
    const accounts = await db
      .prepare(
        'SELECT id,channel,status,last_sync FROM platform_accounts WHERE owner=? AND enabled=1',
      )
      .bind(user.userId)
      .all();
    if (!accounts.results.length)
      return json({
        mode: 'demo',
        rows: filterDaily(unit, { start, end }),
        coverage: [],
        posts: [],
        tables: [],
        label: 'Demo Data',
      });
    const records = await db
      .prepare(
        'SELECT m.normalized FROM account_metrics_daily m JOIN platform_accounts a ON a.id=m.account_id WHERE a.owner=? AND a.enabled=1 AND m.date>=? AND m.date<=?',
      )
      .bind(user.userId, start, end)
      .all();
    const rows = consolidateDaily(
      records.results.map((r: any) => JSON.parse(r.normalized) as Daily),
    );
    const postRows = await db
      .prepare(
        'SELECT p.payload FROM source_posts p JOIN platform_accounts a ON a.id=p.account_id WHERE a.owner=? AND a.enabled=1 AND p.published_date>=? AND p.published_date<=? ORDER BY p.published_date DESC LIMIT 5000',
      )
      .bind(user.userId, start, end)
      .all<{ payload: string }>();
    const today = calendarDate('Europe/Tirane');
    const monthlyPosts = await db.prepare('SELECT p.payload FROM source_posts p JOIN platform_accounts a ON a.id=p.account_id WHERE a.owner=? AND a.enabled=1 AND p.published_date>=? AND p.published_date<=? ORDER BY p.published_date DESC').bind(user.userId, today.slice(0,7)+'-01', today).all<{payload:string}>();
    const tableRows = await db
      .prepare(
        "SELECT r.payload,r.period_start,r.period_end,r.updated_at,a.channel FROM source_reports r JOIN platform_accounts a ON a.id=r.account_id WHERE a.owner=? AND a.enabled=1 AND ((r.period_start<=? AND r.period_end>=?) OR a.channel='Google Business') ORDER BY r.updated_at DESC",
      )
      .bind(user.userId, end, start)
      .all<{
        payload: string;
        period_start: string;
        period_end: string;
        updated_at: string;
        channel: string;
      }>();
    const tables = tableRows.results
      .map((r) => JSON.parse(r.payload))
      .filter(
        (t) =>
          t.rows.some((r: any) => r.date) ||
          googlePeriodTable(t) ||
          (t.period.start === start && t.period.end === end) ||
          t.key.startsWith('audience-'),
      )
      .map((t) => ({
        ...t,
        rows: t.rows.some((r: any) => r.date)
          ? t.rows.filter((r: any) => r.date >= start && r.date <= end)
          : t.rows,
      }));
    const tableMap = new Map<string, any>();
    for (const table of tables) {
      const key =
          table.source +
          ':' +
          table.key +
          (googlePeriodTable(table)
            ? ':' + table.period.start + ':' + table.period.end
            : ''),
        prior = tableMap.get(key);
      if (!prior) {
        tableMap.set(key, table);
        continue;
      }
      if (!table.rows.some((r: any) => r.date)) {
        if (
          table.key.startsWith('audience-') &&
          table.period.end > prior.period.end
        )
          tableMap.set(key, table);
        continue;
      }
      const rowKey = (r: any) =>
        JSON.stringify(
          Object.entries(r).filter(
            ([key, value]) => key === 'date' || typeof value === 'string',
          ),
        );
      const seen = new Set(prior.rows.map(rowKey));
      for (const row of table.rows)
        if (!seen.has(rowKey(row))) {
          prior.rows.push(row);
          seen.add(rowKey(row));
        }
      prior.period = {
        start:
          prior.period.start < table.period.start
            ? prior.period.start
            : table.period.start,
        end:
          prior.period.end > table.period.end
            ? prior.period.end
            : table.period.end,
      };
      prior.scope += '';
    }
    const profiles = await db
      .prepare(
        'SELECT source,label,snapshot FROM connector_links WHERE owner=?',
      )
      .bind(user.userId)
      .all<{ source: string; label: string; snapshot: string | null }>();
    return json({
      mode: 'live',
      rows,
      coverage: [
        ...new Set(
          [
            ...rows.filter((r) => r.available?.length).map((r) => r.channel),
            ...[...tableMap.values()]
              .filter((r) => r.rows?.length)
              .map((r) => SOURCE_CHANNELS[r.source]),
            ...postRows.results.map((r) => JSON.parse(r.payload).platform),
          ].filter(Boolean),
        ),
      ],
      sourceStatus: accounts.results.map((a: any) => ({
        channel: a.channel,
        status: a.status,
        lastSync: a.last_sync || null,
      })),
      posts: postRows.results.map((r) => JSON.parse(r.payload)),
      monthlyPosts: monthlyPosts.results.map(r => JSON.parse(r.payload)),
      tables: [...tableMap.values()],
      accounts: profiles.results.map((p) => ({
        source: p.source,
        label: p.label,
        snapshot: p.snapshot ? JSON.parse(p.snapshot) : null,
      })),
      label: 'Imported source reports',
    });
  } catch (e) {
    return apiError(e);
  }
}
