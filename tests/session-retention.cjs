const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const sql = new DatabaseSync(':memory:');
sql.exec('CREATE TABLE marketing_sessions(token_hash TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE marketing_login_limits(key TEXT,window INTEGER,attempts INTEGER,PRIMARY KEY(key,window));');
const db = {
  prepare(query) {
    return {
      args: [],
      bind(...args) { this.args = args; return this; },
      async first() { return sql.prepare(query).get(...this.args) || null; },
      async all() { return { results: sql.prepare(query).all(...this.args) }; },
      async run() { return { meta: sql.prepare(query).run(...this.args) }; },
    };
  },
  async batch(statements) { return Promise.all(statements.map(s => s.all())); },
};
const env = {
  DB: db,
  CONNECTOR_SITE_URL: 'https://ysabel.test/marketingdata',
  MARKETING_OWNER_ID: 'owner',
  MARKETING_USERNAME: 'fixture-user',
  MARKETING_PASSWORD_SALT: 'fixture-salt',
};
let cookie = '', now = Date.UTC(2026, 8, 11);
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const req = id => {
    if (id === 'cloudflare:workers') return { env };
    if (id === 'next/headers') return { headers: async () => new Headers({ cookie }) };
    if (id === 'next/navigation') return { redirect: to => { throw Error('REDIRECT:' + to); } };
    if (id === '@/app/chatgpt-auth') return {};
    if (id === '@/components/ysabel/login-form') return { default: () => null };
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
    return require(id);
  };
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
function request(method, body, origin = 'https://ysabel.test') {
  return new Request('https://ysabel.test/marketingdata/api/session', {
    method, headers: { cookie, origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function main() {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    let session = load('lib/server/session.ts');
    const api = load('app/api/session/route.ts');
    env.MARKETING_PASSWORD_HASH = await load('lib/password.ts').passwordHash('fixture-password', env.MARKETING_PASSWORD_SALT);
    assert.equal((await api.POST(request('POST', { username: 'fixture-user', password: 'incorrect' }))).status, 401);
    const signedIn = await api.POST(request('POST', { username: 'fixture-user', password: 'fixture-password' }));
    assert.equal(signedIn.status, 200);
    const setCookie = signedIn.headers.get('set-cookie');
    assert(setCookie.includes('Max-Age=31536000') && setCookie.includes('Expires='));
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/marketingdata']) assert(setCookie.includes(attribute));
    assert(!setCookie.includes('fixture-password'));
    cookie = setCookie.split(';')[0];
    const token = session.cookieValue(cookie, session.SESSION_COOKIE);
    let row = sql.prepare('SELECT * FROM marketing_sessions').get();
    assert.notEqual(row.token_hash, token);
    assert.equal(row.expires_at, now + session.SESSION_MAX_AGE * 1000);

    // A browser/worker restart has no in-memory authentication state to recover.
    now += 45 * 86400000;
    cache.clear();
    session = load('lib/server/session.ts');
    assert.equal((await session.getSessionUser()).userId, 'owner');
    const page = load('app/login/page.tsx').default;
    await assert.rejects(() => page({ searchParams: Promise.resolve({ returnTo: '/marketingdata/connections' }) }), /REDIRECT:\/connections$/);
    await assert.rejects(() => page({ searchParams: Promise.resolve({ returnTo: '//evil.test' }) }), /REDIRECT:\/$/);
    assert.equal((await api.PATCH(request('PATCH', undefined, 'https://evil.test'))).status, 403);
    assert.equal(sql.prepare('SELECT expires_at FROM marketing_sessions').get().expires_at, row.expires_at);

    const renewal = await api.PATCH(request('PATCH'));
    assert.equal(renewal.status, 200);
    assert.equal(renewal.headers.get('set-cookie').split(';')[0], cookie);
    assert.equal(sql.prepare('SELECT expires_at FROM marketing_sessions').get().expires_at, now + session.SESSION_MAX_AGE * 1000);
    // Still-valid previous 24-hour sessions are upgraded without another password.
    sql.prepare('UPDATE marketing_sessions SET expires_at=?').run(now + 60000);
    assert.equal((await api.PATCH(request('PATCH'))).status, 200);
    assert.equal(sql.prepare('SELECT expires_at FROM marketing_sessions').get().expires_at, now + session.SESSION_MAX_AGE * 1000);

    env.MARKETING_OWNER_ID = 'different-owner';
    assert.equal(await session.getSessionUser(), null);
    assert.equal((await api.PATCH(request('PATCH'))).status, 401);
    env.MARKETING_OWNER_ID = 'owner';
    const otherDevice = await session.newSession();
    const signedOut = await api.DELETE(request('DELETE'));
    assert.equal(signedOut.status, 200);
    assert(signedOut.headers.get('set-cookie').includes('Max-Age=0'));
    assert.equal(await session.getSessionUser(), null);
    assert.equal((await api.PATCH(request('PATCH'))).status, 401, 'Renewal cannot resurrect a signed-out session');
    cookie = session.SESSION_COOKIE + '=' + otherDevice;
    assert.equal((await session.getSessionUser()).userId, 'owner', 'Signing out affects only this device');
    now += (session.SESSION_MAX_AGE + 1) * 1000;
    assert.equal(await session.getSessionUser(), null);
    assert.equal((await api.PATCH(request('PATCH'))).status, 401, 'Expired sessions cannot renew');
    cookie = '';
    assert.equal((await api.PATCH(request('PATCH'))).status, 401);
    assert((await page({ searchParams: Promise.resolve({}) })) !== undefined);
    console.log('Persistent login: one-year cookie/database expiry, renewal, restart persistence, existing-session upgrade, login bypass, CSRF, expiry and device-specific sign-out pass.');
  } finally {
    Date.now = realNow;
    sql.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
