import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
const cache = new Map();
const data = (s) =>
  'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const overrides = new Map([
  [
    'lib/server/providers.ts',
    data(
      'export const requestJSON=(...args)=>globalThis.providerFixture(...args);',
    ),
  ],
]);
function load(file) {
  file = path.posix.normalize(file);
  if (overrides.has(file)) return overrides.get(file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  code = code.replace(/from\s+(['"])([^'"]+)\1/g, (match, q, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return match;
    const target =
      (spec.startsWith('@/')
        ? spec.slice(2)
        : path.posix.join(path.posix.dirname(file), spec)) + '.ts';
    return 'from ' + JSON.stringify(load(target));
  });
  const url = data(code);
  cache.set(file, url);
  return url;
}
const reporting = await import(load('lib/reporting.ts'));
const a = reporting.importedPost('TikTok', 'sample', '2020-01-01', 'Old post');
reporting.putPost(a, 'views', 400);
reporting.putPost(a, 'shares', 4);
const b = reporting.importedPost(
  'TikTok',
  'sample',
  '2020-01-01',
  'Updated caption',
);
reporting.putPost(b, 'shares', 0);
const merged = reporting.mergePost(a, b);
assert.equal(merged.views, 400);
assert.equal(merged.shares, 0);
assert(merged.available.includes('views'));
const tiktok = await import(load('lib/server/report-tiktok.ts'));
let requested = [];
globalThis.providerFixture = async (url, options) => {
  if (url.includes('/user/info/'))
    return {
      data: {
        user: {
          open_id: 'owned',
          follower_count: 10,
          likes_count: 20,
          video_count: 2,
        },
      },
    };
  const body = JSON.parse(options.body);
  requested.push(body);
  return {
    data: {
      videos: [
        {
          id: body.cursor ? 'older' : 'newer',
          create_time:
            Date.parse(body.cursor ? '2020-01-01' : '2026-09-01') / 1000,
          view_count: 100,
          like_count: 0,
          comment_count: 2,
          share_count: 3,
        },
      ],
      has_more: !body.cursor,
      cursor: body.cursor ? 0 : 12345,
    },
  };
};
let first = await tiktok.importTikTok(
  { externalId: 'owned', accessToken: 'fixture', importMode: 'content' },
  { start: '2004-01-01', end: '2026-09-07' },
);
assert.equal(first.posts.length, 1);
assert.equal(first.nextCursor, '12345');
let second = await tiktok.importTikTok(
  {
    externalId: 'owned',
    accessToken: 'fixture',
    importMode: 'content',
    pageCursor: first.nextCursor,
  },
  { start: '2004-01-01', end: '2026-09-07' },
);
assert.equal(second.posts[0].date, '2020-01-01');
assert.equal(second.nextCursor, null);
assert.equal(requested[1].cursor, 12345);
assert(second.daily.every((d) => !d.available.includes('views')));
assert.equal(second.posts[0].likes, 0);
globalThis.providerFixture = async (url) =>
  url.includes('/user/info/')
    ? { data: { user: { open_id: 'owned', follower_count: 10 } } }
    : { data: { videos: [], has_more: true }, error: { code: 'ok' } };
const missing = await tiktok.importTikTok(
  { externalId: 'owned', accessToken: 'fixture', importMode: 'content' },
  { start: '2004-01-01', end: '2026-09-07' },
);
assert.equal(
  missing.checks.find((c) => c.key === 'content').status,
  'unavailable',
);
const google = await import(load('lib/server/report-google.ts'));
let offsets = [];
globalThis.providerFixture = async (url, options) => {
  const q = JSON.parse(options.body);
  if (url.includes('Realtime')) return { rows: [] };
  const dims = q.dimensions.map((d) => d.name),
    metrics = q.metrics.map((m) => m.name);
  const traffic = dims.includes('sessionSourceMedium');
  if (traffic) offsets.push(q.offset);
  const count = traffic ? (q.offset === 0 ? 2000 : 1) : 1;
  return {
    rowCount: traffic ? 2001 : 1,
    dimensionHeaders: q.dimensions,
    metricHeaders: q.metrics,
    rows: Array.from({ length: count }, (_, i) => ({
      dimensionValues: dims.map((d) => ({
        value:
          d === 'date'
            ? '20260906'
            : d === 'sessionSourceMedium'
              ? 'source' + (q.offset + i)
              : 'desktop',
      })),
      metricValues: metrics.map(() => ({ value: '1' })),
    })),
  };
};
const ga = await google.importGA4(
  { externalId: '552874533', accessToken: 'fixture' },
  { start: '2026-09-06', end: '2026-09-07' },
);
assert.deepEqual(offsets, [0, 2000]);
assert.equal(
  ga.tables.find((t) => t.key === 'website-traffic').rows.length,
  2001,
);
assert.equal(
  ga.tables.find((t) => t.key === 'website-traffic').truncated,
  false,
);
const model = await import(load('lib/website-report-model.ts'));
const plot = model.websitePlot(
  {
    columns: ['date', 'country', 'activeUsers'],
    rows: [
      { date: '2026-01-01', country: 'Albania', activeUsers: 5 },
      { date: '2026-01-03', country: 'Albania', activeUsers: 8 },
      { date: '2026-01-03', country: 'Italy', activeUsers: null },
    ],
  },
  'activeUsers',
);
assert.deepEqual(plot.ranked, [{ name: 'Albania', value: 13 }]);
assert.equal(plot.series.length, 2);
assert.equal(plot.series[0].Italy, undefined);
const db = new DatabaseSync(':memory:');
for (const file of fs
  .readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  db.exec(fs.readFileSync('drizzle/' + file, 'utf8'));
const payload = JSON.stringify({ phase: 'content', cursor: 'saved' });
db.prepare(
  'INSERT INTO history_imports(owner,source,external_id,payload) VALUES(?,?,?,?)',
).run('owner', 'tiktok', 'owned', payload);
const acquire = db.prepare(
  'UPDATE history_imports SET lease=?,lease_until=? WHERE owner=? AND source=? AND external_id=? AND lease_until<?',
);
assert.equal(
  acquire.run('a', 200, 'stranger', 'tiktok', 'owned', 100).changes,
  0,
);
assert.equal(acquire.run('a', 200, 'owner', 'tiktok', 'wrong', 100).changes, 0);
assert.equal(acquire.run('a', 200, 'owner', 'tiktok', 'owned', 100).changes, 1);
assert.equal(acquire.run('b', 200, 'owner', 'tiktok', 'owned', 100).changes, 0);
assert.equal(acquire.run('b', 400, 'owner', 'tiktok', 'owned', 300).changes, 1);
assert.equal(
  db
    .prepare(
      'UPDATE history_imports SET payload=? WHERE owner=? AND source=? AND lease=?',
    )
    .run('{}', 'owner', 'tiktok', 'a').changes,
  0,
);
assert.equal(
  JSON.parse(db.prepare('SELECT payload FROM history_imports').get().payload)
    .cursor,
  'saved',
);
db.close();
console.log(
  'PASS: history paging, missing cursors, real zeroes, lifetime scope, metric preservation, GA4 pagination, website grouping and owner-scoped import leases.',
);
