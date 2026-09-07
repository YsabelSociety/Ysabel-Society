const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const root = path.resolve(__dirname, '..');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Exercise hook lifecycles with controlled network responses and events.
function harness() {
  const slots = [],
    effects = [];
  let cursor = 0,
    dirty = true,
    output;
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (v) => {
          const next = typeof v === 'function' ? v(slots[i]) : v;
          if (!Object.is(next, slots[i])) {
            slots[i] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      return hooks.useState(() => ({ current: initial }))[0];
    },
    useEffect(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) {
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => {
          slots[i].cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  return {
    hooks,
    render(fn) {
      dirty = true;
      for (let n = 0; dirty && n < 20; n++) {
        dirty = false;
        cursor = 0;
        output = fn();
        effects.splice(0).forEach((e) => e());
      }
      return output;
    },
    cleanup() {
      slots.forEach((s) => s?.cleanup?.());
    },
  };
}
function load(file, hooks, cache = new Map()) {
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
  const req = (id) =>
    id === 'react'
      ? hooks
      : id.startsWith('@/')
        ? load(id.slice(2) + '.ts', hooks, cache)
        : id.startsWith('.')
          ? load(path.resolve(path.dirname(file), id) + '.ts', hooks, cache)
          : require(id);
  new Function('require', 'module', 'exports', js)(req, m, m.exports);
  return m.exports;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function verifyIntro() {
  const source = ts.createSourceFile(
    'intro.tsx',
    fs.readFileSync(
      path.join(root, 'components/ysabel/workspace-intro.tsx'),
      'utf8',
    ),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const subset = source.statements
    .filter(
      (s) =>
        (ts.isFunctionDeclaration(s) &&
          ['WorkspaceIntro', 'useWorkspaceIntro'].includes(s.name?.text)) ||
        (ts.isVariableStatement(s) &&
          s.declarationList.declarations.some(
            (d) => d.name.getText(source) === 'INTRO_TIMING',
          )),
    )
    .map((s) => s.getText(source))
    .join('\n');
  const compiled = ts.transpileModule(subset, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const original = {
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    matchMedia: global.matchMedia,
    sessionStorage: global.sessionStorage,
  };
  let now = 0,
    nextId = 0;
  const timers = new Map();
  global.setTimeout = (fn, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { fn, time: now + delay });
    return id;
  };
  global.clearTimeout = (id) => timers.delete(id);
  global.matchMedia = () => ({ matches: false });
  global.sessionStorage = { removeItem() {} };
  const advance = (ms) => {
    now += ms;
    for (const [id, t] of [...timers])
      if (t.time <= now) {
        timers.delete(id);
        t.fn();
      }
  };
  function setup(ready) {
    const h = harness(),
      m = { exports: {} };
    new Function(
      'require',
      'module',
      'exports',
      'useState',
      'useEffect',
      'styles',
      'RefreshCw',
      'INTRO_KEY',
      compiled,
    )(
      require,
      m,
      m.exports,
      h.hooks.useState,
      h.hooks.useEffect,
      new Proxy({}, { get: (_, name) => String(name) }),
      () => null,
      'test-intro',
    );
    return {
      h,
      m,
      render: (value) =>
        h.render(() =>
          m.exports.useWorkspaceIntro(value === undefined ? ready : value),
        ),
    };
  }
  try {
    const fast = setup(true),
      timing = fast.m.exports.INTRO_TIMING;
    assert(fast.render().visible);
    advance(timing.minimum);
    fast.render();
    advance(timing.settle - 1);
    assert.equal(fast.render().leaving, false);
    advance(1);
    assert.equal(fast.render().leaving, true);
    advance(timing.exit - 1);
    assert.equal(fast.render().visible, true);
    advance(1);
    assert.equal(fast.render().visible, false);
    assert.equal(
      fast.render(false).visible,
      false,
      'Background refresh does not reopen the intro',
    );
    fast.h.cleanup();
    const slow = setup(false);
    slow.render();
    advance(30000);
    assert.equal(
      slow.render().visible,
      true,
      'Slow or failed data cannot time out into an empty dashboard',
    );
    slow.render(true);
    advance(timing.settle);
    assert.equal(slow.render(true).leaving, true);
    assert.equal(
      slow.render(false).leaving,
      false,
      'A changed date range cancels an in-progress reveal',
    );
    advance(timing.exit + 1);
    assert.equal(slow.render(false).visible, true);
    slow.render(true);
    advance(timing.settle);
    slow.render(true);
    advance(timing.exit);
    assert.equal(slow.render(true).visible, false);
    const html = renderToStaticMarkup(
      React.createElement(slow.m.exports.WorkspaceIntro, {
        error: 'Request failed',
        onRetry() {},
      }),
    );
    assert(
      !html.includes('<img'),
      'No static logo appears in the loading overlay',
    );
    assert(
      html.includes('Retry loading') && html.includes('role="alert"'),
      'Loading failures offer a retry',
    );
    slow.h.cleanup();
  } finally {
    Object.assign(global, original);
  }
}
async function main() {
  global.window = new EventTarget();
  global.document = new EventTarget();
  document.visibilityState = 'visible';
  const h = harness(),
    { useSourceAnalytics } = load(
      'components/ysabel/use-analytics.ts',
      h.hooks,
    );
  const pending = [];
  global.fetch = (url) =>
    new Promise((resolve) => pending.push({ url, resolve }));
  let range = { start: '2026-09-01', end: '2026-09-07' };
  const render = () =>
    h.render(() =>
      useSourceAnalytics('Ysabel Society', range, 'No Comparison'),
    );
  const payload = (value) => ({
    mode: 'live',
    rows: [
      {
        date: '2026-09-07',
        channel: 'Instagram',
        available: ['views'],
        views: value,
      },
    ],
    coverage: [],
    sourceStatus: [],
    posts: [],
    tables: [],
  });
  assert.equal(render().loading, true);
  pending[0].resolve(Response.json(payload(100)));
  await settle();
  assert.equal(render().rows[0].views, 100);
  assert.equal(
    render().ready,
    true,
    'Initial reports are ready only after a successful response',
  );
  window.dispatchEvent(new Event('ysabel:sources-updated'));
  const background = render();
  assert.equal(
    background.loading,
    false,
    'Background refresh must never replace loaded charts',
  );
  assert.equal(background.refreshing, true);
  assert.equal(
    background.rows[0].views,
    100,
    'Keep existing data until replacement arrives',
  );
  window.dispatchEvent(new Event('scroll'));
  render();
  assert.equal(pending.length, 2, 'Scrolling must not fetch analytics');
  pending[1].resolve(Response.json(payload(125)));
  await settle();
  assert.equal(
    render().rows[0].views,
    125,
    'Fresh reports still update the visible chart',
  );
  window.dispatchEvent(new Event('ysabel:sources-updated'));
  render();
  pending[2].resolve(
    Response.json({ error: 'Source unavailable' }, { status: 503 }),
  );
  await settle();
  assert.equal(
    render().rows[0].views,
    125,
    'Failed background requests retain loaded data',
  );
  range = { start: '2026-08-01', end: '2026-08-07' };
  const changed = render();
  assert.equal(
    changed.ready,
    false,
    'A previous result must not end the intro for a newly selected range',
  );
  assert.equal(
    changed.loading,
    true,
    'A different date range must load its own data',
  );
  assert.equal(
    changed.rows.length,
    0,
    'Never label old-range data as a newly selected period',
  );
  h.cleanup();

  const auto = harness(),
    { useAutoRefresh } = load(
      'components/ysabel/use-auto-refresh.ts',
      auto.hooks,
    );
  const events = [];
  window = new EventTarget();
  for (const type of ['ysabel:sources-updated', 'ysabel:community-updated'])
    window.addEventListener(type, () => events.push(type));
  let steps = 0;
  const job = (step) => ({
    id: 'run-1',
    status: step >= 22 ? 'complete' : 'running',
    completed: step >= 2 ? 1 : 0,
    updatedAt: '2026-09-07T01:00:00Z',
    tasks: [
      {
        kind: 'reports',
        source: 'ga4',
        state: step >= 2 ? 'updated' : 'pending',
        pages: 0,
      },
      {
        kind: 'message',
        source: 'facebook',
        state: step >= 22 ? 'updated' : 'pending',
        pages: step,
      },
    ],
  });
  global.fetch = async (url, init) => {
    if (!init?.body) return Response.json({ schedule: 'Daily' });
    const body = JSON.parse(init.body);
    return Response.json(job(body.op === 'step' ? ++steps : 0));
  };
  const originalInterval = global.setInterval;
  global.setInterval = () => 1;
  try {
    auto.render(() => useAutoRefresh(true));
    await settle();
    await settle();
    auto.render(() => useAutoRefresh(true));
    assert.equal(steps, 22);
    assert.deepEqual(
      events,
      ['ysabel:sources-updated', 'ysabel:community-updated'],
      'Many inbox pages publish one report update, then one community update',
    );
  } finally {
    auto.cleanup();
    global.setInterval = originalInterval;
  }

  // A loaded off-screen chart renders immediately, independent of viewport state.
  const source = ts.createSourceFile(
    'chart.tsx',
    fs.readFileSync(
      path.join(root, 'components/ysabel/social-performance.tsx'),
      'utf8',
    ),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = source.statements.find(
    (s) => ts.isFunctionDeclaration(s) && s.name?.text === 'DeferredChart',
  );
  const js = ts.transpileModule(declaration.getText(source), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const m = { exports: {} };
  new Function(
    'require',
    'module',
    'exports',
    'ChartBoundary',
    'useRef',
    'useState',
    'useEffect',
    js,
  )(
    require,
    m,
    m.exports,
    (p) => p.children,
    React.useRef,
    React.useState,
    React.useEffect,
  );
  const html = renderToStaticMarkup(
    React.createElement(
      m.exports.DeferredChart,
      { loading: false, title: 'Views' },
      React.createElement('strong', null, 'Loaded chart'),
    ),
  );
  assert(html.includes('Loaded chart'));
  assert(
    !html.includes('Chart loads as you scroll') &&
      !html.includes('Loading source data'),
  );
  verifyIntro();
  console.log(
    'Dashboard refresh: loaded charts persist, scrolling is read-free, new periods stay scoped, failed refreshes retain data, inbox batches do not reload analytics, and off-screen charts render immediately.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
