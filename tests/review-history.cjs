const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../lib/review-history.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { reviewMonthHistory } = loaded.exports;
const review = (time) => ({ time });
const basis = [
  review('2025-12-31T23:00:00Z'),
  review('2026-02-01T10:00:00Z'),
  review('2026-02-12T10:00:00Z'),
];
assert.deepEqual(
  reviewMonthHistory(basis, basis),
  [1, 0, 2],
  'Sort months and retain a zero-count month across a year boundary',
);
assert.deepEqual(
  reviewMonthHistory([...basis].reverse(), [basis[2]]),
  [0, 0, 1],
  'Filtered cards retain the same time axis',
);
assert.deepEqual(
  reviewMonthHistory(basis, []),
  [0, 0, 0],
  'No matching captured reviews is a real zero',
);
assert.deepEqual(
  reviewMonthHistory([], []),
  [],
  'No dated source records does not manufacture a trend',
);
assert.deepEqual(
  reviewMonthHistory([review('unknown'), review('2026-13-01')], []),
  [],
  'Undated and invalid months are excluded',
);
assert.deepEqual(
  reviewMonthHistory([basis[1]], [basis[1]]),
  [1],
  'One imported month stays one point',
);
assert.deepEqual(
  reviewMonthHistory([basis[1]], [basis[0], basis[1]]),
  [1],
  'Records outside the selected basis do not extend the report period',
);
console.log(
  'Review history checks passed: filtered counts, gaps, year boundaries and missing dates.',
);
