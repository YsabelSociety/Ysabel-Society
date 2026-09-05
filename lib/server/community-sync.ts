import { database } from './db';
import { accessGrant, getApp, type Resource } from './connector-oauth';
import { readVault } from './connector-vault';
import { readDirect, directContext } from './connection-direct';
import { graphGet, graphBatch } from './report-meta';
import { requestJSON } from './providers';
import { saveCommunity, saveCommunityStatus } from './community-store';
import {
  safeProfileURL,
  type CommunityRecord,
  type CommunitySource,
} from '@/lib/community';

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
  const grant = await accessGrant(owner, link.provider);
  const target = await readVault<Resource>(owner, 'target', source);
  if (!target || target.id !== link.external_id)
    throw new Error('INPUT:Select the connected account again.');
  return {
    accessToken: target.pageToken || grant.accessToken,
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
) {
  const context = await linkedContext(owner, source);
  // A Page token identifies the Page used by the Facebook Login conversations API.
  const page = await graphGet(context, 'me?fields=id');
  const own = new Set([String(page.id), context.externalId]);
  const imported: CommunityRecord[] = [];
  let after = '',
    partial = false,
    inaccessible = 0,
    conversationCount = 0;
  for (let batch = 0; batch < 10; batch++) {
    let list: any;
    try {
      list = await graphGet(
        context,
        encodeURIComponent(String(page.id)) +
          '/conversations?' +
          new URLSearchParams({
            platform: source === 'instagram' ? 'instagram' : 'messenger',
            fields: 'id,updated_time,participants',
            limit: '50',
            ...(after ? { after } : {}),
          }),
      );
    } catch {
      throw new Error(
        'INPUT:Meta messaging access is not available. Add ' +
          (source === 'instagram'
            ? 'instagram_manage_messages'
            : 'pages_messaging') +
          ' and pages_manage_metadata to the app and login configuration, then authorize again. Real customer conversations may require Advanced Access, App Review and business verification.',
      );
    }
    if (list.error || !Array.isArray(list.data))
      throw new Error(
        'INPUT:Meta did not return a readable conversation list. Check messaging access and reconnect.',
      );
    const conversations = list.data;
    conversationCount += conversations.length;
    const replies = await graphBatch(
      context,
      conversations.map(
        (c: any) =>
          encodeURIComponent(c.id) +
          '/messages?fields=id,created_time,from,to,message,attachments&limit=20',
      ),
    );
    for (let i = 0; i < conversations.length; i++) {
      const c = conversations[i],
        response = replies[i];
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
        // Only explicit provider attachment types qualify; a shared post is not a story repost.
        for (const a of m.attachments?.data || [])
          if (['story_mention', 'story_repost'].includes(a.type))
            imported.push({
              ...item,
              id: m.id + ':' + a.type,
              kind: 'mention',
              mentionType: a.type,
              profileUrl: safeProfileURL(a.url),
            });
      }
    }
    after = list.paging?.cursors?.after || '';
    if (!list.paging?.next || !after) break;
    if (batch === 9) partial = true;
    if (imported.length >= 1800) {
      partial = true;
      break;
    }
  }
  if (imported.length > 1900) {
    imported.length = 1900;
    partial = true;
  }
  const people = [
    ...new Map(
      imported
        .filter((r) => r.direction === 'in')
        .map((r) => [r.participantId!, r]),
    ).values(),
  ].slice(0, 100);
  const profiles = await graphBatch(
    context,
    people.map(
      (p) =>
        encodeURIComponent(p.participantId!) +
        '?fields=' +
        (source === 'instagram'
          ? 'name,username,profile_pic,follower_count'
          : 'first_name,last_name,profile_pic'),
    ),
  );
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
  await saveCommunity(owner, imported);
  const detail =
    conversationCount +
    ' accessible conversations checked. Up to 20 recent messages per conversation; older captured records are retained. Counts describe captured messages, not a complete inbox history.' +
    (inaccessible
      ? ' ' + inaccessible + ' conversations or messages were inaccessible.'
      : '') +
    (partial ? ' Some history remains outside this import.' : '') +
    ' Story mentions/reposts count only when explicitly supplied; expired, private or untagged stories cannot be reconstructed.';
  await saveCommunityStatus(owner, {
    source,
    kind: 'message',
    state: 'partial',
    detail,
    accountId: context.accountId,
  });
  return {
    imported: imported.filter((r) => r.kind === 'message').length,
    detail,
  };
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
) {
  const kind = source === 'gbp' ? 'review' : 'message',
    db = database(),
    now = new Date().toISOString();
  if (source === 'tiktok')
    throw new Error(
      'INPUT:TikTok inbox access requires separately approved Business Messaging API access. Import a reviewed message export in the meantime; Display API sign-in does not grant messaging access.',
    );
  const lock = await db
    .prepare(
      "INSERT INTO community_sync(owner,source,kind,state,detail,updated_at) VALUES(?,?,?,'syncing','Import in progress',?) ON CONFLICT(owner,source,kind) DO UPDATE SET state='syncing',updated_at=excluded.updated_at WHERE (community_sync.state<>'syncing' OR community_sync.updated_at<?) AND (?=0 OR community_sync.updated_at<?)",
    )
    .bind(
      owner,
      source,
      kind,
      now,
      new Date(Date.now() - 600000).toISOString(),
      automatic ? 1 : 0,
      new Date(Date.now() - 900000).toISOString(),
    )
    .run();
  if (!lock.meta.changes) return { skipped: true };
  try {
    return source === 'gbp'
      ? await syncReviews(owner, continueImport || automatic)
      : await syncMessages(owner, source);
  } catch (e) {
    const detail =
      e instanceof Error && e.message.startsWith('INPUT:')
        ? e.message.slice(6)
        : source === 'gbp'
          ? 'Google reviews need access to a verified managed location and the Business Profile API. Check the Google connection and try again.'
          : 'Messaging import could not finish. Check Meta permissions and reconnect.';
    await saveCommunityStatus(owner, {
      source,
      kind,
      state: 'needs-access',
      detail,
    });
    throw new Error('INPUT:' + detail);
  }
}
