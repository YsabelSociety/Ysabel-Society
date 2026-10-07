"use client";
import { useEffect, useRef, useState } from 'react';
import { Layers3, Pause, Play, RotateCcw, Plus, Minus, Maximize2, Camera } from 'lucide-react';
import { canvasPixelRatio, releaseRenderer } from '@/lib/render-budget';
import styles from './overview-maison.module.css';

const venues = [
  { id: 'garden', name: 'Ysabel Garden', y: 28.2, color: '#8bb5a4' },
  { id: 'asian', name: 'Ysabel Asian', y: 26.3, color: '#d89695' },
  { id: 'italian', name: 'Ysabel Italian', y: 24.1, color: '#dec586' },
];
type Runtime = { update(): void; preset(roof: boolean): void; zoom(factor: number): void; snapshot(): void };

export function YsabelBuilding() {
  const host = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const runtime = useRef<Runtime | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [paused, setPaused] = useState(false);
  const [separated, setSeparated] = useState(false);
  const [selected, setSelected] = useState('all');
  const [roof, setRoof] = useState(false);
  const state = useRef({ paused, separated, selected });
  state.current = { paused, separated, selected };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false, started = false, visible = false, cleanup = () => {};
    const initialise = async () => {
      if (started || disposed) return;
      started = true;
      try {
        const [T, { OrbitControls }, { buildYsabelArchitecture }] = await Promise.all([
          import('three'), import('three/examples/jsm/controls/OrbitControls.js'), import('@/lib/ysabel-architecture'),
        ]);
        if (disposed) return;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
        catch { setFailure(true); return; }
        cleanup = () => releaseRenderer(renderer);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.setClearColor('#eff3ef', 0);
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        const scene = new T.Scene();
        const camera = new T.OrthographicCamera(-15, 15, 18.5, -18.5, .1, 150);
        camera.position.set(-18, 28, 52);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 15, 1.7);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.enableZoom = false; // Page scrolling stays native; zoom has dedicated buttons.
        controls.maxPolarAngle = Math.PI * .49;
        controls.autoRotateSpeed = .4;
        controls.update();
        renderer.domElement.style.touchAction = 'pan-y';
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 1024; skyCanvas.height = 512;
        const skyContext = skyCanvas.getContext('2d')!;
        const sky = skyContext.createLinearGradient(0, 0, 0, 512);
        for (const [at, color] of [[0, '#547b9f'], [.3, '#97bbd0'], [.49, '#e2d5b8'], [.52, '#647b84'], [1, '#283b46']] as const) sky.addColorStop(at, color);
        skyContext.fillStyle = sky; skyContext.fillRect(0, 0, 1024, 512);
        const skyTexture = new T.CanvasTexture(skyCanvas);
        skyTexture.colorSpace = T.SRGBColorSpace;
        skyTexture.mapping = T.EquirectangularReflectionMapping;
        const pmrem = new T.PMREMGenerator(renderer);
        const environment = pmrem.fromEquirectangular(skyTexture);
        scene.environment = environment.texture;
        skyTexture.dispose(); pmrem.dispose();
        scene.add(new T.HemisphereLight('#e5edf0', '#20313b', 1));
        const key = new T.DirectionalLight('#fff2d6', 2.2); key.position.set(-18, 40, 22); scene.add(key);
        const rim = new T.DirectionalLight('#a5d6eb', 1.8); rim.position.set(15, 26, -16); scene.add(rim);
        const { groups, materials, textures, picks } = buildYsabelArchitecture(T);
        groups.forEach(group => scene.add(group));
        const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
        const ctx = shadowCanvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
        gradient.addColorStop(0, 'rgba(31,53,48,.22)'); gradient.addColorStop(1, 'rgba(31,53,48,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
        const shadowTexture = new T.CanvasTexture(shadowCanvas);
        const shadow = new T.Mesh(new T.PlaneGeometry(25, 28), new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -.1, 2); scene.add(shadow);
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = matchMedia('(pointer: coarse)');
        let frame = 0, lost = false, dragging = false, last = 0, appearanceUntil = 0, currentRoof = false, scrollUntil = 0, scrollTimer = 0;
        let bounds = el.getBoundingClientRect();
        const point = new T.Vector3(), ray = new T.Raycaster(), pointer = new T.Vector2();
        const anchors = venues.map(v => new T.Vector3(4.65, v.y, -.5));
        const labelPositions = new Float32Array(venues.length * 2).fill(-10000);
        const canDraw = () => !disposed && !lost && visible && !document.hidden && performance.now() >= scrollUntil;
        const motion = () => !state.current.paused && !reduced.matches && !coarse.matches && !dragging && !currentRoof;
        const stop = () => { cancelAnimationFrame(frame); frame = 0; last = 0; controls.autoRotate = false; };
        const render = () => {
          if (!canDraw()) return;
          renderer.render(scene, camera);
          anchors.forEach((anchor, i) => {
            const label = labelRefs.current[i]; if (!label) return;
            point.copy(anchor); point.y += groups.get(venues[i].id)!.position.y; point.project(camera);
            const x = (point.x + 1) / 2 * bounds.width, y = (1 - point.y) / 2 * bounds.height;
            if (Math.abs(labelPositions[i * 2] - x) > .2 || Math.abs(labelPositions[i * 2 + 1] - y) > .2) {
              label.style.transform = `translate3d(${x}px,${y}px,0)`;
              labelPositions[i * 2] = x; labelPositions[i * 2 + 1] = y;
            }
          });
        };
        const schedule = () => { if (!frame && canDraw()) frame = requestAnimationFrame(draw); };
        function draw(now: number) {
          frame = 0;
          if (!canDraw()) { last = 0; return; }
          // At most 30 frames per second; the scene rests on touch devices and when hidden.
          if (last && now - last < 32) { schedule(); return; }
          const delta = last ? Math.min(.1, (now - last) / 1000) : 0;
          last = now;
          const changing = appearanceUntil > now;
          const finish = reduced.matches || !changing;
          if (appearanceUntil) {
          for (const [id, group] of groups) {
            const target = state.current.separated ? (id === 'garden' ? 1.5 : id === 'asian' ? .9 : id === 'italian' ? .35 : 0) : 0;
            group.position.y = finish ? target : T.MathUtils.lerp(group.position.y, target, .2);
          }
          for (const material of materials) {
            const id = material.userData.zone, base = material.userData.base as InstanceType<typeof T.Color> | undefined;
            if (!base) continue;
            const focus = state.current.selected;
            const desired = base.clone();
            if (focus !== 'all' && id !== 'base' && id !== focus) desired.multiplyScalar(.62);
            if (id === focus) desired.multiplyScalar(1.12);
            material.color.lerp(desired, finish ? 1 : .2);
          }
          if (finish) appearanceUntil = 0;
          }
          controls.autoRotate = motion();
          if (controls.autoRotate) controls.update(delta);
          render();
          if (changing || motion()) schedule(); else last = 0;
        }
        const update = () => { appearanceUntil = performance.now() + 420; schedule(); };
        const resize = () => {
          bounds = el.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          renderer.setPixelRatio(canvasPixelRatio(bounds.width, bounds.height, devicePixelRatio, coarse.matches));
          renderer.setSize(bounds.width, bounds.height);
          const aspect = bounds.width / bounds.height, h = Math.max(18.2, 10 / aspect);
          camera.left = -h * aspect; camera.right = h * aspect; camera.top = h; camera.bottom = -h;
          camera.updateProjectionMatrix(); render();
        };
        const pick = (event: PointerEvent) => {
          // Refresh the rectangle only for clicks, avoiding layout work while orbiting or scrolling.
          const rect = el.getBoundingClientRect();
          pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
          ray.setFromCamera(pointer, camera);
          return ray.intersectObjects(picks, false)[0]?.object.userData.zone as string | undefined;
        };
        let downX = 0, downY = 0;
        const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
        const up = (event: PointerEvent) => {
          if (Math.hypot(event.clientX - downX, event.clientY - downY) < 6) {
            const id = pick(event); if (id && id !== 'base') setSelected(old => old === id ? 'all' : id);
          }
        };
        const changed = () => { if (!controls.autoRotate) render(); };
        const start = () => { dragging = true; stop(); };
        const end = () => { dragging = false; update(); };
        const visibility = () => { if (document.hidden) stop(); else update(); };
        const scroll = () => {
          stop(); scrollUntil = performance.now() + 150;
          clearTimeout(scrollTimer); scrollTimer = window.setTimeout(update, 165);
        };
        const contextLost = (event: Event) => { event.preventDefault(); lost = true; stop(); setFailure(true); setReady(false); };
        controls.addEventListener('change', changed); controls.addEventListener('start', start); controls.addEventListener('end', end);
        renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('scroll', scroll, { capture: true, passive: true });
        reduced.addEventListener('change', update); coarse.addEventListener('change', update);
        const observer = new ResizeObserver(resize); observer.observe(el);
        runtime.current = {
          update,
          snapshot: () => {
            renderer.render(scene, camera);
            const link = document.createElement('a');
            link.download = 'ysabel-building.png'; link.href = renderer.domElement.toDataURL('image/png'); link.click();
          },
          zoom: factor => { camera.zoom = T.MathUtils.clamp(camera.zoom * factor, .7, 2.6); camera.updateProjectionMatrix(); render(); },
          preset: isRoof => {
            currentRoof = isRoof;
            camera.position.set(isRoof ? -17 : -18, isRoof ? 35 : 28, isRoof ? 27 : 52);
            controls.target.set(0, isRoof ? 25 : 15, 1.7); camera.zoom = isRoof ? 1.6 : 1;
            camera.updateProjectionMatrix(); controls.update(); update();
          },
        };
        cleanup = () => {
          stop(); clearTimeout(scrollTimer); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
          window.removeEventListener('scroll', scroll, true);
          reduced.removeEventListener('change', update); coarse.removeEventListener('change', update);
          controls.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
          renderer.domElement.removeEventListener('webglcontextlost', contextLost);
          const geometries = new Set<InstanceType<typeof T.BufferGeometry>>(), mats = new Set<InstanceType<typeof T.Material>>();
          scene.traverse(object => {
            if (object instanceof T.InstancedMesh) object.dispose();
            if (object instanceof T.Mesh || object instanceof T.LineSegments) {
              geometries.add(object.geometry);
              (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => mats.add(m));
            }
          });
          geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
          textures.forEach(t => t.dispose()); shadowTexture.dispose(); environment.dispose(); releaseRenderer(renderer); runtime.current = null;
        };
        resize(); update(); setReady(true);
      } catch { cleanup(); if (!disposed) setFailure(true); }
    };
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { void initialise(); runtime.current?.update(); }
      // draw exits immediately when offscreen, and no new frames are scheduled.
    }, { threshold: 0, rootMargin: '0px' });
    intersection.observe(el);
    return () => { disposed = true; intersection.disconnect(); cleanup(); };
  }, []);
  useEffect(() => { runtime.current?.update(); }, [paused, separated, selected, ready]);

  return <div className={styles.building}>
    <div className={styles.buildingHeading}><span>MAISON YSABEL</span><span><Maximize2 size={12}/> 360°</span></div>
    <div className={styles.viewport}>
      <img className={styles.buildingPoster} src="/marketingdata-ui/ysabel-building.webp" alt="Ysabel’s glass-fronted tower with its curved rooftop and terrace" hidden={ready && !failure}/>
      <div ref={host} className={styles.canvas} role="img" aria-label="Interactive original Ysabel building. Garden on the rooftop, Asian in the middle, Italian below. Drag to rotate, or use the venue buttons." style={{ visibility: failure ? 'hidden' : 'visible' }}/>
      {ready && !failure && <div className={styles.floorLabels} aria-hidden="true">{venues.map((venue, i) => <span key={venue.id} ref={el => { labelRefs.current[i] = el; }} style={{ '--venue': venue.color } as React.CSSProperties}><i/>{venue.name}</span>)}</div>}
      <div className={styles.buildingCaption}><span>{failure ? 'Architecture preview' : 'The house of Ysabel'}</span><small>{failure ? 'Explore the analytics alongside' : 'Drag to explore · select a floor'}</small></div>
      <div className={styles.zoom}><button type="button" aria-label="Zoom in on building" disabled={!ready || failure} onClick={() => runtime.current?.zoom(1.15)}><Plus size={15}/></button><button type="button" aria-label="Zoom out of building" disabled={!ready || failure} onClick={() => runtime.current?.zoom(1 / 1.15)}><Minus size={15}/></button></div>
    </div>
    <div className={styles.venues} aria-label="Building venues">{venues.map(venue => <button type="button" key={venue.id} aria-pressed={selected === venue.id} onClick={() => setSelected(selected === venue.id ? 'all' : venue.id)} style={{ '--venue': venue.color } as React.CSSProperties}><i/>{venue.name.replace('Ysabel ', '')}</button>)}</div>
    <div className={styles.buildingControls}>
      <button type="button" disabled={!ready || failure} aria-pressed={roof} onClick={() => { setRoof(!roof); runtime.current?.preset(!roof); }}><Maximize2 size={13}/>{roof ? 'Whole building' : 'Rooftop'}</button>
      <button type="button" disabled={!ready || failure} aria-pressed={separated} onClick={() => setSeparated(!separated)}><Layers3 size={13}/>{separated ? 'Join floors' : 'Separate floors'}</button>
      <button type="button" disabled={!ready || failure} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={13}/> : <Pause size={13}/>}<span>{paused ? 'Play' : 'Pause'}</span></button>
      <button type="button" disabled={!ready || failure} aria-label="Save building image" onClick={() => runtime.current?.snapshot()}><Camera size={13}/></button>
      <button type="button" disabled={!ready || failure} aria-label="Reset building view" onClick={() => { setSelected('all'); setSeparated(false); setRoof(false); runtime.current?.preset(false); }}><RotateCcw size={13}/></button>
    </div>
  </div>;
}
