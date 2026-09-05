import { SOURCE_CHANNELS, CONNECTOR_GROUPS } from '@/lib/connector-catalog';
import {
  database,
  identity,
  json,
  apiError,
  requireText,
  requireDate,
} from '@/lib/server/db';
import { parseDirect, saveDirect } from '@/lib/server/connection-direct';
import { syncLinkedSource, importRange } from '@/lib/server/connector-sync';
import { readVault, writeVault } from '@/lib/server/connector-vault';
import { csvRows, parseImport } from '@/lib/import-file';
import { persistImport } from '@/lib/server/report-import';
import { type Grant, getApp } from '@/lib/server/connector-oauth';
import { graphGet } from '@/lib/server/report-meta';
import { validateImportSize } from '@/lib/reporting';
export async function GET(req: Request) {
  try {
    const owner = (await identity()).userId,
      source = new URL(req.url).searchParams.get('source');
    if (!source || !SOURCE_CHANNELS[source])
      throw new Error('INPUT:Choose a supported source.');
    return json({
      tracking:
        (await readVault<Record<string, string>>(owner, 'tracking', source)) ||
        {},
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const owner = (await identity(req)).userId;
    if (Number(req.headers.get('content-length') || 0) > 3500000)
      throw new Error('INPUT:Use a file smaller than 3 MB.');
    const body = (await req.json()) as Record<string, unknown>;
    const db = database();
    if (body.op === 'permissions') {
      const provider = requireText(body.provider, 30);
      if (provider !== 'meta')
        throw new Error('INPUT:Permission diagnostics are available for Meta.');
      const grant = await readVault<Grant>(owner, 'grant', 'meta');
      if (!grant) throw new Error('INPUT:Sign in with Meta first.');
      const app = await getApp(owner, 'meta');
      const r = await graphGet(
        {
          accessToken: grant.accessToken,
          externalId: 'me',
          apiVersion: app.apiVersion,
        },
        'me/permissions',
      );
      const required = [
        ...CONNECTOR_GROUPS.find((g) => g.id === 'meta')!.scopes,
        'pages_messaging',
        'instagram_manage_messages',
        'pages_manage_metadata',
      ];
      return json({
        permissions: required.map((name) => ({
          name,
          status:
            r.data?.find((v: any) => v.permission === name)?.status ||
            'not granted',
        })),
        expiresAt: grant.expiresAt,
      });
    }
    const source = requireText(body.source, 30),
      channel = SOURCE_CHANNELS[source];
    if (!channel) throw new Error('INPUT:Choose a supported source.');
    if (body.op === 'tracking') {
      const value: Record<string, string> = {};
      for (const key of [
        'menuPath',
        'reservationEvent',
        'completedReservationEvent',
      ])
        value[key] = body[key] ? requireText(body[key], 500) : '';
      await writeVault(owner, 'tracking', source, value);
      return json({ saved: true });
    }
    if (body.op === 'history')
      return json(await syncLinkedSource(owner, source, body.range));
    if (body.op === 'direct') {
      const credentials = parseDirect(body),
        old = await db
          .prepare(
            'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
          )
          .bind(owner, source)
          .first<{ external_id: string }>();
      if (old && old.external_id !== credentials.externalId)
        throw new Error(
          'INPUT:Disconnect the existing account before replacing it.',
        );
      const provider = ['instagram', 'facebook', 'meta-ads'].includes(source)
          ? 'meta'
          : ['ga4', 'gbp', 'google-ads'].includes(source)
            ? 'google'
            : 'tiktok',
        account = owner + ':' + source + ':' + credentials.externalId;
      await saveDirect(owner, source, credentials);
      await db.batch([
        db
          .prepare(
            'UPDATE platform_accounts SET enabled=0 WHERE owner=? AND channel=? AND id<>?',
          )
          .bind(owner, channel, account),
        db
          .prepare(
            'INSERT INTO connector_links(owner,source,provider,external_id,label,auto_sync) VALUES(?,?,?,?,?,1) ON CONFLICT(owner,source) DO UPDATE SET provider=excluded.provider,external_id=excluded.external_id,label=excluded.label,auto_sync=1',
          )
          .bind(
            owner,
            source,
            provider,
            credentials.externalId,
            credentials.label,
          ),
        db
          .prepare(
            "INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,status) VALUES(?,?,?,?,?,1,'Authorized') ON CONFLICT(id) DO UPDATE SET enabled=1,status='Authorized'",
          )
          .bind(
            account,
            owner,
            channel,
            'Ysabel Society',
            credentials.externalId,
          ),
      ]);
      return json(await syncLinkedSource(owner, source));
    }
    if (body.op === 'file') {
      const label = requireText(body.label, 200),
        kind = requireText(body.kind, 30),
        text = requireText(body.csv, 3000000),
        mapping = body.mapping || {};
      if (
        !mapping ||
        Array.isArray(mapping) ||
        typeof mapping !== 'object' ||
        Object.values(mapping).some((v) => typeof v !== 'string')
      )
        throw new Error('INPUT:Choose valid column mappings.');
      const r = body.range as { start: string; end: string },
        range = { start: requireDate(r?.start), end: requireDate(r?.end) };
      if (range.start > range.end)
        throw new Error('INPUT:Choose a valid report period.');
      const result = parseImport(
        source,
        kind,
        csvRows(text),
        mapping as Record<string, string>,
        range,
        label,
      );
      validateImportSize(result);
      const linked = await db
        .prepare(
          'SELECT external_id,label FROM connector_links WHERE owner=? AND source=?',
        )
        .bind(owner, source)
        .first<{ external_id: string; label: string }>();
      const id = linked?.external_id || 'file-import',
        account = owner + ':' + source + ':' + id,
        now = new Date().toISOString();
      if (!linked)
        await db.batch([
          db
            .prepare(
              'INSERT INTO connector_links(owner,source,provider,external_id,label,auto_sync) VALUES(?,?,?,?,?,0)',
            )
            .bind(owner, source, 'file', id, label),
          db
            .prepare(
              "INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,status,last_sync) VALUES(?,?,?,?,?,1,'Imported file',?) ON CONFLICT(id) DO UPDATE SET enabled=1,last_sync=excluded.last_sync,status='Imported file'",
            )
            .bind(account, owner, channel, 'Ysabel Society', id, now),
        ]);
      await persistImport(owner, source, id, result, range);
      if (!linked)
        await db
          .prepare(
            'UPDATE connector_links SET snapshot=? WHERE owner=? AND source=?',
          )
          .bind(
            JSON.stringify({
              kind: 'reporting',
              observedAt: now,
              method: 'file',
              checks: result.checks,
              scope: result.scope,
              records: result.daily.length,
              contentRecords: result.posts.length,
              reportTables: result.tables.length,
            }),
            owner,
            source,
          )
          .run();
      await db
        .prepare(
          'INSERT INTO sync_runs(id,owner,channel,status,started_at,finished_at,message) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          owner,
          channel,
          'Imported file',
          now,
          now,
          label + ': ' + csvRows(text).length + ' rows imported from file.',
        )
        .run();
      return json({
        imported: true,
        rows: result.daily.length,
        posts: result.posts.length,
        tables: result.tables.length,
      });
    }
    throw new Error('INPUT:Choose a supported connection action.');
  } catch (e) {
    return apiError(e);
  }
}
