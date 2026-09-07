'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from './workspace-intro.module.css';
import { LoadingLogo } from './loading-logo';
import { LoadingIdentity } from './loading-identity';
import { LOADING_BACKGROUND, INTRO_TEXT_COLOR } from './brand-appearance';

export const INTRO_KEY = 'ysabel:login-intro';
// Only a short reveal transition remains; loading itself has no cinematic delay.
export const INTRO_TIMING = { settle: 120, exit: 420 };
export function WorkspaceIntro({
  leaving = false,
  signingIn = false,
  error = '',
  progress = 0,
  complete = false,
  refreshing = false,
  onRetry,
  onSceneReady,
}: {
  leaving?: boolean;
  signingIn?: boolean;
  error?: string;
  progress?: number;
  complete?: boolean;
  refreshing?: boolean;
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
        : refreshing
          ? 'Refreshing your marketing data…'
          : 'Loading your marketing data…';
  return (
    <div
      className={styles.intro + (leaving ? ' ' + styles.leaving : '')}
      data-rendered={rendered}
      style={{ color: INTRO_TEXT_COLOR, background: LOADING_BACKGROUND }}
      role="status"
      aria-live="polite"
      aria-label={
        signingIn
          ? 'Signing in to Ysabel Society'
          : 'Loading Ysabel Society data'
      }
    >
      <div className={styles.gpu} aria-hidden="true">
        <LoadingLogo
          progress={progress}
          complete={complete}
          refreshing={refreshing}
          caption={caption}
          onReady={(available) => {
            setRendered(available);
            onSceneReady?.();
          }}
        />
      </div>
      {!rendered && <LoadingIdentity caption={caption} />}
      <span className={styles.accessible}>{caption}</span>
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
