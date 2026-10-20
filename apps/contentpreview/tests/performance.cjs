const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function read(file, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Headers, ...globals });
  return exports;
}
async function main() {
  const { createWorkspaceLoader } = read('lib/workspace-loader.ts');
  let requests = 0, status = 200;
  const loader = createWorkspaceLoader(async (_url, init) => {
    requests++; assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'same-origin');
    return { ok: status === 200, status, json: async () => ({ boards: [], media: ['test'] }) };
  });
  const prepared = await loader.prime('session-one');
  assert.equal(await loader.load('session-one'), prepared);
  assert.equal(requests, 1, 'Authentication and hydration must share one workspace download');
  await Promise.all([loader.load('session-one'), loader.load('session-one')]);
  assert.equal(requests, 2, 'Deduplicate in-flight requests without caching future reads');
  await loader.prime('session-one'); await loader.load('session-two');
  assert.equal(requests, 4, 'A different session never receives the prepared private data');
  loader.clear(); status = 401;
  await assert.rejects(loader.prime('expired'), /SESSION_EXPIRED/);
  status = 200; await loader.prime('expired');
  assert.equal(requests, 6, 'Failed sessions can retry, not stay cached');
  loader.clear(); await loader.load('expired'); assert.equal(requests, 7);

  const { mediaGridWindow } = read('lib/media-grid-window.ts');
  const base = { count: 3000, width: 1000, minWidth: 150, gap: 13, rowGap: 23, extraHeight: 44, scrollTop: 0, viewportHeight: 700 };
  const first = mediaGridWindow(base);
  assert.ok(first.end - first.start < 60, 'Mount only a small window, not all 3000 assets');
  for (const count of [0, 1, 12, 100, 3000]) for (const width of [80, 280, 600, 1000, 1920]) {
    const initial = mediaGridWindow({ ...base, count, width });
    for (const scrollTop of [0, initial.totalHeight / 2, initial.totalHeight]) {
      const result = mediaGridWindow({ ...base, count, width, scrollTop });
      assert.ok(result.start >= 0 && result.end <= count && result.end >= result.start);
      assert.ok(result.itemWidth > 0 && result.totalHeight >= 0);
      if (scrollTop === initial.totalHeight) assert.equal(result.end, count, 'Last asset stays reachable');
    }
  }

  const states = [], effects = [], images = [];
  const React = { useState(initial) { const index = states.length; states.push(typeof initial === 'function' ? initial() : initial); return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, useRef(value) { return { current: value }; }, useEffect(effect) { effects.push(effect); } };
  class FakeImage { constructor() { images.push(this); } decode() { return Promise.resolve(); } }
  const { ProgressiveImage } = read('components/media-preview.tsx', {
    require: name => name === 'react' ? React : { jsx: () => ({}), jsxs: () => ({}), Fragment: 'fragment' },
    Image: FakeImage, AbortController, window: { setTimeout, clearTimeout }, clearTimeout,
  });
  let repairs = 0;
  ProgressiveImage({ thumbnail: '/thumb', display: '/display', alt: 'Test', style: {}, recover: async () => { repairs++; return null; } });
  const cleanup = effects[0]();
  assert.equal(images.length, 2, 'Load thumbnail and display concurrently, never serially');
  images.find(image => image.src === '/display').onload();
  await new Promise(setImmediate);
  assert.equal(states[0], '/display', 'Display image paints even while thumbnail is slow');
  images.find(image => image.src === '/thumb').onload();
  await new Promise(setImmediate);
  assert.equal(states[0], '/display', 'Late thumbnail must not downgrade the displayed photo');
  assert.equal(repairs, 0, 'Do not fetch huge originals when a usable preview exists');
  cleanup();

  const gallery = fs.readFileSync(path.resolve(__dirname, '../components/gallery-viewer.tsx'), 'utf8');
  assert.match(gallery, /originalRequested && !loaded && !failed/);
  assert.match(gallery, /if \(zoom > 1\) setOriginalRequested\(true\)/);
  const index = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(index, /login-landscape.webp/, 'Signed-in startup must not download the 1.56 MB login painting');
  console.log(`PASS: one authenticated bootstrap request, session isolation/retry, ${first.end - first.start}/3000 gallery items mounted, reachable end/resize, parallel preview loading without downgrade, originals on demand.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
