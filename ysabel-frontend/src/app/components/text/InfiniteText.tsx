 "use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import styles from "./InfiniteText.module.css";

type InfiniteTextProps = {
  phrases?: string[];
  secondaryPhrases?: string[];
  durationSeconds?: number;
  secondaryDurationSeconds?: number;
  className?: string;
};

const defaultPhrases = ["Lenta Vita", "Lenta Vita", "New Sensations"];

const InfiniteText = ({
  phrases = defaultPhrases,
  secondaryPhrases,
  durationSeconds = 28,
  secondaryDurationSeconds,
  className,
}: InfiniteTextProps) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [colorProgress, setColorProgress] = useState(0);

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) {
      return;
    }

    let animationFrameId: number | undefined;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    const updateProgress = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 1;

      const distance = viewportHeight - rect.top;
      const maxDistance = viewportHeight + rect.height || 1;
      const progress = clamp(distance / maxDistance, 0, 1);

      setColorProgress(progress);
    };

    const handleScroll = () => {
      animationFrameId = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  const sectionStyle = useMemo(() => {
    const startColor = { r: 21, g: 16, b: 13 };
    const endColor = { r: 186, g: 132, b: 36 };

    const interpolate = (start: number, end: number, t: number) =>
      Math.round(start + (end - start) * t);

    const r = interpolate(startColor.r, endColor.r, colorProgress);
    const g = interpolate(startColor.g, endColor.g, colorProgress);
    const b = interpolate(startColor.b, endColor.b, colorProgress);

    return {
      "--infinite-text-color": `rgb(${r}, ${g}, ${b})`,
    } as CSSProperties;
  }, [colorProgress]);

  if (phrases.length === 0) {
    return null;
  }

  const resolvedSecondaryPhrases =
    secondaryPhrases && secondaryPhrases.length > 0 ? secondaryPhrases : phrases;

  const primaryDuration = Math.max(durationSeconds, 6);
  const secondaryDuration = Math.max(
    secondaryDurationSeconds ?? Math.round(primaryDuration * 1.1),
    6
  );

  const primaryStyle = {
    "--marquee-duration": `${primaryDuration}s`,
  } as CSSProperties;

  const secondaryStyle = {
    "--marquee-duration": `${secondaryDuration}s`,
  } as CSSProperties;

  const wrapperClassName = className ? `${styles.wrapper} ${className}` : styles.wrapper;

  return (
    <section
      ref={sectionRef}
      className={wrapperClassName}
      style={sectionStyle}
      aria-label="Featured phrases marquee"
    >
      <div className={styles.rows}>
        <div className={styles.row} aria-label="Marquee row scrolling left">
          <div className={styles.marquee} style={primaryStyle}>
            <div className={styles.inner}>
              {phrases.map((phrase, index) => (
                <span className={styles.text} key={`primary-phrase-${index}`}>
                  {phrase}
                </span>
              ))}
            </div>
            <div className={styles.inner} aria-hidden="true">
              {phrases.map((phrase, index) => (
                <span className={styles.text} key={`primary-clone-${index}`}>
                  {phrase}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row} aria-label="Marquee row scrolling right">
          <div className={`${styles.marquee} ${styles.reverse}`} style={secondaryStyle}>
            <div className={styles.inner}>
              {resolvedSecondaryPhrases.map((phrase, index) => (
                <span className={styles.text} key={`secondary-phrase-${index}`}>
                  {phrase}
                </span>
              ))}
            </div>
            <div className={styles.inner} aria-hidden="true">
              {resolvedSecondaryPhrases.map((phrase, index) => (
                <span className={styles.text} key={`secondary-clone-${index}`}>
                  {phrase}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfiniteText;

