const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const sql = new DatabaseSync(':memory:');
sql.exec(
  'CREATE TABLE marketing_login_limits(key TEXT, window INTEGER, attempts INTEGER, PRIMARY KEY(key,window))',
);
const db = {
  prepare(query) {
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async run() {
        return { meta: sql.prepare(query).run(...this.args) };
      },
      async all() {
        return { results: sql.prepare(query).all(...this.args) };
      },
    };
  },
  async batch(statements) {
    return Promise.all(statements.map((s) => s.all()));
  },
};
const env = {
  DB: db,
  CONNECTOR_SITE_URL: 'https://ysabel.test/marketingdata',
  MARKETING_ADMIN_PIN_SALT: 'test-salt',
  MARKETING_ADMIN_SIGNING_KEY: 'test-secret-only-for-this-suite',
};
let cookie = '',
  signedIn = true;
const cache = new Map();
const allowed = new Set([
  'lib/server/db.ts',
  'lib/server/session.ts',
  'lib/server/admin-access.ts',
  'lib/admin-grant.ts',
  'lib/password.ts',
  'lib/app-path.ts',
]);
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const req = (id) => {
    if (id === 'cloudflare:workers') return { env };
    if (id === 'next/headers')
      return { headers: async () => new Headers({ cookie }) };
    if (id === '@/app/chatgpt-auth')
      return {
        getChatGPTUser: async () => (signedIn ? { userId: 'owner' } : null),
      };
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id);
    const p = id.startsWith('@/')
      ? path.resolve(root, id.slice(2) + '.ts')
      : path.resolve(path.dirname(file), id + '.ts');
    if (!allowed.has(path.relative(root, p).replaceAll('\\', '/')))
      return new Proxy(
        {},
        {
          get: () => () => {
            throw Error('Unexpected downstream action before authorization');
          },
        },
      );
    return load(p);
  };
  new Function('require', 'module', 'exports', js)(req, m, m.exports);
  return m.exports;
}
function request(
  method = 'GET',
  body,
  route = 'admin-access',
  origin = 'https://ysabel.test',
) {
  return new Request('https://ysabel.test/marketingdata/api/' + route, {
    method,
    headers: { cookie, origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function main() {
  const session = load('lib/server/session.ts');
  const grants = load('lib/admin-grant.ts');
  const access = load('lib/server/admin-access.ts');
  const api = load('app/api/admin-access/route.ts');
  env.MARKETING_ADMIN_PIN_HASH = await load('lib/password.ts').passwordHash(
    '012345',
    env.MARKETING_ADMIN_PIN_SALT,
  );
  signedIn = false;
  assert.equal(
    (await api.GET(request())).status,
    401,
    'An app login is still required',
  );
  signedIn = true;
  cookie = session.SESSION_COOKIE + '=' + 'a'.repeat(64);
  assert.equal((await (await api.GET(request())).json()).unlocked, false);
  assert.equal(
    (
      await api.POST(
        request('POST', { pin: '012345' }, 'admin-access', 'https://evil.test'),
      )
    ).status,
    403,
    'Cross-origin unlock denied',
  );
  assert.equal(
    (await api.POST(request('POST', { pin: '999999' }))).status,
    403,
    'Wrong PIN rejected',
  );
  assert.equal(
    (await api.POST(request('POST', { pin: 12345 }))).status,
    403,
    'Leading-zero PIN must remain a string',
  );
  const success = await api.POST(request('POST', { pin: '012345' }));
  assert.equal(success.status, 200);
  const grantCookie = success.headers.get('set-cookie');
  assert(
    grantCookie.includes('HttpOnly') &&
      grantCookie.includes('Secure') &&
      grantCookie.includes('SameSite=Strict'),
  );
  cookie += '; ' + grantCookie.split(';')[0];
  assert.equal((await (await api.GET(request())).json()).unlocked, true);
  assert.equal((await access.requireAdmin(request())).userId, 'owner');
  const grantValue = session.cookieValue(cookie, grants.ADMIN_COOKIE),
    subject = await access.adminSubject(request());
  assert.equal(
    await grants.verifyAdminGrant(
      grantValue,
      subject,
      env.MARKETING_ADMIN_SIGNING_KEY,
      Date.now() + 1800001,
    ),
    null,
    'Expired grant denied',
  );
  assert.equal(
    await grants.verifyAdminGrant(
      grantValue + 'x',
      subject,
      env.MARKETING_ADMIN_SIGNING_KEY,
    ),
    null,
    'Tampered grant denied',
  );
  assert.equal(
    await grants.verifyAdminGrant(
      grantValue,
      'different-session',
      env.MARKETING_ADMIN_SIGNING_KEY,
    ),
    null,
    'Cannot copy unlock into another login',
  );
  const lock = await api.DELETE(request('DELETE'));
  assert(lock.headers.get('set-cookie').includes('Max-Age=0'));
  cookie =
    session.SESSION_COOKIE +
    '=' +
    'b'.repeat(64) +
    '; ' +
    grantCookie.split(';')[0];
  await assert.rejects(
    () => access.requireAdmin(request()),
    /ADMIN_PIN_REQUIRED/,
  );
  cookie = session.SESSION_COOKIE + '=' + 'b'.repeat(64);
  for (const [route, methods] of [
    ['connections', ['GET', 'POST']],
    ['connectors', ['GET', 'POST']],
    ['connection-options', ['GET', 'POST']],
    ['instagram-messaging', ['GET', 'POST']],
    ['tiktok-business', ['GET', 'POST']],
    ['oauth/[provider]/start', ['POST']],
    ['state', ['POST']],
  ]) {
    const handlers = load('app/api/' + route + '/route.ts');
    for (const method of methods) {
      const op = route === 'state' ? 'settings' : 'saveApp';
      const r = await handlers[method](
        request(method, method === 'POST' ? { op } : undefined, route),
        { params: Promise.resolve({ provider: 'meta' }) },
      );
      assert.equal(
        r.status,
        403,
        route +
          ' ' +
          method +
          ' requires the PIN before reading or changing settings',
      );
    }
  }
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await api.POST(request('POST', { pin: '000000' }))).status,
      403,
    );
  assert.equal(
    (await api.POST(request('POST', { pin: '012345' }))).status,
    429,
    'Repeated attempts are rate limited even with the right PIN',
  );
  console.log(
    'Admin access passed: PIN/leading zero, CSRF, server gates, expiry, tampering, login binding, lock and attempt limits.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
