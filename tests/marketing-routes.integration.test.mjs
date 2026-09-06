import test from 'node:test';
import assert from 'node:assert/strict';

const origin = process.env.MARKETING_TEST_ORIGIN;
test('anonymous dashboard entries reach one correctly mounted login', { skip: !origin }, async () => {
  const paths = ['/marketingdata/', '/marketingdata/admin', '/marketingdata/connections'];
  // The public website proxy also normalizes the mount without its final slash.
  if (new URL(origin).hostname === 'ysabelsociety.com') paths.unshift('/marketingdata');
  for (const path of paths) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    const url = new URL(response.url);
    assert.equal(url.pathname, '/marketingdata/login', path);
    const returnTo = url.searchParams.get('returnTo');
    assert.ok(returnTo?.startsWith('/marketingdata/'), path);
    assert.ok(!returnTo.includes('/marketingdata/marketingdata'), path);
    const html = await response.text();
    assert.ok(html.includes('name="username"') && html.includes('name="password"'), path);
  }
});
