import {
  SOURCE_CHANNELS,
  type ConnectorProvider,
} from '@/lib/connector-catalog';
import { iso, type Range } from '@/lib/analytics';
import { recentSyncWindow } from '@/lib/sync-window';
import { database, requireDate } from './db';
import { accessGrant, getApp, type Resource } from './connector-oauth';
import { readVault, writeVault } from './connector-vault';
import { readDirect, directContext } from './connection-direct';
import { importSource, persistImport } from './report-import';
import { type ReportingContext } from './report-google';
export type ConnectorLink = {
  owner: string;
  source: string;
  provider: ConnectorProvider;
  external_id: string;
  label: string;
  snapshot: string | null;
  auto_sync: number;
};
export function importRange(value?: unknown): Range {
  if (value && typeof value === 'object') {
    const r = value as Range,
      start = requireDate(r.start),
      end = requireDate(r.end);
    if (
      start > end ||
      Date.parse(end) - Date.parse(start) > 31 * 86400000 ||
      end > iso(new Date(Date.now() + 14 * 3600000))
    )
      throw new Error(
        'INPUT:Choose an import window of up to 32 days, ending today or earlier.',
      );
    return { start, end };
  }
  return recentSyncWindow();
}
export async function syncLinkedSource(
  owner: string,
  source: string,
  requestedRange?: unknown,
) {
  const db = database(),
    link = await db
      .prepare('SELECT * FROM connector_links WHERE owner=? AND source=?')
      .bind(owner, source)
      .first<ConnectorLink>();
  if (!link) throw new Error('INPUT:Choose an account to connect first.');
  if ((link.provider as string) === 'file')
    throw new Error(
      'INPUT:This source uses file imports. Upload the next export to refresh it.',
    );
  const account = owner + ':' + source + ':' + link.external_id,
    channel = SOURCE_CHANNELS[source],
    now = new Date().toISOString(),
    runId = crypto.randomUUID(),
    range = importRange(
      requestedRange ||
        (source === 'ga4'
          ? {
              ...recentSyncWindow(),
            }
          : undefined),
    );
  const lock = await db
    .prepare(
      "INSERT INTO sync_runs(id,owner,channel,status,started_at) SELECT ?,?,?,'Syncing',? WHERE NOT EXISTS(SELECT 1 FROM sync_runs WHERE owner=? AND channel=? AND status='Syncing' AND started_at>?)",
    )
    .bind(
      runId,
      owner,
      channel,
      now,
      owner,
      channel,
      new Date(Date.now() - 600000).toISOString(),
    )
    .run();
  if (!lock.meta.changes) return { records: 0, skipped: true };
  try {
    const direct = await readDirect(owner, source);
    let context: ReportingContext;
    if (direct) {
      if (direct.externalId !== link.external_id)
        throw new Error('INPUT:Select this account again before refreshing.');
      context = {
        ...(await directContext(source, direct)),
        ...(await readVault<Partial<ReportingContext>>(
          owner,
          'tracking',
          source,
        )),
      };
    } else {
      const grant = await accessGrant(owner, link.provider),
        target = await readVault<Resource>(owner, 'target', source);
      if (!target || target.id !== link.external_id)
        throw new Error('INPUT:Select this account again before refreshing.');
      const app = link.provider === 'meta' ? await getApp(owner, 'meta') : null;
      const tracking = await readVault<Partial<ReportingContext>>(
        owner,
        'tracking',
        source,
      );
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
    const result = await importSource(source, context, range);
    if (
      !result.daily.length &&
      !result.posts.length &&
      !result.tables.length &&
      result.checks.every((c) => c.status === 'unavailable')
    )
      throw new Error(
        'INPUT:No reports could be read. ' +
          (result.checks[0]?.detail ||
            'Check access and API approval, then reconnect.'),
      );
    await persistImport(owner, source, link.external_id, result, range);
    const snapshot = {
      ...result.profile,
      kind: 'reporting',
      observedAt: now,
      label: link.label,
      periodStart: range.start,
      periodEnd: range.end,
      records: result.daily.length,
      contentRecords: result.posts.length,
      reportTables: result.tables.length,
      checks: result.checks,
      scope: result.scope,
      partial: result.checks.some((c) => c.status === 'unavailable'),
      method: direct?.method || 'oauth',
    };
    await db.batch([
      db
        .prepare(
          "UPDATE platform_accounts SET enabled=1,status='Connected',last_sync=? WHERE owner=? AND id=? AND EXISTS(SELECT 1 FROM connector_links WHERE owner=? AND source=? AND external_id=?)",
        )
        .bind(now, owner, account, owner, source, link.external_id),
      db
        .prepare(
          'UPDATE connector_links SET snapshot=? WHERE owner=? AND source=? AND external_id=?',
        )
        .bind(JSON.stringify(snapshot), owner, source, link.external_id),
      db
        .prepare(
          "UPDATE sync_runs SET status='Connected',finished_at=?,message=? WHERE id=? AND owner=?",
        )
        .bind(
          new Date().toISOString(),
          result.daily.length +
            ' daily rows, ' +
            result.posts.length +
            ' posts and ' +
            result.tables.length +
            ' reports imported.' +
            (snapshot.partial
              ? ' Some reports need attention; inspect coverage.'
              : ''),
          runId,
          owner,
        ),
    ]);
    return { records: result.daily.length, snapshot, scope: result.scope };
  } catch (e) {
    await db.batch([
      db
        .prepare(
          "UPDATE sync_runs SET status='Needs Attention',finished_at=?,message=? WHERE id=? AND owner=?",
        )
        .bind(
          new Date().toISOString(),
          e instanceof Error && e.message.startsWith('INPUT:')
            ? e.message.slice(6)
            : 'Source import needs attention.',
          runId,
          owner,
        ),
      db
        .prepare(
          "UPDATE platform_accounts SET status='Needs Attention' WHERE id=? AND owner=?",
        )
        .bind(account, owner),
    ]);
    throw e;
  }
}
export async function linkResource(
  owner: string,
  provider: ConnectorProvider,
  source: string,
  id: string,
) {
  const grant = await accessGrant(owner, provider),
    target = grant.resources?.find((r) => r.source === source && r.id === id);
  if (!target || !SOURCE_CHANNELS[source])
    throw new Error(
      'INPUT:Choose an account discovered in this authorization session.',
    );
  const db = database(),
    account = owner + ':' + source + ':' + id,
    old = await db
      .prepare(
        'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
      )
      .bind(owner, source)
      .first<{ external_id: string }>();
  if (old && old.external_id !== id)
    throw new Error(
      'INPUT:Disconnect the existing account before choosing another.',
    );
  await writeVault(owner, 'target', source, target);
  await db.batch([
    db
      .prepare(
        "DELETE FROM connector_vault WHERE owner=? AND kind='direct' AND provider=?",
      )
      .bind(owner, source),
    db
      .prepare(
        'UPDATE platform_accounts SET enabled=0 WHERE owner=? AND channel=? AND id<>?',
      )
      .bind(owner, SOURCE_CHANNELS[source], account),
    db
      .prepare(
        'INSERT INTO connector_links(owner,source,provider,external_id,label,auto_sync) VALUES(?,?,?,?,?,1) ON CONFLICT(owner,source) DO UPDATE SET provider=excluded.provider,external_id=excluded.external_id,label=excluded.label,auto_sync=1',
      )
      .bind(owner, source, provider, id, target.label),
    db
      .prepare(
        "INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,status) VALUES(?,?,?,?,?,1,'Authorized') ON CONFLICT(id) DO UPDATE SET external_id=excluded.external_id,enabled=1,status='Authorized'",
      )
      .bind(account, owner, SOURCE_CHANNELS[source], 'Ysabel Society', id),
  ]);
  try {
    return { linked: true, ...(await syncLinkedSource(owner, source)) };
  } catch {
    return {
      linked: true,
      needsAttention: true,
      message:
        'Account selected. Import needs attention. Check the source status and try Refresh.',
    };
  }
}
