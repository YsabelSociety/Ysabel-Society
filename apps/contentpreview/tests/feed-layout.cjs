const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../lib/feed-layout.ts'), 'utf8');
const mod = { exports: {} };
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compile(source), { module: mod, exports: mod.exports });
const { FEED_SIZE, emptyFeed, readStoredFeed, readStoredFeedRows, writeStoredFeed, workspacePayload } = mod.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const old = Object.freeze(Array.from({ length: 12 }, (_, i) => `post-${i + 1}`));
const expanded = [null, null, null, ...old];
assert.equal(FEED_SIZE, 15);
assert.deepEqual(plain(readStoredFeed(old)), expanded, 'New slots precede all 12 existing posts');
assert.deepEqual(plain(readStoredFeed([...old, null, null, null])), expanded, 'Old 15-slot server snapshots also gain the top row');
assert.deepEqual(plain(readStoredFeedRows(old.map((mediaId, position) => ({ mediaId, position })).reverse())), expanded, 'Sparse DB rows need not arrive in order');
assert.deepEqual(plain(readStoredFeedRows([{ position: -1, mediaId: 'bad' }, { position: 15, mediaId: 'bad' }, { position: 1.5, mediaId: 'bad' }])), plain(emptyFeed()));
assert.deepEqual(plain(readStoredFeed([...old, 'a', 'b', 'c'])), ['a', 'b', 'c', ...old], 'Previously stored spare-slot media is retained');

// Exercise all positions, including empty trailing slots, through the actual
// sparse save protocol used by the server. Refresh must never shift twice.
for (let length = 0; length <= FEED_SIZE; length++) {
  let feed = Array.from({ length: FEED_SIZE }, (_, i) => i < length ? `media-${i}` : null);
  for (let reload = 0; reload < 4; reload++) {
    const rows = writeStoredFeed(feed).flatMap((mediaId, position) => mediaId ? [{ mediaId, position }] : []);
    assert.deepEqual(plain(readStoredFeedRows(rows)), feed);
    feed = plain(readStoredFeedRows(rows));
  }
}
const full = ['new-1', 'new-2', 'new-3', ...old];
const payload = { action: 'publish-board', boardId: 'october', positions: full, assets: [{ id: 'post-1', slides: ['slide-2'] }] };
const saved = workspacePayload(payload);
assert.deepEqual(plain(saved.positions), [...old, 'new-1', 'new-2', 'new-3']);
assert.equal(saved.assets, payload.assets, 'Carousel media and metadata are untouched');
assert.equal(saved.boardId, 'october');
assert.deepEqual(payload.positions, full, 'Serialization never mutates the editor feed');
assert.deepEqual(plain(readStoredFeed(saved.positions)), full, 'Published order matches the editor');
const assetOnly = { action: 'save', asset: { id: 'post-1', caption: 'Dinner' } };
assert.equal(workspacePayload(assetOnly), assetOnly);

// Verify the real published-snapshot reader applies the boundary exactly once.
const workspace = fs.readFileSync(path.resolve(__dirname, '../components/ysabel-workspace.tsx'), 'utf8');
const reader = workspace.slice(workspace.indexOf('function readPublishedSnapshot('), workspace.indexOf('\nconst formats'));
const readSnapshot = vm.runInNewContext(compile(reader) + '\nreadPublishedSnapshot', { readStoredFeed, mediaUrl: asset => asset.url });
assert.deepEqual(plain(readSnapshot({ snapshot: JSON.stringify({ positions: old, assets: [] }) }).positions), expanded);
assert.deepEqual(plain(readSnapshot({ snapshot: JSON.stringify(saved) }).positions), full);
assert.match(workspace, /JSON\.stringify\(workspacePayload\(payload\)\)/, 'Autosave, undo and cover changes use stored order');
assert.match(workspace, /workspacePayload\(\{ action: 'publish-board'/);
assert.match(workspace, /readStoredFeedRows\(data.positions\)/, 'Month creation/opening uses the same layout');
console.log('15-post layout: top row, reloads, sparse storage, publishing and carousel preservation passed.');
