import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const clientRoot = 'apps/contentpreview/';
const workspace = read(clientRoot + 'components/ysabel-workspace.tsx');
const require = createRequire(resolve(root, clientRoot, 'package.json'));
const ts = require('typescript');
const mediaFunction = workspace.slice(workspace.indexOf('function mediaUrl('), workspace.indexOf('type MediaVariant'));
const mediaUrl = vm.runInNewContext(ts.transpileModule(mediaFunction, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nmediaUrl');

test('website page loads its own built preview, not an external app iframe', () => {
  const page = read('src/app/contentpreview/page.tsx');
  assert(page.includes('src="/contentpreview-app/index.html"'));
  assert(!page.includes('chatgpt.site'));
});

test('preview build tools are installed even when the build environment is production', () => {
  assert(read('scripts/build-contentpreview.mjs').includes("'--include=dev'"));
});

test('production builds bound memory and keep website style scanning isolated', () => {
  assert(read('next.config.ts').includes('webpackMemoryOptimizations: true'));
  assert(read('src/app/globals.css').includes('@import "tailwindcss" source("../")'));
});

test('API routing is restricted to the preview and keeps the existing data server', () => {
  const config = read('next.config.ts');
  assert(config.includes('source: "/contentpreview/api/:path*"'));
  assert(config.includes('https://ysabel-society-media-preview.arberhalili1.chatgpt.site/api/:path*'));
  assert(!config.includes('source: "/:path*"'));
  for (const endpoint of ['auth/login', 'auth/logout', 'auth/session', 'workspace', 'media']) {
    assert(workspace.includes(`/contentpreview/api/${endpoint}`), endpoint);
  }
});

test('stored media and carousel URLs retain their IDs and use the protected API', () => {
  assert.equal(mediaUrl({ id: 'a', url: '/api/media/a' }, 'session'), '/contentpreview/api/media/a?access_token=session');
  assert.equal(mediaUrl({ id: 'a', url: '/contentpreview/api/media/a?old=1' }, 'new session'), '/contentpreview/api/media/a?access_token=new%20session');
  assert.equal(mediaUrl({ id: 'a', url: '' }, 'session'), '/contentpreview/api/media/a?access_token=session');
  assert.equal(mediaUrl({ id: 'a', url: 'blob:temporary' }, 'session'), 'blob:temporary');
  assert.equal(mediaUrl({ id: 'a', publicPath: '/seed-food.png', url: '' }, 'session'), '/contentpreview-app/seed-food.png');
  assert.equal(mediaUrl({ id: 'a', url: 'https://example.com/image.jpg' }, 'session'), 'https://example.com/image.jpg');
});

test('painting, logo, fonts and video engine belong to the isolated preview build', () => {
  assert(read(clientRoot + 'lib/login-scene-config.ts').includes('/contentpreview-app/login-landscape.webp'));
  assert(read(clientRoot + 'components/ysabel-login-logo.tsx').includes('/contentpreview-app/login-wordmark.webp'));
  assert(workspace.includes('`/contentpreview-app/ffmpeg/${name}`'));
  for (const asset of ['login-landscape.webp', 'login-landscape-original.png', 'login-wordmark.webp', 'login-logo-original.png', 'ffmpeg/ffmpeg-core.js', 'ffmpeg/ffmpeg-core.wasm.gz']) {
    assert(existsSync(resolve(root, clientRoot, 'public', asset)), asset);
  }
  const build = read(clientRoot + 'vite.config.ts');
  assert(build.includes("outDir: '../../public/contentpreview-app'"));
  assert(!build.includes("outDir: '../../public'"));
});

test('login cannot fade the painting or authenticate without a server result', () => {
  const styles = read(clientRoot + 'styles.css');
  assert(!/\.login-screen\.is-entering\s*\{/.test(styles));
  assert(styles.includes('.login-painting-canvas.is-ready { visibility: visible; }'));
  const login = workspace.slice(workspace.indexOf('const submitLogin ='), workspace.indexOf('const logout ='));
  assert(login.indexOf('if (!response.ok)') < login.indexOf('setLoginEntering(true)'));
  assert(login.includes('data.authenticated !== true'));
});
