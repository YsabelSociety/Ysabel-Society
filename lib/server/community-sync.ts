import { database } from './db';
import { accessGrant, getApp, type Resource } from './connector-oauth';
import { readVault } from './connector-vault';
import { readDirect, directContext } from './connection-direct';
import { graphGet } from './report-meta';
import { requestJSON } from './providers';
import { conversationCursor } from '@/lib/message-pagination';
import {
  explicitMessageMentions,
  facebookTaggedPosts,
} from '@/lib/community-sync-plan';
import {
  readInstagramMessaging,
  instagramMessageBatch,
  instagramConversationMessages,
  metaMessageError,
} from './instagram-messaging';
import { saveCommunity, saveCommunityStatus } from './community-store';
import {
  safeProfileURL,
  type CommunityRecord,
  type CommunitySource,
} from '@/lib/community';

export async function readConversationList(
  context: {
    accessToken: string;
    apiVersion?: string;
    instagramLogin?: boolean;
  },
  pageId: string,
  source: 'facebook' | 'instagram',
  after = '',
  attempt = 0,
  pageSize = 50,
) {
  if (!/^v\d{1,2}\.\d{1,2}$/.test(context.apiVersion || ''))
    throw new Error('INPUT:Check the configured Meta API version.');
  const response = await fetch(
    (context.instagramLogin
      ? 'https://graph.instagram.com/'
      : 'https://graph.facebook.com/') +
      context.apiVersion +
      '/' +
      encodeURIComponent(pageId) +
      '/conversations?' +
      new URLSearchParams({
        platform: source === 'instagram' ? 'instagram' : 'messenger',
        fields:
          source === 'instagram' || attempt > 0
            ? 'id'
            : 'id,updated_time,participants',
        limit:
          attempt === 2
            ? '1'
            : attempt === 1
              ? '2'
              : String(Math.min(50, Math.max(1, pageSize))),
        ...(after ? { after } : {}),
      }),
    {
      headers: { Authorization: 'Bearer ' + context.accessToken },
      signal: AbortSignal.timeout(18000),
    },
  );
  const body: any = await response.json();
  if (!response.ok || body.error) {
    const error = body.error || {};
    if (error.code === 1 && attempt < 2)
      return readConversationList(
        context,
        pageId,
        source,
        after,
        attempt + 1,
        pageSize,
      );
    const detail = String(
      error.error_user_msg ||
        error.message ||
        'The conversation request was refused.',
    )
      .replaceAll(context.accessToken, '[redacted]')
      .replace(/https?:\/\/\S+/gi, '[provider link]')
      .replace(/EA[A-Za-z0-9]{30,}/g, '[redacted]')
      .slice(0, 500);
    throw new Error(
      'INPUT:Meta conversation import: ' +
        detail +
        (Number.isInteger(error.code) ? ' (Meta ' + error.code + ')' : '') +
        (/advanced access|users who do not have a role/i.test(detail)
          ? context.instagramLogin
            ? ' Meta is restricting these customer conversations. Check the Instagram account role and required access level.'
            : ' This Facebook-linked route requires Advanced Access for these customer conversations. Try Direct Instagram in Access & import for your own account, or complete Meta App Review.'
          : [10, 190, 200, 294].includes(error.code)
            ? ' Check ' +
              (source === 'instagram'
                ? 'instagram_manage_messages, connected-tool message access in Instagram,'
                : 'pages_messaging,') +
              ' pages_manage_metadata and the app access level. Only reconnect when permissions have changed.'
            : ' The provider could not complete this request. Try the import again later.'),
    );
  }
  return body;
}

