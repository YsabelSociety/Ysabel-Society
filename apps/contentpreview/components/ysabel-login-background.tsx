'use client';

import { LOGIN_SCENE } from '@/lib/login-scene-config';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import type { PaintingScene } from './login-painting-scene';

export default function YsabelLoginBackground({ focused, entering }: { focused: boolean; entering: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const scene = useRef<PaintingScene | null>(null);
  const [posterReady, setPosterReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [enabledByUser, setEnabledByUser] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const motionPaused = paused || (reduced && !enabledByUser);
  const motion = useRef({ focused, entering, paused: motionPaused });
  motion.current = { focused, entering, paused: motionPaused };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(preference.matches); setEnabledByUser(false); };
    update(); preference.addEventListener('change', update);
    try { setPaused(localStorage.getItem('ysabel_login_motion_paused') === 'true'); } catch { /* Optional device preference. */ }
    if (poster.current?.complete && poster.current.naturalWidth) setPosterReady(true);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!posterReady || (reduced && !enabledByUser)) return;
    let cancelled = false;
    setAvailable(false); setSceneFailed(false);
    const start = async () => {
      if (document.hidden || cancelled || scene.current) return;
      try {
        const { createPaintingScene } = await import('./login-painting-scene');
        if (cancelled || document.hidden || scene.current || !host.current || !poster.current) return;
        scene.current = createPaintingScene(host.current, poster.current, () => motion.current, (ready) => { if (!cancelled) { setAvailable(ready); setSceneFailed(!ready); } });
      } catch { if (!cancelled) { setAvailable(false); setSceneFailed(true); } }
    };
    // Static HTML poster renders first; WebGL is an optional progressive enhancement.
    void start();
    document.addEventListener('visibilitychange', start);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', start); scene.current?.destroy(); scene.current = null; };
  }, [posterReady, reduced, enabledByUser, retry]);

  useEffect(() => { scene.current?.sync(); }, [motionPaused, focused, entering]);
  const toggle = () => {
    const next = !motionPaused;
    if (motionPaused && reduced) setEnabledByUser(true);
    setPaused(next);
    try { localStorage.setItem('ysabel_login_motion_paused', String(next)); } catch { /* Framed storage may be unavailable. */ }
  };

  return <><div ref={host} className="login-landscape" aria-hidden="true" data-animation={motionPaused ? 'paused' : available ? 'webgl' : 'poster'} style={{
    '--landscape-pad': `${LOGIN_SCENE.overscanPx}px`,
    '--focal-desktop': `${LOGIN_SCENE.desktop.focalX * 100}% ${LOGIN_SCENE.desktop.focalY * 100}%`,
    '--focal-mobile': `${LOGIN_SCENE.mobile.focalX * 100}% ${LOGIN_SCENE.mobile.focalY * 100}%`,
  } as CSSProperties}>
    <img ref={poster} className="login-painting-poster" src={LOGIN_SCENE.artwork} alt="" fetchPriority="high" width={LOGIN_SCENE.image.width} height={LOGIN_SCENE.image.height} onLoad={() => { setPosterReady(true); setFailedImage(false); }} onError={(event) => { if (!event.currentTarget.src.endsWith(LOGIN_SCENE.fallbackArtwork)) event.currentTarget.src = LOGIN_SCENE.fallbackArtwork; else setFailedImage(true); }} />
  </div>
    <div className="login-scene-controls">
      {failedImage ? <button type="button" onClick={() => { if (poster.current) { setPosterReady(false); setFailedImage(false); poster.current.src = `${LOGIN_SCENE.fallbackArtwork}?retry=${Date.now()}`; } }}>Reload painting</button> : sceneFailed && !motionPaused ? <><span>Painting shown in still mode</span><button type="button" onClick={() => setRetry(value => value + 1)}>Retry 3D animation</button></> : <>
        {reduced && !enabledByUser && <span>Reduced motion is on</span>}
        <button type="button" onClick={toggle} aria-pressed={!motionPaused} aria-label="Background animation">{motionPaused ? <Play /> : <Pause />}{motionPaused ? 'Enable animation' : 'Pause animation'}</button>
      </>}
    </div>
  </>;
}
