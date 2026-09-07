'use client';
import { useEffect, useRef } from 'react';
import { appPath } from '@/lib/app-path';
import styles from './loading-logo.module.css';
import emblemPaths from './emblem-paths.json';
import {
  INTRO_LIGHT_COLORS,
  INTRO_LOGO_MATERIAL,
  INTRO_LOGO_COLOR,
  INTRO_TEXT_COLOR,
} from './brand-appearance';

type LoadingLogoProps = {
  compact?: boolean;
  progress?: number;
  complete?: boolean;
  caption?: string;
  onReady?: (rendered: boolean) => void;
};

// The emblem is a rigid extrusion; the lettering uses the original alpha artwork.
export function LoadingLogo({
  compact = false,
  progress = 0,
  complete = false,
  caption = 'Loading your marketing data…',
  onReady,
}: LoadingLogoProps) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ progress, complete, caption, onReady });
  const repaint = useRef<() => void>(() => {});
  useEffect(() => {
    state.current = { progress, complete, caption, onReady };
    repaint.current();
  }, [progress, complete, caption, onReady]);
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let disposed = false;
    let availability: boolean | undefined;
    let cleanup = () => {};
    const abort = new AbortController();
    const announce = (rendered: boolean) => {
      if (!disposed && availability !== rendered) {
        availability = rendered;
        state.current.onReady?.(rendered);
      }
    };
    // Asset or GPU failure must never trap a ready dashboard behind an intro.
    const fallbackDeadline = setTimeout(() => announce(false), 6000);
    async function start() {
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]);
      const [
        THREE,
        { SVGLoader },
        { RoomEnvironment },
        { createIntroBackdrop },
        bitmap,
      ] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/SVGLoader.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('./intro-backdrop'),
        compact
          ? Promise.resolve(null)
          : fetch(appPath('/ysabel-society-logo.png'), { signal }).then((r) => {
              if (!r.ok) throw new Error('Lettering unavailable');
              return r.blob();
            }),
      ]);
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg">' +
        emblemPaths.map((d) => `<path d="${d}"/>`).join('') +
        '</svg>';
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({
        alpha: compact,
        antialias: !compact,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(
        Math.min(devicePixelRatio || 1, compact ? 1.5 : 1.75),
      );
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.domElement.style.visibility = 'hidden';
      target!.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(
        -3.5,
        3.5,
        3.5,
        -3.5,
        0.1,
        30,
      );
      camera.position.z = 10;
      const preference = matchMedia('(prefers-reduced-motion: reduce)');
      const pointer = new THREE.Vector2();
      const resources: { dispose: () => void }[] = [];
      let frame = 0,
        elapsed = 0,
        last = 0,
        paint = 0,
        yaw = 0.08;
      let lost = false,
        firstFrame = false,
        shownProgress = 0;
      const lifecycle: { observer?: ResizeObserver } = {};
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
        announce(false);
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
        repaint.current = () => {};
        lifecycle.observer?.disconnect();
        target!.removeEventListener('pointermove', onMove);
        target!.removeEventListener('pointerleave', onLeave);
        renderer.domElement.removeEventListener('webglcontextlost', onLost);
        document.removeEventListener('visibilitychange', onVisible);
        preference.removeEventListener('change', onPreference);
        resources.forEach((resource) => resource.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
      const background = compact
        ? null
        : createIntroBackdrop(scene, { loading: true });
      if (background) resources.push(background);
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        const environment = pmrem.fromScene(room, 0.035);
        resources.push(environment);
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
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: 32,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 0.8,
        bevelSegments: 2,
        curveSegments: compact ? 8 : 12,
      });
      resources.push(geometry);
      geometry.center();
      geometry.rotateX(Math.PI);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      const scale = (compact ? 3.1 : 2.45) / Math.max(size.x, size.y);
      geometry.scale(scale, scale, scale);
      const material = new THREE.MeshPhysicalMaterial(INTRO_LOGO_MATERIAL);
      resources.push(material);
      const logo = new THREE.Mesh(geometry, material);
      const identity = new THREE.Group();
      scene.add(identity);
      identity.add(logo);
      const lettering = new THREE.Group();
      identity.add(lettering);
      const letteringPhase = { value: 0 };
      const captionMotion = { value: 1 };

      function canvasPlane(
        canvas: HTMLCanvasElement,
        width: number,
        height: number,
        animatedCaption = false,
      ) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(
          4,
          renderer.capabilities.getMaxAnisotropy(),
        );
        const geometry = new THREE.PlaneGeometry(
          width,
          height,
          animatedCaption ? 48 : 1,
          1,
        );
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uLetteringPhase = letteringPhase;
          shader.uniforms.uCaptionMotion = captionMotion;
          shader.fragmentShader =
            'uniform float uLetteringPhase;\nuniform float uCaptionMotion;\n' +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n' +
              'float lightSweep = .5 + .5 * sin(vMapUv.x * 4.0 - uLetteringPhase);\n' +
              (animatedCaption
                ? 'float sheen=pow(lightSweep,4.0)*uCaptionMotion;\n' +
                  'diffuseColor.rgb *= mix(.9,1.45,sheen);\n' +
                  'diffuseColor.a *= 1.0 - uCaptionMotion * .12 * (1.0-lightSweep);'
                : 'diffuseColor.rgb *= mix(.82, 1.12, lightSweep);'),
          );
          if (animatedCaption) {
            shader.vertexShader =
              'uniform float uLetteringPhase;\nuniform float uCaptionMotion;\n' +
              shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\n' +
                'transformed.y += sin(uv.x*6.28318-uLetteringPhase)*.018*uCaptionMotion;',
            );
          }
        };
        material.customProgramCacheKey = () =>
          animatedCaption
            ? 'ysabel-flowing-caption-v2'
            : 'ysabel-cinematic-lettering-v1';
        resources.push(texture, geometry, material);
        const mesh = new THREE.Mesh(geometry, material);
        lettering.add(mesh);
        return { mesh, texture };
      }
      let captionTexture: InstanceType<typeof THREE.CanvasTexture> | undefined;
      let captionMesh: InstanceType<typeof THREE.Mesh> | undefined;
      let captionContext: CanvasRenderingContext2D | null = null;
      let previousCaption = '';
      if (bitmap) {
        const image = await createImageBitmap(bitmap, 1502, 2158, 4996, 1916, {
          resizeWidth: 1499,
          resizeHeight: 575,
          resizeQuality: 'high',
        });
        if (disposed) {
          image.close();
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 1499;
        canvas.height = 575;
        const context = canvas.getContext('2d');
        if (!context) {
          image.close();
          throw new Error('Lettering unavailable');
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close();
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = INTRO_TEXT_COLOR;
        context.fillRect(0, 0, canvas.width, canvas.height);
        const wordmark = canvasPlane(canvas, 2.95, (2.95 * 1916) / 4996);
        wordmark.mesh.position.set(0, -1.28, 0.12);
        const captionCanvas = document.createElement('canvas');
        captionCanvas.width = 1536;
        captionCanvas.height = 112;
        captionContext = captionCanvas.getContext('2d');
        if (!captionContext) throw new Error('Caption unavailable');
        const label = canvasPlane(
          captionCanvas,
          4.45,
          (4.45 * 112) / 1536,
          true,
        );
        label.mesh.position.set(0, -2.22, 0.14);
        captionMesh = label.mesh;
        captionTexture = label.texture;
      }
      // The arc represents completed loading stages, never elapsed time.
      const ringGeometry = new THREE.BufferGeometry();
      const points = [];
      for (let i = 0; i <= 160; i++) {
        const angle = Math.PI / 2 - (i / 160) * Math.PI * 2;
        points.push(Math.cos(angle) * 1.47, Math.sin(angle) * 1.47, -0.06);
      }
      ringGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(points, 3),
      );
      const ringMaterial = new THREE.LineBasicMaterial({
        color: INTRO_LOGO_COLOR,
        transparent: true,
        opacity: 0.25,
        toneMapped: false,
        depthWrite: false,
      });
      resources.push(ringGeometry, ringMaterial);
      const ring = new THREE.Line(ringGeometry, ringMaterial);
      ring.visible = !compact;
      ring.position.y = 0.72;
      identity.add(ring);
      scene.add(
        new THREE.HemisphereLight(
          INTRO_LIGHT_COLORS.sky,
          INTRO_LIGHT_COLORS.ground,
          1.5,
        ),
      );
      const key = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.key, 3.4);
      key.position.set(-3, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.rim, 2.2);
      rim.position.set(4, 1, -2);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(INTRO_LIGHT_COLORS.fill, 0.65);
      fill.position.set(2, -2, 3);
      scene.add(fill);
      const draw = (delta = 0) => {
        if (lost || disposed) return;
        const still = preference.matches;
        const t = still ? 0 : elapsed;
        const current = state.current;
        const targetProgress = current.complete
          ? 1
          : Math.max(0, Math.min(0.96, current.progress));
        const ease = still ? 1 : 1 - Math.exp(-delta * 9);
        captionMotion.value +=
          ((still || current.complete ? 0 : 1) - captionMotion.value) * ease;
        shownProgress += (targetProgress - shownProgress) * ease;
        ringGeometry.setDrawRange(0, Math.round(shownProgress * 160) + 1);
        if (
          captionContext &&
          captionTexture &&
          previousCaption !== current.caption
        ) {
          previousCaption = current.caption;
          const { width, height } = captionContext.canvas;
          captionContext.clearRect(0, 0, width, height);
          captionContext.font = '400 62px Arial, sans-serif';
          captionContext.letterSpacing = '3px';
          captionContext.textAlign = 'center';
          captionContext.textBaseline = 'middle';
          captionContext.fillStyle = INTRO_TEXT_COLOR;
          captionContext.fillText(
            current.caption,
            width / 2,
            height / 2,
            width - 80,
          );
          captionTexture.needsUpdate = true;
        }
        // Real completion starts the settle immediately, without an extra cycle.
        if (!still) {
          if (current.complete) {
            const nearest = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
            yaw += (nearest - yaw) * ease;
          } else if (compact) yaw += delta * (0.36 + shownProgress * 0.36);
          else yaw = 0.08 + Math.sin(t * 0.58) * 0.3;
        }
        logo.rotation.set(
          still ? -0.04 : -0.08 + Math.sin(t * 0.42) * 0.04 - pointer.y * 0.07,
          still ? 0.08 : yaw + pointer.x * 0.12,
          still ? 0 : Math.sin(t * 0.31) * 0.014,
        );
        logo.position.y = compact ? 0 : 0.72;
        identity.position.y = still ? 0 : Math.sin(t * 0.8) * 0.035;
        identity.rotation.x = still ? 0 : -pointer.y * 0.018;
        identity.rotation.y = still ? 0 : pointer.x * 0.022;
        letteringPhase.value = still ? 0 : t * 0.8;
        if (captionMesh) {
          captionMesh.position.y =
            -2.22 + Math.sin(t * 0.8) * 0.035 * captionMotion.value;
          captionMesh.rotation.x =
            Math.sin(t * 0.6) * 0.025 * captionMotion.value;
          captionMesh.scale.setScalar(
            1 + Math.sin(t * 0.8) * 0.006 * captionMotion.value,
          );
        }
        lettering.rotation.x = still ? 0 : Math.sin(t * 0.8) * 0.008;
        key.intensity = still ? 3.4 : 3.4 + Math.sin(t * 0.8) * 0.25;
        background?.update(t, pointer.x, pointer.y);
        key.position.x = -3 + (still ? 0 : Math.sin(t * 0.6) * 1.6);
        renderer.render(scene, camera);
        if (!firstFrame) {
          firstFrame = true;
          renderer.domElement.style.visibility = 'visible';
          clearTimeout(fallbackDeadline);
          announce(true);
        }
      };
      const tick = (now: number) => {
        if (disposed || lost || document.hidden) {
          frame = 0;
          return;
        }
        frame = requestAnimationFrame(tick);
        if (now - paint < 1000 / 30) return;
        const delta = last ? Math.min((now - last) / 1000, 0.1) : 1 / 30;
        elapsed += delta;
        last = now;
        paint = now;
        draw(delta);
      };
      resume = () => {
        if (disposed || lost || document.hidden) return;
        last = 0;
        draw();
        if (!preference.matches && !frame) frame = requestAnimationFrame(tick);
      };
      const resize = () => {
        const { width, height } = target!.getBoundingClientRect();
        if (!width || !height) return;
        const aspect = width / height;
        const viewHeight = compact ? 3.5 : Math.max(7, 5 / aspect);
        camera.left = (-viewHeight * aspect) / 2;
        camera.right = -camera.left;
        camera.top = viewHeight / 2;
        camera.bottom = -camera.top;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        draw();
      };
      lifecycle.observer = new ResizeObserver(resize);
      lifecycle.observer.observe(target!);
      resize();
      repaint.current = () => draw();
      target!.addEventListener('pointermove', onMove);
      target!.addEventListener('pointerleave', onLeave);
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      document.addEventListener('visibilitychange', onVisible);
      preference.addEventListener('change', onPreference);
      resume();
    }
    void start().catch(() => {
      cleanup();
      clearTimeout(fallbackDeadline);
      announce(false);
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
