'use client';
import { useEffect, useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { appPath } from '@/lib/app-path';
import styles from './workspace-intro.module.css';
import { LoadingLogo } from './loading-logo';
import { INTRO_BACKGROUND, INTRO_LOGO_COLOR } from './brand-appearance';

export const INTRO_KEY = 'ysabel:login-intro';
export const INTRO_TIMING = { minimum: 1200, settle: 300, exit: 650 };
export function WorkspaceIntro({
  leaving = false,
  signingIn = false,
  error = '',
  onRetry,
  onSceneReady,
}: {
  leaving?: boolean;
  signingIn?: boolean;
  error?: string;
  onRetry?: () => void;
  onSceneReady?: () => void;
}) {
  const wordmarkMask = useId();
  return (
    <div
      className={styles.intro + (leaving ? ' ' + styles.leaving : '')}
      style={{ color: INTRO_LOGO_COLOR, background: INTRO_BACKGROUND }}
      role="status"
      aria-live="polite"
      aria-label={
        signingIn
          ? 'Signing in to Ysabel Society'
          : 'Loading Ysabel Society data'
      }
    >
      <div className={styles.light} aria-hidden="true" />
      <div className={styles.identity}>
        <LoadingLogo onReady={onSceneReady} />
        {/* Tint the original lettering's alpha silhouette without retyping or reshaping it. */}
        <svg
          className={styles.wordmark}
          viewBox="1502 2158 4996 1916"
          width={4996}
          height={1916}
          role="img"
          aria-label="Ysabel Society"
        >
          <defs>
            <mask
              id={wordmarkMask}
              maskUnits="userSpaceOnUse"
              x={1502}
              y={2158}
              width={4996}
              height={1916}
              style={{ maskType: 'alpha' }}
            >
              <image
                href={appPath('/ysabel-society-logo.png')}
                width={8000}
                height={4500}
              />
            </mask>
          </defs>
          <rect
            x={1502}
            y={2158}
            width={4996}
            height={1916}
            fill="currentColor"
            mask={`url(#${wordmarkMask})`}
          />
        </svg>
        <span className={styles.caption}>
          {signingIn
            ? 'Signing in…'
            : error
              ? 'Your data could not finish loading.'
              : 'Loading your marketing data…'}
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
    </div>
  );
}

export function useWorkspaceIntro(ready: boolean, sceneReady = true) {
  const [visible, setVisible] = useState(true);
  const [minimum, setMinimum] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {}
    const lessMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(lessMotion);
  }, []);
  useEffect(() => {
    if (!sceneReady) return;
    const timer = setTimeout(
      () => setMinimum(true),
      reduced ? 0 : INTRO_TIMING.minimum,
    );
    return () => clearTimeout(timer);
  }, [sceneReady, reduced]);
  useEffect(() => {
    if (!visible) return;
    if (!ready || !sceneReady || !minimum) {
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
  }, [ready, sceneReady, minimum, reduced, visible]);
  return { visible, leaving: leaving && ready && sceneReady };
}
