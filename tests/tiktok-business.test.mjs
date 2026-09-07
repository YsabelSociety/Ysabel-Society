import assert from 'node:assert/strict';
import test from 'node:test';
import {
  businessAuthorizationUrl,
  businessTokenResult,
} from '../lib/tiktok-business.ts';

const source =
  'https://www.tiktok.com/v2/auth/authorize/?client_key=official-key&scope=message.list.read,biz.brand.insights';
const callback =
  'https://ysabelsociety.com/marketingdata/api/tiktok-business/callback';
test('business sign-in uses only the trusted TikTok host and owned callback', () => {
  const u = new URL(
    businessAuthorizationUrl(
      source +
        '&redirect_uri=https://wrong.example/&state=old&redirect_url=https://wrong.example/',
      callback,
      'new-state',
    ),
  );
  assert.equal(u.origin, 'https://www.tiktok.com');
  assert.equal(u.searchParams.get('redirect_uri'), callback);
  assert.equal(u.searchParams.get('state'), 'new-state');
  assert.equal(u.searchParams.get('disable_auto_auth'), '1');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.has('redirect_url'), false);
  assert.equal(
    u.searchParams.get('scope'),
    'message.list.read,biz.brand.insights',
  );
});
test('rejects credential-bearing URLs, lookalike hosts and duplicate identity keys', () => {
  for (const u of [
    source.replace('www.tiktok.com', 'www.tiktok.com.evil.test'),
    source.replace('https:', 'http:'),
    source.replace('/v2/auth/authorize/', '/login'),
    source + '&client_secret=private',
    source + '&code=private',
    source + '&access_token=private',
    source + '&client_key=other',
    source + '#fragment',
    source.replace('https://', 'https://user:password@'),
  ])
    assert.throws(() => businessAuthorizationUrl(u, callback, 's'), /INPUT:/);
});
const valid = {
  code: 0,
  data: {
    access_token: 'access',
    refresh_token: 'refresh',
    open_id: 'owner-account',
    scope: 'message.list.read',
    expires_in: 86400,
    refresh_token_expires_in: 31536000,
  },
};
test('stores business authorization separately with provider lifetimes', () => {
  const g = businessTokenResult(valid, '123456', 1000);
  assert.equal(g.clientId, '123456');
  assert.equal(g.openId, 'owner-account');
  assert.equal(g.expiresAt, 86401000);
  assert.equal(g.refreshExpiresAt, 31536001000);
});
test('rejects denied or partial exchanges without exposing provider error payloads', () => {
  for (const result of [
    { code: 401, message: 'secret-response', data: valid.data },
    { code: 0, data: { ...valid.data, refresh_token: '' } },
    { code: 0, data: { ...valid.data, open_id: '' } },
    { code: 0, data: { ...valid.data, expires_in: 0 } },
    { code: 0, data: { ...valid.data, expires_in: '86400' } },
  ]) {
    assert.throws(
      () => businessTokenResult(result, '123456'),
      (e) =>
        e.message.startsWith('INPUT:') &&
        !e.message.includes('secret-response'),
    );
  }
});
