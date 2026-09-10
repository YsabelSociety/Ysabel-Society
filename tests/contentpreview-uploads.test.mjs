import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../apps/contentpreview/package.json', import.meta.url));
const ts = require('typescript');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compile(readFileSync('apps/contentpreview/lib/media-transfer.ts', 'utf8')), { exports: module.exports, Error, Set, Map });
const { validatePublishMedia, mediaRequestError } = module.exports;
test('publishing rejects unfinished and deleted media, including nested carousel slides', () => {
  assert.throws(() => validatePublishMedia(['local-1'], [{ id: 'local-1' }]), /not uploaded/);
  assert.throws(() => validatePublishMedia(['a'], [{ id: 'a', slides: ['b'] }, { id: 'b' }], new Set(['a'])), /no longer/);
  assert.throws(() => validatePublishMedia(['missing'], []), /no longer/);
  assert.deepEqual([...validatePublishMedia(['a'], [{ id: 'a', slides: ['b'] }, { id: 'b', slides: ['a'] }], new Set(['a', 'b']))], ['a', 'b']);
});
test('upload errors explain size, session and server failures', async () => {
  assert.match((await mediaRequestError(new Response('', { status: 413 }), 'Upload')).message, /too large/);
  assert.match((await mediaRequestError(new Response('', { status: 401 }), 'Upload')).message, /session expired/);
  assert.match((await mediaRequestError(new Response('', { status: 503 }), 'Upload')).message, /draft has been kept/);
});
const source = readFileSync('apps/contentpreview/components/ysabel-workspace.tsx', 'utf8').replace(/\r\n/g, '\n');
test('large originals bypass the buffered website proxy while the grid uses thumbnails', () => {
  assert.match(source, /fetch\('https:\/\/ysabel-society-media-preview\.arberhalili1\.chatgpt\.site\/api\/media'/);
  assert.match(source, /file\.size > 90_000_000/);
  assert.match(source, /thumbnail=\{mediaVariantUrl\(asset.url, 'thumbnail'\)/);
  assert.match(source, /if \(!isVideoFile\(file\) && \(!optimized.thumbnail \|\| !optimized.display\)\)/);
});
test('uploads attach to the target only after confirmation, retain failures for retry and release completed files', async () => {
  const begin = source.indexOf('  const runUpload = async');
  const code = compile(source.slice(begin, source.indexOf('  const queueUpload', begin)) + '\nrunUpload;');
  for (const success of [false, true]) {
    let tasks = [{ id: 'local-test', phase: 'preparing' }];
    let assets = [{ id: 'parent', slides: [] }];
    const records = new Map([['local-test', { file: new File(['abc'], 'test.jpg', { type: 'image/jpeg' }), boardId: 'board', replacementId: null, carouselId: 'parent' }]]);
    const latestAssets = { current: assets };
    const writes = [];
    const context = {
      uploadRecords: { current: records }, activeUploads: { current: new Set() },
      setUploadTasks: fn => { tasks = fn(tasks); }, normalizeVideo: async file => file,
      createOptimizedMedia: async () => ({ thumbnail: new Blob(['t']), display: new Blob(['d']) }),
      isVideoFile: () => false, URL: { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} },
      setAssets: fn => { assets = typeof fn === 'function' ? fn(assets) : fn; latestAssets.current = assets; },
      FormData, fetch: async () => success ? Response.json({ id: 'saved', slides: [] }) : new Response('', { status: 503 }),
      authToken: 'test', mediaRequestError, mediaUrl: asset => asset.url,
      latestAssets, latestFeeds: { current: { board: Array(12).fill(null) } },
      persist: payload => { writes.push(payload); }, setFeeds: () => {}, setHistory: () => {}, setFuture: () => {}, setSelectedId: () => {},
    };
    const run = vm.runInNewContext(code, context);
    await run('local-test');
    assert.equal(tasks[0].phase, success ? 'uploaded' : 'failed');
    assert.equal(records.has('local-test'), !success);
    assert.equal(assets.find(a => a.id === 'parent').slides.length, success ? 1 : 0);
    assert.equal(writes.length, success ? 1 : 0);
  }
});
