'use client';
import { useEffect, useState } from 'react';
import {
  filterDaily,
  comparablePrevious,
  previousRange,
  type Range,
  type Daily,
  type Post,
} from '@/lib/analytics';
import { type ReportTable } from '@/lib/reporting';
import { type SourceStatus, type WebsiteRealtime } from '@/lib/source-status';
export function useSourceAnalytics(
  unit: string,
  range: Range,
  comparison: string,
  onLive?: () => void,
) {
  const [result, setResult] = useState<{
    key: string;
    mode: 'demo' | 'live';
    rows: Daily[];
    previous: Daily[];
    coverage: string[];
    sourceStatus: SourceStatus[];
    websiteRealtime?: WebsiteRealtime;
    posts: Post[];
    tables: ReportTable[];
    comparisonLimited: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener('ysabel:sources-updated', refresh);
    return () => window.removeEventListener('ysabel:sources-updated', refresh);
  }, []);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const key = unit + '|' + range.start + '|' + range.end + '|' + comparison;
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    async function run() {
      try {
        const read = async (r: Range) => {
          const q = new URLSearchParams({ unit, start: r.start, end: r.end });
          const response = await fetch('/marketingdata/api/analytics?' + q, {
            signal: abort.signal,
          });
          const data: any = await response.json();
          if (!response.ok) throw new Error(data.error);
          return data;
        };
        const [current, previous] = await Promise.all([
          read(range),
          comparison === 'No Comparison'
            ? Promise.resolve({ rows: [] })
            : read(previousRange(range, comparison)),
        ]);
        if (!abort.signal.aborted) {
          if (current.mode === 'live') onLive?.();
          const safePrevious =
            current.mode === 'live'
              ? comparablePrevious(
                  current.rows,
                  previous.rows,
                  range,
                  previousRange(range, comparison),
                )
              : previous.rows;
          setResult({
            key,
            mode: current.mode,
            rows: current.rows,
            previous: safePrevious,
            comparisonLimited:
              current.mode === 'live' &&
              comparison !== 'No Comparison' &&
              !safePrevious.some((r: Daily) => r.available?.length),
            coverage: current.coverage,
            sourceStatus: current.sourceStatus || [],
            websiteRealtime: current.accounts?.find(
              (a: any) => a.source === 'ga4',
            )?.snapshot?.realtime,
            posts: current.posts || [],
            tables: current.tables || [],
          });
          setError('');
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Could not load analytics.',
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void run();
    return () => abort.abort();
  }, [key, revision, onLive]);
  const current = result?.key === key ? result : null;
  const live = result?.mode === 'live';
  return {
    mode: current?.mode ?? (live ? 'live' : 'demo'),
    rows: current?.rows ?? (live || !result ? [] : filterDaily(unit, range)),
    previous:
      current?.previous ??
      (live || comparison === 'No Comparison'
        ? []
        : filterDaily(unit, previousRange(range, comparison))),
    coverage: current?.coverage ?? [],
    sourceStatus: current?.sourceStatus ?? [],
    websiteRealtime: current?.websiteRealtime,
    posts: current?.posts ?? [],
    tables: current?.tables ?? [],
    comparisonLimited: current?.comparisonLimited ?? false,
    loading,
    error,
  };
}
