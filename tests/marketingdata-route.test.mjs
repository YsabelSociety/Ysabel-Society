import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/marketingdata/[[...path]]/route.ts';

test('Instagram authorization keeps the exact state cookie through the callback proxy', async t => {
  t.mock.method(globalThis, 'fetch', async (target, init) => {
    assert.equal(target.pathname, '/marketingdata/api/instagram-messaging/callback');
    assert.equal(target.searchParams.get('state'), 'test-state');
    assert.equal(target.searchParams.get('code'), 'test-code');
    assert.equal(init.headers.get('cookie'), 'ys_marketing_session=sample; ys_instagram_login=test-nonce');
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 303, headers: {
      Location: 'https://ysabelsociety.com/marketingdata/?instagramLogin=authorized#Inbox',
      'Set-Cookie': 'ys_instagram_login=; HttpOnly; SameSite=Lax; Path=/marketingdata/api/instagram-messaging; Max-Age=0; Secure',
    } });
  });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/api/instagram-messaging/callback?state=test-state&code=test-code', { headers: {
    cookie: '_ga=unrelated; ys_marketing_session=sample; ys_instagram_login=test-nonce; ys_instagram_login_extra=unrelated; instagram_session=unrelated',
  } }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://ysabelsociety.com/marketingdata/?instagramLogin=authorized#Inbox');
  assert.match(response.headers.get('set-cookie'), /ys_instagram_login=; HttpOnly; SameSite=Lax;/);
});

test('the dashboard proxy cannot forward forged identity or unrelated website cookies', async t => {
  t.mock.method(globalThis, 'fetch', async (target, init) => {
    assert.equal(target.origin, 'https://ysabel-society-intelligence.arberhalili1.chatgpt.site');
    assert.equal(target.pathname, '/marketingdata/api/state');
    assert.equal(target.search, '?value=https://untrusted.example');
    assert.equal(init.headers.get('oai-authenticated-user-id'), null);
    assert.equal(init.headers.get('authorization'), null);
    assert.equal(init.headers.get('cookie'), 'ys_marketing_session=sample');
    return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/api/state?value=https://untrusted.example', { headers: { 'oai-authenticated-user-id': 'forged', authorization: 'Bearer untrusted', cookie: '_ga=unrelated; ys_marketing_session=sample; site_admin=unrelated' } }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('the root mount gains a slash and login redirects retain secure cookies', async t => {
  t.mock.method(globalThis, 'fetch', async (target) => {
    assert.equal(target.pathname, '/marketingdata/');
    return new Response(null, { status: 303, headers: { Location: 'https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/login?returnTo=%2Fmarketingdata', 'Set-Cookie': 'ys_marketing_session=sample; HttpOnly; Secure; SameSite=Lax; Path=/marketingdata' } });
  });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata'));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/marketingdata/login?returnTo=%2Fmarketingdata');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax; Path=\/marketingdata/);
});

test('an interrupted refresh is reported as a failure', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('timeout'); });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/api/connectors'));
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /may still be finishing/);
});

test('the dashboard PIN grant reaches its server without forwarding other admin cookies', async t => {
  t.mock.method(globalThis, 'fetch', async (target, init) => {
    assert.equal(target.pathname, '/marketingdata/api/admin-access');
    assert.equal(init.headers.get('cookie'), 'ys_marketing_session=sample; ys_marketing_admin=signed-grant');
    return Response.json({ unlocked: true }, { headers: { 'Set-Cookie': 'ys_marketing_admin=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/marketingdata' } });
  });
  const response = await GET(new Request('https://ysabelsociety.com/marketingdata/api/admin-access', { headers: { cookie: 'ys_marketing_session=sample; ys_marketing_admin=signed-grant; ys_marketing_administrator=unrelated; site_admin=unrelated' } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
});
