import * as THREE from 'three';
import { LOGIN_SCENE, paintingLayout } from '@/lib/login-scene-config';

export type PaintingMotion = { focused: boolean; paused: boolean; entering: boolean };
export type PaintingScene = { sync: () => void; destroy: () => void };

/** One unwarped plate. Future cutout layers belong here, never in the HTML form. */
export function createPaintingScene(host: HTMLElement, poster: HTMLImageElement,
  readMotion: () => PaintingMotion, onReady: (ready: boolean) => void): PaintingScene {
  if (!poster.complete || !poster.naturalWidth || !poster.naturalHeight) throw new Error('Painting has not decoded');
  // A fixed-size source keeps DOM layout changes out of the GPU upload path.
  const source = document.createElement('canvas');
  source.width = poster.naturalWidth; source.height = poster.naturalHeight;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('Painting source unavailable');
  sourceContext.drawImage(poster, 0, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power', depth: false, stencil: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'login-painting-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  // Reuse decoded pixels without downloading the painting again.
  const texture = new THREE.Texture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, depthTest: false, depthWrite: false });
  const plate = new THREE.Mesh(geometry, material);
  scene.add(plate);

  let width = 1, height = 1, layout = paintingLayout(1, 1);
  let destroyed = false, failed = false, frame = 0, lastTime = 0, elapsed = 0;
  let x = 0, y = 0, targetX = 0, targetY = 0, strength = 1, entry = 0;
  let prepared = false, verified = false;
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
  const fail = () => { failed = true; stop(); canvas.hidden = true; canvas.classList.remove('is-ready'); onReady(false); };
  renderer.debug.onShaderError = fail;
  const contextLost = (event: Event) => { event.preventDefault(); fail(); };
  canvas.addEventListener('webglcontextlost', contextLost);
  // A driver reset leaves the accessible static poster in place for this visit.

  function verifyFrame() {
    const probe = new THREE.WebGLRenderTarget(8, 8, { depthBuffer: false, stencilBuffer: false });
    const pixels = new Uint8Array(8 * 8 * 4);
    try {
      renderer.setRenderTarget(probe);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(probe, 0, 0, 8, 8, pixels);
      const gl = renderer.getContext();
      const colored = pixels.reduce((count, value, index) => count + (index % 4 === 0 && pixels[index + 3] > 200 && value + pixels[index + 1] + pixels[index + 2] > 24 ? 1 : 0), 0);
      if (failed || gl.isContextLost() || gl.getError() !== gl.NO_ERROR || colored < 8) throw new Error('Painting did not render correctly');
      verified = true;
    } finally { renderer.setRenderTarget(null); probe.dispose(); }
  }

  function draw(dt: number) {
    const state = readMotion();
    if (!state.paused && dt) {
      const follow = 1 - Math.exp(-dt / LOGIN_SCENE.followSeconds);
      strength += ((state.focused ? LOGIN_SCENE.focusStrength : 1) - strength) * follow;
      x += (targetX * layout.settings.travelPx - x) * follow;
      y += (targetY * layout.settings.travelPx - y) * follow;
      elapsed += dt * strength;
      if (state.entering) entry = Math.min(1, entry + dt / (LOGIN_SCENE.entry.durationMs / 1000));
    }
    const phase = elapsed * LOGIN_SCENE.driftRadiansPerSecond;
    const driftX = (Math.sin(phase) * 0.72 + Math.sin(phase * 0.43) * 0.28) * layout.settings.driftPx;
    const driftY = Math.sin(phase * 0.73) * layout.settings.driftPx;
    plate.scale.set(layout.width, layout.height, 1);
    plate.position.set(layout.left + layout.width / 2 - width / 2 + (x + driftX) * strength,
      height / 2 - layout.top - layout.height / 2 - (y + driftY) * strength, 0);
    // A small forward camera move occurs only after an accepted authentication response.
    const idleZoom = (1 - Math.cos(phase * 0.6)) * 0.5 * LOGIN_SCENE.idleZoom * strength;
    camera.zoom = 1 + idleZoom + (LOGIN_SCENE.entry.scale - 1) * (1 - Math.pow(1 - entry, 3));
    camera.updateProjectionMatrix();
    if (!verified) verifyFrame();
    renderer.render(scene, camera);
    if (!prepared && !failed) { prepared = true; canvas.setAttribute('data-frame-verified', 'true'); canvas.classList.add('is-ready'); onReady(true); }
  }

  function tick(time: number) {
    frame = 0;
    if (destroyed || failed || document.hidden || readMotion().paused) { lastTime = 0; return; }
    const delta = lastTime ? (time - lastTime) / 1000 : 1 / layout.settings.fps;
    if (delta >= 1 / layout.settings.fps - 0.001) {
      lastTime = time;
      try { draw(Math.min(delta, 0.1)); } catch { fail(); return; }
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (destroyed || failed) return;
    if (document.hidden || readMotion().paused) { stop(); return; }
    if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
  }

  function resize() {
    if (destroyed || failed) return;
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    layout = paintingLayout(width, height);
    verified = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, layout.settings.pixelRatio));
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    try { if (!document.hidden) draw(0); } catch { fail(); }
    sync();
  }
  const pointerMove = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType !== 'mouse' && event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    // Touches on the glass panel belong to the form; no scroll/pinch event is captured.
    if (event.pointerType !== 'mouse' && event.target instanceof Element && event.target.closest('.login-panel, .login-scene-controls')) return;
    const bounds = host.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / width * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / height * 2 - 1));
  };
  const pointerLeave = () => { targetX = 0; targetY = 0; };
  const pointerEnd = (event: PointerEvent) => { if (event.pointerType !== 'mouse') pointerLeave(); };
  const visibility = () => { if (document.hidden) stop(); else resize(); };
  const observer = new ResizeObserver(resize);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; stop(); observer.disconnect();
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerleave', pointerLeave);
    document.removeEventListener('pointerup', pointerEnd);
    document.removeEventListener('pointercancel', pointerEnd);
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('webglcontextlost', contextLost);
    geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose();
    source.width = 0; source.height = 0;
    renderer.forceContextLoss(); canvas.remove();
  };
  try {
    observer.observe(host);
    document.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('pointerleave', pointerLeave, { passive: true });
    document.addEventListener('pointerup', pointerEnd, { passive: true });
    document.addEventListener('pointercancel', pointerEnd, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    resize();
  } catch { destroy(); throw new Error('Painting scene unavailable'); }
  return { sync, destroy };
}
