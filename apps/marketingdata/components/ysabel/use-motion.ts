'use client';
import { useSyncExternalStore } from 'react';
// Keep CSS micro-motion, but avoid simultaneous JS chart interpolation on touch devices.
const query = '(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 767px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useMinimalMotion() {
  return !useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
