import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
process.on('uncaughtException', (error) => {
  console.error(error.message);
  console.error(
    String(error.stack)
      .split('\n')
      .filter((line) => line.includes('check-review-reports.mjs'))
      .join('\n'),
  );
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
const {
  makeReviewReport,
  reportCSV,
  reportHTML,
  reviewLink,
  DEFAULT_REVIEW_FILTERS,
} = await import(load('lib/review-report.ts'));
const { parseCommunityCSV, reviewTopics } = await import(
  load('lib/community.ts')
);
const { allowedReviewPhoto, fetchReviewPhoto } = await import(
  load('lib/server/review-photo.ts')
);
const range = { start: '2026-09-01', end: '2026-09-07' },
  tz = 'Europe/Tirane';
const {
  reviewPeriodRange,
  shiftReviewPeriod,
  reviewMatchesDates,
  reviewDateBounds,
} = await import(load('lib/review-dates.ts'));
const dateSelection = {
  mode: 'Daily',
  anchor: '2024-02-29',
  start: range.start,
  end: range.end,
  approximate: true,
};
assert.deepEqual(reviewPeriodRange(dateSelection, range), {
  start: '2024-02-29',
  end: '2024-02-29',
});
assert.deepEqual(
  reviewPeriodRange({ ...dateSelection, mode: 'Monthly' }, range),
  { start: '2024-02-01', end: '2024-02-29' },
);
assert.deepEqual(
  reviewPeriodRange({ ...dateSelection, mode: 'Yearly' }, range),
  { start: '2024-01-01', end: '2024-12-31' },
);
assert.deepEqual(
  reviewPeriodRange(
    { ...dateSelection, mode: 'Weekly', anchor: '2026-01-01' },
    range,
  ),
  { start: '2025-12-29', end: '2026-01-04' },
);
assert.equal(
  shiftReviewPeriod(
    { ...dateSelection, mode: 'Monthly', anchor: '2026-01-31' },
    1,
  ).anchor,
  '2026-02-01',
);
const base = {
  id: 'a',
  source: 'gbp',
  kind: 'review',
  accountId: 'file',
  time: '2026-09-03T12:00:00Z',
  text: '',
  rating: 1,
  origin: 'file',
  name: 'Guest',
};
const rows = [
  { ...base, id: 'food', text: 'The sushi was stale. The staff were lovely.' },
  { ...base, id: 'drink', rating: 2, text: 'The cocktails were watery.' },
  {
    ...base,
    id: 'service',
    rating: 3,
    text: 'The food was delicious but the service was rude.',
  },
  { ...base, id: 'good', rating: 5, text: 'The food was cold.' },
  {
    ...base,
    id: 'relative',
    rating: 3,
    timePrecision: 'relative',
    timeLabel: '3 weeks ago',
    text: 'The coffee was terrible.',
  },
  {
    ...base,
    id: 'old',
    time: '2025-01-01T00:00:00Z',
    text: 'The pizza was burnt.',
  },
  {
    ...base,
    id: 'chilled',
    rating: 2,
    text: 'Cold drinks and good food. Lovely service.',
  },
];
assert(
  reviewMatchesDates(
    { ...base, time: '2026-08-31T22:30:00Z' },
    { start: '2026-09-01', end: '2026-09-01' },
    tz,
  ),
);
assert(
  !reviewMatchesDates(
    base,
    { start: '2026-09-07', end: '2026-09-01' },
    tz,
    true,
  ),
);
const approximateReview = {
  ...base,
  time: '2026-09-07T00:11:00Z',
  timePrecision: 'relative',
  timeLabel: '3 weeks ago',
};
const bounds = reviewDateBounds(approximateReview, tz);
assert.equal(bounds.approximate, true);
assert(
  reviewMatchesDates(
    approximateReview,
    { start: '2026-08-01', end: '2026-08-31' },
    tz,
    true,
  ),
);
assert(
  !reviewMatchesDates(
    approximateReview,
    { start: '2026-08-01', end: '2026-08-31' },
    tz,
    false,
  ),
);
assert(
  !reviewMatchesDates(
    { ...approximateReview, timeLabel: 'Some time ago' },
    range,
    tz,
    true,
  ),
);
assert.equal(
  approximateReview.time,
  '2026-09-07T00:11:00Z',
  'Filtering must never replace capture time with an invented review timestamp',
);
for (const [text, topic] of [
  ['The ribeye arrived. It was rubbery and dry.', 'Food'],
  ['We ordered gnocchi. It was not fresh.', 'Food'],
  ['Could not chew it. Sent it back.', 'Food'],
  ['The mojito was mostly ice with hardly any alcohol.', 'Drinks'],
  ['Nobody acknowledged us. We felt invisible.', 'Service'],
  ['The hostess rolled her eyes and refused to help.', 'Service'],
  ['We could not hear each other and had to shout to be heard.', 'Atmosphere'],
  ['It smelled like an ashtray.', 'Atmosphere'],
  ['We waited 45 minutes to order.', 'Waiting time'],
  ['The glasses were stained. Sticky tables everywhere.', 'Cleanliness'],
])
  assert(
    reviewTopics({ ...base, text }).criticisms.some((c) => c.topic === topic),
    text + ' => ' + topic,
  );
for (const text of [
  'The staff were not rude. The pasta was not bad.',
  'Cold beer and a dry martini. Excellent.',
  'We loved the loud music.',
  'The staff were never dismissive.',
])
  assert.equal(reviewTopics({ ...base, text }).criticisms.length, 0, text);
assert(
  !reviewTopics({
    ...base,
    text: 'Delicious risotto but the hostess ignored us.',
  }).criticisms.some((c) => c.topic === 'Food'),
);
assert.equal(
  makeReviewReport(
    [{ ...base, text: 'The hostess ignored us.' }],
    { ...DEFAULT_REVIEW_FILTERS, topic: 'Service & staff' },
    range,
    tz,
  ).rows.length,
  1,
);
const filtered = makeReviewReport(rows, DEFAULT_REVIEW_FILTERS, range, tz);
assert.deepEqual(
  new Set(filtered.rows.map((r) => r.id)),
  new Set(['food', 'drink', 'relative', 'old']),
);
assert.deepEqual(
  makeReviewReport(
    rows,
    { ...DEFAULT_REVIEW_FILTERS, topic: 'Drinks', stars: [2] },
    range,
    tz,
  ).rows.map((r) => r.id),
  ['drink'],
);
assert.deepEqual(
  makeReviewReport(
    rows,
    { ...DEFAULT_REVIEW_FILTERS, period: 'Selected dates' },
    range,
    tz,
  )
    .rows.map((r) => r.id)
    .sort(),
  ['drink', 'food'],
);
assert.equal(
  makeReviewReport(rows, { ...DEFAULT_REVIEW_FILTERS, stars: [] }, range, tz)
    .rows.length,
  0,
);
assert.equal(
  makeReviewReport(
    rows,
    { ...DEFAULT_REVIEW_FILTERS, search: 'cocktails' },
    range,
    tz,
  ).rows.length,
  1,
);
assert(
  makeReviewReport(
    rows,
    { ...DEFAULT_REVIEW_FILTERS, evidence: 'All matching reviews' },
    range,
    tz,
  ).rows.some((r) => r.id === 'service'),
);
assert.equal(reviewTopics(rows[6]).criticisms.length, 0);
assert(
  reviewTopics({
    ...base,
    text: 'The cocktails were overpriced.',
  }).criticisms.some((c) => c.topic === 'Drinks'),
);
assert(
  !reviewTopics({
    ...base,
    text: 'Great food, expensive parking.',
  }).criticisms.some((c) => c.topic === 'Food'),
);
assert.equal(
  reviewTopics({
    ...base,
    text: '(Translated by Google) The food was good, with no delays. (Original) Ushqimi i mire pa vonesa.',
  }).criticisms.length,
  0,
);
const dangerous = {
  ...base,
  name: '=HYPERLINK("https://bad.example")',
  text:
    '<script>alert(1)</script>\nFull comment, "quoted"\n' +
    'End of comment. '.repeat(250),
  profileUrl: 'https://www.google.com/maps/contrib/123/reviews',
  reviewUrl: 'javascript:alert(1)',
  avatar: 'https://lh3.googleusercontent.com/a/photo',
};
assert.equal(reviewLink(dangerous).direct, false);
assert.equal(
  reviewLink({ ...base, reviewUrl: 'https://maps.app.goo.gl/review-example' })
    .direct,
  true,
);
const report = makeReviewReport(
  Array.from({ length: 42 }, (_, i) => ({
    ...dangerous,
    id: String(i),
    rating: (i % 3) + 1,
  })),
  {
    ...DEFAULT_REVIEW_FILTERS,
    evidence: 'All matching reviews',
    topic: 'All topics',
  },
  range,
  tz,
  '<img src=x onerror=alert(1)>',
);
const html = reportHTML(report, {
  'file:0': 'data:image/png;base64,iVBORw0KGgo=',
});
assert.equal(
  (html.match(/<article>/g) || []).length,
  42,
  'All filtered records must be exported, not just the visible page',
);
assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert(!html.includes('<script>alert(1)'));
assert(html.includes('data:image/png;base64,iVBORw0KGgo='));
assert(
  !html.includes('src="https://'),
  'The illustrated report must not depend on remote images',
);
assert(html.includes('A direct review permalink was not supplied'));
assert(html.includes('Print / Save as PDF'));
const csv = reportCSV(report);
assert(csv.includes("'=HYPERLINK"), 'Prevent spreadsheet formula execution');
assert(csv.includes(dangerous.text.replaceAll('"', '""')));
assert(csv.includes('https://lh3.googleusercontent.com/a/photo'));
const relative = reportCSV(
  makeReviewReport([rows[4]], DEFAULT_REVIEW_FILTERS, range, tz),
);
assert(relative.includes('3 weeks ago when captured'));
assert(
  parseCommunityCSV(
    'id,time,name,rating,text,review_url\nx,2026-09-01T00:00:00Z,Guest,2,Bad,https://maps.app.goo.gl/example',
    'gbp',
    'review',
  )[0].reviewUrl,
);
for (const url of [
  'http://lh3.googleusercontent.com/a',
  'https://lh3.googleusercontent.com.evil.test/a',
  'https://user:pass@lh3.googleusercontent.com/a',
  'https://127.0.0.1/a',
  'https://lh3.googleusercontent.com:888/a',
])
  assert(!allowedReviewPhoto(url));
let calls = 0;
assert.equal(
  await fetchReviewPhoto('https://evil.test/a', async () => {
    calls++;
  }),
  null,
);
assert.equal(calls, 0);
assert.equal(
  await fetchReviewPhoto(
    'https://lh3.googleusercontent.com/a',
    async (url, options) => {
      assert.equal(options.redirect, 'manual');
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/' },
      });
    },
  ),
  null,
);
assert.equal(
  await fetchReviewPhoto(
    'https://lh3.googleusercontent.com/a',
    async () =>
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
  ),
  null,
);
assert.equal(
  await fetchReviewPhoto(
    'https://lh3.googleusercontent.com/a',
    async () =>
      new Response(new Uint8Array(512 * 1024 + 1), {
        headers: { 'content-type': 'image/png' },
      }),
  ),
  null,
);
const image = await fetchReviewPhoto(
  'https://lh3.googleusercontent.com/a',
  async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png' },
    }),
);
assert.equal(image.bytes.length, 3);
console.log(
  'PASS: rating/topic/date/criticism filters; complete report export; photo embedding; link provenance; HTML/CSV escaping; safe bounded image retrieval.',
);

const { conversationCursor } = await import(load('lib/message-pagination.ts'));
assert.equal(
  conversationCursor({
    next: 'https://graph.instagram.com/v26.0/123/conversations?after=next-value&access_token=secret',
  }),
  'next-value',
);
assert.equal(
  conversationCursor({ next: 'https://evil.test/?after=cursor' }),
  '',
);
assert.equal(conversationCursor({ cursors: { after: 'orphan-cursor' } }), '');
