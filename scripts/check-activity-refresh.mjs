import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const urls = new Map();
function load(file) {
  if (urls.has(file)) return urls.get(file);
  const text = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const rewritten = text.replace(
    /from (['"])\.\/analytics\1/g,
    'from ' +
      JSON.stringify(
        file === 'lib/analytics.ts' ? '' : load('lib/analytics.ts'),
      ),
  );
  const url =
    'data:text/javascript;base64,' + Buffer.from(rewritten).toString('base64');
  urls.set(file, url);
  return url;
}
const a = await import(load('lib/analytics.ts'));
const s = await import(load('lib/social-performance.ts'));
const w = await import(load('lib/sync-window.ts'));
const p = await import(load('lib/activity-series.ts'));
assert.deepEqual(a.dateRange('Last 7 Days', undefined, '2026-09-07'), {
  start: '2026-09-01',
  end: '2026-09-07',
});
assert.deepEqual(a.dateRange('Last 3 Days', undefined, '2026-01-01'), {
  start: '2025-12-30',
  end: '2026-01-01',
});
assert.deepEqual(a.dateRange('Previous Week', undefined, '2026-09-07'), {
  start: '2026-08-31',
  end: '2026-09-06',
});
assert.deepEqual(a.dateRange('Previous 7 Days', undefined, '2026-09-07'), {
  start: '2026-08-25',
  end: '2026-08-31',
});
assert.deepEqual(
  w.recentSyncWindow('Europe/Tirane', new Date('2026-09-06T22:30:00Z')),
  { start: '2026-09-01', end: '2026-09-07' },
);
assert.equal(
  s.metricBasis('profileViews', 'Published content'),
  'Daily activity',
);
assert.equal(
  s.postValue(
    { views: 500, visits: 20, available: ['views', 'visits'] },
    'profileViews',
  ),
  null,
);
assert.equal(
  a.metricAvailable(
    [{ date: '2026-09-01', channel: 'TikTok', views: 100 }],
    'profileViews',
  ),
  false,
);
const rows = [
  {
    channel: 'Instagram',
    date: '2026-09-01',
    available: ['profileViews'],
    profileViews: 11,
  },
  {
    channel: 'Instagram',
    date: '2026-09-03',
    available: ['profileViews'],
    profileViews: 0,
  },
  {
    channel: 'Facebook',
    date: '2026-09-01',
    available: ['profileViews'],
    profileViews: 40,
  },
];
assert.deepEqual(p.activitySeries(rows, 'Instagram', 'profileViews'), [
  { date: '2026-09-01', value: 11 },
  { date: '2026-09-02', value: null },
  { date: '2026-09-03', value: 0 },
]);
const range = { start: '2026-09-01', end: '2026-09-03' };
const points = s.performanceSeries(
  rows,
  [],
  ['Instagram', 'TikTok'],
  range,
  'profileViews',
  'Published content',
);
assert.equal(s.seriesTotal(points, 'Instagram', 'profileViews'), 11);
assert.equal(s.seriesTotal(points, 'TikTok', 'profileViews'), null);
console.log(
  'PASS: last-seven-day and timezone defaults, previous windows, profile/content separation, unavailable TikTok metrics and honest chart gaps.',
);
