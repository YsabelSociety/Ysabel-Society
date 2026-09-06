'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Pause, Play } from 'lucide-react';
import { appPath } from '@/lib/app-path';

const planeVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const surfaceFragment = `
  uniform sampler2D uImage;
  uniform float uProgress;
  uniform float uSculpture;
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    vec4 pixel = texture2D(uImage, vUv);
    float lightness = dot(pixel.rgb, vec3(.2126,.7152,.0722));
    float mask = uSculpture > .5 ? smoothstep(.006,.055,lightness) : 1.0-smoothstep(.68,.97,lightness);
    if (mask < .01 || pixel.a < .01) discard;
    float grain = noise(vUv*23.0)*.65 + noise(vUv*81.0)*.25 + noise(vUv*173.0)*.1;
    float threshold = uSculpture > .5 ? .34+grain*.47 : .1+grain*.5;
    float reveal = smoothstep(threshold-.08,threshold+.08,uProgress);
    float visibility = uSculpture > .5 ? reveal : 1.0-reveal;
    float edge = (1.0-smoothstep(.0,.045,abs(uProgress-threshold))) * sin(uProgress*3.14159265);
    vec3 colour = pixel.rgb;
    // Light moves across the marble; texture coordinates never warp the emblem.
    if(uSculpture > .5) {
      float beam = exp(-pow((vUv.x - .5 - uPointer.x*.24 + sin(uTime*.13)*.08)*2.3,2.0));
      colour *= .87 + .25*beam;
    }
    colour += vec3(.48,.40,.21)*edge*.5;
    gl_FragColor = vec4(colour, pixel.a*mask*visibility);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const particleVertex = `
  attribute vec3 aEnd;
  attribute vec3 aStone;
  attribute float aSeed;
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColour;
  varying float vAlpha;
  void main() {
    float p = smoothstep(.12,.9,uProgress);
    float drift = max(0.0,sin(p*3.14159265));
    vec3 target = mix(position,aEnd,p);
    float angle = aSeed*62.83 + p*4.2;
    target += vec3(cos(angle)*.8,sin(angle)*.7,sin(angle*.7)*1.5)*drift;
    target.y += sin(aSeed*35.0+uTime*.35)*drift*.15;
    vec4 viewPosition = modelViewMatrix*vec4(target,1.0);
    gl_Position = projectionMatrix*viewPosition;
    gl_PointSize = (1.0+aSeed*1.35)*uPixelRatio*(1.0+drift*.3);
    vColour = mix(vec3(.27,.24,.12),aStone,p);
    vAlpha = pow(drift,.75)*.88;
  }
