import { CONNECTOR_GROUPS, connectorGroup } from '@/lib/connector-catalog';
import {
  database,
  identity,
  json,
  apiError,
  requireText,
} from '@/lib/server/db';
import {
  readVault,
  writeVault,
  vaultReady,
} from '@/lib/server/connector-vault';
import {
  discoverResources,
  siteOrigin,
  type AppCredentials,
  type Grant,
} from '@/lib/server/connector-oauth';
import {
  linkResource,
  syncLinkedSource,
  type ConnectorLink,
} from '@/lib/server/connector-sync';
export async function GET(req: Request) {
  try {
    const user = await identity(),
      owner = user.userId;
    const links = await database()
      .prepare('SELECT * FROM connector_links WHERE owner=?')
      .bind(owner)
      .all<ConnectorLink>();
    const groups = await Promise.all(
      CONNECTOR_GROUPS.map(async (g) => {
        const app = await readVault<AppCredentials>(owner, 'app', g.id),
          grant = await readVault<Grant>(owner, 'grant', g.id);
        return {
          id: g.id,
          configured: !!app,
          clientId: app?.clientId || '',
          apiVersion: app?.apiVersion || '',
          configId: app?.configId || '',
          authorized: !!grant,
          callback: siteOrigin(req) + '/api/oauth/' + g.id + '/callback',
        };
      }),
    );
    return json({
      ready: vaultReady(),
      groups,
      links: links.results.map((l) => ({
        source: l.source,
        provider: l.provider,
        label: l.label,
        externalId: l.external_id,
        autoSync: !!l.auto_sync,
        snapshot: l.snapshot ? JSON.parse(l.snapshot) : null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity(req),
      owner = user.userId,
      body = (await req.json()) as Record<string, unknown>,
      db = database();
    if (!body || Array.isArray(body) || typeof body !== 'object')
      throw new Error('INPUT:Choose a valid connection action.');
    if (body.op === 'autoRefresh') {
      const due = await db
        .prepare(
          "SELECT l.source FROM connector_links l JOIN platform_accounts a ON a.id=l.owner||':'||l.source||':'||l.external_id WHERE l.owner=? AND l.auto_sync=1 AND l.provider<>'file' AND a.enabled=1 AND (a.last_sync IS NULL OR a.last_sync<?) AND NOT EXISTS(SELECT 1 FROM sync_runs r WHERE r.owner=l.owner AND r.channel=a.channel AND r.started_at>?) ORDER BY a.last_sync LIMIT 1",
        )
        .bind(
          owner,
          new Date(Date.now() - 3600000).toISOString(),
          new Date(Date.now() - 900000).toISOString(),
        )
        .first<{ source: string }>();
      if (!due) return json({ refreshed: false });
      const end = new Date(Date.now() - (due.source === 'ga4' ? 0 : 86400000))
          .toISOString()
          .slice(0, 10),
        start = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      try {
        await syncLinkedSource(owner, due.source, { start, end });
        return json({ refreshed: true, source: due.source, more: true });
      } catch {
        return json({
          refreshed: false,
          source: due.source,
          more: true,
          needsAttention: true,
        });
      }
    }
    if (body.op === 'refresh') {
      return json(
        await syncLinkedSource(owner, requireText(body.source, 30), body.range),
      );
    }
    if (body.op === 'autoSync') {
      if (typeof body.enabled !== 'boolean')
        throw new Error('INPUT:Choose a refresh preference.');
      await db
        .prepare(
          'UPDATE connector_links SET auto_sync=? WHERE owner=? AND source=?',
        )
        .bind(body.enabled ? 1 : 0, owner, requireText(body.source, 30))
        .run();
      return json({ ok: true });
    }
    const group = connectorGroup(body.provider);
    if (body.op === 'saveApp') {
      const prior = await readVault<AppCredentials>(owner, 'app', group.id),
        clientId = requireText(body.clientId, 500),
        clientSecret = body.clientSecret
          ? requireText(body.clientSecret, 2000)
          : prior?.clientId === clientId
            ? prior.clientSecret
            : '';
      if (!clientSecret)
        throw new Error(
          'INPUT:Enter the app secret from your provider console.',
        );
      const apiVersion =
        group.id === 'meta' ? requireText(body.apiVersion, 12) : undefined;
      const configId =
        group.id === 'meta' ? requireText(body.configId, 100) : undefined;
      if (configId && !/^\d+$/.test(configId))
        throw new Error(
          'INPUT:Enter the numeric Facebook Login for Business configuration ID.',
        );
      if (apiVersion && !/^v\d{1,2}\.\d{1,2}$/.test(apiVersion))
        throw new Error(
          'INPUT:Use the Graph API version shown in your Meta app, for example v25.0.',
        );
      if (
        prior &&
        (prior.clientId !== clientId || prior.clientSecret !== clientSecret)
      ) {
        const linked = await db
          .prepare(
            'SELECT source FROM connector_links WHERE owner=? AND provider=?',
          )
          .bind(owner, group.id)
          .all();
        if (linked.results.length)
          throw new Error(
            'INPUT:Disconnect linked accounts before changing the app credentials.',
          );
        await db
          .prepare(
            "DELETE FROM connector_vault WHERE owner=? AND kind='grant' AND provider=?",
          )
          .bind(owner, group.id)
          .run();
      }
      await writeVault(owner, 'app', group.id, {
        clientId,
        clientSecret,
        apiVersion,
        configId,
      });
      return json({ saved: true });
    }
    if (body.op === 'discover')
      return json(await discoverResources(owner, group.id));
    if (body.op === 'select')
      return json(
        await linkResource(
          owner,
          group.id,
          requireText(body.source, 30),
          requireText(body.resourceId, 200),
        ),
      );
    throw new Error('INPUT:Unknown connection action.');
  } catch (e) {
    return apiError(e);
  }
}
