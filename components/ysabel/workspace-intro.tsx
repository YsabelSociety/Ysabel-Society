'use client';
import { useEffect, useState } from 'react';
import { BrandLogo } from './brand-logo';
import styles from './workspace-intro.module.css';

export const INTRO_KEY = 'ysabel:login-intro';
export function WorkspaceIntro({
  leaving = false,
  signingIn = false,
}: {
  leaving?: boolean;
  signingIn?: boolean;
}) {
  return (
    <div
      className={`${styles.intro} ${leaving ? styles.leaving : ''}`}
      role="status"
      aria-live="polite"
      aria-label={
        signingIn
          ? 'Signing in to Ysabel Society'
          : 'Preparing your Ysabel Society workspace'
      }
    >
      <div className={styles.light} aria-hidden="true" />
      <div className={styles.identity}>
        <div className={styles.logo}>
          <BrandLogo />
        </div>
        <p>MARKETING INTELLIGENCE</p>
        <div className={styles.track} aria-hidden="true">
          <span />
        </div>
        <span className={styles.caption}>
          {signingIn ? 'Signing in…' : 'Preparing your workspace…'}
        </span>
      </div>
    </div>
  );
}

export function useWorkspaceIntro(ready: boolean) {
  const [visible, setVisible] = useState(true);
  const [minimum, setMinimum] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let entered = false;
    try {
      entered = Date.now() - Number(sessionStorage.getItem(INTRO_KEY)) < 60000;
      sessionStorage.removeItem(INTRO_KEY);
    } catch {
      /* The intro still works when browser storage is disabled. */
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(
      () => setMinimum(true),
      entered && !reduced ? 1500 : 0,
    );
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready || !minimum) return;
    setLeaving(true);
    const timer = setTimeout(() => setVisible(false), 550);
    return () => clearTimeout(timer);
  }, [ready, minimum]);
  return { visible, leaving };
}
