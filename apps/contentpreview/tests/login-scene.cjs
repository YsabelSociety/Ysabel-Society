// Non-browser tests: exercise the real scene controller with a lightweight renderer double.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, require: name => { assert(name in imports, name); return imports[name]; }, ...globals });
  return module.exports;
}
const config = load('lib/login-scene-config.ts');
const { LOGIN_SCENE, paintingLayout } = config;
let samples = 0;
for (const width of [240, 320, 390, 430, 700, 701, 1024, 1440, 1920, 3440]) {
  for (const height of [240, 600, 844, 1080, 1440, 2160]) {
    const p = paintingLayout(width, height);
    assert(Math.abs(p.width / p.height - 1280 / 929) < 1e-10, 'Never stretch the painting');
    const travel = p.settings.travelPx + p.settings.driftPx;
    for (const sign of [-1, 1]) {
      assert(p.left + sign * travel <= 0, 'No exposed left edge');
      assert(p.top + sign * travel <= 0, 'No exposed top edge');
      assert(p.left + p.width + sign * travel >= width, 'No exposed right edge');
      assert(p.top + p.height + sign * travel >= height, 'No exposed bottom edge');
    }
    samples++;
  }
}
assert.equal(LOGIN_SCENE.effects.particleCount, 0, 'No invented effect masks');
assert.equal(LOGIN_SCENE.effects.waterStrength, 0);
assert.equal(LOGIN_SCENE.effects.leafStrength, 0);

