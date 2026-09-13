'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ResponsiveContainer as RechartsContainer } from 'recharts';

type Props = Pick<ComponentProps<typeof RechartsContainer>, 'children' | 'width' | 'height' | 'minWidth' | 'minHeight'>;

type VisibilityListener = (visible: boolean) => void;
const visibilityListeners = new Map<Element, VisibilityListener>();
let visibilityObserver: IntersectionObserver | undefined;
let scrollRestTimer: ReturnType<typeof setTimeout> | undefined;
let scrolling = false;

function isInHiddenPage(element: Element) {
  const panel = element.closest('.visited-panel, .retained-report-panel');
  return panel instanceof HTMLElement && panel.hidden;
}

function refreshChartVisibility() {
  scrolling = false;
  const margin = 700;
  for (const [element, listener] of visibilityListeners) {
    if (isInHiddenPage(element)) continue;
    const bounds = element.getBoundingClientRect();
    listener(bounds.bottom >= -margin && bounds.top <= window.innerHeight + margin);
  }
}

function onWorkspaceScroll() {
  scrolling = true;
  clearTimeout(scrollRestTimer);
  scrollRestTimer = setTimeout(refreshChartVisibility, 140);
}

export function observeNearViewport(element: Element, listener: VisibilityListener) {
  if (!('IntersectionObserver' in window)) {
    listener(true);
    return () => {};
  }
  visibilityObserver ??= new IntersectionObserver(entries => {
    if (scrolling) return;
    for (const entry of entries) {
      if (!entry.isIntersecting && isInHiddenPage(entry.target)) continue;
      visibilityListeners.get(entry.target)?.(entry.isIntersecting);
    }
  }, { rootMargin: '700px 0px' });
  if (!visibilityListeners.size) {
    document.addEventListener('scroll', onWorkspaceScroll, { capture: true, passive: true });
  }
  visibilityListeners.set(element, listener);
  visibilityObserver.observe(element);
  return () => {
    visibilityObserver?.unobserve(element);
    visibilityListeners.delete(element);
    if (!visibilityListeners.size) {
      visibilityObserver?.disconnect();
      visibilityObserver = undefined;
      clearTimeout(scrollRestTimer);
      scrolling = false;
      document.removeEventListener('scroll', onWorkspaceScroll, true);
    }
  };
}

// Recharts creates hundreds of SVG nodes per report. Keep only charts near the
// viewport mounted; the fixed host preserves layout while distant SVGs rest.
export function ResponsiveContainer({ children, width = '100%', height = '100%', minWidth = 0, minHeight }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    return element ? observeNearViewport(element, setNearViewport) : undefined;
  }, []);
  useEffect(() => {
    const element = host.current;
    if (!element || !nearViewport) return;
    const measure = (width: number, height: number) => {
      width = Math.round(width); height = Math.round(height);
      if (width <= 0 || height <= 0) return;
      setSize(previous => previous.width === width && previous.height === height
        ? previous : { width, height });
    };
    const bounds = element.getBoundingClientRect();
    measure(bounds.width, bounds.height);
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [nearViewport]);
  return <div ref={host} className="stable-chart-container" style={{ width, height, minWidth, minHeight }}>
    {nearViewport && size.width > 0 && size.height > 0 &&
      <RechartsContainer width={size.width} height={size.height}>{children}</RechartsContainer>}
  </div>;
}
