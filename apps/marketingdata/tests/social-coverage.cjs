const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript'), cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', js)(id => id.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(file), id)) + '.ts') : require(id), exports);
  return exports;
}
const m = load('lib/social-performance.ts'), source = load('lib/source-status.ts'), reports = load('lib/reporting.ts');
const range = { start: '2026-10-01', end: '2026-10-11' };
const daily = (extra = {}) => ({ date: '2026-10-10', channel: 'TikTok', views: 0, reach: 0, available: [], ...extra });
const post = (extra = {}) => ({ id: 'video', platform: 'TikTok', date: '2026-10-10', format: 'Video', status: 'Published', views: 0, available: ['views'], origin: 'api', ...extra });

test('supplied zero remains visible; missing defaults and dates outside the range do not', () => {
  assert.deepEqual(m.suppliedSocialChannels([daily({ available: ['views'] })], [], ['TikTok'], range, 'views', 'Daily activity'), ['TikTok']);
  assert.deepEqual(m.suppliedSocialChannels([daily()], [], ['TikTok'], range, 'views', 'Daily activity'), []);
  assert.deepEqual(m.suppliedSocialChannels([daily({ date: '2026-09-01', available: ['views'] })], [], ['TikTok'], range, 'views', 'Daily activity'), []);
});
test('TikTok reached audience uses the API field without converting saved historical reach to live data', () => {
  const rows = [daily({ reachedAudience: 120, available: ['reachedAudience'], sourceMetrics: { metricOrigins: { reachedAudience: 'api' } } }), daily({ date: '2026-10-01', reach: 40, available: ['reach'], sourceMetrics: { origin: 'file' } })];
  assert.equal(m.seriesTotal(m.performanceSeries(rows, [], ['TikTok'], range, 'reach', 'Daily activity'), 'TikTok', 'reach'), 160);
  const provenance = m.socialSourceRows(rows, 'reach');
  assert.equal(source.metricSource(provenance[0], 'reach'), 'api');
  assert.equal(source.metricSource(provenance[1], 'reach'), 'file');
});
test('latest available uses supplied daily data or post lifetime data, and respects an explicit daily choice', () => {
  const rows = [daily({ channel: 'Facebook', available: ['views'] })];
  assert.equal(m.availablePerformanceBasis(rows, ['Facebook'], range, 'views', 'Latest available'), 'Daily activity');
  assert.equal(m.availablePerformanceBasis(rows, ['Facebook'], range, 'likes', 'Latest available'), 'Published content');
  assert.equal(m.availablePerformanceBasis(rows, ['Facebook'], range, 'likes', 'Daily activity'), 'Daily activity');
});
test('unrepresented formats and unsupported actions disappear without hiding supplied Instagram reposts', () => {
  assert.deepEqual(m.suppliedSocialChannels([], [post()], ['TikTok'], range, 'stories', 'Published content'), []);
  assert.deepEqual(m.suppliedSocialChannels([], [post()], ['TikTok'], range, 'reels', 'Published content'), []);
  assert.deepEqual(m.suppliedSocialChannels([], [post()], ['TikTok'], range, 'reshares', 'Published content'), []);
  assert.deepEqual(m.suppliedSocialChannels([], [post({ platform: 'Instagram', reposts: 0, available: ['reposts'] })], ['Instagram'], range, 'reposts', 'Published content'), ['Instagram']);
});
test('post lifetime cards retain file/API provenance independently of the connection', () => {
  const rows = m.socialContentSourceRows([post({ origin: 'file' }), post({ id: 'live' })], 'views');
  assert.deepEqual(rows.map(row => source.metricSource(row, 'views')), ['file', 'api']);
});
test('new Accounts audience snapshots replace older Studio snapshots and empty reports never replace real values', () => {
  const table = (key, end, rows) => ({ key, source: 'tiktok', columns: ['gender', 'percentage'], period: { start: end, end }, rows, scope: key.startsWith('audience-tiktok-accounts-') ? 'Accounts API' : 'TikTok Studio export' });
  const old = table('audience-gender', '2026-10-04', [{ gender: 'female', percentage: 50 }]);
  const api = table('audience-tiktok-accounts-genders', '2026-10-10', [{ gender: 'female', percentage: 60 }]);
  const empty = table('audience-tiktok-accounts-genders', '2026-10-11', []);
  assert.equal(m.latestAudienceTables([old, api, empty], ['TikTok'], 'gender').get('TikTok'), api);
  assert.equal(reports.reportSourceKind(old), 'file');
  assert.equal(reports.reportSourceKind(api), 'api');
});
