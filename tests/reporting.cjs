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
const vault = load('lib/server/connector-vault.ts');
const oauth = load('lib/server/connector-oauth.ts');
const sync = load('lib/server/connector-sync.ts');
const analytics = load('lib/analytics.ts');
let responder;
global.fetch = async (url, init) =>
  Response.json(await responder(String(url), init));
const owner = 'test-owner',
  second = 'other-owner';
const grant = (resources) => ({
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  expiresAt: Date.now() + 86400000,
  resources,
  authorizedAt: new Date().toISOString(),
});
const app = {
  clientId: 'test-client',
  clientSecret: 'private-test-secret',
  apiVersion: 'v25.0',
  configId: '123456',
};

async function main() {
  const reporting = load('lib/reporting.ts'),
    file = load('lib/import-file.ts'),
    google = load('lib/server/report-google.ts'),
    meta = load('lib/server/report-meta.ts'),
    tiktok = load('lib/server/report-tiktok.ts'),
    ads = load('lib/server/report-ads.ts');
  const range = { start: '2026-09-04', end: '2026-09-04' },
    context = {
      accessToken: 'test-access',
      externalId: 'ig-one',
      apiVersion: 'v25.0',
    };
  responder = (url, init) => {
    if (init?.body instanceof URLSearchParams && init.body.has('batch'))
      return JSON.parse(init.body.get('batch')).map((job) => {
        const u = new URL(job.relative_url, 'https://graph.test/'),
          metric = u.searchParams.get('metric');
        if (['profile_links_taps', 'follows'].includes(metric))
          return { code: 400, body: JSON.stringify({ error: { code: 100 } }) };
        if (metric === 'profile_views')
          return { code: 200, body: JSON.stringify({ data: [] }) };
        const value = metric === 'reach' ? 0 : metric === 'views' ? 17 : 3;
        return {
          code: 200,
          body: JSON.stringify({
            data: [
              {
                name: metric,
                ...(u.pathname === '/ig-one/insights'
                  ? { total_value: { value } }
                  : { values: [{ value }] }),
              },
            ],
          }),
        };
      });
    const u = new URL(url);
    if (u.pathname.endsWith('/media'))
      return {
        data: [
          {
            id: 'post-one',
            timestamp: '2026-09-04T18:30:00Z',
            caption: 'Source caption',
            media_type: 'IMAGE',
            permalink: 'https://www.instagram.com/p/test/',
            media_url: 'https://example.test/image.jpg',
            like_count: 0,
            comments_count: 2,
          },
        ],
      };
    if (u.pathname.endsWith('/insights'))
      return {
        data: [
          {
            total_value: {
              breakdowns: [
                { results: [{ dimension_values: ['Albania'], value: 123 }] },
              ],
            },
          },
        ],
      };
    return { id: 'ig-one', followers_count: 99, media_count: 1 };
  };
  const ig = await meta.importMeta(context, 'instagram', range);
  assert.equal(ig.posts.length, 1);
  assert.equal(ig.posts[0].views, 17);
  assert.equal(ig.posts[0].likes, 0);
  assert.equal(ig.posts[0].metricScope, 'lifetime');
  assert.ok(!ig.posts[0].available.includes('visits'));
  assert.ok(ig.posts[0].available.includes('profileVisits'));
  assert.ok(!ig.posts[0].available.includes('followers'));
  const day = ig.daily.find((r) => r.date === range.start);
  assert.equal(day.views, 17);
  assert.equal(day.reach, 0);
  assert.ok(day.available.includes('reach'));
  assert.ok(!day.available.includes('clicks'));
  assert.ok(!day.available.includes('profileViews'));
  assert.ok(!day.available.includes('followers'));
  assert.equal(ig.tables.length, 4);
  assert.ok(
    ig.checks.some(
      (c) => c.key === 'profile_links_taps' && c.status === 'unavailable',
    ),
  );
  let allowFacebookInteractions = false;
  responder = (url, init) => {
    if (init?.body instanceof URLSearchParams && init.body.has('batch'))
      return JSON.parse(init.body.get('batch')).map((job) => {
        const request = new URL(job.relative_url, 'https://test/');
        if (request.searchParams.has('fields')) return allowFacebookInteractions
          ? { code: 200, body: JSON.stringify({ reactions: { summary: { total_count: 0 } }, comments: { summary: { total_count: 2 } } }) }
          : { code: 400, body: JSON.stringify({ error: { code: 10 } }) };
        const metric = new URL(
          job.relative_url,
          'https://test/',
        ).searchParams.get('metric');
        return {
          code: 200,
          body: JSON.stringify({
            data: [
              {
                name: metric,
                values: [{ end_time: '2026-09-05T07:00:00+0000', value: 10 }],
              },
            ],
          }),
        };
      });
    if (url.includes('/published_posts')) {
      assert.ok(!new URL(url).searchParams.get('fields').includes('reactions'));
      assert.ok(!new URL(url).searchParams.get('fields').includes('comments'));
      return { data: [{ id: 'facebook-post', message: 'Page content remains available', created_time: '2026-09-04T12:00:00Z' }] };
    }
    if (url.includes('/insights')) return { data: [] };
    return { id: 'page-one', followers_count: 150 };
  };
  const fb = await meta.importMeta(
    { ...context, externalId: 'page-one' },
    'facebook',
    range,
  );
  const facebookDay = fb.daily.find((r) => r.date === range.start);
  assert.equal(facebookDay.views, 10);
  assert.equal(facebookDay.mediaViewers, 10);
  assert.ok(!facebookDay.available.includes('reach'));
  assert.equal(fb.posts.length, 1, 'missing comment access must not discard published posts');
  assert.equal(fb.posts[0].views, 10);
  assert.ok(!fb.posts[0].available.includes('likes'));
  assert.ok(!fb.posts[0].available.includes('comments'));
  assert.ok(fb.checks.find(c => c.key === 'post-interactions').detail.includes('pages_read_user_content'));
  allowFacebookInteractions = true;
  const fbWithInteractions = await meta.importMeta({ ...context, externalId: 'page-one' }, 'facebook', range);
  assert.equal(fbWithInteractions.posts[0].likes, 0);
  assert.ok(fbWithInteractions.posts[0].available.includes('likes'));
  assert.equal(fbWithInteractions.posts[0].comments, 2);
  assert.equal(fbWithInteractions.checks.find(c => c.key === 'post-interactions').records, 2);
  responder = (url, init) => {
    if (url.includes('/user/info'))
      return {
        data: {
          user: {
            open_id: 'tt-one',
            follower_count: 42,
            likes_count: 500,
            video_count: 1,
          },
        },
        error: { code: 'ok' },
      };
    return {
      data: {
        videos: [
          {
            id: 'tt-video',
            create_time: Date.parse('2026-09-04T12:30:00Z') / 1000,
            title: 'Real video',
            view_count: 2000,
            like_count: 100,
            comment_count: 0,
            share_count: 20,
          },
        ],
        has_more: false,
      },
      error: { code: 'ok' },
    };
  };
  const tt = await tiktok.importTikTok(
    { ...context, externalId: 'tt-one' },
    range,
  );
  assert.equal(tt.posts[0].views, 2000);
  assert.ok(tt.posts[0].available.includes('comments'));
  assert.ok(!tt.posts[0].available.includes('reach'));
  assert.ok(tt.daily.every((d) => !d.available.includes('views')));
  responder = (url, init) => {
    const request = JSON.parse(init.body),
      dims = request.dimensions.map((d) => d.name),
      metrics = request.metrics.map((m) => m.name);
    return {
      rowCount: 1,
      dimensionHeaders: dims.map((name) => ({ name })),
      metricHeaders: metrics.map((name) => ({ name })),
      rows: [
        {
          dimensionValues: dims.map((name) => ({
            value: name === 'date' ? '20260904' : 'source value',
          })),
          metricValues: metrics.map((name) => ({
            value:
              name === 'activeUsers' ? '8' : name === 'keyEvents' ? '0' : '12',
          })),
        },
      ],
      metadata: { timeZone: 'Europe/Tirane' },
    };
  };
  const ga = await google.importGA4(
    {
      ...context,
      externalId: '1234',
      menuPath: '/menu',
      reservationEvent: 'reserve_click',
      completedReservationEvent: 'reservation_confirmed',
    },
    range,
  );
  assert.equal(ga.daily[0].users, 8);
  assert.equal(ga.daily[0].conversions, 0);
  assert.ok(ga.daily[0].available.includes('conversions'));
  assert.equal(ga.daily[0].bookings, 12);
  assert.equal(ga.tables.length, 9);
  assert.equal(
    ga.tables.find((t) => t.key === 'website-total').rows[0].activeUsers,
    8,
  );
  responder = (url) =>
    url.includes('searchkeywords')
      ? {
          searchKeywordsCounts: [
            { searchKeyword: 'restaurant', insightsValue: { threshold: '15' } },
          ],
        }
      : {
          timeSeries: {
            datedValues: [
              { date: { year: 2026, month: 9, day: 4 }, value: '0' },
            ],
          },
        };
  const gbp = await google.importGBP({ ...context, externalId: '123' }, range);
  assert.ok(gbp.daily[0].available.includes('bookings'));
  assert.equal(gbp.daily[0].bookings, 0);
  assert.equal(gbp.tables[0].rows[0].impressions, null);
  assert.equal(gbp.tables[0].rows[0].threshold, 15);
  responder = () => ({
    results: [
      {
        segments: { date: '2026-09-04' },
        customer: { currencyCode: 'EUR' },
        campaign: { id: '9', name: 'Dinner' },
        metrics: {
          costMicros: '12340000',
          clicks: '10',
          impressions: '1000',
          conversions: '2.5',
          conversionsValue: '99',
        },
      },
    ],
  });
  const ad = await ads.importAdvertising(
    {
      ...context,
      externalId: '1234',
      apiVersion: 'v25',
      developerToken: 'test-only',
    },
    'google-ads',
    range,
  );
  assert.equal(ad.tables[0].rows[0].spend, 12.34);
  assert.equal(ad.tables[0].rows[0].conversions, 2.5);
  assert.equal(ad.daily.length, 0);
  const csv = file.csvRows('date,views,reach\r\n2026-09-04,0,\r\n');
  const imported = file.parseImport(
    'instagram',
    'daily',
    csv,
    {},
    range,
    'source.csv',
  );
  assert.deepEqual(imported.daily[0].available, ['views']);
  reporting.validateImportSize(imported);
  assert.throws(
    () =>
      reporting.validateImportSize({
        ...imported,
        tables: [{ key: 'large', rows: [{ value: 'x'.repeat(1500001) }] }],
      }),
    /shorter date range/,
  );
  assert.equal(imported.daily[0].views, 0);
  assert.throws(() =>
    file.parseImport('instagram', 'daily', [...csv, ...csv], {}, range, 'dup'),
  );
  assert.throws(() => file.csvRows('date,date\n1,2'));
  assert.throws(() =>
    file.parseImport(
      'instagram',
      'daily',
      [{ date: '2026-02-31', views: '1' }],
      {},
      range,
      'bad-date',
    ),
  );
  assert.equal(
    file.csvRows('title,value\n"Dinner, with friends",4')[0].title,
    'Dinner, with friends',
  );
  assert.throws(() =>
    file.parseImport(
      'instagram',
      'daily',
      [{ date: '2026-09-04', views: '-1' }],
      {},
      range,
      'negative',
    ),
  );
  assert.throws(() =>
    file.parseImport(
      'instagram',
      'daily',
      [{ date: '2026-09-04', views: '10' }],
      { views: '' },
      range,
      'skip',
    ),
  );
  console.log(
    'PASS: Meta daily vs lifetime metrics, missing vs zero, profile vs website visits, permissions, Facebook day boundaries and distinct media viewers; TikTok lifetime counters; GA4 events and reporting dimensions; Google privacy thresholds; ad currency scaling; CSV dates, mapping and duplicate rejection.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.close());
