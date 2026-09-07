'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, Pause, Play } from 'lucide-react';
import { appPath } from '@/lib/app-path';
import { BrandLogo } from './brand-logo';
import {
  INTRO_BACKGROUND,
  INTRO_LIGHT_COLORS,
  INTRO_LOGO_COLOR,
  INTRO_TEXT_COLOR,
  INTRO_LOGO_MATERIAL,
} from './brand-appearance';

const ease = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function LoginScene() {
  const fallbackMask = useId();
  const host = useRef<HTMLDivElement>(null);
  const settings = useRef({
    automatic: true,
    reduced: false,
    target: 0.13,
    progress: 0.13,
    time: 1.04,
  });
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let disposed = false;
    let cleanup = () => {};
    const abort = new AbortController();
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      const state = settings.current;
      state.reduced = preference.matches;
      state.automatic = !preference.matches;
      if (preference.matches) state.target = state.progress < 0.5 ? 0 : 1;
      setPlaying(state.automatic);
    };
    updatePreference();
    preference.addEventListener('change', updatePreference);

    async function start() {
      const [
        THREE,
        { SVGLoader },
        { RoomEnvironment },
        { createLoginDataField },
        { createIntroBackdrop },
        svgResponse,
      ] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/SVGLoader.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('./login-data-field'),
        import('./intro-backdrop'),
        fetch(appPath('/ysabel-emblem-source.svg'), { signal: abort.signal }),
      ]);
      if (!svgResponse.ok) throw new Error('Emblem unavailable');
      const svg = await svgResponse.text();
      if (disposed) return;

      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const materials: InstanceType<typeof THREE.Material>[] = [];
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, innerWidth < 800 ? 1.25 : 1.75),
      );
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      target!.appendChild(renderer.domElement);
      let frame = 0;
      let environment: InstanceType<typeof THREE.WebGLRenderTarget> | undefined;
      let observer: ResizeObserver | undefined;
      let dataField: ReturnType<typeof createLoginDataField> | undefined;
      const background = createIntroBackdrop(scene, { softEdges: true });
      const dispose = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        dataField?.dispose();
        background.dispose();
        geometries.forEach((item) => item.dispose());
        materials.forEach((item) => item.dispose());
        environment?.dispose();
        scene.traverse((item) => {
          if (item instanceof THREE.Light && 'shadow' in item)
            (
              item as InstanceType<typeof THREE.DirectionalLight>
            ).shadow?.map?.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
      cleanup = dispose;

      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, 0.035);
      scene.environment = Array.isArray(environment.texture)
        ? environment.texture[0]
        : environment.texture;
      room.dispose();
      pmrem.dispose();
      scene.add(
        new THREE.HemisphereLight(
          INTRO_LIGHT_COLORS.sky,
          INTRO_LIGHT_COLORS.ground,
          1.5,
        ),
      );
      const key = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.key, 3.4);
      key.position.set(-3.8, 5.5, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -5;
      key.shadow.camera.right = 5;
      key.shadow.camera.top = 5;
      key.shadow.camera.bottom = -5;
      key.shadow.normalBias = 0.025;
      key.shadow.bias = -0.0001;
      key.shadow.radius = 4;
      scene.add(key);
      const rim = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.rim, 2.2);
      rim.position.set(3, 2, -3);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.fill, 0.65);
      fill.position.set(2, -1, 4);
      scene.add(fill);

      const bronze = new THREE.MeshPhysicalMaterial(INTRO_LOGO_MATERIAL);
      materials.push(bronze);
      const world = new THREE.Group();
      scene.add(world);

      const paths = new SVGLoader().parse(svg).paths;
      const sculptedPaths = paths
        .flatMap((path) => path.toShapes())
        .map((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 35,
            steps: 1,
            bevelEnabled: true,
            bevelThickness: 2.2,
            bevelSize: 0.9,
            bevelSegments: 3,
            curveSegments: 18,
          });
          geometry.translate(-960, -540, -17.5);
          geometry.rotateX(Math.PI);
          geometry.scale(0.0051, 0.0051, 0.0051);
          geometry.computeBoundingBox();
          const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
          geometry.translate(-center.x, -center.y, -center.z);
          const mesh = new THREE.Mesh(geometry, bronze);
          mesh.position.copy(center);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          world.add(mesh);
          geometries.push(geometry);
          return { mesh, center };
        });
      const numberOrigins = sculptedPaths.flatMap(({ mesh, center }) => {
        const vertices = mesh.geometry.getAttribute('position');
        return Array.from({ length: 36 }, (_, i) =>
          new THREE.Vector3()
            .fromBufferAttribute(
              vertices,
              Math.floor((i * vertices.count) / 36),
            )
            .add(center),
        );
      });
      dataField = createLoginDataField(world, numberOrigins);

      const dummy = new THREE.Object3D();
      const destinations = sculptedPaths.map((_, i) => {
        const angle = i * 2.39996323;
        const radius = 0.12 + 2.18 * Math.sqrt(i / 119);
        return new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.86 + 0.12,
          Math.sin(i * 1.81) * 1.05 + (i % 19 === 0 ? 0.6 : 0),
        );
      });
      const groundGeometry = new THREE.PlaneGeometry(80, 80);
      geometries.push(groundGeometry);
      const groundMaterial = new THREE.ShadowMaterial({
        color: 0x10170c,
        opacity: 0.19,
      });
      materials.push(groundMaterial);
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.6;
      ground.receiveShadow = true;
      scene.add(ground);

      const pointer = new THREE.Vector2();
      const rotation = new THREE.Vector2();
      const dragRotation = new THREE.Vector2();
      let dragging = false;
      let previousX = 0;
      let previousY = 0;
      let visible = !document.hidden;
      let last = 0;
      let elapsed = 0;
      let cameraDistance = 9.6;
      const onMove = (event: PointerEvent) => {
        const bounds = target!.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
        );
        if (dragging) {
          dragRotation.x += (event.clientX - previousX) * 0.006;
          dragRotation.y = THREE.MathUtils.clamp(
            dragRotation.y + (event.clientY - previousY) * 0.004,
            -0.6,
            0.6,
          );
          previousX = event.clientX;
          previousY = event.clientY;
        }
      };
      const onDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        dragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
        target!.setPointerCapture(event.pointerId);
        target!.classList.add('is-dragging');
      };
      const onUp = () => {
        dragging = false;
        target!.classList.remove('is-dragging');
      };
      const onLeave = () => {
        if (!dragging) pointer.set(0, 0);
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          dragRotation.x += event.key === 'ArrowLeft' ? -0.2 : 0.2;
        }
      };
      const resize = () => {
        const width = target!.clientWidth;
        const height = target!.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        cameraDistance = Math.max(9.6, 8.8 / camera.aspect);
        camera.position.set(0, 0.25, cameraDistance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(target!);

      function render(now: number) {
        if (disposed || !visible) return;
        frame = requestAnimationFrame(render);
        if (now - last < 1000 / 30) return;
        const dt = Math.min((now - last) / 1000 || 0, 0.05);
        last = now;
        const state = settings.current;
        if (state.automatic) {
          elapsed += dt;
          state.time += dt;
          const cycle = state.time % 24;
          state.target =
            cycle < 8 ? cycle / 8 : cycle < 15 ? 1 : 1 - (cycle - 15) / 9;
        }
        if (state.reduced) state.progress = state.target;
        else if (state.automatic)
          state.progress +=
            (state.target - state.progress) * (1 - Math.exp(-dt * 3));
        else
          state.progress += THREE.MathUtils.clamp(
            state.target - state.progress,
            -dt / 7,
            dt / 7,
          );
        const p = state.progress;
        camera.position.z = cameraDistance + ease(0.15, 0.9, p) * 1.35;
        dataField?.update(p, elapsed);
        rotation.x +=
          (dragRotation.x + pointer.x * 0.22 - rotation.x) *
          (1 - Math.exp(-dt * 3));
        rotation.y +=
          (dragRotation.y + pointer.y * 0.12 - rotation.y) *
          (1 - Math.exp(-dt * 3));
        world.rotation.set(
          rotation.y + 0.025 * Math.sin(elapsed * 0.3),
          rotation.x - 0.14 + Math.sin(elapsed * 0.17) * 0.09,
          0.02 * Math.sin(elapsed * 0.2),
        );
        world.position.y = Math.sin(elapsed * 0.4) * 0.04;
        key.position.x = -3.8 + pointer.x * 0.8;
        key.position.y = 5.5 - pointer.y * 0.5;

        sculptedPaths.forEach(({ mesh, center }, i) => {
          const stagger = (i / sculptedPaths.length) * 0.14;
          const local = ease(stagger, 0.85 + stagger, p);
          const travel = ease(0.02, 0.92, local);
          const arc = Math.sin(travel * Math.PI);
          const destination = destinations[i];
          const angle = i * 2.39996323 + travel * 1.7;
          dummy.position.copy(center).lerp(destination, travel);
          dummy.position.x += Math.cos(angle) * arc * 0.34;
          dummy.position.y += Math.sin(angle) * arc * 0.34;
          dummy.position.z += arc * (0.7 + (i % 3) * 0.2);
          mesh.position.copy(dummy.position);
          const shrink = 1 - ease(0.12, 0.76, local);
          mesh.scale.setScalar(Math.max(0.00001, shrink));
          mesh.rotation.set(
            arc * 0.3,
            travel * Math.PI * 1.5,
            arc * (i % 2 ? 0.65 : -0.65),
          );
          mesh.visible = shrink > 0.002;
        });
        background.update(state.reduced ? 0 : elapsed, pointer.x, pointer.y);
        renderer.render(scene, camera);
      }
      const onVisibility = () => {
        visible = !document.hidden;
        cancelAnimationFrame(frame);
        if (visible) {
          last = 0;
          frame = requestAnimationFrame(render);
        }
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        visible = false;
        cancelAnimationFrame(frame);
        setReady(false);
      };
      target!.addEventListener('pointermove', onMove);
      target!.addEventListener('pointerdown', onDown);
      target!.addEventListener('pointerup', onUp);
      target!.addEventListener('pointercancel', onUp);
      target!.addEventListener('lostpointercapture', onUp);
      target!.addEventListener('pointerleave', onLeave);
      target!.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVisibility);
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      cleanup = () => {
        target!.removeEventListener('pointermove', onMove);
        target!.removeEventListener('pointerdown', onDown);
        target!.removeEventListener('pointerup', onUp);
        target!.removeEventListener('pointercancel', onUp);
        target!.removeEventListener('lostpointercapture', onUp);
        target!.removeEventListener('pointerleave', onLeave);
        target!.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        renderer.domElement.removeEventListener(
          'webglcontextlost',
          onContextLost,
        );
        dispose();
      };
      onVisibility();
      setReady(true);
    }
    start().catch(() => {
      cleanup();
      if (!disposed) setReady(false);
    });
    return () => {
      disposed = true;
      abort.abort();
      preference.removeEventListener('change', updatePreference);
      cleanup();
    };
  }, []);

  return (
    <section
      className="login-intro"
      style={{ color: INTRO_TEXT_COLOR, background: INTRO_BACKGROUND }}
      aria-label="Ysabel Society cinematic introduction"
    >
      <div className="login-intro-top">
        <BrandLogo introPalette wordmarkOnly className="login-wordmark" />
        <span className="login-edition">DIGITAL INTELLIGENCE</span>
      </div>
      <div className="login-emblem-stage">
        <svg
          className={'login-emblem-fallback' + (ready ? ' is-ready' : '')}
          style={{ color: INTRO_LOGO_COLOR }}
          viewBox="0 0 8000 4500"
          role="img"
          aria-label="Ysabel Society emblem"
          aria-hidden={ready}
          width={8000}
          height={4500}
        >
          <defs>
            <mask
              id={fallbackMask}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={8000}
              height={4500}
              style={{ maskType: 'alpha' }}
            >
              <image
                href={appPath('/ysabel-emblem.png')}
                width={8000}
                height={4500}
              />
            </mask>
          </defs>
          <rect
            width={8000}
            height={4500}
            fill="currentColor"
            mask={`url(#${fallbackMask})`}
          />
        </svg>
        <div
          ref={host}
          className="login-three"
          role="img"
          tabIndex={ready ? 0 : -1}
          aria-label="Interactive 3D Ysabel emblem transforming into 3,120 digits, mathematical equations, and moving statistical charts. Drag to rotate, or use the left and right arrow keys."
        />
      </div>
      <p className="login-marketing-caption">
        Marketing Data of all Platforms of Ysabel
      </p>
      <div className="login-intro-bottom">
        {ready && (
          <div className="login-scene-controls">
            <button
              className="login-transform"
              type="button"
              aria-label="Transform emblem and data"
              title="Transform"
              onClick={() => {
                const state = settings.current;
                state.automatic = false;
                state.target = state.progress < 0.5 ? 1 : 0;
                setPlaying(false);
              }}
            >
              <ArrowLeftRight size={14} />
            </button>
            <button
              type="button"
              className="login-motion"
              aria-label={
                playing
                  ? 'Pause automatic animation'
                  : 'Play automatic animation'
              }
              aria-pressed={!playing}
              onClick={() => {
                const state = settings.current;
                state.automatic = !playing;
                if (!playing) {
                  state.reduced = false;
                  state.time = state.progress < 0.5 ? 1.04 : 10;
                }
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
