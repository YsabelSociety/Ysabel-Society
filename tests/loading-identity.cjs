const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const req = (id) => {
    if (id.endsWith('.module.css'))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      };
    if (id.endsWith('.json'))
      return JSON.parse(
        fs.readFileSync(path.resolve(path.dirname(file), id), 'utf8'),
      );
    if (id.startsWith('.') || id.startsWith('@/')) {
      const candidate = id.startsWith('@/')
        ? path.resolve(root, id.slice(2))
        : path.resolve(path.dirname(file), id);
      const resolved = ['.tsx', '.ts']
        .map((ext) => candidate + ext)
        .find(fs.existsSync);
      if (!resolved) throw new Error('Missing local import: ' + id);
      return load(resolved);
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(req, m, m.exports);
  return m.exports;
}

const originalSvg = fs.readFileSync(
  path.join(root, 'public/ysabel-emblem-source.svg'),
  'utf8',
);
const originalPaths = [
  ...originalSvg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g),
].map((match) => match[1]);
const embeddedPaths = JSON.parse(
  fs.readFileSync(
    path.join(root, 'components/ysabel/emblem-paths.json'),
    'utf8',
  ),
);
assert.deepEqual(
  embeddedPaths,
  originalPaths,
  'Immediate emblem uses the exact supplied paths',
);
const { WorkspaceIntro } = load('components/ysabel/workspace-intro.tsx');
for (const [props, caption] of [
  [{}, 'Loading your marketing data…'],
  [{ signingIn: true }, 'Signing in…'],
  [{ complete: true }, 'Your marketing data is ready.'],
  [{ error: 'Request failed' }, 'Your data could not finish loading.'],
]) {
  const html = renderToStaticMarkup(React.createElement(WorkspaceIntro, props));
  assert(html.includes('data-rendered="false"'));
  assert(
    html.includes('class="gpu"'),
    'GPU group stays hidden until the matching brand group is ready',
  );
  assert(html.includes('class="fallbackGroup"'));
  assert(
    html.includes('data-loading-identity="fallback"'),
    'Logo and caption are grouped before GPU startup',
  );
  assert(html.includes('fill="#1d3428"'));
  for (const d of originalPaths)
    assert(
      html.includes('d="' + d + '"'),
      'Logo exists without any image/network request',
    );
  assert(html.includes(caption));
  assert(
    html.includes('ysabel-society-logo.png'),
    'Original script wordmark accompanies the emblem',
  );
  assert(
    !html.includes('<span class="fallback">'),
    'No standalone visible loading text',
  );
}
console.log(
  'Loading identity: original inline emblem and paired caption are present on the first render, including sign-in, ready and failure states.',
);
