'use client';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from './workspace-intro.module.css';
import { LoadingIdentity } from './loading-identity';
import { LOADING_BACKGROUND, INTRO_TEXT_COLOR } from './brand-appearance';

export const INTRO_KEY = 'ysabel:login-intro';
// Only a short reveal transition remains; loading itself has no cinematic delay.
export const INTRO_TIMING = { settle: 40, exit: 180, maximum: 700 };
export function WorkspaceIntro({
  animate = true,
  leaving = false,
  signingIn = false,
  error = '',
  progress = 0,
  complete = false,
  refreshing = false,
  onRetry,
  onSceneReady,
}: {
  animate?: boolean;
  leaving?: boolean;
  signingIn?: boolean;
  error?: string;
  progress?: number;
  complete?: boolean;
  refreshing?: boolean;
  onRetry?: () => void;
  onSceneReady?: () => void;
}) {
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
      style={{ color: INTRO_TEXT_COLOR, background: LOADING_BACKGROUND }}
      role="status"
      aria-live="polite"
      aria-label={
        signingIn
          ? 'Signing in to Ysabel Society'
          : 'Loading Ysabel Society data'
      }
    >
      <LoadingIdentity caption={caption} />
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

export function useWorkspaceIntro(_ready: boolean) {
  useEffect(() => {
    try { sessionStorage.removeItem(INTRO_KEY); } catch {}
  }, []);
  // The workspace renders immediately. Each report owns its actual loading state.
  return { visible: false, leaving: false };
}
