import {
  SOURCE_CHANNELS,
  type ConnectorProvider,
} from '@/lib/connector-catalog';
import { iso, type Daily } from '@/lib/analytics';
import { database } from './db';
import { accessGrant, getApp, type Resource } from './connector-oauth';
import { readVault, writeVault } from './connector-vault';
import { GA4Adapter, GoogleBusinessAdapter, requestJSON } from './providers';
export type ConnectorLink = {
  owner: string;
  source: string;
  provider: ConnectorProvider;
  external_id: string;
  label: string;
  snapshot: string | null;
  auto_sync: number;
};
export async function syncLinkedSource(owner: string, source: string) {
  const db = database(),
    link = await db
      .prepare('SELECT * FROM connector_links WHERE owner=? AND source=?')
      .bind(owner, source)
      .first<ConnectorLink>();
  if (!link) throw new Error('INPUT:Choose an account to connect first.');
  const accountId = owner + ':' + source + ':' + link.external_id,
    channel = SOURCE_CHANNELS[source],
    now = new Date().toISOString(),
    runId = crypto.randomUUID();
  // An atomic owner/source lock prevents overlapping refreshes from multiple tabs.
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
      new Date(Date.now() - 180000).toISOString(),
    )
    .run();
  if (!lock.meta.changes) return { records: 0, skipped: true };
  try {
    const grant = await accessGrant(owner, link.provider),
      target = await readVault<Resource>(owner, 'target', source);
    if (!target || target.id !== link.external_id)
      throw new Error('INPUT:Select this account again before refreshing.');
    let daily: Daily[] = [],
      snapshot: Record<string, unknown> = {
        observedAt: now,
        label: link.label,
      },
      scope = 'Current account snapshot; no historical daily metrics.';
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    if (source === 'ga4' || source === 'gbp') {
      const adapter =
        source === 'ga4' ? new GA4Adapter() : new GoogleBusinessAdapter();
      const result = await adapter.sync(
        { start: iso(start), end: iso(end) },
        { accessToken: grant.accessToken, externalId: target.id },
      );
      daily = result.daily;
      scope = result.scope;
      snapshot = {
        ...snapshot,
        kind: 'daily',
        records: daily.length,
        periodStart: iso(start),
        periodEnd: iso(end),
      };
    } else if (source === 'tiktok') {
      const r = await requestJSON(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count',
        { headers: { Authorization: 'Bearer ' + grant.accessToken } },
      );
      if (r.error?.code && r.error.code !== 'ok')
        throw new Error(
          'INPUT:TikTok statistics need user.info.stats permission. Reconnect after scope approval.',
        );
      const u = r.data?.user;
      if (!u || u.open_id !== target.id)
        throw new Error(
          'INPUT:The authorized TikTok account changed. Select it again.',
        );
      snapshot = {
        ...snapshot,
        kind: 'profile',
        followers: u.follower_count ?? null,
        likes: u.likes_count ?? null,
        videos: u.video_count ?? null,
      };
    } else {
      const app = await getApp(owner, 'meta'),
        fields =
          source === 'instagram'
            ? 'id,username,followers_count,media_count'
            : 'id,name,followers_count,fan_count';
      const r = await requestJSON(
        `https://graph.facebook.com/${app.apiVersion}/${encodeURIComponent(target.id)}?fields=${fields}`,
        {
          headers: {
            Authorization: 'Bearer ' + (target.pageToken || grant.accessToken),
          },
        },
      );
      snapshot = {
        ...snapshot,
        kind: 'profile',
        followers: r.followers_count ?? null,
        ...(source === 'instagram'
          ? { posts: r.media_count ?? null }
          : { pageLikes: r.fan_count ?? null }),
      };
    }
    if (source === 'ga4' || source === 'gbp') {
      // Reconcile the imported window, including dates the provider no longer returns.
      // Keep detached account history intact when a disconnect races this request.
      await db.batch([
        db
          .prepare(
            'DELETE FROM account_metrics_daily WHERE account_id=? AND date>=? AND date<=? AND EXISTS(SELECT 1 FROM connector_links WHERE owner=? AND source=? AND external_id=?)',
          )
          .bind(
            accountId,
            iso(start),
            iso(end),
            owner,
            source,
            link.external_id,
          ),
        ...daily.map((row) =>
          db
            .prepare(
              'INSERT INTO account_metrics_daily(account_id,date,normalized,source_metrics,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,date) DO UPDATE SET normalized=excluded.normalized,source_metrics=excluded.source_metrics,updated_at=excluded.updated_at',
            )
            .bind(
              accountId,
              row.date,
              JSON.stringify(row),
              JSON.stringify({ scope }),
              now,
            ),
        ),
      ]);
    } else if (daily.length) {
      for (let i = 0; i < daily.length; i += 50)
        await db.batch(
          daily
            .slice(i, i + 50)
            .map((row) =>
              db
                .prepare(
                  'INSERT INTO account_metrics_daily(account_id,date,normalized,source_metrics,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,date) DO UPDATE SET normalized=excluded.normalized,source_metrics=excluded.source_metrics,updated_at=excluded.updated_at',
                )
                .bind(
                  accountId,
                  row.date,
                  JSON.stringify(row),
                  JSON.stringify({ scope }),
                  now,
                ),
            ),
        );
    }
    await db.batch([
      db
        .prepare(
          "UPDATE platform_accounts SET enabled=1,status='Connected',last_sync=? WHERE owner=? AND id=? AND EXISTS(SELECT 1 FROM connector_links WHERE owner=? AND source=? AND external_id=?)",
        )
        .bind(now, owner, accountId, owner, source, link.external_id),
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
          snapshot.kind === 'daily'
            ? daily.length + ' daily records refreshed.'
            : 'Current profile statistics refreshed. Daily views are not supplied.',
          runId,
          owner,
        ),
    ]);
    return { records: daily.length, snapshot, scope };
  } catch (e) {
    await db.batch([
      db
        .prepare(
          "UPDATE sync_runs SET status='Needs Attention',finished_at=?,message=? WHERE id=? AND owner=?",
        )
        .bind(
          new Date().toISOString(),
          'Authorization, account access or API approval requires attention.',
          runId,
          owner,
        ),
      db
        .prepare(
          "UPDATE platform_accounts SET status='Needs Attention' WHERE id=? AND owner=?",
        )
        .bind(accountId, owner),
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
    accountId = owner + ':' + source + ':' + id;
  const old = await db
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
        'UPDATE platform_accounts SET enabled=0 WHERE owner=? AND channel=? AND id<>?',
      )
      .bind(owner, SOURCE_CHANNELS[source], accountId),
    db
      .prepare(
        'INSERT INTO connector_links(owner,source,provider,external_id,label,auto_sync) VALUES(?,?,?,?,?,1) ON CONFLICT(owner,source) DO UPDATE SET external_id=excluded.external_id,label=excluded.label,auto_sync=1',
      )
      .bind(owner, source, provider, id, target.label),
    db
      .prepare(
        "INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,status) VALUES(?,?,?,?,?,1,'Authorized') ON CONFLICT(id) DO UPDATE SET external_id=excluded.external_id,enabled=1,status='Authorized'",
      )
      .bind(accountId, owner, SOURCE_CHANNELS[source], 'Ysabel Society', id),
  ]);
  try {
    return { linked: true, ...(await syncLinkedSource(owner, source)) };
  } catch {
    return {
      linked: true,
      needsAttention: true,
      message:
        'Account selected. The first refresh needs attention. Check API access and try Refresh.',
    };
  }
}
