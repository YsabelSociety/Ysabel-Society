import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../apps/contentpreview/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8').replace(/\r\n/g, '\n');
const compile = (text) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
test('every grid position can swap or insert into every other position without losing posts', () => {
  const start = source.indexOf('  const moveFeed =');
  const code = compile(source.slice(start, source.indexOf('\n  useEffect', start)) + '\nmoveFeed');
  for (const mode of ['swap', 'insert']) for (let from = 0; from < 12; from++) for (let to = 0; to < 12; to++) {
    const positions = Array.from({ length: 12 }, (_, i) => `photo-${i}`);
    let result = positions;
    const move = vm.runInNewContext(code, { positions, FEED_SIZE: 12, rearrangeMode: mode, commitFeed: (next) => { result = next; } });
    move(from, to);
    assert.equal(result[to], positions[from]);
    assert.equal(result.length, 12);
    assert.equal(new Set(result).size, 12);
    if (mode === 'swap') assert.equal(result[from], positions[to]);
  }
});
test('pointer drag commits only after movement and a valid release; cancellation never commits', () => {
  const start = source.lastIndexOf('  useEffect(() => {\n    const targetAt');
  const code = compile(source.slice(start, source.indexOf('  }, [positions, rearrangeMode, activeBoardId, assets, edit]);', start) + '  }, [positions, rearrangeMode, activeBoardId, assets, edit]);'.length));
  for (const scenario of ['drop', 'tap', 'cancel', 'outside']) {
    const listeners = new Map();
    let committed = null;
    const pointerDrag = { current: { source: { type: 'grid', index: 0 }, pointerId: 1, startX: 0, startY: 0, active: false } };
    const suppressDragClickUntil = { current: 0 };
    vm.runInNewContext(code, {
      positions: [], rearrangeMode: 'swap', activeBoardId: 'test', assets: [], edit: true,
      pointerDrag, suppressDragClickUntil, useEffect: (callback) => callback(),
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
      highlightDrop: () => {}, clearDropHighlight: () => {},
      document: { elementFromPoint: () => ({ closest: (selector) => selector === '[data-feed-index]' && scenario !== 'outside' ? { dataset: { feedIndex: '11' } } : null }) },
      window: { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: () => {} },
      applyDrop: (origin, target) => { committed = [origin.index, target]; },
    });
    const event = { pointerId: 1, clientX: scenario === 'tap' ? 2 : 100, clientY: 100, preventDefault() {} };
    if (scenario !== 'tap') listeners.get('pointermove')(event);
    listeners.get('pointerup')({ ...event, type: scenario === 'cancel' ? 'pointercancel' : 'pointerup' });
    assert.deepEqual(committed, scenario === 'drop' ? [0, 11] : null);
    assert.equal(pointerDrag.current, null);
    if (scenario === 'drop') assert.ok(suppressDragClickUntil.current > Date.now());
  }
});
