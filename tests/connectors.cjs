/* Run with Node 24: node tests/connectors.cjs. No network or real accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sql = new DatabaseSync(':memory:');
for (const name of [
  '0000_organic_tiger_shark.sql',
  '0001_connection_assistant.sql',
  '0002_reporting_sources.sql',
])
  sql.exec(fs.readFileSync(path.join(root, 'drizzle', name), 'utf8'));
const db = {
  prepare(query) {
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        return sql.prepare(query).get(...this.args) || null;
      },
      async all() {
        return { results: sql.prepare(query).all(...this.args) };
      },
      async run() {
        return { meta: sql.prepare(query).run(...this.args) };
      },
    };
  },
  async batch(statements) {
    return Promise.all(statements.map((s) => s.run()));
  },
};
const env = {
  CONNECTOR_SITE_URL: 'https://ysabel.test',
  CONNECTOR_ENCRYPTION_KEY: Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString('base64'),
};
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (id) => {
    const resolved = id.startsWith('@/')
      ? path.join(root, id.slice(2))
      : path.resolve(path.dirname(file), id);
    if (resolved === path.join(root, 'lib/server/db'))
      return {
        database: () => db,
        secrets: () => env,
        requireText: (v) => {
          if (typeof v !== 'string' || !v.trim())
            throw new Error('INPUT:Text required');
          return v.trim();
        },
        requireDate: (v) => {
          if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
            throw new Error('INPUT:Date required');
          return v;
        },
      };
    if (id.startsWith('.') || id.startsWith('@/'))
      return load(resolved + '.ts');
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
const vault = load('lib/server/connector-vault.ts');
const oauth = load('lib/server/connector-oauth.ts');
const sync = load('lib/server/connector-sync.ts');
const analytics = load('lib/analytics.ts');
let responder;
global.fetch = async (url, init) =>
  Response.json(await responder(String(url), init));
const owner = 'test-owner',
  second = 'other-owner';
const grant = (resources) => ({
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  expiresAt: Date.now() + 86400000,
  resources,
  authorizedAt: new Date().toISOString(),
});
const app = {
  clientId: 'test-client',
  clientSecret: 'private-test-secret',
  apiVersion: 'v25.0',
  configId: '123456',
};
async function main() {
  const sealed = await vault.seal({ secret: 'test-only' }, owner);
  assert.notEqual(sealed, await vault.seal({ secret: 'test-only' }, owner));
  assert.deepEqual(await vault.unseal(sealed, owner), { secret: 'test-only' });
  await assert.rejects(vault.unseal(sealed, second));
  const [iv, cipher] = sealed.split('.');
  const tampered = Buffer.from(cipher, 'base64');
  tampered[0] ^= 1;
  await assert.rejects(
    vault.unseal(iv + '.' + tampered.toString('base64'), owner),
  );
  await vault.writeVault(owner, 'app', 'google', app);
  assert.equal(await vault.readVault(second, 'app', 'google'), null);
  assert.ok(
    !sql
      .prepare('SELECT encrypted FROM connector_vault')
      .get()
      .encrypted.includes(app.clientSecret),
  );

  const req = new Request('https://ysabel.test/api/oauth/google/start', {
    method: 'POST',
  });
  const begin = await oauth.beginOAuth(owner, 'google', req);
  const auth = new URL(begin.url);
  assert.equal(auth.origin, 'https://accounts.google.com');
  assert.equal(
    auth.searchParams.get('redirect_uri'),
    'https://ysabel.test/api/oauth/google/callback',
  );
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.match(
    begin.cookie,
    /HttpOnly; SameSite=Lax; Path=\/api\/oauth\/google; Max-Age=600; Secure/,
  );
  const state = auth.searchParams.get('state');
  const stateRow = sql.prepare('SELECT * FROM oauth_states').get();
  assert.equal(stateRow.state_hash, await vault.digest(state));
  assert.notEqual(stateRow.state_hash, state);
  const callback = new Request(
    'https://ysabel.test/api/oauth/google/callback?state=' +
      state +
      '&code=test-code',
    { headers: { cookie: begin.cookie.split(';')[0] } },
  );
  await assert.rejects(oauth.finishOAuth(second, 'google', callback));
  await assert.rejects(
    oauth.finishOAuth(owner, 'google', new Request(callback.url)),
  );
  responder = (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(init.body.get('code_verifier'), stateRow.verifier);
    return {
      access_token: 'issued-access',
      refresh_token: 'issued-refresh',
      expires_in: 3600,
    };
  };
  await oauth.finishOAuth(owner, 'google', callback);
  assert.equal(
    (await vault.readVault(owner, 'grant', 'google')).accessToken,
    'issued-access',
  );
  await assert.rejects(oauth.finishOAuth(owner, 'google', callback));
  const expired = await oauth.beginOAuth(owner, 'google', req);
  sql.prepare('UPDATE oauth_states SET expires_at=0').run();
  await assert.rejects(
    oauth.finishOAuth(
      owner,
      'google',
      new Request(
        'https://ysabel.test/api/oauth/google/callback?code=expired&state=' +
          new URL(expired.url).searchParams.get('state'),
        { headers: { cookie: expired.cookie.split(';')[0] } },
      ),
    ),
  );

  await vault.writeVault(owner, 'app', 'meta', app);
  const meta = new URL((await oauth.beginOAuth(owner, 'meta', req)).url);
  assert.equal(meta.searchParams.get('config_id'), app.configId);
  assert.equal(meta.searchParams.has('scope'), false);
  await vault.writeVault(owner, 'grant', 'meta', grant([]));
  responder = () => ({
    data: [
      {
        id: 'page-one',
        name: 'Ysabel Society',
        access_token: 'private-page-token',
        instagram_business_account: { id: 'ig-one', username: 'ysabelsociety' },
      },
    ],
  });
  const discovered = await oauth.discoverResources(owner, 'meta');
  assert.equal(discovered.resources.length, 2);
  assert.ok(!JSON.stringify(discovered).includes('private-page-token'));
  assert.equal(
    (await vault.readVault(owner, 'grant', 'meta')).resources[0].pageToken,
    'private-page-token',
  );
  await assert.rejects(
    sync.linkResource(second, 'meta', 'facebook', 'page-one'),
  );

  // Current follower observations never fabricate daily view history.
  await vault.writeVault(owner, 'app', 'tiktok', app);
  await vault.writeVault(
    owner,
    'grant',
    'tiktok',
    grant([{ source: 'tiktok', id: 'tt-one', label: 'Ysabel Society' }]),
  );
  responder = () => ({
    data: {
      user: {
        open_id: 'tt-one',
        follower_count: 234,
        likes_count: 987,
        video_count: 18,
      },
    },
    error: { code: 'ok' },
  });
  const social = await sync.linkResource(owner, 'tiktok', 'tiktok', 'tt-one');
  assert.equal(social.records, 1);
  assert.equal(social.snapshot.followers, 234);
  assert.equal(
    sql.prepare('SELECT COUNT(*) AS n FROM account_metrics_daily').get().n,
    1,
  );
  responder = () => ({
    data: { user: { open_id: 'different-account' } },
    error: { code: 'ok' },
  });
  await assert.rejects(sync.syncLinkedSource(owner, 'tiktok'));
  assert.equal(
    sql
      .prepare("SELECT status FROM platform_accounts WHERE channel='TikTok'")
      .get().status,
    'Needs Attention',
  );

  // Google daily observations upsert by account/date and retain availability.
  const resources = [
    { source: 'ga4', id: '1234', label: 'Ysabel Society website' },
    { source: 'ga4', id: '5678', label: 'Replacement website' },
  ];
  await vault.writeVault(owner, 'grant', 'google', grant(resources));
  responder = (url, init) => {
    assert.match(url, /properties\/1234:runReport/);
    assert.equal(init.headers.Authorization, 'Bearer test-access');
    return {
      rows: [
        {
          dimensionValues: [{ value: '20260904' }],
          metricValues: [12, 15, 10, 20].map((value) => ({
            value: String(value),
          })),
        },
      ],
    };
  };
  await sync.linkResource(owner, 'google', 'ga4', '1234');
  await sync.syncLinkedSource(owner, 'ga4');
  const daily = sql
    .prepare(
      "SELECT normalized FROM account_metrics_daily WHERE account_id LIKE '%:ga4:%'",
    )
    .all()
    .map((r) => JSON.parse(r.normalized));
  assert.equal(daily.length, 1);
  assert.equal(analytics.total(daily, 'users'), 12);
  assert.equal(analytics.metricAvailable(daily, 'users'), true);
  assert.equal(analytics.metricAvailable(daily, 'views'), false);
  assert.equal(analytics.metricAvailable([], 'users'), false);
  const exporter = load('lib/exports.ts');
  let exported;
  const createURL = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    exported = blob;
    return 'blob:test-export';
  };
  global.document = { createElement: () => ({ click() {}, remove() {} }) };
  exporter.exportCSV(daily, { start: '2026-09-04', end: '2026-09-04' }, 'live');
  const csv = (await exported.text()).split('\r\n');
  assert.equal(csv[1].split(',')[3], '""');
  assert.equal(csv[1].split(',')[7], '"12"');
  URL.createObjectURL = createURL;
  await assert.rejects(sync.linkResource(owner, 'google', 'ga4', '5678'));
  await assert.rejects(
    sync.linkResource(owner, 'google', 'ga4', 'not-discovered'),
  );

  // An in-flight refresh cannot undo disconnect, and concurrent runs are skipped.
  let release, entered;
  const started = new Promise((r) => (entered = r));
  let blockedOnce = false;
  responder = async () => {
    if (blockedOnce) return { rows: [] };
    blockedOnce = true;
    entered();
    await new Promise((r) => (release = r));
    return { rows: [] };
  };
  const pending = sync.syncLinkedSource(owner, 'ga4');
  await started;
  assert.equal((await sync.syncLinkedSource(owner, 'ga4')).skipped, true);
  sql
    .prepare(
      "UPDATE platform_accounts SET enabled=0,status='Disconnected' WHERE owner=? AND channel='Website'",
    )
    .run(owner);
  sql
    .prepare("DELETE FROM connector_links WHERE owner=? AND source='ga4'")
    .run(owner);
  release();
  await pending;
  assert.equal(
    sql
      .prepare("SELECT enabled FROM platform_accounts WHERE channel='Website'")
      .get().enabled,
    0,
  );
  assert.equal(
    sql
      .prepare("SELECT snapshot FROM connector_links WHERE source='ga4'")
      .get(),
    undefined,
  );
  assert.equal(
    sql.prepare('SELECT COUNT(*) AS n FROM account_metrics_daily').get().n,
    2,
  );

  // Expiring grants refresh without losing the discovered account selection.
  await vault.writeVault(owner, 'grant', 'google', {
    ...grant(resources),
    expiresAt: 0,
  });
  responder = (url, init) => {
    assert.equal(init.body.get('grant_type'), 'refresh_token');
    return {
      access_token: 'renewed-access',
      refresh_token: 'rotated-refresh',
      expires_in: 3600,
    };
  };
  const renewed = await oauth.accessGrant(owner, 'google');
  assert.equal(renewed.refreshToken, 'rotated-refresh');
  assert.deepEqual(renewed.resources, resources);
  assert.equal(
    analytics.dateRange('Last 30 Days', undefined, '2026-10-10').end,
    '2026-10-10',
  );
  console.log(
    'PASS: encrypted storage and owner isolation; OAuth state, cookies, PKCE, expiry and replay; private discovery; snapshot-only social data; Google upserts and metric availability; account selection, refresh locking, disconnect race and token rotation.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.close());
