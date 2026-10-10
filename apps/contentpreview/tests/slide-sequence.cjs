const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/slide-sequence.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { moveSequenceSlide, sequenceEdgeSpeed } = moduleUnderTest.exports;
const order = ['cover', 'food', 'chef', 'cocktail', 'room'];
const same = value => Array.from(value);
assert.deepEqual(same(moveSequenceSlide(order, 'food', 4)), ['cover','chef','cocktail','room','food']);
assert.deepEqual(same(moveSequenceSlide(order, 'room', 1)), ['cover','room','food','chef','cocktail']);
assert.equal(moveSequenceSlide(order, 'cover', 4), order, 'Cover cannot be displaced');
assert.equal(moveSequenceSlide(order, 'missing', 2), order);
assert.equal(moveSequenceSlide(order, 'food', NaN), order);
assert.equal(moveSequenceSlide(order, 'food', 1), order);
assert.deepEqual(same(moveSequenceSlide(order, 'chef', 0)), ['cover','chef','food','cocktail','room']);
assert.deepEqual(same(moveSequenceSlide(order, 'food', 200)), ['cover','chef','cocktail','room','food']);
assert.deepEqual(order, ['cover','food','chef','cocktail','room'], 'Never mutate stored order while dragging');
for (const length of [1, 2, 7, 21, 40]) {
  const ids = Array.from({length}, (_, i) => String(i));
  for (let from = 1; from < length; from++) for (let to = 0; to < length; to++) {
    const result = moveSequenceSlide(ids, ids[from], to);
    assert.equal(result[0], '0'); assert.equal(new Set(result).size, length);
    assert.equal(result.indexOf(ids[from]), Math.max(1, to));
  }
}
assert.equal(sequenceEdgeSpeed(500, 0, 1000), 0);
assert.ok(sequenceEdgeSpeed(10, 0, 1000) < 0);
assert.ok(sequenceEdgeSpeed(990, 0, 1000) > 0);
assert.equal(sequenceEdgeSpeed(-20, 0, 1000), 0);
assert.equal(sequenceEdgeSpeed(1200, 0, 1000), 0);
assert.equal(sequenceEdgeSpeed(5, 5, 5), 0);
console.log('PASS: reordering 1–40 slides, cover protection, boundary moves, order immutability and drag edge scrolling.');
