const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..'),
  cache = new Map(),
  sql = new DatabaseSync(':memory:');
sql.exec(
  'CREATE TABLE platform_accounts(id TEXT PRIMARY KEY,owner TEXT,enabled INTEGER);CREATE TABLE source_posts(account_id TEXT,post_id TEXT,published_date TEXT,payload TEXT);CREATE TABLE community_records(owner TEXT,source TEXT,kind TEXT,id TEXT,encrypted TEXT);CREATE TABLE community_sync(owner TEXT,source TEXT,kind TEXT,state TEXT,detail TEXT,updated_at TEXT);',
);
let owner = 'owner-a';
const db = {
  prepare(q) {
    let args = [];
    return {
      bind(...v) {
        args = v;
        return this;
      },
      async all() {
        return { results: sql.prepare(q).all(...args) };
      },
    };
  },
};
const stubs = {
  '@/lib/server/db': {
    identity: async () => {
      if (!owner) throw Error('UNAUTHORIZED');
      return { userId: owner };
    },
    database: () => db,
    json: Response.json,
    apiError: (e) =>
      Response.json(
        { error: e.message },
        { status: e.message === 'UNAUTHORIZED' ? 401 : 400 },
      ),
    requireDate: (v) => {
      assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
      return v;
    },
  },
  '@/lib/server/connector-vault': {
    unseal: async (value, context) => {
      assert(context.startsWith(owner + ':community:'));
      return JSON.parse(value);
    },
  },
};
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const req = (id) =>
    stubs[id] ||
    (id.startsWith('@/')
      ? load(id.slice(2) + '.ts')
      : id.startsWith('.')
        ? load(path.resolve(path.dirname(file), id) + '.ts')
        : require(id));
  new Function('require', 'module', 'exports', code)(req, m, m.exports);
  return m.exports;
}
async function main() {
  sql.exec(
    "INSERT INTO platform_accounts VALUES('a','owner-a',1),('other','owner-b',1),('disabled','owner-a',0);BEGIN",
  );
  const post = sql.prepare('INSERT INTO source_posts VALUES(?,?,?,?)');
  for (let i = 0; i < 5002; i++)
    post.run(
      'a',
      String(i).padStart(5, '0'),
      '2026-09-02',
      JSON.stringify({ id: 'p' + i }),
    );
  post.run('other', 'secret', '2026-09-02', '{}');
  post.run('disabled', 'hidden', '2026-09-02', '{}');
  post.run('a', 'out-of-range', '2025-01-01', '{}');
  const community = sql.prepare(
    'INSERT INTO community_records VALUES(?,?,?,?,?)',
  );
  for (let i = 0; i < 10003; i++)
    community.run(
      'owner-a',
      i % 2 ? 'instagram' : 'facebook',
      'message',
      String(i).padStart(5, '0'),
      JSON.stringify({ id: 'm' + i }),
    );
  community.run('owner-b', 'instagram', 'message', 'secret', '{}');
  sql.exec('COMMIT');
  const endpoint = load('app/api/report-data/route.ts');
  const range = { start: '2026-09-01', end: '2026-09-07' };
  async function collect(dataset) {
    let cursor = null,
      items = [];
    do {
      const q = new URLSearchParams({ dataset, ...range });
      if (cursor) q.set('cursor', cursor);
      const r = await endpoint.GET(
        new Request('https://test/api/report-data?' + q),
      );
      assert.equal(r.status, 200);
      const p = await r.json();
      items.push(...p.records);
      cursor = p.nextCursor;
    } while (cursor);
    return items;
  }
  assert.equal((await collect('posts')).length, 5002);
  assert.equal(
    new Set((await collect('community')).map((r) => r.id)).size,
    10003,
  );
  owner = '';
  assert.equal(
    (
      await endpoint.GET(
        new Request('https://test/api/report-data?dataset=community'),
      )
    ).status,
    401,
  );
  owner = 'owner-a';
  const analytics = load('lib/analytics.ts'),
    reporting = load('lib/reporting.ts'),
    pdf = load('lib/report-pdf.ts');
  const row = (date, channel, values) => {
    const r = reporting.emptyDaily(date, channel);
    for (const [k, v] of Object.entries(values)) reporting.putMetric(r, k, v);
    return r;
  };
  const record = (id, kind, time, rest = {}) => ({
    id,
    kind,
    time,
    source: 'instagram',
    accountId: 'a',
    participantId: 'guest',
    conversationId: 'thread',
    direction: 'in',
    text: 'Reservation for two',
    origin: 'api',
    ...rest,
  });
  const bundle = {
    title: 'Ysabel Society - complete report verification',
    range,
    timezone: 'Europe/Tirane',
    mode: 'live',
    generatedAt: '2026-09-07T12:00:00Z',
    rows: [
      row('2026-09-01', 'Instagram', { views: 100, followers: 5000 }),
      row('2026-09-03', 'Instagram', { views: 0, followers: 5200 }),
      row('2026-09-01', 'TikTok', { followers: 900 }),
      row('2026-09-01', 'Website', { sessions: 21, users: 15 }),
      row('2026-09-02', 'Website', { sessions: 31, users: 20 }),
    ],
    posts: [
      {
        ...reporting.importedPost(
          'TikTok',
          'video-1',
          '2026-09-03T10:00:00Z',
          'A complete caption - ' + 'long title '.repeat(14),
        ),
        caption: 'Video caption with accented letters: ë ç É',
        views: 735,
        likes: 35,
        shares: 12,
        available: ['views', 'likes', 'shares'],
        permalink: 'https://www.tiktok.com/@ysabel.society/video/1',
      },
    ],
    tables: [
      {
        key: 'audience-country',
        title: 'Instagram audience countries',
        source: 'instagram',
        columns: ['country', 'followers'],
        rows: [
          { country: 'AL', followers: 800 },
          { country: 'IT', followers: 300 },
        ],
        period: range,
        scope: 'Current follower snapshot.',
      },
      {
        key: 'website-traffic',
        title: 'Website traffic sources',
        source: 'ga4',
        columns: [
          'sessionSourceMedium',
          'sessions',
          'activeUsers',
          'screenPageViews',
        ],
        rows: [
          {
            sessionSourceMedium: 'google / organic',
            sessions: 50,
            activeUsers: 35,
            screenPageViews: 86,
          },
        ],
        period: range,
        scope: 'GA4 traffic sources.',
      },
      {
        key: 'google-performance-summary',
        title: 'Google Business source report',
        source: 'gbp',
        columns: ['metric', 'value'],
        rows: [
          { metric: 'Search views', value: 450 },
          { metric: 'Maps views', value: 150 },
        ],
        period: range,
        scope: 'Native Google Business report.',
      },
    ],
    records: [
      record('old', 'message', '2026-08-20T12:00:00Z'),
      record('new', 'message', '2026-09-02T12:00:00Z', { folder: 'requests' }),
      record('future', 'message', '2026-09-09T12:00:00Z', { direction: 'out' }),
      record('profile', 'profile', '2026-09-07T12:00:00Z', {
        followers: 15000,
        locationGroup: 'local',
        username: 'guest_profile',
      }),
      record('mention', 'mention', '2026-09-02T14:00:00Z', {
        mentionType: 'story_mention',
      }),
      record('review', 'review', '2026-09-03T12:00:00Z', {
        source: 'gbp',
        rating: 1,
        name: 'Reviewer Ë Ç',
        text:
          'The steak was cold and the waiter was rude. ' +
          'This is the complete long review, with every word retained. '.repeat(
            95,
          ) +
          ' END-OF-REVIEW',
        reviewUrl: 'https://www.google.com/maps/reviews/1',
      }),
      record('relative', 'review', '2026-09-07T12:00:00Z', {
        source: 'gbp',
        rating: 2,
        timePrecision: 'relative',
        timeLabel: '3 months ago',
        text: 'The cocktail was watery.',
      }),
    ],
    sourceStatus: [
      { channel: 'TikTok', status: 'Connected', lastSync: '2026-09-07' },
    ],
    communityStatus: [
      {
        source: 'instagram',
        kind: 'message',
        state: 'partial',
        detail: 'Only captured messages are available.',
      },
    ],
  };
  const selection = pdf.reportSelection(bundle);
  assert.equal(selection.messages.length, 1);
  assert.equal(
    selection.inbox.unanswered.length,
    1,
    'Later replies must not change historical unanswered counts',
  );
  assert.equal(selection.inbox.priority.length, 1);
  assert.equal(selection.reviews.length, 1);
  assert.equal(selection.uncertainReviews.length, 1);
  assert.equal(
    analytics.total(selection.rows, 'followers'),
    6100,
    'Followers are snapshots, not daily sums',
  );
  const fsBytes = (p) => new Uint8Array(fs.readFileSync(path.join(root, p)));
  const reviewProgress = [];
  const reviewDoc = await pdf.createReportPDF({ ...bundle, scope: 'reviews',
    title: 'Critical review selection', reviewSelection: selection.reviews,
  }, {
    regular: fsBytes('public/fonts/NotoSans-Regular.ttf'),
    bold: fsBytes('public/fonts/NotoSans-Bold.ttf'),
    logo: fsBytes('public/ysabel-society-logo.png'),
  }, message => reviewProgress.push(message));
  assert.deepEqual(reviewProgress.filter(message => message.startsWith('Designing PDF')),
    ['Designing PDF · Critical review selection'], 'Review export must omit every other analytics section');
  assert(reviewDoc.getNumberOfPages() > 0);
  if (process.env.YS_RENDER_PDF) {
    fs.mkdirSync(path.join(root, 'outputs/pdf-qa'), { recursive: true });
    const doc = await pdf.createReportPDF(bundle, {
      regular: fsBytes('public/fonts/NotoSans-Regular.ttf'),
      bold: fsBytes('public/fonts/NotoSans-Bold.ttf'),
      logo: fsBytes('public/ysabel-society-logo.png'),
      countries: JSON.parse(
        fs.readFileSync(
          path.join(root, 'public/maps/world-countries.json'),
          'utf8',
        ),
      ),
    });
    fs.writeFileSync(
      path.join(root, 'outputs/pdf-qa/report.pdf'),
      Buffer.from(doc.output('arraybuffer')),
    );
    assert(doc.getNumberOfPages() > 10);
    console.log('PDF QA pages:', doc.getNumberOfPages());
  }
  const { loadReportBundle } = load('lib/report-bundle.ts');
  global.fetch = async (url) => {
    if (String(url).includes('analytics?'))
      return Response.json({ ...bundle, posts: [], coverage: [] });
    if (String(url).endsWith('/state'))
      return Response.json({ settings: { timezone: bundle.timezone } });
    return endpoint.GET(new Request('https://test' + url));
  };
  const loaded = await loadReportBundle(range, 'All channels', () => {});
  assert.equal(loaded.posts.length, 5002);
  assert.equal(loaded.records.length, 10003);
  assert.equal(loaded.rows.find((r) => r.channel === 'TikTok').followers, 900);
  global.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(
    () => loadReportBundle(range, 'Failure', () => {}),
    /category could not/,
  );
  console.log(
    'Report checks passed: full pagination beyond display limits, owner isolation, authentication, all channels, date scoping, follower snapshots, later replies, approximate reviews and failed-category handling.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
