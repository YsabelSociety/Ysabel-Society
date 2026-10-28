import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../apps/contentpreview/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8').replace(/\r\n/g, '\n');
const compile = (text) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const pointerSource = readFileSync('apps/contentpreview/lib/feed-pointer-drag.ts', 'utf8');
test('every grid position can swap or insert into every other position without losing posts', () => {
  const start = source.indexOf('  const moveFeed =');
  const code = compile(source.slice(start, source.indexOf('\n  useEffect', start)) + '\nmoveFeed');
  for (const mode of ['swap', 'insert']) for (let from = 0; from < 15; from++) for (let to = 0; to < 15; to++) {
    const positions = Array.from({ length: 15 }, (_, i) => `photo-${i}`);
    let result = positions;
    const move = vm.runInNewContext(code, { positions, FEED_SIZE: 15, rearrangeMode: mode, commitFeed: (next) => { result = next; } });
    move(from, to);
    assert.equal(result[to], positions[from]);
    assert.equal(result.length, 15);
    assert.equal(new Set(result).size, 15);
    if (mode === 'swap') assert.equal(result[from], positions[to]);
  }
});
test('mouse, touch and pen drags commit only after a valid release; cancellation never commits', () => {
  const code = ts.transpileModule(pointerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  for (const pointerType of ['mouse', 'touch', 'pen']) for (const scenario of ['drop', 'tap', 'cancel', 'outside', 'preview', 'wrong-pointer']) {
    const listeners = new Map();
    let committed = null;
    const pointerDrag = { current: { source: { type: 'grid', index: 0 }, pointerId: 1, startX: 0, startY: 0, active: false } };
    const suppressDragClickUntil = { current: 0 };
    const exports = {};
    vm.runInNewContext(code, {
      exports,
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
      document: { elementFromPoint: () => ({ closest: (selector) => selector === '[data-feed-index]' && scenario !== 'outside' ? { dataset: { feedIndex: '11' } } : null }) },
      window: { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: () => {} },
    });
    const cleanup = exports.bindFeedPointerDrag({
      pointerDrag, suppressDragClickUntil, edit: scenario !== 'preview',
      highlightDrop() {}, clearDropHighlight() {},
      applyDrop: (origin, target) => { committed = [origin.index, target]; },
    });
    const event = { pointerId: scenario === 'wrong-pointer' ? 2 : 1, pointerType, clientX: scenario === 'tap' ? 2 : 100, clientY: scenario === 'tap' ? 2 : 100, preventDefault() {} };
    listeners.get('pointermove')(event);
    const release = scenario === 'cancel' ? 'pointercancel' : 'pointerup';
    listeners.get(release)({ ...event, type: release });
    assert.deepEqual(committed, scenario === 'drop' ? [0, 11] : null);
    if (scenario !== 'wrong-pointer') assert.equal(pointerDrag.current, null);
    if (scenario === 'drop') assert.ok(suppressDragClickUntil.current > Date.now());
    cleanup();
    assert.equal(pointerDrag.current, null);
  }
});

test('the drag thumbnail retains the visible slide at its smaller display size', () => {
  const exports = {};
  const listeners = new Map();
  const sourceTrack = { clientWidth: 240, scrollLeft: 240 * 15 };
  const ghostTrack = { clientWidth: 100, scrollLeft: 0 };
  let removed = false;
  const ghost = { setAttribute() {}, removeAttribute() {}, remove() { removed = true; }, querySelectorAll: () => [ghostTrack] };
  const tile = { cloneNode: () => ghost, querySelectorAll: () => [sourceTrack] };
  const origin = { querySelector: () => tile, classList: { add() {}, remove() {} } };
  const pointerDrag = { current: { source: { type: 'grid', index: 0 }, pointerId: 1, startX: 0, startY: 0, active: false } };
  const code = ts.transpileModule(pointerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    exports, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    document: { body: { appendChild() {} }, elementFromPoint: () => ({ closest: () => origin }) },
    window: { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener() {} },
  });
  const cleanup = exports.bindFeedPointerDrag({ pointerDrag, suppressDragClickUntil: { current: 0 }, edit: true, applyDrop() {}, highlightDrop() {}, clearDropHighlight() {} });
  listeners.get('pointermove')({ pointerId: 1, clientX: 20, clientY: 20, preventDefault() {} });
  assert.equal(ghostTrack.scrollLeft / ghostTrack.clientWidth, 15);
  cleanup();
  assert.equal(removed, true);
  assert.equal(pointerDrag.current, null);
});

test('carousel posts use whole-post pointer dragging by default, with opt-in slide swiping', () => {
  assert.match(source, /if \(framing \|\| reordering\) return/);
  assert.match(source, /if \(swiping\) return/);
  assert.doesNotMatch(source, /if \(isCarousel\) return/);
  assert.match(source, /reordering=\{edit && !swiping\}/);
  assert.match(source, /Swipe slides in grid/);
  const handle = source.slice(source.indexOf('<button className="tile-drag-handle"'), source.indexOf('<Move /></button>', source.indexOf('<button className="tile-drag-handle"')));
  assert.match(handle, /onPointerStart/);
  assert.doesNotMatch(handle, /pointerType === 'touch'/);
  assert.doesNotMatch(handle, /type="button" draggable/);
});
