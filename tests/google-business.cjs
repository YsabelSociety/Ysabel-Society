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
        identity: async () => ({ userId: 'test-owner' }),
        json: (value) => Response.json(value),
        apiError: (error) =>
          Response.json({ error: error.message }, { status: 400 }),
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
async function main() {
  const model = load('lib/google-business.ts'),
    file = load('lib/import-file.ts');
  const headers =
    'Store code,Business name,Address,Labels,Google Search - Mobile,Google Search - Desktop,Google Maps - Mobile,Google Maps - Desktop,Calls,Messages,Bookings,Directions,Website clicks,Food orders,Food menu clicks,Hotel bookings';
  const csv =
    headers +
    '\n,,,,definition,definition,definition,definition,definition,definition,definition,definition,definition,definition,definition,definition\n0000123,Ysabel Society,"Test address, city",,12,3,30,4,0,0,0,18,10,0,7,0\n';
  const period = { start: '2026-08-01', end: '2026-08-31' },
    day = { start: '2026-09-04', end: '2026-09-04' };
  const rows = file.csvRows(csv),
    report = model.parseGBPExport(rows, period, 'August export');
  assert.equal(
    report.daily.length,
    0,
    'period totals must not manufacture daily observations',
  );
  assert.equal(report.tables[0].rows[0].search, 15);
  assert.equal(report.tables[0].rows[0].maps, 34);
  assert.equal(report.tables[1].rows[0]['Store code'], '0000123');
  assert.equal(
    report.tables[1].rows.length,
    1,
    'skip the metric definition row',
  );
  const daily = model.parseGBPExport(rows, day, 'Daily export').daily[0];
  assert.equal(daily.views, 49);
  assert.equal(daily.actions, 28);
  assert.equal(model.gbpDailyValue(daily, 'mapsMobile'), 30);
  assert.equal(
    model.gbpDailyValue(daily, 'calls'),
    0,
    'explicit zero remains a value',
  );
  const missingRows = rows.map((r) => ({ ...r, 'Google Maps - Mobile': '' }));
  const missing = model.parseGBPExport(missingRows, day, 'Daily export')
    .daily[0];
  assert.equal(
    model.gbpDailyValue(missing, 'maps'),
    null,
    'partial devices cannot masquerade as complete Maps totals',
  );
  assert.equal(model.gbpDailyValue(missing, 'mapsMobile'), null);
  assert.throws(
    () =>
      model.parseGBPExport(
        rows.map((r) => ({
          ...r,
          'Business name': r['Business name'] ? 'Different business' : '',
        })),
        period,
        'Export',
      ),
    /only the Ysabel Society/,
  );
  assert.throws(
    () =>
      model.parseGBPExport(
        rows,
        period,
        'GMB insights (Performance Report) - 2026-8-2 - 2026-8-31 - id.csv',
      ),
    /must match/,
  );
  const june = {
    ...report.tables[0],
    period: { start: '2026-06-01', end: '2026-06-30' },
  };
  const year = {
    ...report.tables[0],
    period: { start: '2025-09-07', end: '2026-09-04' },
  };
  assert.deepEqual(
    model.gbpMonthlyPoints([report.tables[0], june, year], 'search'),
    [
      { date: '2026-06', value: 15 },
      { date: '2026-07', value: null },
      { date: '2026-08', value: 15 },
    ],
  );
  const google = load('lib/server/report-google.ts');
  let calls = [];
  global.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    return Response.json(
      u.pathname.includes('searchkeywords')
        ? u.searchParams.has('pageToken')
          ? {
              searchKeywordsCounts: [
                { searchKeyword: 'dinner', insightsValue: { value: '22' } },
              ],
            }
          : {
              searchKeywordsCounts: [
                {
                  searchKeyword: 'restaurant',
                  insightsValue: { threshold: '15' },
                },
              ],
              nextPageToken: 'next-page',
            }
        : {
            multiDailyMetricTimeSeries: [
              {
                dailyMetricTimeSeries: u.searchParams
                  .getAll('dailyMetrics')
                  .filter((k) => k !== 'BUSINESS_IMPRESSIONS_MOBILE_MAPS')
                  .map((dailyMetric) => ({
                    dailyMetric,
                    timeSeries: {
                      datedValues: [{ date: { year: 2026, month: 9, day: 4 } }],
                    },
                  })),
              },
            ],
          },
    );
  };
  const api = await google.importGBP(
    { accessToken: 'test-token', externalId: '123' },
    day,
  );
  assert.equal(
    calls.filter((u) => u.pathname.includes('fetchMulti')).length,
    1,
  );
  assert.equal(calls[0].searchParams.getAll('dailyMetrics').length, 10);
  assert.equal(
    api.daily[0].bookings,
    0,
    'omitted protobuf value for a returned date is zero',
  );
  assert.ok(!api.daily[0].available.includes('maps'));
  assert.equal(api.tables[0].rows.length, 2, 'follow additional keyword pages');
  assert.equal(api.tables[0].rows[0].impressions, null);
  assert.equal(
    api.tables[0].rows[0].threshold,
    15,
    'privacy threshold is not an exact value',
  );
  calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return Response.json({}, { status: 403 });
  };
  const denied = await google.importGBP(
    { accessToken: 'test-token', externalId: '123' },
    day,
  );
  assert.equal(calls.length, 1, 'do not repeatedly call a denied API');
  assert.equal(denied.daily.length, 0);
  assert.equal(denied.checks[0].status, 'unavailable');
  const options = load('app/api/connection-options/route.ts');
  const upload = (range, label, value = csv) =>
    options.POST(
      new Request('https://test.local/api/connection-options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          op: 'file',
          source: 'gbp',
          kind: 'google-business',
          csv: value,
          label,
          mapping: {},
          range,
        }),
      }),
    );
  let response = await upload(period, 'August export');
  assert.equal(response.status, 200, await response.clone().text());
  response = await upload(day, 'Daily export');
  assert.equal(response.status, 200, await response.clone().text());
  const link = sql
    .prepare('SELECT * FROM connector_links WHERE owner=? AND source=?')
    .get('test-owner', 'gbp');
  assert.equal(link.provider, 'file');
  assert.equal(link.auto_sync, 0);
  assert.equal(
    JSON.parse(link.snapshot).period.start,
    day.start,
    'repeat imports refresh connection metadata',
  );
  assert.equal(JSON.parse(link.snapshot).records, 1);
  const analytics = load('app/api/analytics/route.ts');
  const result = await (
    await analytics.GET(
      new Request(
        'https://test.local/api/analytics?start=2026-09-01&end=2026-09-07',
      ),
    )
  ).json();
  assert.equal(
    result.rows.filter((r) => r.channel === 'Google Business').length,
    1,
  );
  assert.equal(
    result.tables.filter((t) => t.key === model.GBP_SUMMARY).length,
    2,
    'monthly report remains available when daily filter differs',
  );
  assert.equal(
    result.tables.find(
      (t) => t.period.start === period.start && t.key === model.GBP_SUMMARY,
    ).rows[0].search,
    15,
  );
  await upload(day, 'Daily export');
  assert.equal(
    sql.prepare('SELECT count(*) as n FROM account_metrics_daily').get().n,
    1,
    'reimport updates without duplication',
  );
  console.log(
    'PASS: native Google exports, identity/date validation, daily vs period totals, zero vs missing, monthly gaps, multi-metric API, keyword pagination/privacy, denied access, import freshness and shared dashboard reports.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
