// Explicitly invoked smoke test. Creates and removes only its own isolated test media/board.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = 'https://ysabel-society-media-preview.arberhalili1.chatgpt.site';
const password = process.env.YSABEL_TEST_PASSWORD;
if (!password) throw new Error('Provide YSABEL_TEST_PASSWORD for the authorized smoke test.');
const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'ysabel', password }) });
assert.equal(login.status, 200);
const { token } = await login.json();
const headers = { authorization: 'Bearer ' + token, origin: 'https://ysabelsociety.com' };
const json = async payload => fetch(base + '/api/workspace', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
let mediaId, boardId;
try {
  const preflight = await fetch(base + '/api/media', { method: 'OPTIONS', headers: { origin: headers.origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), headers.origin);
  const thumbnail = readFileSync('apps/contentpreview/public/ysabel-instagram-profile.jpg');
  // JPEG trailing padding tests transfer size without needing a user photograph.
  const original = Buffer.concat([thumbnail, Buffer.alloc(9_000_000)]);
  const form = new FormData();
  form.append('file', new File([original], 'upload-smoke-test.jpg', { type: 'image/jpeg' }));
  form.append('thumbnail', new File([thumbnail], 'thumbnail.jpg', { type: 'image/jpeg' }));
  form.append('display', new File([thumbnail], 'display.jpg', { type: 'image/jpeg' }));
  const upload = await fetch(base + '/api/media', { method: 'POST', headers, body: form });
  assert.equal(upload.status, 200, 'Large original upload must succeed');
  assert.equal(upload.headers.get('access-control-allow-origin'), headers.origin);
  const media = await upload.json(); mediaId = media.id;
  assert.equal(media.fileSize, original.length);
  const preview = await fetch(base + '/api/media/' + mediaId + '?variant=thumbnail', { headers });
  assert.equal(preview.status, 200);
  const previewBytes = (await preview.arrayBuffer()).byteLength;
  assert.equal(previewBytes, thumbnail.length, 'Grid must serve derivative, not the large original');
  const board = await json({ action: 'create-board', name: 'Temporary upload verification — safe to remove' });
  assert.equal(board.status, 200); boardId = (await board.json()).id;
  const rejected = await json({ action: 'publish-board', boardId, positions: ['local-not-uploaded'], assets: [] });
  assert.equal(rejected.status, 409);
  const published = await json({ action: 'publish-board', boardId, positions: Array(12).fill(mediaId), assets: [media] });
  assert.equal(published.status, 200);
  console.log(JSON.stringify({ largeUpload: 'passed', originalBytes: original.length, gridPreviewBytes: previewBytes, unfinishedPublish: 'rejected safely', twelvePostPublish: 'passed' }));
} finally {
  if (boardId) assert.equal((await json({ action: 'delete-board', boardId })).status, 200, 'Test board cleanup');
  if (mediaId) assert.equal((await fetch(base + '/api/media', { method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ ids: [mediaId] }) })).status, 200, 'Test media cleanup');
  console.log('Temporary test fixtures removed; existing boards untouched.');
}