async function linkedContext(owner: string, source: string) {
  const link = await database()
    .prepare(
      'SELECT external_id,provider FROM connector_links WHERE owner=? AND source=?',
    )
    .bind(owner, source)
    .first<{ external_id: string; provider: 'meta' | 'google' }>();
  if (!link)
    throw new Error(
      'INPUT:Connect ' +
        (source === 'gbp' ? 'Google Business' : source) +
        ' in Connections first.',
    );
  const direct = await readDirect(owner, source);
  if (direct)
    return {
      ...(await directContext(source, direct)),
      accountId: link.external_id,
    };
  const target = await readVault<Resource>(owner, 'target', source);
  if (!target || target.id !== link.external_id)
    throw new Error('INPUT:Select the connected account again.');
  return {
    // A selected Page grant has its own validity. Meta checks it on the actual
    // request; an unrelated user-token expiry must not disable the Page inbox.
    accessToken:
      target.pageToken || (await accessGrant(owner, link.provider)).accessToken,
    externalId: target.id,
    accountId: target.id,
    apiVersion:
      link.provider === 'meta'
        ? (await getApp(owner, 'meta')).apiVersion
        : undefined,
  };
}
async function ensureStillLinked(
  owner: string,
  source: string,
  accountId: string,
) {
  const link = await database()
    .prepare(
      'SELECT external_id FROM connector_links WHERE owner=? AND source=?',
    )
    .bind(owner, source)
    .first<{ external_id: string }>();
  if (link?.external_id !== accountId)
    throw new Error(
      'INPUT:The connection changed during import. Select the account and try again.',
    );
}
export async function syncMessages(
  owner: string,
  source: 'facebook' | 'instagram',
  continueImport = false,
  automatic = false,
) {
  const instagram =
    source === 'instagram' ? await readInstagramMessaging(owner) : null;
  if (instagram) await ensureStillLinked(owner, source, instagram.accountId);
  const started = Date.now(),
    deadline = started + 35000;
  const context = instagram
    ? { ...instagram, deadline }
    : await linkedContext(owner, source);
  // A Page token identifies the Page used by the Facebook Login conversations API.
  const page = instagram
    ? { id: instagram.externalId }
    : await graphGet(context, 'me?fields=id');
  const own = new Set([String(page.id), context.externalId, context.accountId]);
  const imported: CommunityRecord[] = [];
  const previous = await database()
    .prepare(
      "SELECT cursor,account_id FROM community_sync WHERE owner=? AND source=? AND kind='message'",
    )
    .bind(owner, source)
    .first<{ cursor: string; account_id: string }>();
  let after =
      continueImport && previous?.account_id === context.accountId
        ? previous.cursor || ''
        : '',
    partial = false,
    inaccessible = 0,
    conversationCount = 0,
    pagesChecked = 0;
  const seenCursors = new Set<string>();
  let conversationNode = String(page.id);
  if (!instagram && source === 'instagram' && after.startsWith('ig-node:')) {
    conversationNode = context.externalId;
    after = after.slice(8);
  }
  // Return small durable batches before the front proxy closes a long request.
  // Empty Instagram pages can still be scanned, but a readable thread ends the batch.
  const batches = automatic ? 1 : instagram ? 8 : 1;
  for (let batch = 0; batch < batches; batch++) {
    let list: any;
    try {
      list = await readConversationList(
        context,
        conversationNode,
        source,
        after,
        0,
        instagram ? 1 : automatic ? 10 : 25,
      );
    } catch (e) {
      // Probe the linked Instagram node as well as the Page node. Both calls
      // use the existing approved Page grant; Meta still enforces its access level.
      if (
        !instagram &&
        source === 'instagram' &&
        !after &&
        conversationNode !== context.externalId &&
        /Meta -2|Meta 1\)/.test(String(e))
      ) {
        try {
          list = await readConversationList(
            context,
            context.externalId,
            source,
          );
          conversationNode = context.externalId;
        } catch (alternate) {
          throw new Error(
            String(e instanceof Error ? e.message : e) +
              ' The linked Instagram-account route also failed: ' +
              String(
                alternate instanceof Error ? alternate.message : alternate,
              ).replace(/^INPUT:/, ''),
          );
        }
      } else throw e;
    }
    if (list.error || !Array.isArray(list.data))
      throw new Error(
        'INPUT:Meta did not return a readable conversation list. Check messaging access and reconnect.',
      );
    const conversations = list.data;
    pagesChecked++;
    conversationCount += conversations.length;
    await saveCommunityStatus(owner, {
      source,
      kind: 'message',
      state: 'syncing',
      accountId: context.accountId,
      detail:
        'Checking messages from ' +
        conversationCount +
        ' accessible conversations. The first import can take several minutes.',
    });
    const replies: {
      body?: any;
      error?: string;
      inaccessible?: number;
      retryable?: boolean;
    }[] = [];
    if (instagram) {
      for (let i = 0; i < conversations.length; i += 2)
        replies.push(
          ...(await Promise.all(
            conversations
              .slice(i, i + 2)
              .map((c: any) =>
                instagramConversationMessages(
                  { ...instagram, deadline },
                  String(c.id),
                ),
              ),
          )),
        );
    } else
      replies.push(
        ...(await communityMessageBatch(
          context,
          conversations.map(
            (c: any) =>
              encodeURIComponent(c.id) +
              '/messages?fields=id,created_time,from,to,message' +
              (source === 'facebook' ? ',attachments' : '') +
              '&limit=20',
          ),
          deadline,
        )),
      );
    // Optional attachment details must not prevent the core inbox from importing.
    const attachments =
      source === 'instagram' && !instagram
        ? await communityMessageBatch(
            context,
            conversations.map(
              (c: any) =>
                encodeURIComponent(c.id) +
                '/messages?fields=id,attachments&limit=20',
            ),
            deadline,
          )
        : [];
    const pageStart = imported.length;
    for (let i = 0; i < conversations.length; i++) {
      const c = conversations[i],
        response = replies[i];
      inaccessible += response.inaccessible || 0;
      if (response.error) {
        inaccessible++;
        continue;
      }
      if (response.body?.paging?.next) partial = true;
      const participants = c.participants?.data || [];
      for (const m of response.body?.data || []) {
        if (
          !m.id ||
          !m.created_time ||
          !m.from?.id ||
          !Number.isFinite(Date.parse(m.created_time))
        ) {
          inaccessible++;
          continue;
        }
        const outgoing = own.has(String(m.from.id));
        const peer = outgoing
          ? (m.to?.data || participants).find(
              (p: any) => !own.has(String(p.id)),
            )
          : m.from;
        if (!peer?.id) {
          inaccessible++;
          continue;
        }
        const item: CommunityRecord = {
          id: m.id,
          source,
          kind: 'message',
          accountId: context.accountId,
          time: new Date(m.created_time).toISOString(),
          conversationId: c.id,
          participantId: String(peer.id),
          name: peer.name || peer.username || 'Profile unavailable',
          username: peer.username,
          text: String(m.message || '').slice(0, 12000),
          direction: outgoing ? 'out' : 'in',
          origin: 'api',
          followers: null,
        };
        imported.push(item);
        imported.push(
          ...explicitMessageMentions(
            item,
            m.attachments ||
              attachments[i]?.body?.data?.find((x: any) => x.id === m.id)
                ?.attachments,
          ),
        );
      }
    }
    if (conversations.length && replies.every((r) => !!r.error))
      throw new Error(
        'INPUT:The conversation list is accessible, but message details failed: ' +
          replies[0].error,
      );
    await ensureStillLinked(owner, source, context.accountId);
    for (let start = pageStart; start < imported.length; start += 2000)
      await saveCommunity(owner, imported.slice(start, start + 2000));
    if (Date.now() >= deadline || replies.some((r) => r.retryable))
      throw new Error(
        'INPUT:The message batch reached its time limit. Readable messages were saved; retry this batch to check the remaining details.',
      );
    const next = conversationCursor(list.paging);
    // Save a checkpoint after every persisted page. Progress and errors must
    // not reset a manual history cursor, including during an automatic refresh.
    const checkpoint =
      !continueImport &&
      previous?.account_id === context.accountId &&
      previous.cursor
        ? previous.cursor
        : next &&
            !instagram &&
            source === 'instagram' &&
            conversationNode !== String(page.id)
          ? 'ig-node:' + next
          : next;
    await saveCommunityStatus(owner, {
      source,
      kind: 'message',
      state: 'syncing',
      detail:
        conversationCount +
        ' accessible conversations checked. Progress saved.',
      accountId: context.accountId,
      cursor: checkpoint,
    });
    if (!next) {
      after = '';
      break;
    }
    if (next === after || seenCursors.has(next)) {
      partial = true;
      after = next;
      break;
    }
    seenCursors.add(next);
    after = next;
    if (batch === batches - 1) partial = true;
    if (
      Date.now() - started > 18000 ||
      (instagram && conversations.length > 0)
    ) {
      partial = true;
      break;
    }
    if (imported.length >= 1800) {
      partial = true;
      break;
    }
  }
  const people = [
    ...new Map(
      imported
        .filter((r) => r.direction === 'in')
        .map((r) => [r.participantId!, r]),
    ).values(),
  ].slice(0, 100);
  const profilePaths = people.map(
    (p) =>
      encodeURIComponent(p.participantId!) +
      '?fields=' +
      (source === 'instagram'
        ? 'name,username,profile_pic,follower_count'
        : 'first_name,last_name,profile_pic'),
  );
  const profiles =
    Date.now() > deadline - 8000
      ? people.map(() => ({ body: undefined }))
      : instagram
        ? await instagramMessageBatch({ ...instagram, deadline }, profilePaths)
        : await communityMessageBatch(context, profilePaths, deadline);
  for (let i = 0; i < people.length; i++) {
    const p = profiles[i].body;
    if (!p) continue;
    const followers =
      source === 'instagram' &&
      Number.isSafeInteger(p.follower_count) &&
      p.follower_count >= 0
        ? p.follower_count
        : null;
    imported.push({
      ...people[i],
      id: people[i].participantId!,
      accountId: 'profile',
      kind: 'profile',
      time: new Date().toISOString(),
      text: '',
      name:
        p.name ||
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        people[i].name,
      username: p.username || people[i].username,
      avatar: safeProfileURL(p.profile_pic),
      profileUrl: p.username
        ? 'https://www.instagram.com/' + encodeURIComponent(p.username) + '/'
        : '',
      followers,
      followersObservedAt:
        followers !== null ? new Date().toISOString() : undefined,
    });
  }
  await ensureStillLinked(owner, source, context.accountId);
  for (let start = 0; start < imported.length; start += 2000)
    await saveCommunity(owner, imported.slice(start, start + 2000));
  const detail =
    (instagram && conversationCount === 0
      ? 'Instagram returned empty conversation pages. This does not mean your inbox is empty; message access is not yet verified. Check all connection routes in Access & import. '
      : '') +
    (instagram ? 'Direct Instagram connection. ' : '') +
    conversationCount +
    ' accessible conversations checked across ' +
    pagesChecked +
    ' pages. Up to 20 recent messages per conversation; older captured records are retained. Counts describe captured messages, not a complete inbox history.' +
    (inaccessible
      ? ' ' + inaccessible + ' conversations or messages were inaccessible.'
      : '') +
    (partial ? ' Some history remains outside this import.' : '') +
    (after
      ? ' More pages can be checked. Use Load older conversations to continue; a paging cursor does not guarantee readable messages.'
      : '') +
    (source === 'instagram'
      ? ' No folder filter is applied: eligible Primary, General and Requests conversations are combined. Meta excludes Requests inactive for 30 days; folder labels may not be supplied. Use a Meta JSON download for older available message history.'
      : '') +
    ' Story mentions/reposts count only when explicitly supplied; expired, private or untagged stories cannot be reconstructed.';
  await saveCommunityStatus(owner, {
    source,
    kind: 'message',
    state: instagram && conversationCount === 0 ? 'needs-attention' : 'partial',
    detail,
    accountId: context.accountId,
    cursor:
      !continueImport &&
      previous?.account_id === context.accountId &&
      previous.cursor
        ? previous.cursor
        : after &&
            !instagram &&
            source === 'instagram' &&
            conversationNode !== String(page.id)
          ? 'ig-node:' + after
          : after,
  });
  return {
    imported: imported.filter((r) => r.kind === 'message').length,
    mentionsImported: imported.filter((r) => r.kind === 'mention').length,
    more: !!(
      after ||
      (!continueImport &&
        previous?.account_id === context.accountId &&
        previous.cursor)
    ),
    needsAttention: !!instagram && conversationCount === 0,
    detail,
  };
}
async function communityMessageBatch(
  context: { accessToken: string; apiVersion?: string },
  paths: string[],
  deadline: number,
) {
  const results: { body?: any; error?: string; retryable?: boolean }[] = [];
  for (let i = 0; i < paths.length; i += 40) {
    const chunk = paths.slice(i, i + 40);
    try {
      if (Date.now() >= deadline) throw new Error('Batch time limit');
      const response = await fetch(
        'https://graph.facebook.com/' + context.apiVersion + '/',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + context.accessToken,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            batch: JSON.stringify(
              chunk.map((relative_url) => ({ method: 'GET', relative_url })),
            ),
          }),
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(10000, deadline - Date.now())),
          ),
        },
      );
      const result: any = await response.json();
      for (let j = 0; j < chunk.length; j++) {
        const item = Array.isArray(result) ? result[j] : null;
        let body: any;
        try {
          body = JSON.parse(item?.body || '{}');
        } catch {
          body = {};
        }
        results.push(
          response.ok && item?.code >= 200 && item.code < 300 && !body.error
            ? { body }
            : {
                error: metaMessageError(
                  body.error || result.error,
                  context.accessToken,
                ),
              },
        );
      }
    } catch {
      results.push(
        ...chunk.map(() => ({
          error:
            'Meta message details did not finish within this batch. Retry to continue.',
          retryable: true,
        })),
      );
    }
  }
  return results;
}
export async function syncFacebookTags(
  owner: string,
  continueImport = false,
  automatic = false,
) {
  const context = await linkedContext(owner, 'facebook');
  const previous = await database()
    .prepare(
      "SELECT cursor,account_id FROM community_sync WHERE owner=? AND source='facebook' AND kind='mention'",
    )
    .bind(owner)
    .first<{ cursor: string; account_id: string }>();
  let after =
    continueImport && previous?.account_id === context.accountId
      ? previous.cursor || ''
      : '';
  let count = 0;
  const seen = new Set<string>();
  for (let page = 0; page < (automatic ? 1 : 5); page++) {
    const response = await fetch(
      'https://graph.facebook.com/' +
        context.apiVersion +
        '/' +
        encodeURIComponent(context.externalId) +
        '/tagged?' +
        new URLSearchParams({
          fields: 'id,message,created_time,tagged_time,permalink_url,from',
          limit: '50',
          ...(after ? { after } : {}),
        }),
      {
        headers: { Authorization: 'Bearer ' + context.accessToken },
        signal: AbortSignal.timeout(30000),
      },
    );
    const body: any = await response.json();
    if (!response.ok || body.error)
      throw new Error(
        'INPUT:Facebook tagged posts: ' +
          metaMessageError(body.error, context.accessToken) +
          ' Check pages_read_user_content and the Page access level.',
      );
    if (!Array.isArray(body.data))
      throw new Error(
        'INPUT:Facebook did not return a readable tagged-post list.',
      );
    const records = facebookTaggedPosts(body.data, context.accountId);
    await ensureStillLinked(owner, 'facebook', context.accountId);
    await saveCommunity(owner, records);
    count += records.length;
    const next = conversationCursor(body.paging);
    const repeated = !!next && (seen.has(next) || next === after);
    after = next;
    await saveCommunityStatus(owner, {
      source: 'facebook',
      kind: 'mention',
      state: 'syncing',
      accountId: context.accountId,
      cursor: after,
      detail: count + ' tagged posts saved.',
    });
    if (!after || repeated) break;
    seen.add(after);
  }
  const detail =
    count +
    ' Facebook tagged posts imported. ' +
    (after
      ? 'More pages remain. '
      : 'All pages returned by Facebook were checked. ') +
    'Private posts and most author details may not be supplied.';
  await saveCommunityStatus(owner, {
    source: 'facebook',
    kind: 'mention',
    state: after ? 'partial' : 'synced',
    accountId: context.accountId,
    cursor: after,
    detail,
  });
  return { imported: count, more: !!after, detail };
}
export async function syncInstagramTags(owner: string, continueImport = false) {
  const context = await linkedContext(owner, 'instagram');
  const previous = await database()
    .prepare(
      "SELECT cursor,account_id FROM community_sync WHERE owner=? AND source='instagram' AND kind='mention'",
    )
    .bind(owner)
    .first<{ cursor: string; account_id: string }>();
  let after =
    continueImport && previous?.account_id === context.accountId
      ? previous.cursor || ''
      : '';
  let count = 0;
  for (let page = 0; page < 10; page++) {
    const tagResponse = await fetch(
      'https://graph.facebook.com/' +
        context.apiVersion +
        '/' +
        encodeURIComponent(context.externalId) +
        '/tags?' +
        new URLSearchParams({
          fields: 'id,caption,username,timestamp,permalink',
          limit: '50',
          ...(after ? { after } : {}),
        }),
      {
        headers: { Authorization: 'Bearer ' + context.accessToken },
        signal: AbortSignal.timeout(30000),
      },
    );
    const body: any = await tagResponse.json();
    if (!tagResponse.ok || body.error)
      throw new Error(
        'INPUT:Instagram tagged-post import: ' +
          metaMessageError(body.error, context.accessToken),
      );
    if (!Array.isArray(body.data))
      throw new Error(
        'INPUT:Meta did not return tagged posts. Check the Instagram reporting connection.',
      );
    const records: CommunityRecord[] = body.data
      .filter((m: any) => m.id && Number.isFinite(Date.parse(m.timestamp)))
      .map((m: any) => ({
        id: 'tag:' + m.id,
        source: 'instagram',
        kind: 'mention',
        accountId: context.accountId,
        time: new Date(m.timestamp).toISOString(),
        username: m.username || undefined,
        name: m.username || 'Profile unavailable',
        text: String(m.caption || '').slice(0, 12000),
        profileUrl: safeProfileURL(m.permalink),
        mentionType: 'post_tag',
        origin: 'api',
      }));
    await ensureStillLinked(owner, 'instagram', context.accountId);
    await saveCommunity(owner, records);
    count += records.length;
    const next = conversationCursor(body.paging);
    const repeated = !!next && next === after;
    after = next;
    await saveCommunityStatus(owner, {
      source: 'instagram',
      kind: 'mention',
      state: 'syncing',
      accountId: context.accountId,
      cursor: after,
      detail: count + ' tagged posts saved.',
    });
    if (repeated) break;
    if (!after) break;
  }
  const detail =
    count +
    ' tagged posts imported. ' +
    (after
      ? 'More tagged posts are available; continue the import. '
      : 'All tagged-post pages returned by Meta were checked. ') +
    'Post tags are separate from caption mentions, story mentions and reposts. Historical stories and untagged reposts are not supplied by this endpoint.';
  await saveCommunityStatus(owner, {
    source: 'instagram',
    kind: 'mention',
    state: after ? 'partial' : 'synced',
    cursor: after,
    accountId: context.accountId,
    detail,
  });
  return { imported: count, more: !!after, detail };
}
async function syncMetaMentions(
  owner: string,
  source: 'instagram' | 'facebook',
  older: boolean,
  automatic: boolean,
) {
  const details: string[] = [];
  let imported = 0,
    accessible = false,
    more = false;
  try {
    const tags =
      source === 'instagram'
        ? await syncInstagramTags(owner, older || automatic)
        : await syncFacebookTags(owner, older || automatic, automatic);
    imported += tags.imported;
    more = tags.more;
    accessible = true;
    details.push(tags.detail);
  } catch (e) {
    details.push(
      e instanceof Error && e.message.startsWith('INPUT:')
        ? e.message.slice(6)
        : 'Tagged-post import could not complete. Saved records are retained.',
    );
  }
  // Story mentions are inbox attachments, not results of the tagged-post edge.
  // Automatic refresh already checks the inbox separately.
  if (!automatic) {
    try {
      const messages = await runCommunitySync(owner, source, older, false);
      if ('mentionsImported' in messages) {
        imported += Number(messages.mentionsImported || 0);
        accessible ||= !messages.needsAttention;
        details.push(
          messages.mentionsImported +
            ' explicit story events captured from messages.',
        );
      }
      if ('detail' in messages) details.push(String(messages.detail));
      if ('skipped' in messages)
        details.push(
          'The inbox is already being checked; its story events appear when that import completes.',
        );
    } catch (e) {
      details.push(
        e instanceof Error && e.message.startsWith('INPUT:')
          ? e.message.slice(6)
          : 'Message-based mentions could not be checked.',
      );
    }
  }
  details.push(
    'Caption mentions and past story reposts are not supplied by tagged-post imports. Continuous story-event collection is not configured.',
  );
  const detail = details.join(' ');
  await saveCommunityStatus(owner, {
    source,
    kind: 'mention',
    state: accessible ? 'partial' : 'needs-attention',
    detail,
  });
  return { imported, more, detail, needsAttention: !accessible };
}
export async function syncReviews(owner: string, continueImport = false) {
  const context = await linkedContext(owner, 'gbp'),
    headers = { Authorization: 'Bearer ' + context.accessToken };
  let accountPath = '';
  const previous = await database()
    .prepare(
      "SELECT cursor,account_id FROM community_sync WHERE owner=? AND source='gbp' AND kind='review'",
    )
    .bind(owner)
    .first<{ cursor: string; account_id: string }>();
  if (previous?.account_id?.endsWith('/locations/' + context.externalId))
    accountPath = previous.account_id;
  if (!accountPath) {
    let next = '';
    for (let n = 0; n < 10 && !accountPath; n++) {
      const accounts = await requestJSON(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20' +
          (next ? '&pageToken=' + encodeURIComponent(next) : ''),
        { headers },
      );
      for (const a of accounts.accounts || []) {
        let pageToken = '';
        for (let p = 0; p < 20 && !accountPath; p++) {
          const locations = await requestJSON(
            'https://mybusinessbusinessinformation.googleapis.com/v1/' +
              a.name +
              '/locations?readMask=name&pageSize=100' +
              (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''),
            { headers },
          );
          if (
            (locations.locations || []).some(
              (l: any) => l.name === 'locations/' + context.externalId,
            )
          )
            accountPath = a.name + '/locations/' + context.externalId;
          pageToken = locations.nextPageToken || '';
          if (!pageToken) break;
        }
        if (accountPath) break;
      }
      next = accounts.nextPageToken || '';
      if (!next) break;
    }
  }
  if (!accountPath)
    throw new Error(
      'INPUT:The connected Google location could not be found. Authorize the account that manages this location.',
    );
  let pageToken =
      continueImport && previous?.account_id === accountPath
        ? previous?.cursor || ''
        : '',
    count = 0,
    total = 0;
  for (let n = 0; n < 10; n++) {
    const body = await requestJSON(
      'https://mybusiness.googleapis.com/v4/' +
        accountPath +
        '/reviews?' +
        new URLSearchParams({
          pageSize: '50',
          orderBy: 'updateTime desc',
          ...(pageToken ? { pageToken } : {}),
        }),
      { headers },
    );
    const rating: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };
    const records: CommunityRecord[] = (body.reviews || [])
      .filter((r: any) => r.reviewId && r.createTime)
      .map((r: any) => ({
        id: r.reviewId,
        kind: 'review',
        source: 'gbp',
        accountId: context.accountId,
        time: new Date(r.createTime).toISOString(),
        name: r.reviewer?.displayName || 'Anonymous reviewer',
        avatar: safeProfileURL(r.reviewer?.profilePhotoUrl),
        text: String(r.comment || '').slice(0, 12000),
        rating: rating[r.starRating],
        reply: r.reviewReply?.comment || '',
        origin: 'api',
      }));
    await ensureStillLinked(owner, 'gbp', context.accountId);
    await saveCommunity(owner, records);
    count += records.length;
    total = Number(body.totalReviewCount) || 0;
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  const detail = pageToken
    ? 'More reviews are available. Continue importing to collect the remaining history.'
    : 'All pages returned by Google were imported. Reviews are categorized from their text; category suggestions should be reviewed.';
  await saveCommunityStatus(owner, {
    source: 'gbp',
    kind: 'review',
    state: pageToken ? 'partial' : 'synced',
    detail,
    cursor: pageToken,
    accountId: accountPath,
    total,
  });
  return { imported: count, more: !!pageToken, detail };
}
export async function runCommunitySync(
  owner: string,
  source: CommunitySource,
  continueImport = false,
  automatic = false,
  requestedKind?: 'mention',
  force = false,
): Promise<{
  imported?: number;
  mentionsImported?: number;
  detail?: string;
  more?: boolean;
  skipped?: boolean;
  needsAttention?: boolean;
}> {
  const kind = requestedKind || (source === 'gbp' ? 'review' : 'message'),
    db = database(),
    now = new Date().toISOString();
  const lock = await db
    .prepare(
      "INSERT INTO community_sync(owner,source,kind,state,detail,updated_at) VALUES(?,?,?,'syncing','Import in progress',?) ON CONFLICT(owner,source,kind) DO UPDATE SET state='syncing',updated_at=excluded.updated_at WHERE (community_sync.state<>'syncing' OR community_sync.updated_at<?) AND (?=0 OR community_sync.updated_at<?)",
    )
    .bind(
      owner,
      source,
      kind,
      now,
      new Date(
        Date.now() - (kind === 'review' ? 600000 : 120000),
      ).toISOString(),
      automatic && !force ? 1 : 0,
      new Date(Date.now() - 300000).toISOString(),
    )
    .run();
  if (!lock.meta.changes) return { skipped: true };
  try {
    if (source === 'tiktok') {
      const grant = await readVault(owner, 'grant', 'tiktok-business');
      throw new Error(
        'INPUT:' +
          (grant
            ? 'TikTok Business authorization is saved, but live message and mention imports have not been activated or verified. '
            : 'TikTok message and mention access is not authorized. Complete the Business app review and the separate messaging security review, then authorize the account in TikTok messages & mentions setup. ') +
          'The existing profile/video connection cannot read private messages or mentions. Saved file imports are retained.',
      );
    }
    return kind === 'mention'
      ? source === 'gbp'
        ? (() => {
            throw new Error('INPUT:Choose a social platform for mentions.');
          })()
        : await syncMetaMentions(owner, source, continueImport, automatic)
      : source === 'gbp'
        ? await syncReviews(owner, continueImport || automatic)
        : await syncMessages(owner, source, continueImport, automatic);
  } catch (e) {
    const timedOut =
      !!e &&
      typeof e === 'object' &&
      'name' in e &&
      ['TimeoutError', 'AbortError'].includes(String(e.name));
    const detail = timedOut
      ? 'The provider request timed out. Previously captured records are retained. Try importing again later; this does not establish a permission problem.'
      : e instanceof Error && e.message.startsWith('INPUT:')
        ? e.message.slice(6)
        : source === 'gbp'
          ? 'Google reviews need access to a verified managed location and the Business Profile API. Check the Google connection and try again.'
          : 'The provider did not return a readable messaging response. Previously captured records are retained. Try importing again later.';
    await saveCommunityStatus(owner, {
      source,
      kind,
      state: 'needs-attention',
      detail,
    });
    throw new Error('INPUT:' + detail);
  }
}
