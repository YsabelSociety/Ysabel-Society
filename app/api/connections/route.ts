import {
  database,
  identity,
  apiError,
  json,
  secrets,
  requireText,
} from '@/lib/server/db';
import { PROVIDER_CONFIG, adapters } from '@/lib/server/providers';
import { iso } from '@/lib/analytics';
export async function GET() {
  try {
    const user = await identity();
    const db = database();
    const accounts = await db
      .prepare(
        'SELECT channel,status,last_sync,enabled FROM platform_accounts WHERE owner=?',
      )
      .bind(user.userId)
      .all();
    const runs = await db
      .prepare(
        'SELECT channel,status,started_at,finished_at,message FROM sync_runs WHERE owner=? ORDER BY started_at DESC LIMIT 20',
      )
      .bind(user.userId)
      .all();
    return json({
      connections: PROVIDER_CONFIG.map((p) => {
        const record = accounts.results.find(
          (a: any) => a.channel === p.channel,
        ) as any;
        const missing = p.required.filter((k) => !secrets()[k]);
        return {
          ...p,
          missing,
          configured: p.required.length > 0 && !missing.length,
          supported: ['ga4', 'gbp'].includes(p.id),
          status: record?.status ?? 'Disconnected',
          lastSync: record?.last_sync ?? null,
          enabled: record?.enabled !== 0,
        };
      }),
      runs: runs.results,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity(req),
      body = (await req.json()) as any;
    const config = PROVIDER_CONFIG.find((p) => p.id === body.id);
    if (!config) throw new Error('INPUT:Choose a known source.');
    const db = database(),
      accountId = user.userId + ':' + config.id,
      now = new Date().toISOString();
    if (body.action === 'disconnect') {
      await db
        .prepare(
          'UPDATE platform_accounts SET enabled=0,status=? WHERE owner=? AND id=?',
        )
        .bind('Disconnected', user.userId, accountId)
        .run();
      return json({
        ok: true,
        message:
          'Automatic use of this connection is disabled. Revoke platform access separately if needed.',
      });
    }
    if (!config.required.length || config.required.some((k) => !secrets()[k]))
      throw new Error(
        'INPUT:This source needs secure account configuration before it can synchronize.',
      );
    const adapter = adapters[config.id];
    if (!adapter)
      throw new Error(
        'INPUT:Advertising connectors are reserved for a future release.',
      );
    const recent = await db
      .prepare(
        'SELECT started_at FROM sync_runs WHERE owner=? AND channel=? AND status=? ORDER BY started_at DESC LIMIT 1',
      )
      .bind(user.userId, config.channel, 'Syncing')
      .first<{ started_at: string }>();
    if (recent && Date.now() - Date.parse(recent.started_at) < 120000)
      throw new Error('INPUT:A sync is already in progress.');
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO sync_runs(id,owner,channel,status,started_at) VALUES(?,?,?,?,?)',
      )
      .bind(id, user.userId, config.channel, 'Syncing', now)
      .run();
    try {
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);
      const result = await adapter.sync({ start: iso(start), end: iso(end) });
      await db
        .prepare(
          'INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,last_sync,status) VALUES(?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET enabled=1,last_sync=excluded.last_sync,status=excluded.status',
        )
        .bind(
          accountId,
          user.userId,
          config.channel,
          secrets().SOURCE_BUSINESS_UNIT || 'Society',
          secrets()[
            config.id === 'ga4' ? 'GA4_PROPERTY_ID' : 'GBP_LOCATION_ID'
          ] || config.id,
          now,
          'Connected',
        )
        .run();
      for (let i = 0; i < result.daily.length; i += 50)
        await db.batch(
          result.daily
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
                  JSON.stringify({
                    scope: result.scope,
                    originalResponse: result.raw,
                  }),
                  now,
                ),
            ),
        );
      await db
        .prepare(
          'UPDATE sync_runs SET status=?,finished_at=?,message=? WHERE id=?',
        )
        .bind(
          'Connected',
          new Date().toISOString(),
          result.daily.length + ' daily records stored.',
          id,
        )
        .run();
      return json({ ok: true, records: result.daily.length });
    } catch (e) {
      await db
        .prepare(
          'UPDATE sync_runs SET status=?,finished_at=?,message=? WHERE id=?',
        )
        .bind(
          'Needs Attention',
          new Date().toISOString(),
          'Authorization or source request requires attention.',
          id,
        )
        .run();
      await db
        .prepare('UPDATE platform_accounts SET status=? WHERE id=?')
        .bind('Needs Attention', accountId)
        .run();
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
