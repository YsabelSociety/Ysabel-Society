const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(code, { exports, ...globals });
  return exports;
}

const { canvasPixelRatio, releaseRenderer } = load('lib/render-budget.ts');
// High-DPR phones, tablets and desktop displays stay within bounded allocations.
for (const [w, h, dpr, touch] of [
  [390, 844, 3, true], [430, 932, 3, true], [1024, 1366, 2, true],
  [1920, 1080, 2, false], [3840, 2160, 3, false], [240, 180, 1, false],
]) {
  const ratio = canvasPixelRatio(w, h, dpr, touch);
  assert(ratio > 0 && ratio <= dpr);
  assert(w * h * ratio ** 2 <= (touch ? 900000 : 1800000) + 0.001);
}
assert(Number.isFinite(canvasPixelRatio(0, 0, 0, true)));

// A released scene must not retain either its browser context or its canvas.
let contexts = 0, canvases = 0, disposed = 0;
for (let navigation = 0; navigation < 100; navigation++) {
  contexts++; canvases++;
  releaseRenderer({
    dispose() { disposed++; },
    forceContextLoss() { contexts--; },
    domElement: { remove() { canvases--; } },
  });
  assert.equal(contexts, 0);
  assert.equal(canvases, 0);
}
assert.equal(disposed, 100);

// Fast nested scrolling uses one pending timer, resumes after settling, and
// never leaves a pause flag or event handler behind after navigating away.
const document = new EventTarget();
document.documentElement = { dataset: {} };
const timers = new Map();
let id = 0, cleanup;
const { useScrollBudget } = load('components/ysabel/use-scroll-budget.ts', {
  document,
  require: () => ({ useEffect: effect => { cleanup = effect(); } }),
  setTimeout: callback => { timers.set(++id, callback); return id; },
  clearTimeout: timer => timers.delete(timer),
});
const settle = () => {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach(callback => callback());
};
for (let navigation = 0; navigation < 30; navigation++) {
  useScrollBudget();
  for (let scroll = 0; scroll < 50; scroll++) document.dispatchEvent(new Event('scroll'));
  assert.equal(document.documentElement.dataset.scrolling, 'true');
  assert.equal(timers.size, 1);
  settle();
  assert.equal(document.documentElement.dataset.scrolling, undefined);
  document.dispatchEvent(new Event('scroll'));
  cleanup();
  assert.equal(timers.size, 0);
  assert.equal(document.documentElement.dataset.scrolling, undefined);
  document.dispatchEvent(new Event('scroll'));
  assert.equal(timers.size, 0, 'Navigation removed the scroll listener');
}
console.log('Rendering budget: high-DPR canvas allocations are bounded; scene cleanup and rapid-scroll lifecycle checks pass.');
