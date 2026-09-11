'use client';
import { useEffect } from 'react';

// One listener for the workspace; no React renders on scroll.
export function useScrollBudget() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const root = document.documentElement;
    const rest = () => { delete root.dataset.scrolling; };
    const scroll = () => {
      root.dataset.scrolling = 'true';
      clearTimeout(timer);
      timer = setTimeout(rest, 180);
    };
    const options = { capture: true, passive: true };
    document.addEventListener('scroll', scroll, options);
    return () => {
      document.removeEventListener('scroll', scroll, options);
      clearTimeout(timer);
      rest();
    };
  }, []);
}
