'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ResponsiveContainer as RechartsContainer } from 'recharts';

type Props = Pick<ComponentProps<typeof RechartsContainer>, 'children' | 'width' | 'height' | 'minWidth' | 'minHeight'>;

// Hidden categories and content-visibility can report 0 × 0. Retain the last
// usable measurement so Recharts does not destroy/recreate every SVG on a visit.
export function ResponsiveContainer({ children, width = '100%', height = '100%', minWidth = 0, minHeight }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
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
  }, []);
  return <div ref={host} className="stable-chart-container" style={{ width, height, minWidth, minHeight }}>
    {size.width > 0 && size.height > 0 &&
      <RechartsContainer width={size.width} height={size.height}>{children}</RechartsContainer>}
  </div>;
}
