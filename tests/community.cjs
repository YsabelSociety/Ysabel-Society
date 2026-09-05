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
    /messaging access/,
  );
  assert.equal(
    (await store.readCommunity(owner, 'message')).statuses.find(
      (s) => s.source === 'instagram',
    ).state,
    'needs-access',
  );
  await assert.rejects(
    () => sync.runCommunitySync(owner, 'tiktok'),
    /separately approved/,
  );
  await link('gbp', 'google', 'location-1');
  let requestedPages = [];
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
