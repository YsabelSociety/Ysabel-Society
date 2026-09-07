import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { createHash, randomUUID } from 'node:crypto';
import * as business from '../lib/tiktok-business.ts';

function harness() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    'CREATE TABLE oauth_states(state_hash TEXT PRIMARY KEY,owner TEXT,provider TEXT,nonce_hash TEXT,verifier TEXT,redirect_uri TEXT,expires_at INTEGER)',
  );
  const vault = new Map();
  let exchanges = 0;
  const app = {
    clientId: '123456',
    clientSecret: 'fixture-secret',
    authorizationUrl:
      'https://www.tiktok.com/v2/auth/authorize/?client_key=app&scope=message.list.read',
  };
  vault.set('owner:app:tiktok-business', app);
  const imports = {
    './db': {
      database: () => ({
        prepare: (q) => ({
          bind: (...args) => ({
            run: async () => sql.prepare(q).run(...args),
            first: async () => sql.prepare(q).get(...args),
          }),
        }),
      }),
    },
    './connector-vault': {
      digest: async (s) => createHash('sha256').update(s).digest('base64url'),
      randomToken: () => randomUUID(),
      readVault: async (o, k, p) => vault.get(`${o}:${k}:${p}`) || null,
      writeVault: async (o, k, p, v) => vault.set(`${o}:${k}:${p}`, v),
    },
    './connector-oauth': {
      siteOrigin: () => 'https://ysabelsociety.com/marketingdata',
    },
    '@/lib/app-path': { APP_BASE: '/marketingdata' },
    '@/lib/tiktok-business': business,
  };
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      new URL('../lib/server/tiktok-business.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (n) => imports[n],
    URL,
    URLSearchParams,
    Date,
    JSON,
    Error,
    AbortSignal,
    fetch: async (url, init) => {
      exchanges++;
      assert.equal(
        url,
        'https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/',
      );
      const sent = JSON.parse(init.body);
      assert.equal(
        sent.redirect_uri,
        'https://ysabelsociety.com/marketingdata/api/tiktok-business/callback',
      );
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            access_token: 'fixture-token',
            refresh_token: 'fixture-refresh',
            open_id: 'fixture-account',
            scope: 'message.list.read',
            expires_in: 86400,
            refresh_token_expires_in: 31536000,
          },
        }),
      };
    },
  });
  return { api: exports, vault, sql, exchanges: () => exchanges };
}
const req = new Request(
  'https://ysabelsociety.com/marketingdata/api/tiktok-business',
  { method: 'POST' },
);
async function callback(h) {
  const start = await h.api.startBusinessAuthorization('owner', req);
  assert.match(
    start.cookie,
    /HttpOnly; SameSite=Lax; Path=\/marketingdata\/api\/tiktok-business; Max-Age=600; Secure/,
  );
  const state = new URL(start.url).searchParams.get('state');
  return {
    url:
      'https://ysabelsociety.com/marketingdata/api/tiktok-business/callback?code=fixture-code&state=' +
      state,
    cookie: start.cookie.split(';')[0],
  };
}
test('business OAuth rejects cross-owner, wrong nonce and replay without changing analytics grants', async () => {
  const h = harness();
  h.vault.set('owner:grant:tiktok', { accessToken: 'existing-display' });
  const c = await callback(h);
  await assert.rejects(() =>
    h.api.finishBusinessAuthorization(
      'other',
      new Request(c.url, { headers: { cookie: c.cookie } }),
    ),
  );
  await assert.rejects(() =>
    h.api.finishBusinessAuthorization(
      'owner',
      new Request(c.url, {
        headers: { cookie: 'ys_oauth_tiktok_business=wrong' },
      }),
    ),
  );
  assert.equal(h.exchanges(), 0);
  await h.api.finishBusinessAuthorization(
    'owner',
    new Request(c.url, { headers: { cookie: c.cookie } }),
  );
  assert.equal(h.exchanges(), 1);
  assert.equal(
    h.vault.get('owner:grant:tiktok').accessToken,
    'existing-display',
  );
  assert.equal(
    h.vault.get('owner:grant:tiktok-business').openId,
    'fixture-account',
  );
  await assert.rejects(() =>
    h.api.finishBusinessAuthorization(
      'owner',
      new Request(c.url, { headers: { cookie: c.cookie } }),
    ),
  );
  assert.equal(h.exchanges(), 1);
  h.sql.close();
});
test('expiry and changed app configuration fail before token exchange', async () => {
  for (const reason of ['expired', 'changed']) {
    const h = harness(),
      c = await callback(h);
    if (reason === 'expired')
      h.sql.exec('UPDATE oauth_states SET expires_at=0');
    else
      h.vault.set('owner:app:tiktok-business', {
        ...h.vault.get('owner:app:tiktok-business'),
        clientSecret: 'changed',
      });
    await assert.rejects(() =>
      h.api.finishBusinessAuthorization(
        'owner',
        new Request(c.url, { headers: { cookie: c.cookie } }),
      ),
    );
    assert.equal(h.exchanges(), 0);
    assert.equal(h.vault.has('owner:grant:tiktok-business'), false);
    h.sql.close();
  }
});
