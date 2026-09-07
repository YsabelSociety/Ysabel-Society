'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from './workspace-intro.module.css';
import { LoadingLogo } from './loading-logo';
import { INTRO_BACKGROUND, INTRO_TEXT_COLOR } from './brand-appearance';

export const INTRO_KEY = 'ysabel:login-intro';
// Only a short reveal transition remains; loading itself has no cinematic delay.
export const INTRO_TIMING = { settle: 120, exit: 420 };
export function WorkspaceIntro({
  leaving = false,
  signingIn = false,
  error = '',
  progress = 0,
  complete = false,
  onRetry,
  onSceneReady,
}: {
  leaving?: boolean;
  signingIn?: boolean;
  error?: string;
  progress?: number;
  complete?: boolean;
  onRetry?: () => void;
  onSceneReady?: () => void;
}) {
  const [rendered, setRendered] = useState(false);
  const caption = signingIn
    ? 'Signing in…'
    : error
      ? 'Your data could not finish loading.'
      : complete
        ? 'Your marketing data is ready.'
        : 'Loading your marketing data…';
  return (
    <div
      className={styles.intro + (leaving ? ' ' + styles.leaving : '')}
      style={{ color: INTRO_TEXT_COLOR, background: INTRO_BACKGROUND }}
      role="status"
      aria-live="polite"
      aria-label={
        signingIn
          ? 'Signing in to Ysabel Society'
          : 'Loading Ysabel Society data'
      }
    >
      <LoadingLogo
        progress={progress}
        complete={complete}
        caption={caption}
        onReady={(available) => {
          setRendered(available);
          onSceneReady?.();
        }}
      />
      <span className={rendered ? styles.accessible : styles.fallback}>
        {caption}
      </span>
      {error && (
        <div className={styles.failure}>
          <p role="alert">{error}</p>
          <button className="primary" onClick={onRetry}>
            <RefreshCw size={16} /> Retry loading
          </button>
        </div>
      )}
    </div>
  );
}

export function useWorkspaceIntro(ready: boolean, sceneReady = true) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {}
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener?.('change', update);
    return () => preference.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (!ready || !sceneReady) {
      setLeaving(false);
      return;
    }
    let exit: ReturnType<typeof setTimeout> | undefined;
    const settle = setTimeout(
      () => {
        setLeaving(true);
        exit = setTimeout(
          () => setVisible(false),
          reduced ? 150 : INTRO_TIMING.exit,
        );
      },
      reduced ? 0 : INTRO_TIMING.settle,
    );
    return () => {
      clearTimeout(settle);
      if (exit) clearTimeout(exit);
    };
  }, [ready, sceneReady, reduced, visible]);
  return { visible, leaving: leaving && ready && sceneReady };
}