class Events {
  handlers = new Map();
  addEventListener(name, callback) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(callback); }
  removeEventListener(name, callback) { this.handlers.get(name)?.delete(callback); }
  dispatch(name, data = {}) { this.handlers.get(name)?.forEach(callback => callback(data)); }
}
const document = new Events(); document.hidden = false;
document.createElement = () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) });
let raf = new Map(), rafId = 0, now = 0, renderer, mesh, camera, observer, failNextRender = false, probeIsBlack = false;
const step = (count = 1) => { for (let i = 0; i < count; i++) { now += 34; const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(now)); } };
const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } });
const disposable = class { disposed = false; dispose() { this.disposed = true; } };
const THREE = {
  SRGBColorSpace: 'srgb', NoToneMapping: 0,
  WebGLRenderer: class extends disposable {
    constructor(options) { super(); renderer = this; this.options = options; this.debug = {}; this.renders = 0; this.domElement = new Events(); this.domElement.classList = { add() {}, remove() {} }; this.domElement.setAttribute = () => {}; this.domElement.remove = () => { this.removed = true; }; }
    setClearColor() {} setPixelRatio(value) { this.dpr = value; } setSize(w, h) { this.size = [w, h]; }
    render() { if (failNextRender) throw new Error('Lost GPU'); this.renders++; }
    forceContextLoss() { this.lost = true; }
    setRenderTarget() {}
    readRenderTargetPixels(target, x, y, width, height, pixels) { for (let i = 0; i < pixels.length; i += 4) { pixels[i] = probeIsBlack ? 0 : 80; pixels[i + 3] = 255; } }
    getContext() { return { NO_ERROR: 0, getError: () => 0, isContextLost: () => false }; }
  },
  Scene: class { add() {} },
  WebGLRenderTarget: disposable,
  OrthographicCamera: class { position = vector(); zoom = 1; constructor() { camera = this; } updateProjectionMatrix() {} },
  Texture: class extends disposable { constructor(image) { super(); this.image = image; } },
  PlaneGeometry: disposable,
  MeshBasicMaterial: class extends disposable { constructor(options) { super(); Object.assign(this, options); } },
  Mesh: class { position = vector(); scale = vector(); constructor(geometry, material) { mesh = this; this.geometry = geometry; this.material = material; } },
};
let bounds = { width: 1440, height: 900, left: 0, top: 0 };
const host = { appendChild() {}, getBoundingClientRect: () => bounds };
const { createPaintingScene } = load('components/login-painting-scene.ts', { three: THREE, '@/lib/login-scene-config': config }, {
  document, window: { devicePixelRatio: 3 }, Element: class {},
  requestAnimationFrame: fn => { raf.set(++rafId, fn); return rafId; }, cancelAnimationFrame: id => raf.delete(id),
  ResizeObserver: class { constructor(fn) { observer = this; this.fn = fn; } observe() {} disconnect() { this.disconnected = true; } },
});
let motion = { focused: false, paused: false, entering: false }, ready = false;
const instance = createPaintingScene(host, { complete: true, naturalWidth: 1280, naturalHeight: 929 }, () => motion, value => { ready = value; });
assert(ready); assert.equal(renderer.outputColorSpace, 'srgb'); assert.equal(renderer.dpr, 1.5);
assert.equal(renderer.options.preserveDrawingBuffer, true, 'Paused frames remain available to the compositor');
const neutral = { ...mesh.position };
document.dispatch('pointermove', { pointerType: 'mouse', isPrimary: true, clientX: 1440, clientY: 900 });
step(160);
const fullTravel = Math.abs(mesh.position.x - neutral.x);
assert(fullTravel > 18 && fullTravel < 28, 'Responsive, bounded desktop travel');
assert(camera.zoom < 1 + LOGIN_SCENE.idleZoom, 'No entry zoom before authentication');
motion.focused = true; step(160);
assert(Math.abs(mesh.position.x - neutral.x) < fullTravel * 0.3, 'Motion softens while typing');
motion.paused = true; instance.sync();
const pausedX = mesh.position.x, pausedRenders = renderer.renders;
step(100); assert.equal(mesh.position.x, pausedX); assert.equal(renderer.renders, pausedRenders); assert.equal(raf.size, 0);
motion.paused = false; instance.sync(); step(2);
document.hidden = true; document.dispatch('visibilitychange');
const hiddenRenders = renderer.renders; step(100);
assert.equal(renderer.renders, hiddenRenders); assert.equal(raf.size, 0);
document.hidden = false; document.dispatch('visibilitychange'); step(3);
assert(renderer.renders > hiddenRenders);
motion.entering = true; step(25);
assert(camera.zoom >= LOGIN_SCENE.entry.scale && camera.zoom <= LOGIN_SCENE.entry.scale + LOGIN_SCENE.idleZoom, 'Entry zoom follows genuine-auth state');
bounds = { width: 390, height: 844, left: 0, top: 0 }; observer.fn();
assert.equal(renderer.dpr, 1, 'Mobile resolution is capped');
const mobileX = mesh.position.x;
document.dispatch('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 });
step(160); assert(Math.abs(mesh.position.x - mobileX) < 9, 'Touch input remains gently bounded');
document.dispatch('pointercancel', { pointerType: 'touch' }); step(100);
const centered = paintingLayout(390, 844);
assert(Math.abs(mesh.position.x - (centered.left + centered.width / 2 - 195)) < 3, 'Cancelled touches return softly to idle');
failNextRender = true; step(2); assert.equal(ready, false); assert.equal(raf.size, 0, 'GPU failure stops animation');
instance.destroy(); assert(renderer.disposed && renderer.lost && renderer.removed); assert(observer.disconnected);
assert(mesh.geometry.disposed && mesh.material.disposed && mesh.material.map.disposed);
assert([...document.handlers.values()].every(handlers => handlers.size === 0), 'No listeners left after leaving login');

failNextRender = false; probeIsBlack = true;
const readiness = [];
const blackInstance = createPaintingScene(host, { complete: true, naturalWidth: 1280, naturalHeight: 929 }, () => motion, ready => readiness.push(ready));
assert.deepEqual(readiness, [false], 'A silently black GPU frame is never declared ready');
assert.equal(renderer.domElement.hidden, true, 'Failed canvas cannot cover the original painting');
assert.equal(raf.size, 0); blackInstance.destroy();
assert([...document.handlers.values()].every(handlers => handlers.size === 0), 'Black-frame failure releases listeners');
probeIsBlack = false;

// Protect authentication ordering and original server implementation from styling edits.
const workspace = fs.readFileSync(path.join(root, 'components/ysabel-workspace.tsx'), 'utf8');
const loginHandler = workspace.slice(workspace.indexOf('const submitLogin ='), workspace.indexOf('const logout ='));
assert(loginHandler.indexOf('if (!response.ok)') < loginHandler.indexOf('setLoginEntering(true)'));
assert(loginHandler.includes("data.authenticated !== true"));
assert(loginHandler.indexOf('setAuthToken(token)') < loginHandler.indexOf('setLoginEntering(true)'));
assert(workspace.includes("required autoComplete=\"username\""));
console.log(`Passed: ${samples} crop/overscan cases; color setup; focus; pause; hidden tabs; mobile limits; entry gating; GPU failure; cleanup.`);

if (process.env.YSABEL_TEST_MODULES) {
  const sharp = require(path.join(process.env.YSABEL_TEST_MODULES, 'sharp'));
  Promise.all(['login-landscape-original.png', 'login-landscape.webp'].map(file => sharp(path.join(root, 'public', file)).raw().toBuffer())).then(([original, compressed]) => {
    assert(original.equals(compressed), 'Lossless artwork pixels must match');
    console.log('Passed: displayed artwork is pixel-identical to supplied painting.');
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
