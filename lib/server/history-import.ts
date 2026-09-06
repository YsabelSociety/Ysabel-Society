import { database } from './db';
import { accessGrant, getApp, type Resource } from './connector-oauth';
import { readVault } from './connector-vault';
import { readDirect, directContext } from './connection-direct';
import { importSource, persistImport } from './report-import';
import type { ReportingContext } from './report-google';
import type { ConnectorLink } from './connector-sync';
import { requestJSON } from './providers';
import { websiteReportFilter } from '@/lib/website-source';
import type { HistoryProgress } from '@/lib/history-progress';
export const HISTORY_SOURCES = [
  'instagram',
  'facebook',
  'tiktok',
  'ga4',
  'gbp',
];
const day = (time: number) => new Date(time).toISOString().slice(0, 10);
const today = () => day(Date.now());
async function connection(owner: string, source: string) {
  if (!HISTORY_SOURCES.includes(source))
    throw new Error('INPUT:Choose a supported reporting source.');
  const link = await database()
    .prepare('SELECT * FROM connector_links WHERE owner=? AND source=?')
    .bind(owner, source)
    .first<ConnectorLink>();
  if (!link || String(link.provider) === 'file')
    throw new Error(
      'INPUT:Connect a provider account before importing its history.',
    );
  const direct = await readDirect(owner, source),
    tracking = await readVault<Partial<ReportingContext>>(
      owner,
      'tracking',
      source,
    );
  let context: ReportingContext;
  if (direct) {
    if (direct.externalId !== link.external_id)
      throw new Error('INPUT:Select the connected account again.');
    context = { ...tracking, ...(await directContext(source, direct)) };
  } else {
    const grant = await accessGrant(owner, link.provider),
      target = await readVault<Resource>(owner, 'target', source);
    if (!target || target.id !== link.external_id)
      throw new Error('INPUT:Select the connected account again.');
    const app = link.provider === 'meta' ? await getApp(owner, 'meta') : null;
    context = {
      ...tracking,
      accessToken:
        source === 'instagram'
          ? grant.accessToken
          : target.pageToken || grant.accessToken,
      externalId: target.id,
      apiVersion: app?.apiVersion,
    };
  }
  return { link, context };
}
export async function historyStatus(owner: string) {
  const results = await database()
    .prepare(
      'SELECT h.source,h.payload FROM history_imports h JOIN connector_links c ON c.owner=h.owner AND c.source=h.source AND c.external_id=h.external_id WHERE h.owner=?',
    )
    .bind(owner)
    .all<{ source: string; payload: string }>();
  const links = await database()
    .prepare('SELECT source,provider,label FROM connector_links WHERE owner=?')
    .bind(owner)
    .all<{ source: string; provider: string; label: string }>();
  const coverage = await database()
    .prepare(
      'SELECT a.channel,MIN(p.published_date) earliest,MAX(p.published_date) latest,COUNT(*) posts FROM source_posts p JOIN platform_accounts a ON a.id=p.account_id WHERE a.owner=? AND a.enabled=1 GROUP BY a.channel',
    )
    .bind(owner)
    .all();
  const dates = await database()
    .prepare(
      'SELECT a.channel,MIN(m.date) earliest,MAX(m.date) latest,COUNT(*) days FROM account_metrics_daily m JOIN platform_accounts a ON a.id=m.account_id WHERE a.owner=? AND a.enabled=1 GROUP BY a.channel',
    )
    .bind(owner)
    .all();
  return {
    jobs: results.results.map((r) => JSON.parse(r.payload) as HistoryProgress),
    connected: links.results.filter(
      (l) => l.provider !== 'file' && HISTORY_SOURCES.includes(l.source),
    ),
    content: coverage.results,
    daily: dates.results,
  };
}
export async function startHistory(
  owner: string,
  source: string,
  restart = false,
) {
  const { link, context } = await connection(owner, source),
    db = database();
  const existing = await db
    .prepare(
      'SELECT payload FROM history_imports WHERE owner=? AND source=? AND external_id=?',
    )
    .bind(owner, source, link.external_id)
    .first<{ payload: string }>();
  if (existing && !restart) {
    const saved = JSON.parse(existing.payload) as HistoryProgress;
    if (
      source === 'instagram' &&
      saved.phase === 'done' &&
      saved.oldest &&
      saved.oldest < saved.floor
    ) {
      saved.phase = 'reports';
      saved.end = day(Date.parse(saved.floor) - 86400000);
      saved.floor = saved.oldest;
      saved.message =
        'Checking older daily reports back to the first imported post.';
      saved.note =
        'All accessible published content is saved. Daily reports are requested back to the earliest imported publication; provider retention and permission limits may leave gaps.';
      await db
        .prepare(
          'UPDATE history_imports SET payload=? WHERE owner=? AND source=? AND external_id=? AND lease_until<?',
        )
        .bind(
          JSON.stringify(saved),
          owner,
          source,
          link.external_id,
          Date.now(),
        )
        .run();
    }
    return saved;
  }
  const end = today();
  const job: HistoryProgress = {
    source,
    phase: ['instagram', 'facebook', 'tiktok'].includes(source)
      ? 'content'
      : 'reports',
    cursor: '',
    floor: day(
      Date.now() -
        (source === 'instagram' ? 89 : source === 'gbp' ? 539 : 729) * 86400000,
    ),
    end,
    oldest: null,
    posts: 0,
    days: 0,
    batches: 0,
    gaps: 0,
    updatedAt: new Date().toISOString(),
    message: 'Ready to import.',
  };
  if (source === 'ga4') {
    const r = await requestJSON(
      'https://analyticsdata.googleapis.com/v1beta/properties/' +
        context.externalId +
        ':runReport',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + context.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '2015-08-14', endDate: end }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: websiteReportFilter(),
          orderBys: [{ dimension: { dimensionName: 'date' } }],
          limit: 1,
        }),
      },
    );
    const earliest = r.rows?.[0]?.dimensionValues?.[0]?.value;
    if (earliest && /^\d{8}$/.test(earliest)) {
      job.floor =
        earliest.slice(0, 4) +
        '-' +
        earliest.slice(4, 6) +
        '-' +
        earliest.slice(6, 8);
      job.message = 'Website history begins ' + job.floor + '.';
    } else {
      job.phase = 'done';
      job.floor = end;
      job.message =
        'Google returned no recorded website sessions from 2015 onward for ysabelsociety.com.';
    }
  }
  job.note =
    source === 'tiktok'
      ? 'All public videos accessible to this connection are paginated. Counters are lifetime observations; daily traffic and geography require TikTok Studio exports.'
      : source === 'ga4'
        ? 'Imports from the first date with recorded website sessions. Reports remain restricted to ysabelsociety.com; visits before tracking began cannot be recovered.'
        : source === 'instagram'
          ? 'Imports all accessible published content and retries the latest 90 days of daily insights. Older daily insights, expired stories and restricted demographics may require a Meta export.'
          : source === 'facebook'
            ? 'Imports all accessible published content and checks the last two years of daily reports. Older or retired metrics can be added from a Meta export.'
            : 'Checks the last 18 months of Google Business performance, subject to API approval and location eligibility.';
  await db
    .prepare(
      'INSERT INTO history_imports(owner,source,external_id,payload) VALUES(?,?,?,?) ON CONFLICT(owner,source) DO UPDATE SET external_id=excluded.external_id,payload=excluded.payload WHERE history_imports.lease_until<?',
    )
    .bind(owner, source, link.external_id, JSON.stringify(job), Date.now())
    .run();
  return job;
}
export async function stepHistory(owner: string, source: string) {
  const { link, context } = await connection(owner, source),
    db = database(),
    lease = crypto.randomUUID();
  const acquired = await db
    .prepare(
      'UPDATE history_imports SET lease=?,lease_until=? WHERE owner=? AND source=? AND external_id=? AND lease_until<?',
    )
    .bind(
      lease,
      Date.now() + 180000,
      owner,
      source,
      link.external_id,
      Date.now(),
    )
    .run();
  if (!acquired.meta.changes)
    throw new Error(
      'INPUT:An import is already running, or history has not been started. Wait for the current batch before resuming.',
    );
  const stored = await db
    .prepare(
      'SELECT payload FROM history_imports WHERE owner=? AND source=? AND lease=?',
    )
    .bind(owner, source, lease)
    .first<{ payload: string }>();
  const job = JSON.parse(stored!.payload) as HistoryProgress;
  try {
    if (job.phase === 'done') return job;
    const content = job.phase === 'content';
    const range = content
      ? { start: '2004-01-01', end: today() }
      : {
          start: day(
            Math.max(
              Date.parse(job.floor),
              Date.parse(job.end) -
                (source === 'instagram' ? 6 : 30) * 86400000,
            ),
          ),
          end: job.end,
        };
    const result = await importSource(
      source,
      {
        ...context,
        importMode: content ? 'content' : 'reports',
        pageCursor: content ? job.cursor : undefined,
      },
      range,
    );
    if (
      content &&
      result.checks.some(
        (c) => c.key === 'content' && c.status === 'unavailable',
      )
    )
      throw new Error(
        'INPUT:' + result.checks.find((c) => c.key === 'content')!.detail,
      );
    if (content && result.nextCursor === job.cursor && result.nextCursor)
      throw new Error(
        'INPUT:The provider repeated a page cursor. Retry this batch later.',
      );
    const reportChecks = result.checks.filter(
      (c) =>
        c.key !== 'profile' &&
        ![
          'menu',
          'reservation',
          'bookings',
          'website-realtime',
          'reach',
        ].includes(c.key) &&
        !c.key.startsWith('audience'),
    );
    if (
      !content &&
      reportChecks.length &&
      reportChecks.every((c) => c.status === 'unavailable')
    )
      throw new Error('INPUT:' + reportChecks[0].detail);
    if (result.tables.some((t) => t.truncated))
      throw new Error(
        'INPUT:This window contains more report rows than the batch can store. Import this period in smaller date windows in connection settings.',
      );
    await persistImport(owner, source, link.external_id, result, range);
    job.posts += result.posts.length;
    job.days += result.daily.filter(
      (d) =>
        d.date >= range.start &&
        d.date <= range.end &&
        d.available?.some((k) => k !== 'followers'),
    ).length;
    job.batches++;
    job.gaps += result.checks.filter((c) => c.status === 'unavailable').length;
    for (const p of result.posts)
      job.oldest = !job.oldest || p.date < job.oldest ? p.date : job.oldest;
    job.checks = result.checks;
    if (content) {
      job.cursor = result.nextCursor || '';
      if (!result.nextCursor)
        job.phase = source === 'tiktok' ? 'done' : 'reports';
      if (
        !result.nextCursor &&
        source === 'instagram' &&
        job.oldest &&
        job.oldest < job.floor
      ) {
        job.floor = job.oldest;
        job.note =
          'All accessible published content is saved. Daily reports are requested back to the earliest imported publication; provider retention and permission limits may leave gaps.';
      }
      job.message = result.nextCursor
        ? 'Importing older published content…'
        : 'All published content accessible through this connection has been scanned.';
    } else {
      job.end = day(Date.parse(range.start) - 86400000);
      job.message = 'Checked ' + range.start + ' – ' + range.end + '.';
      if (job.end < job.floor) job.phase = 'done';
    }
    if (job.phase === 'done')
      job.message =
        'Available-history scan finished' +
        (job.gaps ? ' with report gaps.' : '.');
    job.error = undefined;
    return job;
  } catch (e) {
    job.error =
      e instanceof Error && e.message.startsWith('INPUT:')
        ? e.message.slice(6)
        : 'This batch could not finish. Progress was saved; resume to retry.';
    throw new Error('INPUT:' + job.error);
  } finally {
    job.updatedAt = new Date().toISOString();
    await db
      .prepare(
        'UPDATE history_imports SET payload=?,lease=NULL,lease_until=0 WHERE owner=? AND source=? AND lease=?',
      )
      .bind(JSON.stringify(job), owner, source, lease)
      .run();
  }
}
