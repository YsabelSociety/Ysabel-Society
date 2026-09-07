'use client';
import { useEffect, useRef } from 'react';
import { appPath } from '@/lib/app-path';
import styles from './loading-logo.module.css';
import { INTRO_LIGHT_COLORS, INTRO_LOGO_MATERIAL } from './brand-appearance';

// Both loading surfaces use the supplied emblem, extruded as one rigid shape.
export function LoadingLogo({
  compact = false,
  onReady,
}: {
  compact?: boolean;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let disposed = false,
      announced = false;
    let cleanup = () => {};
    const abort = new AbortController();
    const announce = () => {
      if (!disposed && !announced) {
        announced = true;
        ready.current?.();
      }
    };
    // An unsupported GPU or slow module download must not block access to data.
    const fallbackDeadline = setTimeout(announce, 6000);
    async function start() {
      const [THREE, { SVGLoader }, { RoomEnvironment }, response] =
        await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/SVGLoader.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          fetch(appPath('/ysabel-emblem-source.svg'), {
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]),
          }),
        ]);
      if (!response.ok) throw new Error('Logo unavailable');
      const svg = await response.text();
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !compact,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(
        Math.min(devicePixelRatio || 1, compact ? 1.5 : 1.75),
      );
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      target!.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
      camera.position.z = 7.4;
      const preference = matchMedia('(prefers-reduced-motion: reduce)');
      const pointer = new THREE.Vector2();
      let frame = 0,
        elapsed = 0,
        last = 0,
        paint = 0,
        lost = false,
        firstFrame = false;
      let geometry: InstanceType<typeof THREE.ExtrudeGeometry> | undefined;
      let material: InstanceType<typeof THREE.MeshPhysicalMaterial> | undefined;
      let environment: InstanceType<typeof THREE.WebGLRenderTarget> | undefined;
      let observer: ResizeObserver | undefined;
      const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
      };
      const onMove = (event: PointerEvent) => {
        if (preference.matches || compact) return;
        const rect = target!.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          ((event.clientY - rect.top) / rect.height) * 2 - 1,
        );
      };
      const onLeave = () => pointer.set(0, 0);
      const onLost = (event: Event) => {
        event.preventDefault();
        lost = true;
        stop();
        announce();
      };
      let resume = () => {};
      const onVisible = () => {
        if (document.hidden) stop();
        else resume();
      };
      const onPreference = () => {
        stop();
        resume();
      };
      cleanup = () => {
        stop();
        observer?.disconnect();
        target!.removeEventListener('pointermove', onMove);
        target!.removeEventListener('pointerleave', onLeave);
        renderer.domElement.removeEventListener('webglcontextlost', onLost);
        document.removeEventListener('visibilitychange', onVisible);
        preference.removeEventListener('change', onPreference);
        geometry?.dispose();
        material?.dispose();
        environment?.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        environment = pmrem.fromScene(room, 0.045);
        scene.environment = Array.isArray(environment.texture)
          ? environment.texture[0]
          : environment.texture;
      } finally {
        room.dispose();
        pmrem.dispose();
      }
      const shapes = new SVGLoader()
        .parse(svg)
        .paths.flatMap((path) => path.toShapes());
      geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: 32,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 0.8,
        bevelSegments: 2,
        curveSegments: compact ? 8 : 12,
      });
      geometry.center();
      geometry.rotateX(Math.PI);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      const scale = 3.1 / Math.max(size.x, size.y);
      geometry.scale(scale, scale, scale);
      material = new THREE.MeshPhysicalMaterial(INTRO_LOGO_MATERIAL);
      const logo = new THREE.Mesh(geometry, material);
      scene.add(logo);
      scene.add(
        new THREE.HemisphereLight(
          INTRO_LIGHT_COLORS.sky,
          INTRO_LIGHT_COLORS.ground,
          2.1,
        ),
      );
      const key = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.key, 5.5);
      key.position.set(-3, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.rim, 4);
      rim.position.set(4, 1, -2);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.fill, 0.85);
      fill.position.set(2, -2, 3);
      scene.add(fill);
      const smooth = (t: number) => {
        const x = Math.min(1, Math.max(0, t));
        return x * x * (3 - 2 * x);
      };
      const draw = () => {
        if (lost || disposed) return;
        const still = preference.matches;
        const t = still ? 2 : elapsed;
        logo.rotation.x +=
          ((still
            ? -0.06
            : -0.08 + Math.sin(t * 0.42) * 0.055 - pointer.y * 0.12) -
            logo.rotation.x) *
          0.07;
        logo.rotation.y +=
          ((still ? 0.12 : 0.12 + t * 0.42 + pointer.x * 0.22) -
            logo.rotation.y) *
          0.07;
        logo.rotation.z = still ? 0 : Math.sin(t * 0.31) * 0.018;
        logo.position.y = still ? 0 : Math.sin(t * 0.85) * 0.045;
        camera.position.z = 7.4 + (still ? 0 : 0.65 * (1 - smooth(t / 1.5)));
        key.position.x = -3 + (still ? 0 : Math.sin(t * 0.8) * 2.4);
        renderer.render(scene, camera);
        if (!firstFrame) {
          firstFrame = true;
          clearTimeout(fallbackDeadline);
          announce();
        }
      };
      const tick = (now: number) => {
        if (disposed || lost || document.hidden) {
          frame = 0;
          return;
        }
        frame = requestAnimationFrame(tick);
        if (now - paint < 1000 / 30) return;
        elapsed += last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        paint = now;
        draw();
      };
      resume = () => {
        if (disposed || lost || document.hidden) return;
        last = 0;
        draw();
        if (!preference.matches && !frame) frame = requestAnimationFrame(tick);
      };
      observer = new ResizeObserver(() => {
        const { width, height } = target!.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        draw();
      });
      observer.observe(target!);
      const rect = target!.getBoundingClientRect();
      camera.aspect = (rect.width || 300) / (rect.height || 300);
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width || 300, rect.height || 300, false);
      target!.addEventListener('pointermove', onMove);
      target!.addEventListener('pointerleave', onLeave);
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      document.addEventListener('visibilitychange', onVisible);
      preference.addEventListener('change', onPreference);
      resume();
    }
    void start().catch(() => {
      cleanup();
      if (!disposed) announce();
    });
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(fallbackDeadline);
      cleanup();
    };
  }, [compact]);
  return (
    <div
      ref={host}
      className={styles.scene + (compact ? ' ' + styles.compact : '')}
      aria-hidden="true"
    />
  );
}
