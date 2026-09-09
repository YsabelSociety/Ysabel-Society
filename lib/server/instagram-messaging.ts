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
  autoSync?: boolean;
  deadline?: number;
  expiresAt?: number;
  refreshedAt?: number;
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
  context: { accessToken: string; apiVersion: string; deadline?: number },
  path: string,
) {
  if (!/^v\d{1,2}\.\d{1,2}$/.test(context.apiVersion))
    throw new Error('INPUT:Check the Instagram API version.');
  if (context.deadline && Date.now() >= context.deadline)
    throw new Error(
      'INPUT:Instagram message batch reached its time limit. Retry to continue.',
    );
  // Only server-created relative paths are used. Never follow a provider paging URL with a token.
  const response = await fetch(
    'https://graph.instagram.com/' + context.apiVersion + '/' + path,
    {
      headers: { Authorization: 'Bearer ' + context.accessToken },
      signal: AbortSignal.timeout(
        context.deadline
          ? Math.max(1, Math.min(8000, context.deadline - Date.now()))
          : 30000,
      ),
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
  let grant = await readVault<InstagramMessageGrant>(owner, 'messaging', 'instagram');
  if (grant?.expiresAt && grant.expiresAt < Date.now()+7*86400000 && (grant.refreshedAt || 0) < Date.now()-86400000) {
    const response = await fetch('https://graph.instagram.com/refresh_access_token?' + new URLSearchParams({grant_type:'ig_refresh_token',access_token:grant.accessToken}), {signal:AbortSignal.timeout(15000)});
    const body: any = await response.json();
    if (!response.ok || body.error || !body.access_token) throw new Error('INPUT:Instagram authorization needs renewal. Use Sign in with Instagram again.');
    grant = {...grant,accessToken:body.access_token,expiresAt:Date.now()+Number(body.expires_in || 3600)*1000,refreshedAt:Date.now()};
    await writeVault(owner,'messaging','instagram',grant);
  }
  return grant;
}

export async function diagnoseInstagramMessaging(owner: string) {
  const grant = await readInstagramMessaging(owner);
  const target = await readVault<Resource>(owner, 'target', 'instagram');
  const app = await readVault<{ apiVersion?: string }>(owner, 'app', 'meta');
  const setupChecks: { label: string; detail: string }[] = [];
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
  }
  if (target?.pageToken && app?.apiVersion) {
    try {
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
    } catch {
      setupChecks.push({
        label: 'Facebook-linked connection',
        detail:
          'The existing Page grant could not be verified. Direct Instagram checks run independently.',
      });
    }
  }
  return {
    results: [
      ...setupChecks,
      ...(await Promise.all(
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
      )),
    ],
  };
}

export async function connectInstagramMessaging(owner: string, input: any, lifetime: { expiresAt?: number; refreshedAt?: number } = {}) {
  const accessToken = requireText(input.accessToken, 6000);
  const apiVersion = requireText(input.apiVersion, 12);
  const link = await database()
    .prepare(
      'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
    )
    .bind(owner, 'instagram')
    .first<{ external_id: string }>();
  const previous = await readVault<InstagramMessageGrant>(owner, 'messaging', 'instagram');
  const context = { accessToken, apiVersion };
  const me = await instagramMessageGet(context, 'me?fields=user_id,username');
  const externalId = String(me.user_id || me.id || '');
  if (!/^\d+$/.test(externalId) || !me.username)
    throw new Error(
      'INPUT:Instagram did not identify this account. Use a token generated with Instagram Login.',
    );
  // The direct grant verifies its own account without Facebook credentials.
  if (previous && previous.username.toLowerCase() !== String(me.username).toLowerCase())
    throw new Error('INPUT:Sign in with the already connected Instagram account.');
  if (!previous && link && ![String(me.user_id), String(me.id)].includes(link.external_id))
    throw new Error('INPUT:This Instagram account does not match the selected reporting account.');
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
  if (current?.external_id !== link?.external_id)
    throw new Error('INPUT:The selected Instagram account changed. Try again.');
  const grant: InstagramMessageGrant = {
    ...lifetime,
    ...context,
    externalId,
    accountId: previous?.accountId || link?.external_id || externalId,
    autoSync: previous?.autoSync ?? true,
    username: String(me.username),
    connectedAt: new Date().toISOString(),
    instagramLogin: true,
  };
  await writeVault(owner, 'messaging', 'instagram', grant);
  const detail =
    'Direct Instagram account verified for @' +
    grant.username +
    (list.data.length
      ? '. Conversation access responded; import messages to check message details.'
      : '. Instagram returned an empty conversation page. This does not mean the inbox is empty. Use the connection checks and message import to investigate access.') +
    ' Historical and request-folder limits still apply.';
  await saveCommunityStatus(owner, {
    source: 'instagram',
    kind: 'message',
    state: list.data.length ? 'partial' : 'needs-attention',
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
    // Attachment access is independent of text access. A denied optional field
    // must never make an otherwise readable conversation disappear.
    const media = await instagramMessageBatch(
      context,
      details.flatMap((r) =>
        r.body?.id
          ? [encodeURIComponent(r.body.id) + '?fields=id,attachments']
          : [],
      ),
    );
    const attachments = new Map(
      media.flatMap((r) =>
        r.body?.id ? [[r.body.id, r.body.attachments] as const] : [],
      ),
    );
    return {
      body: {
        data: details.flatMap((r) =>
          r.body
            ? [{ ...r.body, attachments: attachments.get(r.body.id) }]
            : [],
        ),
        paging: result.messages.paging,
      },
      inaccessible: failed,
      retryable: details.some((r) =>
        /time limit|timed?\s*out|timeout|abort/i.test(r.error || ''),
      ),
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message.replace(/^INPUT:/, '')
          : 'Instagram conversation failed.',
      inaccessible: 1,
      retryable: /time limit|timed?\s*out|timeout|abort/i.test(String(e)),
    };
  }
}

export async function ensureInstagramInbox(owner: string, accountId: string) {
  const grant = await readInstagramMessaging(owner);
  if (!grant || grant.accountId !== accountId) throw new Error('INPUT:The Instagram inbox connection changed. Start a new import.');
}
export async function setInstagramInboxSync(owner: string, enabled: boolean) {
  const grant = await readInstagramMessaging(owner);
  if (!grant) throw new Error('INPUT:Sign in with Instagram first.');
  await writeVault(owner, 'messaging', 'instagram', {...grant, autoSync: enabled});
  return {autoSync: enabled};
}
