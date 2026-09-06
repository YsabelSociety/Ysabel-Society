'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/** Abstract audience signals; never presented as measured account data. */
export function LoginScene() {
  const host = useRef<HTMLDivElement>(null);
  const motion = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      motion.current = !preference.matches;
      setPlaying(!preference.matches);
    };
    update();
    preference.addEventListener('change', update);
    let disposed = false;
    let cleanup = () => {};
    void import('three')
      .then((T) => {
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = T.SRGBColorSpace;
        target.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1, 0.1, 60);
        camera.position.set(0, 0, 11);
        const group = new T.Group();
        group.rotation.set(-0.28, 0.12, -0.25);
        scene.add(group);
        scene.add(new T.AmbientLight(0xbacaff, 2.2));
        const key = new T.DirectionalLight(0xffffff, 4);
        key.position.set(3, 5, 6);
        scene.add(key);
        const fill = new T.PointLight(0x54c8ff, 65, 20);
        fill.position.set(-4, -1, 4);
        scene.add(fill);
        const rim = new T.PointLight(0xb798ff, 80, 20);
        rim.position.set(4, 2, 1);
        scene.add(rim);
        const colors = [0x8dddff, 0xb3a5ff, 0xf2b7d8, 0xc6dfed, 0x75decf];
        const geometries: InstanceType<typeof T.BufferGeometry>[] = [];
        const materials: InstanceType<typeof T.Material>[] = [];
        const signals: {
          curve: InstanceType<typeof T.CatmullRomCurve3>;
          bead: InstanceType<typeof T.Mesh>;
          offset: number;
          speed: number;
        }[] = [];
        const beadGeometry = new T.SphereGeometry(0.055, 12, 8);
        geometries.push(beadGeometry);
        // Intersecting paths suggest conversations, discovery and conversion.
        for (let lane = 0; lane < 22; lane++) {
          const points = [];
          const phase = (lane / 22) * Math.PI * 2;
          for (let step = 0; step <= 128; step++) {
            const a = (step / 128) * Math.PI * 2;
            const r = 2.25 + 0.42 * Math.sin(a * 3 + phase);
            points.push(
              new T.Vector3(
                Math.cos(a) * r,
                Math.sin(a) * r * 0.76,
                0.65 * Math.sin(a * 2 + phase) + (lane - 11) * 0.032,
              ),
            );
          }
          const curve = new T.CatmullRomCurve3(points, true);
          const geometry = new T.TubeGeometry(
            curve,
            144,
            lane % 5 === 0 ? 0.022 : 0.008,
            5,
            true,
          );
          const material = new T.MeshStandardMaterial({
            color: colors[lane % colors.length],
            metalness: 0.58,
            roughness: 0.3,
            emissive: colors[lane % colors.length],
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: lane % 5 === 0 ? 0.95 : 0.44,
          });
          geometries.push(geometry);
          materials.push(material);
          group.add(new T.Mesh(geometry, material));
          if (lane % 2 === 0) {
            const beadMaterial = new T.MeshBasicMaterial({
              color: colors[lane % colors.length],
            });
            materials.push(beadMaterial);
            const bead = new T.Mesh(beadGeometry, beadMaterial);
            group.add(bead);
            signals.push({
              curve,
              bead,
              offset: lane / 22,
              speed: 0.025 + lane * 0.0005,
            });
          }
        }
        const pointer = new T.Vector2();
        const onMove = (event: PointerEvent) => {
          if (!motion.current) return;
          const box = target.getBoundingClientRect();
          pointer.set(
            (event.clientX - box.left) / box.width - 0.5,
            (event.clientY - box.top) / box.height - 0.5,
          );
        };
        const onLeave = () => pointer.set(0, 0);
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerleave', onLeave);
        let frame = 0,
          elapsed = 0,
          previous = 0;
        const paint = () => {
          for (const signal of signals)
            signal.bead.position.copy(
              signal.curve.getPointAt(
                (elapsed * signal.speed + signal.offset) % 1,
              ),
            );
          renderer.render(scene, camera);
        };
        const resize = () => {
          const box = target.getBoundingClientRect();
          if (!box.width || !box.height) return;
          renderer.setSize(box.width, box.height);
          camera.aspect = box.width / box.height;
          camera.position.z = camera.aspect < 0.9 ? 13 : 10.5;
          camera.updateProjectionMatrix();
          paint();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(target);
        resize();
        const animate = (now: number) => {
          frame = requestAnimationFrame(animate);
          if (now - previous < 32) return;
          const delta = Math.min((now - previous) / 1000, 0.05);
          previous = now;
          if (!motion.current) return;
          elapsed += delta;
          group.rotation.y +=
            (pointer.x * 0.32 +
              Math.sin(elapsed * 0.08) * 0.14 -
              group.rotation.y) *
            0.045;
          group.rotation.x +=
            (-0.28 + pointer.y * 0.2 - group.rotation.x) * 0.045;
          group.rotation.z = -0.25 + Math.sin(elapsed * 0.06) * 0.09;
          paint();
        };
        const visibility = () => {
          cancelAnimationFrame(frame);
          if (!document.hidden) {
            previous = performance.now();
            frame = requestAnimationFrame(animate);
          }
        };
        document.addEventListener('visibilitychange', visibility);
        const contextLost = (event: Event) => {
          event.preventDefault();
          cancelAnimationFrame(frame);
          setReady(false);
        };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        visibility();
        setReady(true);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          document.removeEventListener('visibilitychange', visibility);
          target.removeEventListener('pointermove', onMove);
          target.removeEventListener('pointerleave', onLeave);
          renderer.domElement.removeEventListener(
            'webglcontextlost',
            contextLost,
          );
          geometries.forEach((g) => g.dispose());
          materials.forEach((m) => m.dispose());
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        /* The static colour background keeps sign-in usable. */
      });
    return () => {
      disposed = true;
      preference.removeEventListener('change', update);
      cleanup();
    };
  }, []);
  return (
    <section
      className="login-intro"
      aria-label="Ysabel Society marketing intelligence"
    >
      <div ref={host} className="login-three" aria-hidden="true" />
      <div className="login-intro-top">
        <span className="login-eyebrow">YSABEL SOCIETY</span>
        <span className="login-edition">DIGITAL INTELLIGENCE</span>
      </div>
      <div className="login-intro-copy">
        <p className="login-kicker">A clearer perspective.</p>
        <h2>
          Every connection.
          <br />
          <em>A bigger picture.</em>
        </h2>
        <p>
          Your audience, conversations and performance.
          <br className="login-desktop-break" /> Together in one private
          workspace.
        </p>
      </div>
      <div className="login-intro-bottom">
        <div className="login-signals" aria-label="Marketing focus">
          <span>Reach</span>
          <span>Engagement</span>
          <span>Growth</span>
        </div>
        {ready && (
          <button
            type="button"
            className="login-motion"
            aria-label={
              playing
                ? 'Pause background animation'
                : 'Play background animation'
            }
            aria-pressed={!playing}
            onClick={() => {
              motion.current = !playing;
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        )}
      </div>
    </section>
  );
}
