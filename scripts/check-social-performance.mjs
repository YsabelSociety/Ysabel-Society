import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(
  fs.readFileSync('lib/social-performance.ts', 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const m = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const range = { start: '2026-08-08', end: '2026-08-12' };
const post = (platform, id, date, values = {}, format = 'Video') => ({
  platform,
  id,
  date,
  status: 'Published',
  format,
  metricScope: 'lifetime',
  observedAt: '2026-09-06T21:13:03Z',
  available: Object.keys(values),
  ...values,
});
const posts = [
  post('TikTok', 't1', '2026-08-09', {
    views: 100,
    likes: 10,
    comments: 2,
    shares: 3,
  }),
  post('TikTok', 't2', '2026-08-10', {
    views: 250,
    likes: 20,
    comments: 0,
    shares: 8,
  }),
  post(
    'Instagram',
    'i1',
    '2026-08-09',
    { views: 500, reach: 200, likes: 40, shares: 6 },
    'Reel',
  ),
  post('Facebook', 'f1', '2026-08-11', { views: 80, shares: 2 }),
  post('TikTok', 'outside', '2026-07-01', { views: 99999 }),
  post('TikTok', 'story', '2026-08-11', { views: 12 }, 'Story'),
];
const row = (channel, date, values) => ({
  channel,
  date,
  available: Object.keys(values),
  ...values,
});
const daily = [
  row('Instagram', '2026-08-08', { views: 900, followers: 500 }),
  row('Instagram', '2026-08-12', { views: 100, followers: 510 }),
  row('Facebook', '2026-08-08', { views: 300 }),
  row('TikTok', '2026-08-10', { followers: 1485 }),
];
const points = m.performanceSeries(
  daily,
  posts,
  ['TikTok'],
  range,
  'views',
  'Published content',
);
assert.equal(m.seriesTotal(points, 'TikTok', 'views'), 362);
assert(
  points.every((p) => !('Instagram' in p) && !('Facebook' in p)),
  'Single-platform chart leaks another source',
);
assert.equal(
  points.find((p) => p.date === '2026-08-08').TikTok,
  null,
  'Unobserved publication day must not become zero',
);
const all = m.performanceSeries(
  daily,
  posts,
  m.SOCIAL_PLATFORMS,
  range,
  'views',
  'Published content',
);
assert.deepEqual(
  m.SOCIAL_PLATFORMS.map((c) => m.seriesTotal(all, c, 'views')),
  [500, 80, 362],
);
const activity = m.performanceSeries(
  daily,
  posts,
  m.SOCIAL_PLATFORMS,
  range,
  'views',
  'Daily activity',
);
assert.equal(
  m.seriesTotal(activity, 'TikTok', 'views'),
  null,
  'Lifetime counters must not become daily traffic',
);
assert.equal(m.seriesTotal(activity, 'Instagram', 'views'), 1000);
assert.equal(
  m.seriesTotal(
    m.performanceSeries(
      daily,
      posts,
      ['TikTok'],
      range,
      'shares',
      'Published content',
    ),
    'TikTok',
    'shares',
  ),
  11,
);
assert.equal(
  m.seriesTotal(
    m.performanceSeries(
      daily,
      posts,
      ['TikTok'],
      range,
      'reposts',
      'Published content',
    ),
    'TikTok',
    'reposts',
  ),
  null,
  'Shares must not be relabeled as reposts',
);
assert.equal(
  m.postValue(posts[1], 'comments'),
  0,
  'A real zero must remain zero',
);
assert.equal(
  m.postValue(posts[0], 'reach'),
  null,
  'Missing reach must not become zero',
);
assert.equal(m.postValue(posts[0], 'engagements'), 15);
const latest = m.performanceSeries(
  daily,
  posts,
  ['Instagram'],
  range,
  'followers',
  'Daily activity',
  'Monthly',
);
assert.equal(
  m.seriesTotal(latest, 'Instagram', 'followers'),
  510,
  'Follower snapshots must never be added over dates',
);
const duplicate = [
  ...posts,
  { ...posts[0], views: 120, observedAt: '2026-09-07T00:00:00Z' },
];
assert.equal(m.selectContent(duplicate, ['TikTok'], range).length, 3);
assert.equal(
  m.seriesTotal(
    m.performanceSeries(
      [],
      duplicate,
      ['TikTok'],
      range,
      'views',
      'Published content',
    ),
    'TikTok',
    'views',
  ),
  382,
);
assert.equal(m.selectContent(posts, ['TikTok'], range, 'Stories').length, 1);
assert.equal(
  m.seriesTotal(
    m.performanceSeries(
      [],
      posts,
      ['TikTok'],
      range,
      'posts',
      'Published content',
    ),
    'TikTok',
    'posts',
  ),
  2,
);
assert.equal(
  m.selectContent([{ ...posts[0], metricScope: 'period' }], ['TikTok'], range)
    .length,
  0,
  'Period and lifetime content cannot be mixed',
);
const table = (source, key, rows, observedAt = '2026-09-06T00:00:00Z') => ({
  source,
  key,
  rows,
  observedAt,
  columns: Object.keys(rows[0]),
  period: range,
});
const tables = [
  table('instagram', 'audience-gender', [
    { gender: 'F', followers: 10 },
    { gender: 'M', followers: 7 },
  ]),
  table(
    'instagram',
    'audience-gender',
    [{ gender: 'F', followers: 15 }],
    '2026-09-07T00:00:00Z',
  ),
  table('facebook', 'audience-country', [{ country: 'AL', followers: 80 }]),
  table('tiktok', 'audience-file-country', [{ country: 'XK', followers: 50 }]),
  table('ga4', 'website-countries', [{ country: 'Kosovo', activeUsers: 30 }]),
];
assert.equal(
  m.genderDistribution(tables, ['Instagram'])[0].Instagram,
  15,
  'Overlapping demographic snapshots must not be summed',
);
assert.equal(
  m.genderDistribution(tables, ['TikTok'])[0].TikTok,
  null,
  'Gender cannot be borrowed from another platform',
);
assert.deepEqual(
  [...m.latestAudienceTables(tables, ['TikTok'], 'country').keys()],
  ['TikTok'],
);
assert.equal(
  m.latestAudienceTables(tables, m.SOCIAL_PLATFORMS, 'country').has('Website'),
  false,
  'Website users cannot be combined with social followers',
);
assert(!m.SOCIAL_METRICS.some((x) => x.key === 'conversions'));
const currentCountry = {...table('facebook','audience-country',[{country:'AL',followers:80}]),period:{start:'2026-09-01',end:'2026-09-06'}};
const historicalCountry = {...table('facebook','audience-country',[{country:'AL',followers:15}],'2026-09-08T00:00:00Z'),period:{start:'2024-09-01',end:'2024-09-30'}};
assert.equal(m.latestAudienceTables([historicalCountry,currentCountry],['Facebook'],'country').get('Facebook').rows[0].followers,80,'Backfills must not replace current geography with an older period');
const countries = JSON.parse(
  fs.readFileSync('public/maps/world-countries.json', 'utf8'),
);
assert.equal(countries.length, 176);
assert.equal(new Set(countries.map((c) => c.code)).size, countries.length);
assert(countries.some((c) => c.code === 'XK' && c.name === 'Kosovo'));
assert(
  countries.every(
    (c) =>
      Number.isFinite(c.x) &&
      Number.isFinite(c.y) &&
      /^M[0-9.,LZM-]+$/.test(c.path),
  ),
);
console.log(
  'Passed: platform isolation, lifetime/daily separation, honest gaps and zeros, shares/reposts, follower snapshots, deduplication, content filters, gender scope, country scope and 176 map geometries.',
);