`;
const particleFragment = `
  varying vec3 vColour;
  varying float vAlpha;
  void main() {
    float circle = 1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));
    gl_FragColor = vec4(vColour,circle*vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function LoginScene() {
  const host = useRef<HTMLDivElement>(null);
  const settings = useRef({
    automatic: true,
    reduced: false,
    target: 0,
    progress: 0,
    hover: false,
  });
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      settings.current.reduced = preference.matches;
      settings.current.automatic = !preference.matches;
      if (preference.matches)
        settings.current.target = settings.current.progress < 0.5 ? 0 : 1;
      setPlaying(!preference.matches);
    };
    updatePreference();
    preference.addEventListener('change', updatePreference);
    let disposed = false;
    let cleanup = () => {};
    const abort = new AbortController();
    // The original files remain intact; smaller canvases are only GPU textures.
    const loadCanvas = async (path: string, width: number, height: number) => {
      const response = await fetch(appPath(path), { signal: abort.signal });
      if (!response.ok) throw new Error('Artwork unavailable');
      const bitmap = await createImageBitmap(await response.blob(), {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high',
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        bitmap.close();
        throw new Error('Canvas unavailable');
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { canvas, context };
    };
    void Promise.all([
      import('three'),
      loadCanvas('/ysabel-emblem.png', 1536, 864),
      loadCanvas('/ysabel-classical-sculptures.png', 1024, 1024),
    ])
      .then(([T, emblemImage, stoneImage]) => {
        if (disposed || !host.current) return;
        const target = host.current;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try {
          renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
          });
        } catch {
          return;
        }
        const ratio = Math.min(devicePixelRatio, 1.5);
        renderer.setPixelRatio(ratio);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = T.SRGBColorSpace;
        target.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.OrthographicCamera(-4, 4, 3.3, -3.3, 0.1, 30);
        camera.position.z = 10;
        const group = new T.Group();
        scene.add(group);
        const pointer = new T.Vector2();
        const progress = { value: 0 },
          time = { value: 0 };
        const textures = [emblemImage, stoneImage].map(({ canvas }) => {
          const texture = new T.CanvasTexture(canvas);
          texture.colorSpace = T.SRGBColorSpace;
          texture.anisotropy = Math.min(
            4,
            renderer.capabilities.getMaxAnisotropy(),
          );
          return texture;
        });
        const geometries: InstanceType<typeof T.BufferGeometry>[] = [];
        const materials: InstanceType<typeof T.Material>[] = [];
        const makeSurface = (index: number, width: number, height: number) => {
          const geometry = new T.PlaneGeometry(width, height);
          const material = new T.ShaderMaterial({
            uniforms: {
              uImage: { value: textures[index] },
              uProgress: progress,
              uTime: time,
              uPointer: { value: pointer },
              uSculpture: { value: index },
            },
            vertexShader: planeVertex,
            fragmentShader: surfaceFragment,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          });
          geometries.push(geometry);
          materials.push(material);
          const mesh = new T.Mesh(geometry, material);
          mesh.renderOrder = index;
          group.add(mesh);
        };
        makeSurface(0, 9.95, (9.95 * 4500) / 8000);
        makeSurface(1, 5.65, 5.65);
        // Sample the supplied silhouettes, never invent or redraw the brand mark.
        const sample = (
          image: typeof emblemImage,
          width: number,
          height: number,
          invert: boolean,
        ) => {
          const { data } = image.context.getImageData(
            0,
            0,
            image.canvas.width,
            image.canvas.height,
          );
          const points: number[][] = [];
          const step = invert ? 4 : 6;
          const colour = new T.Color();
          for (let y = 0; y < image.canvas.height; y += step)
            for (let x = 0; x < image.canvas.width; x += step) {
              const i = (y * image.canvas.width + x) * 4;
              const l = (data[i] + data[i + 1] + data[i + 2]) / 765;
              if (data[i + 3] < 128 || (invert ? l > 0.45 : l < 0.07)) continue;
              colour.setRGB(
                data[i] / 255,
                data[i + 1] / 255,
                data[i + 2] / 255,
                T.SRGBColorSpace,
              );
              points.push([
                (x / image.canvas.width - 0.5) * width,
                (0.5 - y / image.canvas.height) * height,
                invert ? 0 : l * 0.45,
                colour.r,
                colour.g,
                colour.b,
              ]);
            }
          return points;
        };
        const from = sample(emblemImage, 9.95, (9.95 * 4500) / 8000, true);
        const to = sample(stoneImage, 5.65, 5.65, false);
        const count = matchMedia('(max-width:800px)').matches ? 6500 : 13000;
        const starts = new Float32Array(count * 3),
          ends = new Float32Array(count * 3),
          colours = new Float32Array(count * 3),
          seeds = new Float32Array(count);
        let randomSeed = 71421;
        const random = () => {
          randomSeed = (Math.imul(1664525, randomSeed) + 1013904223) >>> 0;
          return randomSeed / 4294967296;
        };
        for (let i = 0; i < count; i++) {
          const a = from[Math.floor(random() * from.length)] || [0, 0, 0];
          const b = to[Math.floor(random() * to.length)] || [0, 0, 0, 1, 1, 1];
          starts.set(a.slice(0, 3), i * 3);
          ends.set(b.slice(0, 3), i * 3);
          colours.set(b.slice(3, 6), i * 3);
          seeds[i] = random();
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(starts, 3));
        geometry.setAttribute('aEnd', new T.BufferAttribute(ends, 3));
        geometry.setAttribute('aStone', new T.BufferAttribute(colours, 3));
        geometry.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
        const material = new T.ShaderMaterial({
          uniforms: {
            uProgress: progress,
            uTime: time,
            uPixelRatio: { value: ratio },
          },
          vertexShader: particleVertex,
          fragmentShader: particleFragment,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        geometries.push(geometry);
        materials.push(material);
        const particles = new T.Points(geometry, material);
        particles.frustumCulled = false;
        particles.renderOrder = 2;
        group.add(particles);
        let elapsed = 0,
          previous = 0,
          frame = 0;
        const paint = () => renderer.render(scene, camera);
        const resize = () => {
          const box = target.getBoundingClientRect();
          if (!box.width || !box.height) return;
          renderer.setSize(box.width, box.height);
          const aspect = box.width / box.height,
            halfHeight = Math.max(3.3, 3.05 / aspect);
          camera.left = -halfHeight * aspect;
          camera.right = halfHeight * aspect;
          camera.top = halfHeight;
          camera.bottom = -halfHeight;
          camera.updateProjectionMatrix();
          paint();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(target);
        resize();
        const move = (event: PointerEvent) => {
          if (event.pointerType === 'touch') return;
          const box = target.getBoundingClientRect();
          pointer.set(
            (event.clientX - box.left) / box.width - 0.5,
            (event.clientY - box.top) / box.height - 0.5,
          );
          settings.current.hover = true;
          settings.current.target = Math.max(
            0,
            Math.min(1, (pointer.x + 0.5 - 0.15) / 0.7),
          );
        };
        const leave = () => {
          settings.current.hover = false;
          pointer.set(0, 0);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerleave', leave);
        const animate = (now: number) => {
          frame = requestAnimationFrame(animate);
          if (now - previous < 32) return;
          const delta = Math.min((now - previous) / 1000, 0.06);
          previous = now;
          const s = settings.current;
          if (s.automatic && !s.reduced) elapsed += delta;
          time.value = elapsed;
          if (s.automatic && !s.hover) {
            // Hold each form, then make a slow, reversible cinematic dissolve.
            const cycle = elapsed % 20;
            s.target =
              cycle < 3
                ? 0
                : cycle < 8
                  ? (cycle - 3) / 5
                  : cycle < 12
                    ? 1
                    : cycle < 17
                      ? 1 - (cycle - 12) / 5
                      : 0;
          }
          const difference = s.target - s.progress;
          s.progress = s.reduced
            ? s.target
            : Math.abs(difference) < 0.0005
              ? s.target
              : s.progress + difference * 0.075;
          progress.value = s.progress;
          if (!s.reduced) {
            group.rotation.y += (pointer.x * 0.14 - group.rotation.y) * 0.04;
            group.rotation.x += (-pointer.y * 0.09 - group.rotation.x) * 0.04;
            group.position.y = Math.sin(elapsed * 0.27) * 0.045;
          } else {
            group.rotation.set(0, 0, 0);
            group.position.y = 0;
          }
          if (s.automatic || s.hover || Math.abs(difference) > 0.0001) paint();
        };
        const visibility = () => {
          cancelAnimationFrame(frame);
          if (!document.hidden) {
            previous = performance.now();
            frame = requestAnimationFrame(animate);
          }
        };
        document.addEventListener('visibilitychange', visibility);
        const lost = (event: Event) => {
          event.preventDefault();
          cancelAnimationFrame(frame);
          setReady(false);
        };
        renderer.domElement.addEventListener('webglcontextlost', lost);
        visibility();
        setReady(true);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          document.removeEventListener('visibilitychange', visibility);
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerleave', leave);
          renderer.domElement.removeEventListener('webglcontextlost', lost);
          geometries.forEach((g) => g.dispose());
          materials.forEach((m) => m.dispose());
          textures.forEach((t) => t.dispose());
          renderer.dispose();
          renderer.domElement.remove();
          emblemImage.canvas.width = 0;
          stoneImage.canvas.width = 0;
        };
      })
      .catch(() => {
        /* The unchanged emblem remains visible if 3D is unavailable. */
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
      aria-label="Ysabel Society cinematic introduction"
    >
      <div className="login-intro-top">
        <span className="login-eyebrow">YSABEL SOCIETY</span>
        <span className="login-edition">DIGITAL INTELLIGENCE</span>
      </div>
      <div className="login-emblem-stage">
        <img
          className={'login-emblem-fallback' + (ready ? ' is-ready' : '')}
          src={appPath('/ysabel-emblem.png')}
          alt="Ysabel Society emblem"
          width={8000}
          height={4500}
        />
        <div ref={host} className="login-three" aria-hidden="true" />
      </div>
      <div className="login-intro-copy">
        <p className="login-kicker">PAST MEETS POSSIBILITY</p>
        <h2>
          The art of <em>connection.</em>
        </h2>
      </div>
      <div className="login-intro-bottom">
        <span className="login-interaction-hint">Move across to transform</span>
        {ready && (
          <div className="login-scene-controls">
            <button
              className="login-transform"
              type="button"
              onClick={() => {
                const s = settings.current;
                s.automatic = false;
                s.hover = false;
                s.target = s.progress < 0.5 ? 1 : 0;
                setPlaying(false);
              }}
            >
              <ArrowLeftRight size={14} />
              Transform
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
                settings.current.automatic = !playing;
                // Explicit playback is the visitor's motion preference.
                if (!playing) settings.current.reduced = false;
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
