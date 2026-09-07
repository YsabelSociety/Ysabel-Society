import { BrandLogo } from './brand-logo';
import emblemPaths from './emblem-paths.json';
import styles from './workspace-intro.module.css';
import { INTRO_LOGO_COLOR } from './brand-appearance';

// Inline original paths keep the brand visible even before any asset download.
export function LoadingIdentity({ caption }: { caption: string }) {
  return (
    <div
      className={styles.fallback}
      data-loading-identity="fallback"
      aria-hidden="true"
    >
      <div className={styles.fallbackGroup}>
        <svg
          className={styles.fallbackEmblem}
          viewBox="548 128 824 824"
          fill={INTRO_LOGO_COLOR}
        >
          {emblemPaths.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </svg>
        <BrandLogo
          introPalette
          wordmarkOnly
          className={styles.fallbackWordmark}
        />
        <span className={styles.fallbackCaption}>{caption}</span>
      </div>
    </div>
  );
}
