import { type Daily, type Range, type Post } from '@/lib/analytics';
import {
  mergeDaily,
  mergePost,
  validateImportSize,
  type ImportResult,
} from '@/lib/reporting';
import { database } from './db';
import { importGA4, importGBP, type ReportingContext } from './report-google';
import { importMeta } from './report-meta';
import { importTikTok } from './report-tiktok';
import { importAdvertising } from './report-ads';
export async function importSource(
  source: string,
  context: ReportingContext,
  range: Range,
) {
  return source === 'ga4'
    ? importGA4(context, range)
    : source === 'gbp'
      ? importGBP(context, range)
      : source === 'instagram' || source === 'facebook'
        ? importMeta(context, source, range)
        : source === 'tiktok'
          ? importTikTok(context, range)
          : importAdvertising(context, source, range);
}
export async function persistImport(
  owner: string,
  source: string,
  externalId: string,
  result: ImportResult,
  range: Range,
) {
  validateImportSize(result);
  const db = database(),
    account = owner + ':' + source + ':' + externalId,
    now = new Date().toISOString();
  const previous = await db
    .prepare(
      'SELECT date,normalized FROM account_metrics_daily WHERE account_id=? AND date>=? AND date<=?',
    )
    .bind(
      account,
      [range.start, ...result.daily.map((r) => r.date)].sort()[0],
      [
        range.end,
        new Date().toISOString().slice(0, 10),
        ...result.daily.map((r) => r.date),
      ]
        .sort()
        .at(-1),
    )
    .all<{ date: string; normalized: string }>();
  const old = new Map(
    previous.results.map((r) => [r.date, JSON.parse(r.normalized) as Daily]),
  );
  const guard =
    ' EXISTS(SELECT 1 FROM connector_links WHERE owner=? AND source=? AND external_id=?)';
  const oldPosts = new Map<string, Post>();
  for (let offset = 0; offset < result.posts.length; offset += 50) {
    const ids = result.posts.slice(offset, offset + 50).map((p) => p.id);
    const saved = await db
      .prepare(
        'SELECT post_id,payload FROM source_posts WHERE account_id=? AND post_id IN (' +
          ids.map(() => '?').join(',') +
          ')',
      )
      .bind(account, ...ids)
      .all<{ post_id: string; payload: string }>();
    for (const row of saved.results)
      oldPosts.set(row.post_id, JSON.parse(row.payload) as Post);
  }
  const statements = [
    ...result.daily.map((current) => {
      const row = mergeDaily(old.get(current.date), current);
      row.sourceMetrics = {
        ...old.get(current.date)?.sourceMetrics,
        ...current.sourceMetrics,
        metricObservedAt: {
          ...((old.get(current.date)?.sourceMetrics?.metricObservedAt ||
            {}) as Record<string, string>),
          ...Object.fromEntries((current.available || []).map((k) => [k, now])),
        },
      };
      return db
        .prepare(
          'INSERT INTO account_metrics_daily(account_id,date,normalized,source_metrics,updated_at) SELECT ?,?,?,?,? WHERE' +
            guard +
            ' ON CONFLICT(account_id,date) DO UPDATE SET normalized=excluded.normalized,source_metrics=excluded.source_metrics,updated_at=excluded.updated_at',
        )
        .bind(
          account,
          row.date,
          JSON.stringify(row),
          JSON.stringify(row.sourceMetrics || {}),
          now,
          owner,
          source,
          externalId,
        );
    }),
    ...result.posts.map((post) =>
      db
        .prepare(
          'INSERT INTO source_posts(account_id,post_id,published_date,payload,updated_at) SELECT ?,?,?,?,? WHERE' +
            guard +
            ' ON CONFLICT(account_id,post_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
        )
        .bind(
          account,
          post.id,
          post.date,
          JSON.stringify(mergePost(oldPosts.get(post.id), post)),
          now,
          owner,
          source,
          externalId,
        ),
    ),
    ...result.tables.map((table) =>
      db
        .prepare(
          'INSERT INTO source_reports(account_id,report_key,period_start,period_end,payload,updated_at) SELECT ?,?,?,?,?,? WHERE' +
            guard +
            ' ON CONFLICT(account_id,report_key,period_start,period_end) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
        )
        .bind(
          account,
          table.key,
          table.period.start,
          table.period.end,
          JSON.stringify({ ...table, observedAt: now }),
          now,
          owner,
          source,
          externalId,
        ),
    ),
  ];
  for (let i = 0; i < statements.length; i += 40)
    await db.batch(statements.slice(i, i + 40));
  return { account, now };
}
