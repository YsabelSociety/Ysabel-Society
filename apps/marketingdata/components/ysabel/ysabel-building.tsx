"use client";
import { useEffect, useRef, useState } from 'react';
import { Layers3, Pause, Play, RotateCcw, Plus, Minus, Maximize2, Camera, SunMoon, MapPin, Armchair, Building2 } from 'lucide-react';
import { canvasPixelRatio, releaseRenderer } from '@/lib/render-budget';
import { cityDateFormat, cityTimeFormat, cityDayBounds, getPrishtinaDaylight, getPrishtinaSky } from '@/lib/prishtina-daylight';
import styles from './overview-maison.module.css';

const venues = [
  { id: 'garden', name: 'Ysabel Garden', y: 28.2, color: '#8bb5a4' },
  { id: 'asian', name: 'Ysabel Asian', y: 26.3, color: '#d89695' },
  { id: 'italian', name: 'Ysabel Italian', y: 24.1, color: '#dec586' },
];
type Runtime = { update(): void; preset(roof: boolean): void; zoom(factor: number): void; snapshot(): void; garden(enabled: boolean, plan: boolean, whole: boolean): void };

// The second-by-second clock is isolated from the model and analytics React trees.
function PrishtinaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const tick = () => { if (!document.hidden) setNow(new Date()); };
    const visibility = () => { clearInterval(timer); if (!document.hidden) { tick(); timer = window.setInterval(tick, 1000); } };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <div className={styles.cityClock}><span><MapPin size={11}/> Prishtina City</span><time dateTime={now.toISOString()}><span>{cityDateFormat.format(now)}</span><strong>{cityTimeFormat.format(now)}</strong></time></div>;
}

