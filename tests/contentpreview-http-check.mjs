// Optional integration check against a locally running production build.
// Only session creation and read requests are made; no media/feed writes occur.
import assert from 'node:assert/strict';
const base = process.env.YSABEL_CHECK_BASE;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
  throw new Error('Set YSABEL_CHECK_BASE to the local production-server origin.');
}
const request = (path, init = {}) => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(45000), ...init });
const page = await request('/contentpreview');
assert.equal(page.status, 200);
assert((await page.text()).includes('/contentpreview-app/index.html'));
const app = await request('/contentpreview-app/index.html');
assert.equal(app.status, 200);
const html = await app.text();
for (const path of [...html.matchAll(/(?:src|href)="(\/contentpreview-app\/[^\"]+)"/g)].map(match => match[1])) {
  const resource = await request(path);
  assert.equal(resource.status, 200, path);
  await resource.body?.cancel();
}
for (const path of ['/', '/food-menu', '/food-menu/asian', '/food-menu/italian']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  await response.body?.cancel();
}
const anonymous = await request('/contentpreview/api/workspace');
assert.equal(anonymous.status, 401, 'Workspace must remain protected');
assert.equal((await (await request('/contentpreview/api/auth/session')).json()).authenticated, false);
console.log('Passed: preview assets, website routes and anonymous access protection.');

if (process.env.YSABEL_CHECK_USERNAME && process.env.YSABEL_CHECK_PASSWORD) {
  const login = await request('/contentpreview/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: process.env.YSABEL_CHECK_USERNAME, password: process.env.YSABEL_CHECK_PASSWORD }),
  });
  assert.equal(login.status, 200, 'Existing login must succeed');
  const { authenticated, token } = await login.json();
  assert.equal(authenticated, true);
  assert.equal(typeof token, 'string');
  assert(token.length > 20);
  const headers = { authorization: `Bearer ${token}` };
  const session = await request('/contentpreview/api/auth/session', { headers });
  assert.equal((await session.json()).authenticated, true);
  const workspace = await request('/contentpreview/api/workspace', { headers });
  assert.equal(workspace.status, 200);
  const data = await workspace.json();
  for (const key of ['boards', 'media', 'positions', 'versions', 'notes', 'publications']) assert(Array.isArray(data[key]), key);
  const media = data.media.find(asset => !asset.publicPath && asset.mimeType.startsWith('image/'));
  if (media) {
    const response = await request(`/contentpreview/api/media/${encodeURIComponent(media.id)}?variant=thumbnail&access_token=${encodeURIComponent(token)}`);
    assert([200, 404].includes(response.status), 'A thumbnail is delivered or explicitly not yet generated');
    if (response.ok) assert(response.headers.get('content-type')?.startsWith('image/'));
    await response.body?.cancel();
  }
  console.log('Passed: existing credentials, authenticated session and saved-workspace/media connection.');
}
