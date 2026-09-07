import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
process.on('uncaughtException', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const cache = new Map();
function load(file) {
  file = path.posix.normalize(file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  code = code.replace(/from\s+(['"])([^'"]+)\1/g, (m, q, s) =>
    s.startsWith('.') || s.startsWith('@/')
      ? 'from ' +
        JSON.stringify(
          load(
            (s.startsWith('@/')
              ? s.slice(2)
              : path.posix.join(path.posix.dirname(file), s)) + '.ts',
          ),
        )
      : m,
  );
  const url =
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  cache.set(file, url);
  return url;
}
const { parseTikTokStudio } = await import(load('lib/tiktok-studio.ts'));
const { sparkline } = await import(load('lib/sparkline.ts'));
const { connectionView, CONNECTION_VIEWS } = await import(
  load('lib/connection-views.ts')
);
const {
  genderDistribution,
  latestAudienceTables,
  performanceSeries,
  seriesTotal,
} = await import(load('lib/social-performance.ts'));
const { parseCommunityCSV, inWindow } = await import(load('lib/community.ts'));
const range = { start: '2025-12-30', end: '2026-01-02' };
const result = parseTikTokStudio(
  [
    {
      name: 'Overview.csv',
      csv: 'Date,Video Views,Profile Views,Likes,Comments,Shares\nDecember 30,0,0,0,0,0\nDecember 31,100,10,2,1,3\nJanuary 1,200,20,4,0,1\nJanuary 2,50,5,1,0,0',
    },
    {
      name: 'FollowerHistory.csv',
      csv: 'Date,Followers,Difference in followers from previous day\nDecember 30,undefined,0\nDecember 31,10,0\nJanuary 1,9,-1\nJanuary 2,9,0',
    },
    {
      name: 'Viewers.csv',
      csv: 'Date,Total Viewers,New Viewers,Returning Viewers\nJanuary 1,8,5,3',
    },
    {
      name: 'FollowerGender.csv',
      csv: 'Gender,Distribution\nMale,0.51\nFemale,0.49\nOther,0',
    },
    {
      name: 'FollowerTopTerritories.csv',
      csv: 'Top territories,Distribution\nDE,0.125\nXK,0.055\nOthers,0.82',
    },
  ],
  range,
);
assert.equal(result.daily.length, 4);
assert.equal(result.daily[1].date, '2025-12-31');
assert.equal(result.daily[2].date, '2026-01-01');
assert.equal(result.daily[0].views, 0);
assert(!result.daily[0].available.includes('followers'));
assert.equal(result.daily[1].engagements, 6);
assert.equal(result.daily[2].followers, 9);
assert.equal(result.daily[2].mediaViewers, 8);
assert(
  !result.daily[2].available.includes('users'),
  'TikTok viewers must not enter Website users',
);
assert.equal(
  seriesTotal(
    performanceSeries(
      result.daily,
      [],
      ['TikTok'],
      range,
      'users',
      'Daily activity',
    ),
    'TikTok',
    'users',
  ),
  8,
);
assert.equal(genderDistribution(result.tables, ['TikTok'])[0].TikTok, 49);
assert.equal(
  latestAudienceTables(result.tables, ['TikTok'], 'country').get('TikTok')
    .rows[0].percentage,
  12.5,
);
assert(
  !result.tables[0].columns.includes('followers'),
  'Percentage reports never manufacture follower counts',
);
const adjusted = parseTikTokStudio(
  [
    {
      name: 'Overview.csv',
      csv: 'Date,Video Views,Profile Views,Likes,Comments,Shares\nJanuary 1,100,10,2,-1,0',
    },
  ],
  range,
);
assert.equal(adjusted.daily[0].comments, -1);
assert.equal(adjusted.daily[0].engagements, 1);
assert.equal(
  seriesTotal(
    performanceSeries(
      adjusted.daily,
      [],
      ['TikTok'],
      range,
      'comments',
      'Daily activity',
    ),
    'TikTok',
    'comments',
  ),
  -1,
);
assert.throws(
  () =>
    parseTikTokStudio(
      [{ name: 'bad.csv', csv: 'Date,Video Views\nJanuary 1,1' }],
      { start: '2025-01-01', end: '2026-01-01' },
    ),
  /one matching year/,
);
assert.throws(
  () =>
    parseTikTokStudio(
      [{ name: 'bad.csv', csv: 'Date,Video Views\nJanuary 1,nope' }],
      range,
    ),
  /Invalid TikTok/,
);
assert.equal(sparkline([0]).points.length, 1);
assert.equal(sparkline([null]).points.length, 0);
assert.equal(
  (sparkline([1, null, 2]).path.match(/M/g) || []).length,
  2,
  'Missing samples break lines',
);
assert(!/NaN|Infinity/.test(sparkline([10, 10]).path));
assert.equal(CONNECTION_VIEWS.length, 4);
assert.deepEqual(connectionView('ga4').sources, ['ga4']);
assert.deepEqual(connectionView('gbp').sources, ['gbp']);
assert.equal(connectionView('gbp').provider, 'google');
assert(!connectionView('ga4').scopes.some((s) => s.includes('business')));
assert(!connectionView('gbp').scopes.some((s) => s.includes('analytics')));
const review = parseCommunityCSV(
  'id,time,time_precision,time_label,rating,text\nr1,2026-01-01T12:00:00Z,relative,2 weeks ago,5,Excellent',
  'gbp',
  'review',
)[0];
assert.equal(review.timeLabel, '2 weeks ago');
assert(
  !inWindow(review, range, 'Europe/Tirane'),
  'Capture time cannot become a publication date',
);
console.log(
  'PASS: TikTok Studio history, year boundaries, missing values, viewer isolation, percentage demographics, sparklines, independent Google connections and review date provenance.',
);
if (process.argv.includes('--local-export')) {
  const dirs = [
    'outputs/tiktok-studio-overview',
    'outputs/tiktok-studio-followers',
    'outputs/tiktok-studio-viewers',
  ];
  const files = dirs.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.csv'))
      .map((name) => ({
        name,
        csv: fs.readFileSync(path.join(dir, name), 'utf8'),
      })),
  );
  const actual = parseTikTokStudio(files, {
    start: '2025-09-07',
    end: '2026-09-06',
  });
  console.log(
    JSON.stringify({
      days: actual.daily.length,
      reports: actual.tables.length,
      views: actual.daily.reduce((n, d) => n + d.views, 0),
      profileViews: actual.daily.reduce((n, d) => n + (d.profileViews || 0), 0),
      followersRecorded: actual.daily.filter((d) =>
        d.available.includes('followers'),
      ).length,
      viewerDays: actual.daily.filter((d) =>
        d.available.includes('mediaViewers'),
      ).length,
      latest: actual.daily.at(-1).date,
    }),
  );
}
