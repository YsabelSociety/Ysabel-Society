import { database, requireText } from './db';
import { readVault, writeVault } from './connector-vault';
import { getApp, type Resource } from './connector-oauth';
import { graphGet } from './report-meta';
import { saveCommunityStatus } from './community-store';

export type InstagramMessageGrant = {
  accessToken: string;
  apiVersion: string;
  externalId: string;
  accountId: string;
  username: string;
  connectedAt: string;
  instagramLogin: true;
};

export function metaMessageError(error: any, accessToken: string) {
  const detail = String(
    error?.error_user_msg || error?.message || 'The request was refused.',
  )
    .replaceAll(accessToken, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[provider link]')
    .replace(/(?:EA|IG)[A-Za-z0-9_-]{30,}/g, '[redacted]')
    .slice(0, 500);
  return (
    detail + (Number.isInteger(error?.code) ? ' (Meta ' + error.code + ')' : '')
  );
}

export async function instagramMessageGet(
  context: { accessToken: string; apiVersion: string },
  path: string,
) {
  if (!/^v\d{1,2}\.\d{1,2}$/.test(context.apiVersion))
    throw new Error('INPUT:Check the Instagram API version.');
  // Only server-created relative paths are used. Never follow a provider paging URL with a token.
  const response = await fetch(
    'https://graph.instagram.com/' + context.apiVersion + '/' + path,
    {
      headers: { Authorization: 'Bearer ' + context.accessToken },
      signal: AbortSignal.timeout(30000),
    },
  );
  const body: any = await response.json();
  if (!response.ok || body.error)
    throw new Error(
      'INPUT:Direct Instagram access: ' +
        metaMessageError(body.error, context.accessToken),
    );
  return body;
}

export async function readInstagramMessaging(owner: string) {
  return readVault<InstagramMessageGrant>(owner, 'messaging', 'instagram');
}

export async function diagnoseInstagramMessaging(owner: string) {
  const grant = await readInstagramMessaging(owner);
  const target = await readVault<Resource>(owner, 'target', 'instagram');
  const app = await getApp(owner, 'meta');
  const probes: {
    label: string;
    host: string;
    path: string;
    token: string;
    version: string;
  }[] = [];
  if (grant) {
    probes.push({
      label: 'Direct Instagram · account endpoint',
      host: 'graph.instagram.com',
      path: grant.externalId + '/conversations?platform=instagram&limit=50',
      token: grant.accessToken,
      version: grant.apiVersion,
    });
    probes.push({
      label: 'Direct Instagram · me endpoint',
      host: 'graph.instagram.com',
      path: 'me/conversations?limit=50',
      token: grant.accessToken,
      version: grant.apiVersion,
    });
    probes.push({
      label: 'Direct Instagram · permissions',
      host: 'graph.instagram.com',
      path: 'me/permissions',
      token: grant.accessToken,
      version: grant.apiVersion,
    });
  }
  if (target?.pageToken && app.apiVersion) {
    const page = await graphGet(
      {
        accessToken: target.pageToken,
        apiVersion: app.apiVersion,
        externalId: target.id,
      },
      'me?fields=id',
    );
    probes.push({
      label: 'Facebook-linked · Page endpoint',
      host: 'graph.facebook.com',
      path:
        encodeURIComponent(page.id) +
        '/conversations?platform=instagram&limit=1',
      token: target.pageToken,
      version: app.apiVersion,
    });
    probes.push({
      label: 'Facebook-linked · Instagram endpoint',
      host: 'graph.facebook.com',
      path:
        encodeURIComponent(target.id) +
        '/conversations?platform=instagram&limit=1',
      token: target.pageToken,
      version: app.apiVersion,
    });
  }
  return {
    results: await Promise.all(
      probes.map(async (probe) => {
        try {
          const response = await fetch(
            'https://' + probe.host + '/' + probe.version + '/' + probe.path,
            {
              headers: { Authorization: 'Bearer ' + probe.token },
              signal: AbortSignal.timeout(45000),
            },
          );
          const body: any = await response.json();
          if (!response.ok || body.error)
            return {
              label: probe.label,
              detail: metaMessageError(body.error, probe.token),
            };
          if (probe.label.endsWith('permissions'))
            return {
              label: probe.label,
              detail:
                (body.data || [])
                  .map(
                    (p: any) => String(p.permission) + ': ' + String(p.status),
                  )
                  .join('; ') || 'No permissions returned.',
            };
          return {
            label: probe.label,
            detail: Array.isArray(body.data)
              ? body.data.length +
                ' conversations returned in this page.' +
                (body.paging?.next ? ' More pages available.' : '')
              : 'No readable conversation list returned.',
          };
        } catch (e) {
          return {
            label: probe.label,
            detail:
              e instanceof Error && e.name === 'TimeoutError'
                ? 'Meta timed out before returning this page.'
                : 'This access check could not complete.',
          };
        }
      }),
    ),
  };
}

export async function connectInstagramMessaging(owner: string, input: any) {
  const accessToken = requireText(input.accessToken, 6000);
  const apiVersion = requireText(input.apiVersion, 12);
  const link = await database()
    .prepare(
      'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
    )
    .bind(owner, 'instagram')
    .first<{ external_id: string }>();
  if (!link)
    throw new Error(
      'INPUT:Select the Ysabel Instagram account in Connections first.',
    );
  const context = { accessToken, apiVersion };
  const me = await instagramMessageGet(context, 'me?fields=user_id,username');
  const externalId = String(me.user_id || me.id || '');
  if (!/^\d+$/.test(externalId) || !me.username)
    throw new Error(
      'INPUT:Instagram did not identify this account. Use a token generated with Instagram Login.',
    );
  if (![String(me.user_id), String(me.id)].includes(link.external_id)) {
    // Instagram Login may use a different ID namespace. Match the live username
    // on the already connected Instagram asset before attaching its messages.
    const target = await readVault<Resource>(owner, 'target', 'instagram');
    if (!target?.pageToken || target.id !== link.external_id)
      throw new Error(
        'INPUT:This token does not match the connected Instagram account.',
      );
    const app = await getApp(owner, 'meta');
    const linked = await graphGet(
      {
        accessToken: target.pageToken,
        apiVersion: app.apiVersion,
        externalId: target.id,
      },
      encodeURIComponent(target.id) + '?fields=username',
    );
    if (
      !linked.username ||
      String(linked.username).toLowerCase() !==
        String(me.username).toLowerCase()
    )
      throw new Error(
        'INPUT:This token belongs to a different Instagram account.',
      );
  }
  const list = await instagramMessageGet(
    context,
    encodeURIComponent(externalId) +
      '/conversations?platform=instagram&limit=5',
  );
  if (!Array.isArray(list.data))
    throw new Error(
      'INPUT:Instagram did not return a readable conversation list.',
    );
  const current = await database()
    .prepare(
      'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
    )
    .bind(owner, 'instagram')
    .first<{ external_id: string }>();
  if (current?.external_id !== link.external_id)
    throw new Error('INPUT:The selected Instagram account changed. Try again.');
  const grant: InstagramMessageGrant = {
    ...context,
    externalId,
    accountId: link.external_id,
    username: String(me.username),
    connectedAt: new Date().toISOString(),
    instagramLogin: true,
  };
  await writeVault(owner, 'messaging', 'instagram', grant);
  const detail =
    'Direct Instagram access verified for @' +
    grant.username +
    '. Import messages to load the accessible inbox. Historical and request-folder limits still apply.';
  await saveCommunityStatus(owner, {
    source: 'instagram',
    kind: 'message',
    state: 'partial',
    detail,
    accountId: grant.accountId,
  });
  return { username: grant.username, detail };
}

export async function instagramMessageBatch(
  context: InstagramMessageGrant,
  paths: string[],
) {
  const results: { body?: any; error?: string }[] = [];
  // Bounded concurrency; one inaccessible profile/message must not discard its neighbours.
  for (let start = 0; start < paths.length; start += 4) {
    results.push(
      ...(await Promise.all(
        paths.slice(start, start + 4).map(async (path) => {
          try {
            return { body: await instagramMessageGet(context, path) };
          } catch (e) {
            return {
              error:
                e instanceof Error
                  ? e.message.replace(/^INPUT:/, '')
                  : 'Instagram request failed.',
            };
          }
        }),
      )),
    );
  }
  return results;
}

export async function instagramConversationMessages(
  context: InstagramMessageGrant,
  conversationId: string,
) {
  try {
    const result = await instagramMessageGet(
      context,
      encodeURIComponent(conversationId) + '?fields=messages.limit(20)',
    );
    if (!Array.isArray(result.messages?.data))
      throw new Error(
        'INPUT:Instagram did not return a readable message list.',
      );
    const details = await instagramMessageBatch(
      context,
      result.messages.data
        .slice(0, 20)
        .filter((m: any) => typeof m.id === 'string')
        .map(
          (m: any) =>
            encodeURIComponent(m.id) +
            '?fields=id,created_time,from,to,message',
        ),
    );
    const failed = details.filter((r) => r.error).length;
    if (details.length && failed === details.length)
      return { error: details[0].error, inaccessible: failed };
    return {
      body: {
        data: details.flatMap((r) => (r.body ? [r.body] : [])),
        paging: result.messages.paging,
      },
      inaccessible: failed,
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message.replace(/^INPUT:/, '')
          : 'Instagram conversation failed.',
      inaccessible: 1,
    };
  }
}
