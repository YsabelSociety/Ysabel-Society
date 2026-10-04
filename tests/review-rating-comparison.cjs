const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const app = path.resolve(__dirname, '../apps/marketingdata');
const appRequire = createRequire(path.join(app, 'package.json'));
const cache = new Map();
function load(file) {
  file = path.resolve(app, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const req = id => id.startsWith('.') ? load(path.resolve(path.dirname(file), id) + '.ts') :
    id.startsWith('@/') ? load(id.slice(2) + '.ts') : appRequire(id);
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
const { reviewRatingComparison, ratingChangeLabel } = load('lib/review-rating-comparison.ts');
const history = [
  { date: '2026-08-29', rating: 4.1, reviewCount: 320 },
  { date: '2026-09-02', rating: 4.17, reviewCount: 331 },
  { date: '2026-09-30', rating: 4.24, reviewCount: 360 },
  { date: '2026-10-04', rating: 4.31, reviewCount: 366 },
  { date: '2026-10-05', rating: 4.9, reviewCount: 370 },
];
const current = reviewRatingComparison('2026-10-31', '2026-10-04', history, {});
assert.equal(current.previous.month, '2026-09');
assert.equal(current.previous.date, '2026-09-30');
assert.equal(current.current.date, '2026-10-04');
assert.equal(current.current.rating, 4.3);
assert.equal(current.delta, 0.1);
assert.equal(ratingChangeLabel(current), '+0.1 points');
const historical = reviewRatingComparison('2026-09-10', '2026-10-04', history, {});
assert.equal(historical.current.date, '2026-09-02');
assert.equal(historical.previous.month, '2026-08');
assert.equal(historical.delta, 0.1);
const missing = reviewRatingComparison('2027-01-04', '2027-01-04', history, {});
assert.equal(missing.previous.month, '2026-12');
assert.equal(missing.previous.rating, null);
assert.equal(missing.current.rating, null);
assert.equal(ratingChangeLabel(missing), 'Comparison unavailable');
const reference = reviewRatingComparison('2026-09-30', '2026-10-04', history.slice(1), { '2026-08': 4.1 });
assert.equal(reference.previous.source, 'owner-reference');
assert.equal(reference.previous.date, null);
assert.equal(reference.delta, 0.1);
const official = reviewRatingComparison('2026-09-30', '2026-10-04', history, { '2026-08': 1 });
assert.equal(official.previous.rating, 4.1);
assert.equal(official.previous.source, 'google');
const external = reviewRatingComparison('2026-09-30', '2026-10-04', [{ date: '2026-08-30', rating: 4.1, reviewCount: 320, source: 'Restaurant Guru' }], {});
assert.equal(external.previous.rating, null);
assert.equal(reviewRatingComparison('', '2026-10-04', history, {}).current.rating, 4.3);
assert.equal(ratingChangeLabel(reviewRatingComparison('2026-10-04', '2026-10-04', [
  { date: '2026-09-30', rating: 4.3, reviewCount: 360 },
  { date: '2026-10-04', rating: 4.24, reviewCount: 366 },
], {})), '-0.1 points');
assert.equal(ratingChangeLabel(reviewRatingComparison('2026-10-04', '2026-10-04', [
  { date: '2026-09-30', rating: 4.22, reviewCount: 360 },
  { date: '2026-10-04', rating: 4.24, reviewCount: 366 },
], {})), 'No change');

async function renderFixture() {
  if (!process.env.REVIEW_QA_ASSETS || !process.env.REVIEW_QA_OUTPUT) return;
  const { createCompactReviewPDF } = load('lib/review-pdf.ts');
  const assets = process.env.REVIEW_QA_ASSETS;
  const read = name => new Uint8Array(fs.readFileSync(path.join(assets, name)));
  const reviews = [1, 2, 3, 4, 5].map(star => ({
    id: 'qa-' + star, source: 'gbp', accountId: 'test-only', kind: 'review',
    origin: 'api', name: 'Test reviewer ' + star, rating: star, time: '2026-10-02T12:00:00Z',
    text: star === 5 ? 'Lovely setting, but the team ignored us at reception and made us feel unwelcome.' :
      'The dish arrived cold and the waiter was rude. We waited a long time before anyone helped us.',
    reviewUrl: 'https://www.google.com/maps/',
  }));
  const bundle = {
    title: 'Guest feedback review report', scope: 'reviews',
    range: { start: '2026-10-01', end: '2026-10-04' }, timezone: 'Europe/Tirane',
    generatedAt: '2026-10-04T12:00:00Z', ratingComparison: current,
    reviewNote: 'October 2026 / all stars / criticism highlighted',
    rows: [], records: reviews, posts: [], tables: [], sourceStatus: [], communityStatus: [], mode: 'live',
  };
  const doc = await createCompactReviewPDF(bundle, reviews, [], {
    regular: read('NotoSans-Regular.ttf'), bold: read('NotoSans-Bold.ttf'), logo: read('logo.png'),
  }, () => {});
  const output = process.env.REVIEW_QA_OUTPUT;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(doc.output('arraybuffer')));
  assert(doc.getNumberOfPages() <= 4, 'Five short reviews should remain compact');
  console.log('PASS: review-only PDF generated with month comparison, gold stars and full reviews.');
}
console.log('PASS: previous calendar month, historical cutoffs, year rollover, official-only provenance, owner reference, missing history and displayed-rating changes.');
renderFixture().catch(error => { console.error(error); process.exitCode = 1; });
