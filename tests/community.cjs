/* Run with Node 24: node tests/connectors.cjs. No network or real accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sql = new DatabaseSync(':memory:');
for (const name of [
  '0000_organic_tiger_shark.sql',
  '0001_connection_assistant.sql',
  '0002_reporting_sources.sql',
  '0003_swift_surge.sql',
])
  sql.exec(fs.readFileSync(path.join(root, 'drizzle', name), 'utf8'));
const db = {
  prepare(query) {
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        return sql.prepare(query).get(...this.args) || null;
      },
      async all() {
        return { results: sql.prepare(query).all(...this.args) };
      },
      async run() {
        return { meta: sql.prepare(query).run(...this.args) };
      },
    };
  },
  async batch(statements) {
    return Promise.all(statements.map((s) => s.run()));
  },
};
const env = {
  CONNECTOR_SITE_URL: 'https://ysabel.test',
  CONNECTOR_ENCRYPTION_KEY: Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString('base64'),
};
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (id) => {
    const resolved = id.startsWith('@/')
      ? path.join(root, id.slice(2))
      : path.resolve(path.dirname(file), id);
    if (resolved === path.join(root, 'lib/server/db'))
      return {
        database: () => db,
        secrets: () => env,
        requireText: (v) => {
          if (typeof v !== 'string' || !v.trim())
            throw new Error('INPUT:Text required');
          return v.trim();
        },
        requireDate: (v) => {
          if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
            throw new Error('INPUT:Date required');
          return v;
        },
      };
    if (id.startsWith('.') || id.startsWith('@/'))
      return load(resolved + '.ts');
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

const community = load('lib/community.ts');
assert.equal(community.nativeConversation({source:'instagram',username:'visitor'}).url,'https://ig.me/m/visitor');
assert.equal(community.nativeConversation({source:'facebook',conversationUrl:'https://evil.example/chat'}).direct,false);
assert(community.clientSignals({followers:null},[{text:'I am visiting on vacation and would like a business dinner'}]).some(s=>s.label==='Travel / visitor interest'));
assert(community.clientSignals({followers:400},[{text:'I am a food blogger interested in a collaboration'}]).some(s=>s.label==='Creator / collaboration'));
assert.equal(community.clientSignals({followers:null},[{text:'Hello'}]).length,0);
const syncPlan = load('lib/community-sync-plan.ts');
assert.deepEqual(syncPlan.communitySyncSources('all'), [
  'facebook',
  'instagram',
  'tiktok',
]);
assert.deepEqual(syncPlan.communitySyncSources('tiktok'), ['tiktok']);
assert.deepEqual(syncPlan.communitySyncSources('instagram'), ['instagram']);
assert.deepEqual(syncPlan.communitySyncSources('gbp'), []);
const storyFixture = {
  id: 'story-event',
  direction: 'in',
  source: 'instagram',
  kind: 'message',
  accountId: 'fixture',
  time: '2026-09-01T10:00:00Z',
  text: '',
  origin: 'api',
};
assert.equal(
  syncPlan.explicitMessageMentions(storyFixture, [
    { type: 'share' },
    { type: 'story_reply' },
  ]).length,
  0,
);
assert.equal(
  syncPlan.explicitMessageMentions({ ...storyFixture, direction: 'out' }, [
    { type: 'story_mention' },
  ]).length,
  0,
);
const storyEvents = syncPlan.explicitMessageMentions(storyFixture, [
  { type: 'story_mention', payload: { url: 'https://example.com/story' } },
  { type: 'story_mention' },
]);
assert.equal(storyEvents.length, 1);
assert.equal(storyEvents[0].profileUrl, 'https://example.com/story');
assert.equal(
  syncPlan.explicitMessageMentions(storyFixture, {
    data: [{ type: 'story_repost', url: 'javascript:bad' }],
  })[0].profileUrl,
  '',
);
const analytics = load('lib/analytics.ts');
assert.equal(community.followerTier(5000), '5K or fewer');
assert.equal(community.followerTier(5001), '>5K–9.9K');
assert.equal(community.followerTier(10000), '10K–19.9K');
assert.equal(community.followerTier(20000), '20K–29.9K');
assert.equal(community.followerTier(30000), '30K+');
assert.equal(community.matchesProfile({ followers: 29999 }, '30K+ followers', 'All locations'), false);
assert.equal(community.matchesProfile({ followers: 30000 }, '30K+ followers', 'All locations'), true);
assert.equal(community.followerTier(null), 'Unknown');
assert.equal(
  community.matchesProfile(
    { followers: null, locationGroup: 'local' },
    '20K+ followers',
    'Local',
  ),
  false,
);
assert.equal(
  community.matchesProfile(
    { followers: 20000, locationGroup: 'abroad' },
    '10K+ followers',
    'Abroad',
  ),
  true,
);
assert.equal(
  community.matchesProfile({ followers: 22000 }, '20K+ followers', 'Local'),
  false,
  'unknown location must not become local',
);
const sparseFollowers = analytics.series(
  [
    {
      date: '2026-09-01',
      channel: 'Instagram',
      followers: 20,
      available: ['followers'],
    },
    {
      date: '2026-09-02',
      channel: 'Facebook',
      followers: 10,
      available: ['followers'],
    },
  ],
  'followers',
);
assert.equal(
  sparseFollowers[0].Facebook,
  undefined,
  'missing follower observations are not zero',
);
assert.equal(sparseFollowers[1].Instagram, undefined);
const exportFixture = JSON.stringify({
  participants: [{ name: 'Ysabel Society' }, { name: 'Visitor' }],
  thread_path: 'messages/inbox/visitor_123',
  messages: [
    {
      sender_name: 'Visitor',
      timestamp_ms: Date.parse('2026-09-01T10:00:00Z'),
      content: 'Hello',
    },
    {
      sender_name: 'Ysabel Society',
      timestamp_ms: Date.parse('2026-09-01T11:00:00Z'),
      content: 'Our reply',
    },
  ],
});
const exportMessages = community.parseMetaMessageJSON(
  exportFixture,
  'instagram',
  'Ysabel Society',
  'requests',
);
const largeArchive = JSON.stringify({
  participants: [{ name: 'Ysabel Society' }, { name: 'Visitor' }],
  thread_path: 'messages/inbox/visitor_123',
  messages: Array.from({ length: 2501 }, () => ({
    sender_name: 'Visitor',
    timestamp_ms: Date.parse('2026-09-01T10:00:00Z'),
    content: 'Repeated message',
  })),
});
const preparedArchive = community.prepareMetaMessageParts(
  largeArchive,
  'instagram',
  'Ysabel Society',
  'requests',
);
assert.equal(preparedArchive.parts.length, 3);
const preparedRecords = preparedArchive.parts.flatMap((part) =>
  community.parseMetaMessageJSON(
    part.csv,
    'instagram',
    'Ysabel Society',
    part.folder,
  ),
);
assert.equal(
  new Set(preparedRecords.map((r) => r.id)).size,
  2501,
  'identical messages keep separate IDs across chunk boundaries',
);
assert.ok(
  preparedRecords.every((r) => r.folder === 'requests' && r.direction === 'in'),
);
assert.deepEqual(
  preparedRecords.map((r) => r.id),
  community
    .parseMetaMessageJSON(
      largeArchive,
      'instagram',
      'Ysabel Society',
      'requests',
      100000,
    )
    .map((r) => r.id),
  'splitting and re-import preserve original record IDs',
);
assert.ok(
  preparedArchive.parts.every(
    (part) => JSON.stringify({ csv: part.csv }).length < 1400000,
  ),
);
assert.deepEqual(
  exportMessages.map((m) => m.direction),
  ['in', 'out'],
);
assert.equal(exportMessages[0].folder, 'requests');
assert.equal(exportMessages[0].followers, null);
assert.deepEqual(
  exportMessages.map((m) => m.id),
  community
    .parseMetaMessageJSON(
      exportFixture,
      'instagram',
      'Ysabel Society',
      'requests',
    )
    .map((m) => m.id),
  're-import has stable IDs',
);
assert.throws(
  () =>
    community.parseMetaMessageJSON(
      exportFixture,
      'instagram',
      'Different business',
    ),
  /exactly match/,
);
assert.throws(
  () =>
    community.parseMetaMessageJSON(
      JSON.stringify({
        participants: [
          { name: 'Ysabel Society' },
          { name: 'A' },
          { name: 'B' },
        ],
        messages: [{}],
      }),
      'instagram',
      'Ysabel Society',
    ),
  /one-to-one/,
);
const store = load('lib/server/community-store.ts');
const vault = load('lib/server/connector-vault.ts');
const sync = load('lib/server/community-sync.ts');
const range = { start: '2026-09-01', end: '2026-09-05' };
const owner = 'community-owner';
const message = (id, time, direction, extra = {}) => ({
  id,
  time,
  direction,
  source: 'instagram',
  kind: 'message',
  accountId: 'ig',
  conversationId: 'thread',
  participantId: 'customer',
  text: 'Hello',
  origin: 'api',
  followers: null,
  ...extra,
});
let responder;
global.fetch = async (url, init) => {
  const result = await responder(String(url), init);
  return result instanceof Response ? result : Response.json(result);
};
async function link(source, provider, id) {
  sql
    .prepare(
      'INSERT OR REPLACE INTO connector_links(owner,source,provider,external_id,label) VALUES(?,?,?,?,?)',
    )
    .run(owner, source, provider, id, 'Test location');
  await vault.writeVault(owner, 'target', source, {
    source,
    id,
    label: 'Test',
    ...(provider === 'meta' ? { pageToken: 'test-page-token' } : {}),
  });
  await vault.writeVault(owner, 'grant', provider, {
    accessToken: 'test-access',
    expiresAt: Date.now() + 86400000,
    authorizedAt: new Date().toISOString(),
  });
  await vault.writeVault(owner, 'app', provider, {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    apiVersion: 'v26.0',
  });
}
async function main() {
  const photoURL=load('lib/profile-photo.ts').providerPhotoURL;
  assert.equal(photoURL('https://scontent.fbcdn.net/photo.jpg'),'https://scontent.fbcdn.net/photo.jpg');
  for (const url of ['http://scontent.fbcdn.net/x','https://fbcdn.net.evil.test/x','https://127.0.0.1/x','https://fbcdn.net:444/x','https://user:pass@fbcdn.net/x']) assert.equal(photoURL(url),'');
  const login=load('lib/server/instagram-login.ts');
  await login.saveInstagramLogin(owner,{clientId:'1234',clientSecret:'fixture-secret',apiVersion:'v26.0'});
  const started=await login.beginInstagramLogin(owner,new Request('https://ysabel.test/marketingdata/api/instagram-messaging'));
  const authURL=new URL(started.url), nonce=started.cookie.split(';')[0];
  assert.equal(authURL.hostname,'www.instagram.com');
  assert.equal(authURL.searchParams.get('enable_fb_login'),'0');
  assert.match(authURL.searchParams.get('scope'),/instagram_business_manage_messages/);
  assert(!started.url.includes('fixture-secret'));
  const callback='https://ysabel.test/marketingdata/api/instagram-messaging/callback?code=test&state='+authURL.searchParams.get('state');
  await assert.rejects(()=>login.finishInstagramLogin('other-owner',new Request(callback,{headers:{cookie:nonce}})),/cancelled or expired/);
  await assert.rejects(()=>login.finishInstagramLogin(owner,new Request(callback,{headers:{cookie:'ys_instagram_login=wrong'}})),/cancelled or expired/);
  const oldResponder=responder;
  responder=async()=>Response.json({error:{message:'bad code'}},{status:400});
  await assert.rejects(()=>login.finishInstagramLogin(owner,new Request(callback,{headers:{cookie:nonce}})),/did not complete/);
  await assert.rejects(()=>login.finishInstagramLogin(owner,new Request(callback,{headers:{cookie:nonce}})),/cancelled or expired/,'one-time callback cannot be replayed');
  responder=oldResponder;
  const savedPhoto={...message('photo-fixture',new Date().toISOString(),'in'),kind:'profile',accountId:'profile',avatar:'https://scontent.fbcdn.net/photo.jpg',conversationUrl:'https://www.facebook.com/messages/t/123'};
  await store.saveCommunity(owner,[savedPhoto]);
  await store.saveCommunity(owner,[{...savedPhoto,avatar:'',conversationUrl:undefined}]);
  const kept=(await store.readCommunity(owner,'message')).records.find(r=>r.id==='photo-fixture');
  assert.equal(kept.avatar,savedPhoto.avatar,'partial profile sync retains the last supplied photo');
  assert.equal(kept.conversationUrl,savedPhoto.conversationUrl);
  sql.prepare("DELETE FROM community_records WHERE id='profile:photo-fixture'").run();
  const in1 = message('1', '2026-09-01T10:00:00Z', 'in', {
    text: 'Can I reserve a table?',
    followers: 5001,
  });
  const in2 = message('2', '2026-09-02T10:00:00Z', 'in');
  const out = message('3', '2026-09-06T10:00:00Z', 'out');
  let model = community.inboxModel([in1, in2, out], range, 'Europe/Tirane');
  assert.equal(model.received.length, 2);
  assert.equal(
    model.waiting.length,
    0,
    'a reply outside the selected period resolves the backlog',
  );
  assert.equal(model.unanswered.length, 0);
  model = community.inboxModel([in1], range, 'Europe/Tirane');
  assert.equal(model.influencerCount, 1);
  assert.equal(model.priority.length, 1);
  assert.equal(
    community.inboxModel([{ ...in1, followers: 5000 }], range, 'UTC')
      .influencerCount,
    0,
  );
  assert.equal(
    community.inboxModel([{ ...in1, followers: null }], range, 'UTC')
      .influencerCount,
    0,
  );
  assert.equal(
    community.inboxModel([in1], range, 'UTC', 'tiktok').received.length,
    0,
  );
  const manual = {
    ...in1,
    id: 'customer',
    accountId: 'manual-profile',
    kind: 'profile',
    origin: 'manual',
    potentialClient: false,
    followers: 6200,
    username: 'verified',
    time: '2026-09-03T10:00:00Z',
  };
  const apiProfile = {
    ...manual,
    accountId: 'profile',
    origin: 'api',
    potentialClient: undefined,
    followers: null,
    username: undefined,
    time: '2026-09-04T10:00:00Z',
  };
  const enriched = community.inboxModel([in1, manual, apiProfile], range, 'UTC')
    .conversations[0];
  assert.equal(enriched.person.followers, 6200);
  assert.equal(enriched.person.username, 'verified');
  assert.equal(
    enriched.possibleClient,
    false,
    'manual dismissal survives API refresh and keyword suggestions',
  );
  const tied = community.inboxModel(
    [in1, { ...out, time: in1.time }],
    range,
    'UTC',
  );
  assert.equal(tied.conversations[0].ambiguous, true);
  assert.equal(tied.waiting.length, 0);
  const midnight = message('midnight', '2026-09-06T22:30:00Z', 'in');
  assert.equal(
    community.localDate(midnight.time, 'Europe/Tirane'),
    '2026-09-07',
  );
  assert.deepEqual(
    community.bucketActivity([midnight], 'Week', 'Europe/Tirane'),
    [{ date: '2026-09-07', count: 1 }],
  );
  assert.deepEqual(
    community.bucketActivity([midnight], 'Month', 'Europe/Tirane'),
    [{ date: '2026-09-01', count: 1 }],
  );
  const review = (text) => ({
    ...in1,
    source: 'gbp',
    kind: 'review',
    rating: 1,
    text,
  });
  assert(community.reviewTopics(review("The food didn't quite meet our expectations.")).criticisms.some(c => c.topic === 'Food'));
  assert(community.reviewTopics(review('The cocktails are basic, and unfortunately there is not much variety.')).criticisms.some(c => c.topic === 'Drinks'));
  assert.equal(community.reviewTopics(review('A basic menu with excellent food.')).criticisms.length, 0);
  let topics = community.reviewTopics(
    review('The food was excellent but service was rude.'),
  );
  assert.deepEqual(topics.categories, ['Food', 'Service']);
  assert.deepEqual(
    topics.criticisms.map((c) => c.topic),
    ['Service'],
  );
  assert.equal(
    community.reviewTopics(review('The food was not bad. No complaints.'))
      .criticisms.length,
    0,
  );
  assert.equal(
    community.reviewTopics(review('Excellent food.')).criticisms.length,
    0,
    'low stars do not invent a complaint',
  );
  assert.deepEqual(
    community
      .reviewTopics(review('The pasta was cold.'))
      .criticisms.map((c) => c.topic),
    ['Food'],
  );
  const header =
    'id,time,conversation_id,participant_id,direction,followers,text';
  const row = 'row-1,2026-09-01T11:00:00+02:00,thread,customer,in,,Hello';
  const parsed = community.parseCommunityCSV(
    header + '\n' + row,
    'tiktok',
    'message',
  );
  assert.equal(parsed[0].followers, null);
  assert.equal(parsed[0].time, '2026-09-01T09:00:00.000Z');
  assert.throws(
    () =>
      community.parseCommunityCSV(
        header + '\n' + row + '\n' + row,
        'tiktok',
        'message',
      ),
    /unique id/,
  );
  assert.throws(
    () =>
      community.parseCommunityCSV(
        header + '\n' + row.replace('+02:00', ''),
        'tiktok',
        'message',
      ),
    /timezone/,
  );
  assert.throws(
    () =>
      community.parseCommunityCSV(
        header + '\n' + row.replace(',in,', ',incoming,'),
        'tiktok',
        'message',
      ),
    /direction/,
  );
  assert.equal(community.safeProfileURL('javascript:alert(1)'), '');
  assert.equal(community.safeProfileURL('https://user:pass@example.com'), '');
  await store.saveCommunity(owner, [in1]);
  await store.saveCommunity(owner, [
    { ...in1, text: 'Updated private message' },
  ]);
  assert.equal((await store.readCommunity(owner, 'message')).records.length, 1);
  assert.equal(
    (await store.readCommunity('different-owner', 'message')).records.length,
    0,
  );
  const encrypted = sql
    .prepare('SELECT encrypted FROM community_records')
    .get().encrypted;
  assert.ok(!encrypted.includes('private message'));
  await assert.rejects(() => vault.unseal(encrypted, 'wrong-owner'));
  await store.saveCommunityStatus(owner, {
    source: 'facebook',
    kind: 'message',
    state: 'partial',
    detail: 'First page saved',
    cursor: 'older-page',
    accountId: 'page-owner',
    total: 99,
  });
  await store.saveCommunityStatus(owner, {
    source: 'facebook',
    kind: 'message',
    state: 'syncing',
    detail: 'In progress',
  });
  await store.saveCommunityStatus(owner, {
    source: 'facebook',
    kind: 'message',
    state: 'needs-attention',
    detail: 'Provider timed out',
  });
  let progress = sql
    .prepare(
      "SELECT * FROM community_sync WHERE owner=? AND source='facebook' AND kind='message'",
    )
    .get(owner);
  assert.equal(
    progress.cursor,
    'older-page',
    'transient status updates and failures preserve pagination',
  );
  assert.equal(progress.account_id, 'page-owner');
  assert.equal(progress.total, 99);
  await store.saveCommunityStatus('other-owner', {
    source: 'facebook',
    kind: 'message',
    state: 'synced',
    detail: 'Other account',
    cursor: '',
  });
  await store.saveCommunityStatus(owner, {
    source: 'facebook',
    kind: 'message',
    state: 'synced',
    detail: 'Complete',
    cursor: '',
  });
  progress = sql
    .prepare(
      "SELECT * FROM community_sync WHERE owner=? AND source='facebook' AND kind='message'",
    )
    .get(owner);
  assert.equal(progress.cursor, null, 'explicit completion clears the cursor');
  await link('instagram', 'meta', 'ig-business');
  responder = async (url, init) => {
    if (url.endsWith('/me?fields=id')) return { id: 'fb-page' };
    if (url.includes('/conversations?'))
      return {
        data: [
          {
            id: 'api-thread',
            participants: { data: [{ id: 'fb-page' }, { id: 'customer-api' }] },
          },
        ],
      };
    if (url.endsWith('/v26.0/')) {
      return JSON.parse(new URLSearchParams(init.body).get('batch')).map(
        (q) => {
          if (q.relative_url.includes('/messages?'))
            return {
              code: 200,
              body: JSON.stringify({
                data: [
                  {
                    id: 'api-out',
                    created_time: '2026-09-05T11:00:00Z',
                    from: { id: 'ig-business' },
                    to: { data: [{ id: 'customer-api' }] },
                    message: 'Our reply',
                  },
                  {
                    id: 'api-in',
                    created_time: '2026-09-05T10:00:00Z',
                    from: { id: 'customer-api', username: 'test-person' },
                    message: 'Question',
                    attachments: {
                      data: [
                        { type: 'share', url: 'https://example.com/post' },
                      ],
                    },
                  },
                ],
              }),
            };
          return { code: 403, body: JSON.stringify({ error: { code: 200 } }) };
        },
      );
    }
    throw new Error('Unexpected mock URL: ' + url);
  };
  await sync.syncMessages(owner, 'instagram');
  await sync.syncMessages(owner, 'instagram');
  const stored = await store.readCommunity(owner, 'message');
  assert.equal(
    stored.records.filter((r) => r.conversationId === 'api-thread').length,
    2,
    'resync upserts messages',
  );
  assert.equal(
    community
      .inboxModel(stored.records, range, 'UTC')
      .conversations.find((c) => c.last.conversationId === 'api-thread')
      .waiting,
    false,
  );
  assert.equal(
    (await store.readCommunity(owner, 'mention')).records.length,
    0,
    'generic shares never become story reposts',
  );
  responder = async (url) =>
    url.endsWith('/me?fields=id')
      ? { id: 'fb-page' }
      : Response.json(
          { error: { code: 200, message: 'not allowed' } },
          { status: 403 },
        );
  await assert.rejects(
    () => sync.runCommunitySync(owner, 'instagram'),
    /conversation import/,
  );
  assert.equal(
    (await store.readCommunity(owner, 'message')).statuses.find(
      (s) => s.source === 'instagram',
    ).state,
    'needs-attention',
  );
  await assert.rejects(
    () => sync.runCommunitySync(owner, 'tiktok'),
    /Business app review/,
  );
  assert.equal(
    (await store.readCommunity(owner, 'message')).statuses.find(
      (s) => s.source === 'tiktok' && s.kind === 'message',
    ).state,
    'needs-attention',
    'unsupported access is persisted instead of silently skipped',
  );
  responder = async () =>
    Response.json(
      {
        error: {
          code: 10,
          message:
            'Review needed test-sensitive-token https://example.com/?access_token=test-sensitive-token',
        },
      },
      { status: 403 },
    );
  await assert.rejects(
    () =>
      sync.readConversationList(
        { accessToken: 'test-sensitive-token', apiVersion: 'v26.0' },
        'page',
        'instagram',
      ),
    (e) =>
      e.message.includes('Review needed') &&
      e.message.includes('Meta 10') &&
      !e.message.includes('test-sensitive-token') &&
      !e.message.includes('https://'),
  );
  await link('gbp', 'google', 'location-1');
  responder = async () => {
    throw new DOMException('Fixture timeout', 'TimeoutError');
  };
  await assert.rejects(
    () => sync.runCommunitySync(owner, 'instagram'),
    (e) => e.message.includes('timed out') && !e.message.includes('reconnect'),
  );
  const attemptedLimits = [];
  responder = async () =>
    Response.json(
      {
        error: {
          code: -2,
          message:
            'Please request for advanced access to instagram_manage_messages permission',
        },
      },
      { status: 400 },
    );
  await assert.rejects(
    () =>
      sync.readConversationList(
        { accessToken: 'test', apiVersion: 'v26.0' },
        'page',
        'instagram',
      ),
    (e) =>
      e.message.includes('Direct Instagram') &&
      e.message.includes('Advanced Access'),
  );
  responder = async (url) => {
    const size = new URL(url).searchParams.get('limit');
    attemptedLimits.push(size);
    return size === '50'
      ? Response.json(
          { error: { code: 1, message: 'Reduce data' } },
          { status: 400 },
        )
      : { data: [] };
  };
  await sync.readConversationList(
    { accessToken: 'test', apiVersion: 'v26.0' },
    'page',
    'instagram',
  );
  assert.deepEqual(
    attemptedLimits,
    ['50', '2'],
    'large Instagram requests retry with less data',
  );
  let messagePages = [];
  responder = async (url, init) => {
    if (url.endsWith('/me?fields=id')) return { id: 'fb-page' };
    if (url.includes('/conversations?')) {
      const n = Number(new URL(url).searchParams.get('after') || 0) + 1;
      messagePages.push(n);
      return {
        data: [{ id: 'older-thread-' + n }],
        ...(n < 11
          ? { paging: { next: 'provider-next', cursors: { after: String(n) } } }
          : {}),
      };
    }
    if (url.endsWith('/v26.0/'))
      return JSON.parse(new URLSearchParams(init.body).get('batch')).map((q) =>
        q.relative_url.includes('/messages?')
          ? {
              code: 200,
              body: JSON.stringify({
                data: [
                  {
                    id: q.relative_url.split('/')[0] + '-message',
                    created_time: '2026-09-01T10:00:00Z',
                    from: { id: 'older-customer' },
                    message: 'Earlier enquiry',
                  },
                ],
              }),
            }
          : { code: 403, body: '{}' },
      );
    throw new Error('Unexpected pagination request');
  };
  await sync.syncMessages(owner, 'instagram');
  assert.equal(
    (await store.readCommunity(owner, 'message')).statuses.find(
      (s) => s.source === 'instagram',
    ).more,
    true,
  );
  await sync.syncMessages(owner, 'instagram', true);
  assert.equal(
    messagePages.at(-1),
    2,
    'older import resumes at the saved cursor',
  );
  for (let page = 0; page < 9; page++)
    await sync.syncMessages(owner, 'instagram', true);
  assert.equal(
    messagePages.at(-1),
    11,
    'bounded calls eventually finish every returned conversation page',
  );
  assert.equal(
    (await store.readCommunity(owner, 'message')).statuses.find(
      (s) => s.source === 'instagram',
    ).more,
    false,
  );
  let requestedPages = [];
  let tagPages = [];
  const existingGrant = await vault.readVault(owner, 'grant', 'meta');
  await vault.writeVault(owner, 'grant', 'meta', {
    ...existingGrant,
    expiresAt: Date.now() - 1000,
  });
  responder = async (url) => {
    if (!url.includes('/tags?')) throw new Error('Unexpected tag request');
    const after = new URL(url).searchParams.get('after');
    tagPages.push(after);
    return {
      data: [
        {
          id: after ? 'tag-old' : 'tag-new',
          timestamp: after ? '2025-01-01T12:00:00Z' : '2026-09-01T12:00:00Z',
          caption: 'Dinner',
          username: 'public-creator',
          permalink: 'https://www.instagram.com/p/example/',
        },
      ],
      ...(!after
        ? { paging: { next: 'provider-next', cursors: { after: 'tag-next' } } }
        : {}),
    };
  };
  await sync.syncInstagramTags(owner);
  assert.equal(
    tagPages.length,
    2,
    'an expired user grant must not block a valid selected Page token',
  );
  await vault.writeVault(owner, 'grant', 'meta', existingGrant);
  assert.deepEqual(tagPages, [null, 'tag-next']);
  const tags = (await store.readCommunity(owner, 'mention')).records;
  assert.equal(tags.length, 2);
  assert.ok(
    tags.every((t) => t.mentionType === 'post_tag'),
    'photo tags must not become story mentions or reposts',
  );
  await sync.syncInstagramTags(owner);
  assert.equal(
    (await store.readCommunity(owner, 'mention')).records.length,
    2,
    'tags upsert stable IDs',
  );
  responder = async (url) => {
    if (url.includes('accountmanagement'))
      return { accounts: [{ name: 'accounts/account-1' }] };
    if (url.includes('businessinformation'))
      return { locations: [{ name: 'locations/location-1' }] };
    if (url.includes('/reviews?')) {
      const pageToken = new URL(url).searchParams.get('pageToken');
      requestedPages.push(pageToken || 'first');
      const n = pageToken ? Number(pageToken) : 1;
      return {
        reviews: [
          {
            reviewId: 'review-' + n,
            createTime: '2026-09-01T10:00:00Z',
            starRating: 'TWO',
            comment: 'Cold food',
            reviewer: { displayName: 'Guest' },
            reviewReply: { comment: 'Owner reply' },
          },
        ],
        totalReviewCount: 11,
        ...(n < 11 ? { nextPageToken: String(n + 1) } : {}),
      };
    }
    throw new Error('Unexpected Google URL');
  };
  assert.equal((await sync.syncReviews(owner)).more, true);
  assert.equal((await store.readCommunity(owner, 'review')).records.length, 10);
  assert.equal((await sync.syncReviews(owner, true)).more, false);
  let reviews = await store.readCommunity(owner, 'review');
  assert.equal(reviews.records.length, 11);
  assert.equal(reviews.records[0].rating, 2);
  assert.equal(reviews.records[0].reply, 'Owner reply');
  assert.equal(reviews.statuses.find((s) => s.source === 'gbp').total, 11);
  assert.ok(requestedPages.includes('11'));
  await sync.syncReviews(owner);
  assert.equal(
    (await store.readCommunity(owner, 'review')).records.length,
    11,
    'review refresh deduplicates stable IDs',
  );
  assert.equal(
    (await store.readCommunity('other-owner', 'review')).records.length,
    0,
  );
  const directInstagram = load('lib/server/instagram-messaging.ts');
  await link('instagram', 'meta', '178400001');
  const directCalls = [];
  responder = async (url, init) => {
    directCalls.push(url);
    assert.equal(
      new URL(url).hostname,
      'graph.instagram.com',
      'direct Instagram token must not go to the Facebook host',
    );
    assert.equal(init.headers.Authorization, 'Bearer direct-ig-fixture');
    if (url.endsWith('/me?fields=user_id,username'))
      return {
        id: '178400001',
        user_id: '178400001',
        username: 'ysabelsociety',
      };
    if (url.includes('/conversations?')) {
      const after = new URL(url).searchParams.get('after');
      return {
        data: [{ id: after ? 'ig-thread-2' : 'ig-thread-1' }],
        ...(!after
          ? {
              paging: {
                next: 'https://evil.invalid/never-follow',
                cursors: { after: 'second-page' },
              },
            }
          : {}),
      };
    }
    if (url.includes('ig-thread-1?fields=messages'))
      return {
        messages: {
          data: [{ id: 'ig-in' }, { id: 'ig-out' }, { id: 'unavailable' }],
        },
      };
    if (url.includes('ig-thread-2?fields=messages'))
      return { messages: { data: [{ id: 'ig-in-2' }] } };
    if (url.includes('/unavailable?'))
      return Response.json(
        { error: { code: 100, message: 'Message no longer available' } },
        { status: 400 },
      );
    if (url.includes('?fields=id,attachments')) {
      const id = new URL(url).pathname.split('/').pop();
      if (id === 'ig-in' || id === 'ig-out')
        return {
          id,
          attachments: {
            data: [
              {
                type: 'story_mention',
                payload: { url: 'https://example.com/story' },
              },
            ],
          },
        };
      return Response.json(
        { error: { code: 100, message: 'Optional attachment unavailable' } },
        { status: 400 },
      );
    }
    if (url.includes('?fields=id,created_time')) {
      const id = new URL(url).pathname.split('/').pop();
      const outgoing = id === 'ig-out';
      return {
        id,
        created_time: '2026-09-05T10:00:00Z',
        from: { id: outgoing ? '178400001' : 'ig-guest' },
        to: { data: [{ id: outgoing ? 'ig-guest' : '178400001' }] },
        message: outgoing ? 'Our reply' : 'Guest message',
      };
    }
    if (url.includes('/ig-guest?fields='))
      return {
        id: 'ig-guest',
        username: 'visitor',
        name: 'Visitor',
        follower_count: 22000,
      };
    throw new Error('Unexpected direct Instagram URL: ' + url);
  };
  await directInstagram.connectInstagramMessaging(owner, {
    accessToken: 'direct-ig-fixture',
    apiVersion: 'v26.0',
  });
  assert.equal(
    (await directInstagram.readInstagramMessaging(owner)).username,
    'ysabelsociety',
  );
  assert.equal(
    await directInstagram.readInstagramMessaging('different-owner'),
    null,
  );
  assert.equal(
    (await vault.readVault(owner, 'target', 'instagram')).pageToken,
    'test-page-token',
    'keep Facebook-linked analytics credential',
  );
  const directImport = await sync.syncMessages(owner, 'instagram');
  assert.equal(directImport.imported, 2);
  assert.equal(directImport.more, true);
  assert.equal(
    (await sync.syncMessages(owner, 'instagram', true)).imported,
    1,
    'direct Instagram continues at the saved thread cursor',
  );
  assert.match(directImport.detail, /Direct Instagram/);
  assert.match(directImport.detail, /inaccessible/);
  const directRecords = (
    await store.readCommunity(owner, 'message')
  ).records.filter((r) => r.accountId === '178400001');
  assert.equal(directRecords.find((r) => r.id === 'ig-out').direction, 'out');
  assert.equal(directRecords.find((r) => r.id === 'ig-in').direction, 'in');
  const directStories = (
    await store.readCommunity(owner, 'mention')
  ).records.filter((r) => r.accountId === '178400001');
  assert.equal(
    directStories.length,
    1,
    'direct Instagram imports incoming attachments without counting outgoing mentions',
  );
  assert.equal(directStories[0].mentionType, 'story_mention');
  assert.ok(
    directCalls.some((url) => url.includes('after=second-page')),
    'follow all conversation pages using cursor only',
  );
  await sync.syncMessages(owner, 'instagram');
  assert.equal(
    (await store.readCommunity(owner, 'message')).records.filter(
      (r) => r.accountId === '178400001',
    ).length,
    3,
    'direct re-import upserts messages',
  );
  await sync.syncCommunityProfiles(owner, 'instagram');
  assert((await store.readCommunity(owner,'message')).records.some(r=>r.kind==='profile' && r.profileCheckedAt), 'Separate profile sync checks saved participants');
  await link('instagram', 'meta', 'another-account');
  await assert.rejects(
    () => sync.syncMessages(owner, 'instagram'),
    /connection changed/,
    'stored token must not follow a changed account selection',
  );
  responder = async () =>
    Response.json(
      {
        error: {
          code: 190,
          message:
            'Expired direct-ig-fixture https://graph.instagram.com/?access_token=direct-ig-fixture',
        },
      },
      { status: 400 },
    );
  await assert.rejects(
    () =>
      directInstagram.instagramMessageGet(
        { accessToken: 'direct-ig-fixture', apiVersion: 'v26.0' },
        'me',
      ),
    (e) =>
      e.message.includes('Meta 190') &&
      !e.message.includes('direct-ig-fixture') &&
      !e.message.includes('https://'),
  );
  await assert.rejects(
    () =>
      directInstagram.instagramMessageGet(
        {
          accessToken: 'unused-fixture',
          apiVersion: 'v26.0',
          deadline: Date.now() - 1,
        },
        'me',
      ),
    /time limit/,
    'expired time budget prevents another provider request',
  );
  await link('facebook', 'meta', 'fb-tags-page');
  let facebookTagCalls = 0;
  responder = async (url) => {
    if (url.includes('/tagged?')) {
      const after = new URL(url).searchParams.get('after');
      facebookTagCalls++;
      return {
        data: [
          {
            id: after ? 'old-fb-tag' : 'new-fb-tag',
            created_time: '2024-01-01T00:00:00Z',
            tagged_time: '2026-09-01T10:00:00Z',
            message: 'Public tagged post',
            permalink_url: 'https://www.facebook.com/posts/fixture',
          },
        ],
        ...(!after
          ? {
              paging: {
                next: 'https://graph.facebook.com/v26.0/fb-tags-page/tagged?after=older',
              },
            }
          : {}),
      };
    }
    if (url.endsWith('/me?fields=id')) return { id: 'fb-tags-page' };
    if (url.includes('/conversations?')) return { data: [] };
    throw new Error('Unexpected Facebook mention request');
  };
  const fbMentions = await sync.runCommunitySync(
    owner,
    'facebook',
    false,
    false,
    'mention',
  );
  assert.equal(fbMentions.imported, 2);
  assert.equal(
    facebookTagCalls,
    2,
    'Facebook tagged posts follow supported cursor pagination',
  );
  const facebookTags = (
    await store.readCommunity(owner, 'mention')
  ).records.filter((r) => r.source === 'facebook');
  assert.equal(facebookTags.length, 2);
  assert.equal(
    facebookTags[0].time,
    '2026-09-01T10:00:00.000Z',
    'tag date is independent of post creation date',
  );
  assert.equal(
    facebookTags[0].name,
    'Profile unavailable',
    'a restricted author is not invented',
  );
  responder = async () =>
    Response.json(
      { error: { code: 200, message: 'Access refused' } },
      { status: 403 },
    );
  const failedMentions = await sync.runCommunitySync(
    owner,
    'facebook',
    false,
    false,
    'mention',
  );
  assert.equal(failedMentions.needsAttention, true);
  assert.equal(
    (await store.readCommunity(owner, 'mention')).records.filter(
      (r) => r.source === 'facebook',
    ).length,
    2,
    'failed access keeps previously imported tags',
  );
  sql
    .prepare(
      "UPDATE community_sync SET state='syncing', updated_at=? WHERE owner=? AND source='tiktok' AND kind='message'",
    )
    .run(new Date(Date.now() - 180000).toISOString(), owner);
  const interrupted = (
    await store.readCommunity(owner, 'message')
  ).statuses.find((s) => s.source === 'tiktok' && s.kind === 'message');
  assert.equal(interrupted.state, 'needs-attention');
  assert.match(interrupted.detail, /interrupted/);
  await assert.rejects(
    () => sync.runCommunitySync(owner, 'tiktok'),
    /Business app review/,
    'an expired import lock can be retried',
  );
  console.log(
    'PASS: inbox reply timing, strict influencer threshold, verified profile persistence, timezone grouping, review evidence, CSV validation, encryption and owner isolation, Meta sender identities and access failure, Google review pagination and upserts.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.close());
