'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import type { Range } from '@/lib/analytics';
const Explorer = lazy(() => import('./website-geography-explorer'));

// Keep the map engine and its reference files out of the dashboard's first load.
export function WebsiteAudienceMaps({ range }: { range?: Range }) {
  const anchor = useRef<HTMLDivElement>(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '450px' });
    if (anchor.current) observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);
  if (!range) return null;
  const loading = <div style={{ minHeight: 560, padding: 32 }} role="status"><Globe2 size={24} /><h2>Where your audience is</h2><p>Preparing your audience maps…</p></div>;
  return <div ref={anchor} id="website-audience-maps">{visible ? <Suspense fallback={loading}><Explorer range={range} /></Suspense> : loading}</div>;
}
