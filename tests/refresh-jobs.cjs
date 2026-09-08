const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..'),
  sql = new DatabaseSync(':memory:');
for (const name of fs
  .readdirSync(path.join(root, 'drizzle'))
  .filter((n) => n.endsWith('.sql'))
  .sort())
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
  async batch(items) {
    return Promise.all(items.map((s) => s.run()));
  },
};
let authorized = true,
  seen = [],
  pages = 0;
const env = {
  MARKETING_OWNER_ID: 'owner',
  MARKETING_SYNC_SECRET: 's'.repeat(64),
  MARKETING_SYNC_SCHEDULE: 'Daily at 02:17 UTC',
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
        json: (v) => Response.json(v),
        identity: async (req) => {
          if (!authorized) throw new Error('UNAUTHORIZED');
          if (
            req.method === 'POST' &&
            req.headers.get('origin') !== 'https://ysabel.test'
          )
            throw new Error('FORBIDDEN');
          return { userId: 'owner' };
        },
        apiError: (e) =>
          Response.json(
            { error: e.message },
            {
              status:
                e.message === 'UNAUTHORIZED'
                  ? 401
                  : e.message === 'FORBIDDEN'
                    ? 403
                    : 400,
            },
          ),
      };
    if (resolved === path.join(root, 'lib/server/connector-sync'))
      return {
        syncLinkedSource: async (owner, source, range) => {
          seen.push([source, 'reports', owner, range]);
          await new Promise((r) => setTimeout(r, 5));
          if (source === 'instagram') throw new Error('private-token-error');
          return { snapshot: { partial: false } };
        },
      };
    if (resolved === path.join(root, 'lib/server/community-sync'))
      return {
        runCommunitySync: async (
          owner,
          source,
          continuation,
          automatic,
          kind,
        ) => {
          seen.push([source, kind || 'message', owner, continuation]);
          if (source === 'instagram') return { needsAttention: true };
          if (source === 'facebook' && !kind) return { more: ++pages < 3 };
          return { more: false };
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
for (const [source, provider, auto, enabled] of [
  ['facebook', 'meta', 1, 1],
  ['instagram', 'meta', 1, 1],
  ['ga4', 'google', 1, 1],
  ['gbp', 'file', 0, 1],
  ['tiktok', 'tiktok', 0, 1],
  ['meta-ads', 'meta', 1, 0],
]) {
  sql
    .prepare(
      'INSERT INTO connector_links(owner,source,provider,external_id,label,auto_sync)VALUES(?,?,?,?,?,?)',
    )
    .run('owner', source, provider, '123', source, auto);
  sql
    .prepare(
      'INSERT INTO platform_accounts(id,owner,channel,unit,external_id,enabled,status)VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      'owner:' + source + ':123',
      'owner',
      source,
      'Ysabel Society',
      '123',
      enabled,
      'Connected',
    );
}
async function main() {
  const jobs = load('lib/server/refresh-jobs.ts');
  let job = await jobs.startRefresh('owner', 'manual', true);
  assert.equal(job.tasks.length, 11);
  assert.equal(job.tasks.find((t) => t.source === 'gbp').state, 'manual');
  assert.equal((await jobs.startRefresh('owner', 'manual', true)).id, job.id);
  const before = seen.length;
  await Promise.all([
    jobs.stepRefresh('owner', job.id),
    jobs.stepRefresh('owner', job.id),
  ]);
  assert.equal(
    seen.length,
    before + 1,
    'Concurrent callers must claim only one step',
  );
  for (let i = 0; i < 40; i++) {
    job = await jobs.stepRefresh('owner', job.id);
    if (job.status !== 'running') break;
  }
  assert.equal(job.status, 'partial');
  assert.equal(
    job.tasks.find((t) => t.source === 'ga4').state,
    'updated',
    'Failure must not stop later platforms',
  );
  assert(
    seen.some((t) => t[0] === 'tiktok'),
    'Manual refresh includes connected sources with automatic import paused',
  );
  assert(
    !seen.some((t) => t[0] === 'gbp' || t[0] === 'meta-ads'),
    'No file or disabled accounts may be revived',
  );
  assert.equal(pages, 3);
  assert(
    seen.some(
      (t) => t[0] === 'facebook' && t[1] === 'message' && t[3] === true,
    ),
    'More pages must continue',
  );
  assert(
    !JSON.stringify(job).includes('private-token'),
    'Raw adapter errors must not leak',
  );
  assert(seen.every((t) => t[2] === 'owner'));
  let inbox = await jobs.startRefresh('owner', 'scheduled', true, 'inbox');
  assert.deepEqual(inbox.tasks.map(t => [t.source, t.kind]), [['facebook', 'message'], ['instagram', 'message']]);
  for (let i = 0; i < 40 && inbox.status === 'running'; i++) inbox = await jobs.stepRefresh('owner', inbox.id);
  const scheduled = await jobs.startRefresh('owner', 'scheduled', true);
  assert.equal(
    scheduled.tasks.find((t) => t.source === 'tiktok').state,
    'manual',
    'Scheduled refresh honors pause',
  );
  const route = load('app/api/refresh/route.ts');
  const req = (body, headers = {}) =>
    new Request('https://ysabel.test/api/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  authorized = false;
  assert.equal((await route.POST(req({ op: 'start' }))).status, 401);
  assert.equal(
    (await route.POST(req({ op: 'start' }, { authorization: 'Bearer bad' })))
      .status,
    401,
  );
  assert.equal(
    (
      await route.POST(
        req(
          { op: 'start', owner: 'attacker' },
          { authorization: 'Bearer ' + env.MARKETING_SYNC_SECRET },
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    sql
      .prepare('SELECT COUNT(*) AS n FROM refresh_jobs WHERE owner=?')
      .get('attacker').n,
    0,
  );
  authorized = true;
  assert.equal(
    (
      await route.POST(
        req({ op: 'start' }, { origin: 'https://attacker.test' }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await route.POST(
        req({ op: 'step', id: 'wrong' }, { origin: 'https://ysabel.test' }),
      )
    ).status,
    400,
  );
  const result = await route.GET(
    new Request('https://ysabel.test/api/refresh'),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).schedule, env.MARKETING_SYNC_SCHEDULE);
  console.log(
    'Refresh jobs: authentication, CSRF, owner isolation, concurrency, failure isolation, pagination, paused/file sources and schedule status passed.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