export function YsabelBuilding() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const phaseLabel = useRef<HTMLSpanElement>(null);
  const sunTimes = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const runtime = useRef<Runtime | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [paused, setPaused] = useState(false);
  const [separated, setSeparated] = useState(false);
  const [selected, setSelected] = useState('all');
  const [roof, setRoof] = useState(false);
  const [gardenPreview, setGardenPreview] = useState(true);
  const [gardenPlan, setGardenPlan] = useState(false);
  const [gardenWhole, setGardenWhole] = useState(true);
  const [gardenLoading, setGardenLoading] = useState(false);
  const [gardenUnavailable, setGardenUnavailable] = useState(false);
  const [cyclePreview, setCyclePreview] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [initialLight] = useState(() => getPrishtinaDaylight(new Date()));
  const initialSky = getPrishtinaSky(initialLight.daylight, initialLight.golden);
  const state = useRef({ paused, separated, selected, cyclePreview, gardenPreview, gardenPlan, gardenWhole });
  state.current = { paused, separated, selected, cyclePreview, gardenPreview, gardenPlan, gardenWhole };

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
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFShadowMap;
        renderer.shadowMap.autoUpdate = false;
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
        controls.autoRotateSpeed = matchMedia('(pointer: coarse)').matches ? .38 : .34;
        controls.update();
        renderer.domElement.style.touchAction = 'pan-y';
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 2048; skyCanvas.height = 1024;
        const skyContext = skyCanvas.getContext('2d')!;
        const sky = skyContext.createLinearGradient(0, 0, 0, 1024);
        for (const [at, color] of [[0, '#6f94a7'], [.28, '#b4cbd1'], [.47, '#f3e5cf'], [.54, '#a6aba3'], [1, '#66756f']] as const) sky.addColorStop(at, color);
        skyContext.fillStyle = sky; skyContext.fillRect(0, 0, 2048, 1024);
        // Wide soft daylight and distant architectural reflections make the glass read as glass.
        const daylight = skyContext.createRadialGradient(380, 290, 18, 380, 290, 310);
        daylight.addColorStop(0, '#fff9e9'); daylight.addColorStop(.28, '#fff5dcbb'); daylight.addColorStop(1, '#fff5dc00');
        skyContext.fillStyle = daylight; skyContext.fillRect(0, 0, 900, 660);
        const horizon = skyContext.createLinearGradient(0, 460, 0, 680);
        horizon.addColorStop(0, '#73838a00'); horizon.addColorStop(1, '#52646b6b'); skyContext.fillStyle = horizon;
        for (let i = 0; i < 40; i++) { const x = i * 53, height = 45 + ((i * 37) % 105); skyContext.fillRect(x, 560 - height, 35 + i % 4 * 4, height + 140); }
        skyContext.fillStyle = '#fff9e433'; skyContext.fillRect(1420, 210, 75, 330);
        const skyTexture = new T.CanvasTexture(skyCanvas);
        skyTexture.colorSpace = T.SRGBColorSpace;
        skyTexture.mapping = T.EquirectangularReflectionMapping;
        const pmrem = new T.PMREMGenerator(renderer);
        const environment = pmrem.fromEquirectangular(skyTexture);
        scene.environment = environment.texture; scene.environmentIntensity = .85;
        skyTexture.dispose(); pmrem.dispose();
        const ambient = new T.HemisphereLight('#e7eff3', '#766857', 1.25); scene.add(ambient);
        const key = new T.DirectionalLight('#fff0d5', 2.6); key.position.set(-22, 38, 18); key.target.position.set(0, 13, 2);
        key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.00015; key.shadow.normalBias = .045;
        key.shadow.camera.left = -23; key.shadow.camera.right = 23; key.shadow.camera.top = 27; key.shadow.camera.bottom = -23;
        key.shadow.camera.near = 1; key.shadow.camera.far = 85; key.shadow.intensity = .5;
        scene.add(key, key.target);
        const rim = new T.DirectionalLight('#c4dce9', 1.1); rim.position.set(18, 27, -20); scene.add(rim);
        const { groups, materials, textures, picks } = buildYsabelArchitecture(T);
        groups.forEach(group => scene.add(group));
        const nightWindows = materials.filter(m => m.userData.nightWindow);
        const gardenRoof = materials.filter((m): m is InstanceType<typeof T.MeshPhysicalMaterial> => m instanceof T.MeshPhysicalMaterial && m.userData.zone === 'garden');
        const gardenFrames = materials.filter(m => m.userData.gardenRoofFrame);
        // Only Garden glazing changes. The original facade, mullions and other floors remain intact.
        const gardenRoofShadows = new Map<InstanceType<typeof T.Mesh>, boolean>();
        groups.get('garden')!.traverse(object => {
          if (object instanceof T.Mesh && !Array.isArray(object.material) && gardenRoof.includes(object.material as InstanceType<typeof T.MeshPhysicalMaterial>)) gardenRoofShadows.set(object, object.castShadow);
        });
        let gardenInterior: ReturnType<typeof import('@/lib/ysabel-garden-interior').buildGardenInterior> | null = null;
        let gardenLoad: Promise<void> | null = null, gardenMode = 'exterior';
        let cameraTransition: { start: number; from: InstanceType<typeof T.Vector3>; to: InstanceType<typeof T.Vector3>; fromTarget: InstanceType<typeof T.Vector3>; target: InstanceType<typeof T.Vector3>; fromZoom: number; zoom: number } | null = null;
        const terraceLight = new T.PointLight('#ffe5b7', 0, 13, 2); terraceLight.position.set(0, 22, 6); scene.add(terraceLight);
        const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
        const ctx = shadowCanvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
        gradient.addColorStop(0, 'rgba(31,53,48,.22)'); gradient.addColorStop(1, 'rgba(31,53,48,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
        const shadowTexture = new T.CanvasTexture(shadowCanvas);
        const shadow = new T.Mesh(new T.PlaneGeometry(25, 28), new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -.1, 2); scene.add(shadow);
        const ground = new T.Mesh(new T.PlaneGeometry(65, 65), new T.ShadowMaterial({ opacity: .16, depthWrite: false }));
        ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.08, 2); ground.receiveShadow = true; scene.add(ground);
        renderer.shadowMap.needsUpdate = true;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = matchMedia('(pointer: coarse)');
        setReducedMotion(reduced.matches);
        let frame = 0, lost = false, dragging = false, last = 0, appearanceUntil = 0, scrollUntil = 0, scrollTimer = 0;
        let bounds = el.getBoundingClientRect();
        let solar = getPrishtinaDaylight(new Date()), solarSampleAt = 0, skyPaintAt = 0, shadowAt = 0;
        let previewWasOn = false, previewSeconds = 0, lightingSettled = false;
        const light = { day: solar.daylight, gold: solar.golden, night: solar.night, progress: solar.progress, altitude: solar.altitude, sunY: solar.sunY };
        const colors = {
          coolSun: new T.Color('#c3d8ed'), daySun: new T.Color('#fff4e0'), goldSun: new T.Color('#ffcd96'),
          nightAmbient: new T.Color('#b1c8df'), dayAmbient: new T.Color('#e7eff3'),
        };
        const lightDirection = new T.Vector3(), shadowLightPosition = new T.Vector3(1000, 1000, 1000);
        const paintLighting = (now: number, delta: number) => {
          if (state.current.cyclePreview !== previewWasOn) {
            previewWasOn = state.current.cyclePreview; previewSeconds = 0; solarSampleAt = 0;
          }
          if (previewWasOn && motion()) previewSeconds += delta;
          if (!solarSampleAt || now - solarSampleAt >= (previewWasOn ? 100 : 1000)) {
            let date = new Date();
            if (previewWasOn) {
              const day = cityDayBounds(date);
              date = new Date(day.start + ((.22 + previewSeconds / 90) % 1) * (day.end - day.start));
            }
            solar = getPrishtinaDaylight(date); solarSampleAt = now;
            const phase = previewWasOn ? `${solar.phase} · ${cityTimeFormat.format(date).slice(0, 5)} · preview` : `${solar.phase} · local light`;
            if (phaseLabel.current && phaseLabel.current.textContent !== phase) phaseLabel.current.textContent = phase;
            if (sunTimes.current) sunTimes.current.textContent = `Sunrise ${solar.sunriseLabel} · Sunset ${solar.sunsetLabel}`;
          }
          const ease = reduced.matches ? 1 : 1 - Math.exp(-Math.max(delta, .016) * 2.5);
          light.day = T.MathUtils.lerp(light.day, solar.daylight, ease);
          light.gold = T.MathUtils.lerp(light.gold, solar.golden, ease);
          light.night = T.MathUtils.lerp(light.night, solar.night, ease);
          light.progress = T.MathUtils.lerp(light.progress, solar.progress, ease);
          light.altitude = T.MathUtils.lerp(light.altitude, solar.altitude, ease);
          light.sunY = T.MathUtils.lerp(light.sunY, solar.sunY, ease);
          lightingSettled = Math.abs(light.day - solar.daylight) + Math.abs(light.gold - solar.golden) + Math.abs(light.night - solar.night) + Math.abs(light.progress - solar.progress) < .002;
          // Material base colors stay untouched: illumination, reflections and window light change.
          ambient.color.copy(colors.nightAmbient).lerp(colors.dayAmbient, light.day);
          ambient.intensity = .65 + light.day * .7;
          key.color.copy(colors.coolSun).lerp(colors.daySun, light.day).lerp(colors.goldSun, light.gold * .65);
          key.intensity = .25 + light.day * 2.35;
          rim.intensity = .6 + light.day * .5;
          scene.environmentIntensity = .3 + light.day * .55;
          renderer.toneMappingExposure = .96 + light.day * .09;
          terraceLight.intensity = light.night * 16;
          if (gardenInterior?.group.visible) gardenInterior.updateLighting(light.night);
          nightWindows.forEach(m => { m.emissiveIntensity = .08 + light.night * .9; });
          const angle = Math.PI * light.progress;
          lightDirection.set(Math.cos(angle) * 34, 8 + Math.max(0, Math.sin(light.altitude * Math.PI / 180)) * 48, 24);
          key.position.copy(key.target.position).add(lightDirection);
          // Shadow maps refresh at most four times a second, never on every orbit frame.
          if (now - shadowAt > (coarse.matches ? 400 : 250) && (key.position.distanceToSquared(shadowLightPosition) > .001 || !shadowAt)) {
            renderer.shadowMap.needsUpdate = true; shadowAt = now; shadowLightPosition.copy(key.position);
          }
          if (now - skyPaintAt >= 100 || !skyPaintAt) {
            const sky = stage.current;
            if (sky) {
              const backdrop = getPrishtinaSky(light.day, light.gold);
              sky.style.setProperty('--sky-top', backdrop.top);
              sky.style.setProperty('--sky-horizon', backdrop.horizon);
              sky.style.setProperty('--sun-x', `${92 - 84 * light.progress}%`);
              sky.style.setProperty('--sun-y', `${light.sunY}%`);
              sky.style.setProperty('--sun-opacity', String(solar.sunOpacity));
              sky.style.setProperty('--night', String(light.night));
              sky.dataset.night = light.night > .5 ? 'true' : 'false';
            }
            skyPaintAt = now;
          }
        };
        const point = new T.Vector3(), ray = new T.Raycaster(), pointer = new T.Vector2();
        const anchors = venues.map(v => new T.Vector3(4.65, v.y, -.5));
        const labelPositions = new Float32Array(venues.length * 2).fill(-10000);
        const labelSizes = new Float32Array(venues.length * 2);
        const canDraw = () => !disposed && !lost && visible && !document.hidden && performance.now() >= scrollUntil;
        const motion = () => !state.current.paused && !reduced.matches && !dragging;
        const stop = () => { cancelAnimationFrame(frame); frame = 0; last = 0; controls.autoRotate = false; };
        const render = () => {
          if (!canDraw()) return;
          renderer.render(scene, camera);
          anchors.forEach((anchor, i) => {
            const label = labelRefs.current[i]; if (!label) return;
            point.copy(anchor); point.y += groups.get(venues[i].id)!.position.y; point.project(camera);
            if (!labelSizes[i * 2]) { labelSizes[i * 2] = label.offsetWidth; labelSizes[i * 2 + 1] = label.offsetHeight; }
            const x = Math.max(16, Math.min(bounds.width - labelSizes[i * 2] - 8, (point.x + 1) / 2 * bounds.width));
            const y = Math.max(8, Math.min(bounds.height - labelSizes[i * 2 + 1] - 8, (1 - point.y) / 2 * bounds.height));
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
          // At most 30 frames per second on desktop and mobile; scrolling and hidden scenes rest.
          if (last && now - last < 32) { schedule(); return; }
          const delta = last ? Math.min(.1, (now - last) / 1000) : 0;
          last = now;
          paintLighting(now, delta);
          if (cameraTransition) {
            const t = reduced.matches ? 1 : T.MathUtils.clamp((now - cameraTransition.start) / 650, 0, 1), ease = t * t * (3 - 2 * t);
            camera.position.lerpVectors(cameraTransition.from, cameraTransition.to, ease);
            controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.target, ease);
            camera.zoom = T.MathUtils.lerp(cameraTransition.fromZoom, cameraTransition.zoom, ease);
            camera.updateProjectionMatrix(); controls.update();
            if (t === 1) cameraTransition = null;
          }
          const changing = appearanceUntil > now;
          const finish = reduced.matches || !changing;
          if (appearanceUntil) {
          for (const [id, group] of groups) {
            const target = state.current.separated ? (id === 'garden' ? 1.5 : id === 'asian' ? .9 : id === 'italian' ? .35 : 0) : 0;
            const next = finish ? target : T.MathUtils.lerp(group.position.y, target, .2);
            if (Math.abs(next - group.position.y) > .001) renderer.shadowMap.needsUpdate = true;
            group.position.y = next;
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
          controls.autoRotateSpeed = state.current.gardenPreview && !state.current.gardenWhole ? .14 : coarse.matches ? .38 : .34;
          controls.autoRotate = motion() && !cameraTransition && !(state.current.gardenPreview && state.current.gardenPlan);
          if (controls.autoRotate) controls.update(delta);
          render();
          if (changing || controls.autoRotate || cameraTransition || !lightingSettled || (previewWasOn && motion())) schedule(); else last = 0;
        }
        const update = () => { appearanceUntil = performance.now() + 420; schedule(); };
        const moveCamera = (position: InstanceType<typeof T.Vector3>, target: InstanceType<typeof T.Vector3>, zoom: number) => {
          cameraTransition = { start: performance.now(), from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), target, fromZoom: camera.zoom, zoom };
          controls.autoRotate = false; update();
        };
        const sunlightTimer = window.setInterval(() => { if (visible && !document.hidden && !state.current.cyclePreview) schedule(); }, 1000);
        const resize = () => {
          bounds = el.getBoundingClientRect();
          labelSizes.fill(0);
          if (!bounds.width || !bounds.height) return;
          renderer.setPixelRatio(canvasPixelRatio(bounds.width, bounds.height, devicePixelRatio, coarse.matches, coarse.matches ? 1.65 : 2));
          controls.autoRotateSpeed = coarse.matches ? .38 : .34;
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
          if ((!state.current.gardenPreview || state.current.gardenWhole) && Math.hypot(event.clientX - downX, event.clientY - downY) < 6) {
            const id = pick(event); if (id && id !== 'base') setSelected(old => old === id ? 'all' : id);
          }
        };
        const changed = () => { if (!controls.autoRotate && !cameraTransition) render(); };
        const start = () => { dragging = true; cameraTransition = null; stop(); };
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
        const motionPreference = () => { setReducedMotion(reduced.matches); update(); };
        reduced.addEventListener('change', motionPreference); coarse.addEventListener('change', update);
        const observer = new ResizeObserver(resize); observer.observe(el);
        runtime.current = {
          update,
          snapshot: () => {
            renderer.render(scene, camera);
            const link = document.createElement('a');
            link.download = 'ysabel-building.png'; link.href = renderer.domElement.toDataURL('image/png'); link.click();
          },
          zoom: factor => { cameraTransition = null; camera.zoom = T.MathUtils.clamp(camera.zoom * factor, .7, state.current.gardenPreview ? 4.2 : 2.6); camera.updateProjectionMatrix(); render(); },
          preset: isRoof => {
            cameraTransition = null;
            camera.position.set(isRoof ? -17 : -18, isRoof ? 35 : 28, isRoof ? 27 : 52);
            controls.target.set(0, isRoof ? 25 : 15, 1.7); camera.zoom = isRoof ? 1.6 : 1;
            camera.updateProjectionMatrix(); controls.update(); update();
          },
          garden: async (enabled, plan, whole) => {
            const mode = enabled ? (whole ? 'building' : plan ? 'plan' : 'interior') : 'exterior';
            if (mode === gardenMode) return;
            gardenMode = mode;
            if (enabled && !gardenInterior) {
              setGardenLoading(true); setGardenUnavailable(false);
              try {
                gardenLoad ??= import('@/lib/ysabel-garden-interior').then(({ buildGardenInterior }) => {
                  if (disposed) return;
                  gardenInterior = buildGardenInterior(T); groups.get('garden')!.add(gardenInterior.group); textures.push(...gardenInterior.textures);
                });
                await gardenLoad;
              } catch {
                gardenLoad = null; gardenMode = 'exterior';
                if (!disposed) { setGardenPreview(false); setGardenUnavailable(true); }
                return;
              } finally { if (!disposed) setGardenLoading(false); }
            }
            if (disposed || gardenMode !== mode) return;
            if (gardenInterior) gardenInterior.group.visible = enabled;
            for (const [id, group] of groups) group.visible = !enabled || whole || id === 'garden';
            gardenRoofShadows.forEach((cast, mesh) => { mesh.castShadow = enabled ? false : cast; });
            for (const m of gardenRoof) {
              m.transparent = enabled; m.opacity = enabled ? (whole ? .45 : plan ? .015 : .065) : 1; m.depthWrite = !enabled; m.forceSinglePass = enabled;
              m.metalness = enabled ? (whole ? .18 : .06) : .32; m.roughness = enabled ? (whole ? .22 : .42) : .19;
              m.envMapIntensity = enabled ? (whole ? .7 : .12) : 1.3; m.clearcoat = enabled ? (whole ? .8 : .12) : .95; m.needsUpdate = true;
            }
            const cutaway = enabled && !whole;
            for (const m of gardenFrames) { m.transparent = cutaway; m.opacity = cutaway ? (plan ? .055 : .14) : 1; m.depthWrite = !cutaway; m.needsUpdate = true; }
            groups.get('garden')!.children.forEach(object => { if (object.userData.gardenAntenna) object.visible = !cutaway; });
            ground.visible = shadow.visible = terraceLight.visible = !cutaway; renderer.shadowMap.needsUpdate = true;
            if (enabled && whole) moveCamera(new T.Vector3(-18, 28, 52), new T.Vector3(0, 15, 1.7), 1);
            else if (enabled) moveCamera(new T.Vector3(plan ? 0 : -16, plan ? 65 : 49, plan ? -1.53 : 26), new T.Vector3(0, 28.05, -1.65), plan ? 3.25 : 3.1);
            else moveCamera(new T.Vector3(-18, 28, 52), new T.Vector3(0, 15, 1.7), 1);
          },
        };
        cleanup = () => {
          stop(); clearTimeout(scrollTimer); clearInterval(sunlightTimer); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
          window.removeEventListener('scroll', scroll, true);
          reduced.removeEventListener('change', motionPreference); coarse.removeEventListener('change', update);
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
          textures.forEach(t => t.dispose()); shadowTexture.dispose(); environment.dispose(); key.shadow.dispose(); releaseRenderer(renderer); runtime.current = null;
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
  useEffect(() => { runtime.current?.update(); }, [paused, separated, selected, ready, cyclePreview, gardenPreview, gardenPlan, gardenWhole]);
  useEffect(() => { runtime.current?.garden(gardenPreview, gardenPlan, gardenWhole); }, [gardenPreview, gardenPlan, gardenWhole, ready]);

  return <div className={styles.building}>
    <div className={styles.buildingHeading}><span>MAISON YSABEL</span><span><Maximize2 size={12}/> 360°</span></div>
    <PrishtinaClock/>
    <div className={styles.viewport} ref={stage} data-garden={gardenPreview && !gardenWhole} data-night={initialLight.night > .5} style={{ '--sky-top': initialSky.top, '--sky-horizon': initialSky.horizon, '--sun-x': `${initialLight.sunX}%`, '--sun-y': `${initialLight.sunY}%`, '--sun-opacity': initialLight.sunOpacity, '--night': initialLight.night } as React.CSSProperties}>
      <div className={styles.citySky} aria-hidden="true"><div className={styles.stars}/><div className={styles.sun}/><div className={styles.moon}/><div className={styles.horizon}/></div>
      <div className={styles.daylightStatus}><span ref={phaseLabel}>{initialLight.phase} · local light</span><span ref={sunTimes}>Sunrise {initialLight.sunriseLabel} · Sunset {initialLight.sunsetLabel}</span></div>
      <img className={styles.buildingPoster} src="/marketingdata-ui/ysabel-building.webp" alt="Ysabel’s glass-fronted tower with its curved rooftop and terrace" hidden={ready && !failure}/>
      <div ref={host} className={styles.canvas} role="img" aria-label={gardenPreview ? `Photo-inspired Ysabel Garden ${gardenWhole ? 'interior behind lightly transparent rooftop glass in the original whole building' : gardenPlan ? 'overhead plan' : '3D cutaway'} with the bar, lounge and window tables. Illustrative placement, not a measured floor plan. Drag to explore.` : "Interactive original Ysabel building. Garden on the rooftop, Asian in the middle, Italian below. The sky follows Prishtina daylight with a moon at night. Drag to rotate, or use the venue buttons."} style={{ visibility: failure ? 'hidden' : 'visible' }}/>
      {ready && !failure && (!gardenPreview || gardenWhole) && <div className={styles.floorLabels} aria-hidden="true">{venues.map((venue, i) => <span key={venue.id} ref={el => { labelRefs.current[i] = el; }} style={{ '--venue': venue.color } as React.CSSProperties}><i/>{venue.name}</span>)}</div>}
      <div className={styles.buildingCaption}><span>{failure ? 'Architecture preview' : gardenPreview ? (gardenWhole ? 'The house of Ysabel' : 'Ysabel Garden') : 'The house of Ysabel'}</span><small>{failure ? 'Explore the analytics alongside' : gardenPreview ? 'Photo-inspired layout · illustrative placement' : 'Drag to explore · select a floor'}</small></div>
      <div className={styles.zoom}><button type="button" aria-label="Zoom in on building" disabled={!ready || failure} onClick={() => runtime.current?.zoom(1.15)}><Plus size={15}/></button><button type="button" aria-label="Zoom out of building" disabled={!ready || failure} onClick={() => runtime.current?.zoom(1 / 1.15)}><Minus size={15}/></button></div>
    </div>
    {gardenUnavailable && <p className={styles.gardenNotice} role="status">Garden preview could not open. Please try again.</p>}
    {gardenPreview && !gardenWhole ? <div className={styles.gardenLegend} aria-label="Garden dining areas"><span><i style={{background:"#b99960"}}/>Bar & arches</span><span><i style={{background:"#a15c50"}}/>Lounge</span><span><i style={{background:"#4b777d"}}/>Window tables</span></div> : <div className={styles.venues} aria-label="Building venues">{venues.map(venue => <button type="button" key={venue.id} aria-pressed={selected === venue.id} onClick={() => setSelected(selected === venue.id ? 'all' : venue.id)} style={{ '--venue': venue.color } as React.CSSProperties}><i/>{venue.name.replace('Ysabel ', '')}</button>)}</div>}
    <div className={styles.buildingControls}>
      <button type="button" disabled={!ready || failure || gardenLoading} aria-pressed={gardenPreview && !gardenWhole ? gardenPlan : roof} onClick={() => { if (gardenPreview && !gardenWhole) setGardenPlan(!gardenPlan); else { setRoof(!roof); runtime.current?.preset(!roof); } }}><Maximize2 size={13}/>{gardenPreview && !gardenWhole ? (gardenPlan ? '3D view' : 'Plan view') : roof ? 'Whole building' : 'Rooftop'}</button>
      <button type="button" disabled={!ready || failure || gardenLoading} aria-pressed={gardenPreview} onClick={() => { setGardenPreview(!gardenPreview); setGardenPlan(false); setGardenWhole(true); setRoof(false); setSeparated(false); setSelected('all'); }}><Armchair size={13}/>{gardenLoading ? 'Opening Garden…' : 'Garden interior'}</button>
      {gardenPreview && <button type="button" disabled={!ready || failure || gardenLoading} onClick={() => { setGardenWhole(!gardenWhole); setGardenPlan(false); setRoof(false); setSeparated(false); setSelected('all'); }}><Building2 size={13}/>{gardenWhole ? 'Garden close-up' : 'Whole building'}</button>}
      <button type="button" disabled={!ready || failure || (gardenPreview && !gardenWhole)} aria-pressed={separated} onClick={() => setSeparated(!separated)}><Layers3 size={13}/>{separated ? 'Join floors' : 'Separate floors'}</button>
      <button type="button" disabled={!ready || failure} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={13}/> : <Pause size={13}/>}<span>{paused ? 'Play' : 'Pause'}</span></button>
      <button type="button" disabled={!ready || failure || reducedMotion} aria-pressed={cyclePreview} onClick={() => setCyclePreview(!cyclePreview)}><SunMoon size={13}/>{cyclePreview ? 'Live light' : 'Day cycle'}</button>
      <button type="button" disabled={!ready || failure} aria-label="Save building image" onClick={() => runtime.current?.snapshot()}><Camera size={13}/></button>
      <button type="button" disabled={!ready || failure} aria-label="Reset building view" onClick={() => { setSelected('all'); setSeparated(false); setRoof(false); setGardenPreview(true); setGardenPlan(false); setGardenWhole(true); runtime.current?.preset(false); }}><RotateCcw size={13}/></button>
    </div>
  </div>;
}
