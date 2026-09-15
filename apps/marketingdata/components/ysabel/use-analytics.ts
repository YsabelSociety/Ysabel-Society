'use client';
import { useEffect, useRef, useState } from 'react';
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
  const reportCache = useRef(new Map<string, { at: number; data: any }>());
  const comparisonCache = useRef<{ key: string; at: number; rows: Daily[] } | null>(null);
  const [result, setResult] = useState<{
    key: string;
    mode: 'demo' | 'live';
    rows: Daily[];
    previous: Daily[];
    coverage: string[];
    sourceStatus: SourceStatus[];
    websiteRealtime?: WebsiteRealtime;
    posts: Post[];
    monthlyPosts: Post[];
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
    setError('');
    async function run() {
      try {
        const read = async (r: Range, dailyOnly = false) => {
          const q = new URLSearchParams({ unit, start: r.start, end: r.end });
          if (dailyOnly) q.set('dailyOnly', '1');
          const cacheKey = revision + '|' + q.toString();
          const cachedReport = reportCache.current.get(cacheKey);
          if (cachedReport && Date.now() - cachedReport.at < 30000) return cachedReport.data;
          const response = await fetch('/marketingdata/api/analytics?' + q, {
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
          });
          const data: any = await response.json();
          if (!response.ok) throw new Error(data.error);
          if (!abort.signal.aborted) {
            reportCache.current.set(cacheKey, { at: Date.now(), data });
            while (reportCache.current.size > 6) reportCache.current.delete(reportCache.current.keys().next().value!);
          }
          return data;
        };
        // Comparison failures must never discard a valid current-period report.
        const cached = comparisonCache.current;
        const previousRequest = comparison === 'No Comparison'
          ? Promise.resolve({ rows: [] })
          : cached?.key === key && Date.now() - cached.at < 60000
            ? Promise.resolve({ rows: cached.rows })
            : read(previousRange(range, comparison), true).then(data => {
                if (!abort.signal.aborted) comparisonCache.current = { key, at: Date.now(), rows: data.rows };
                return data;
              }).catch(() => ({ rows: [] }));
        const currentRequest = read(range);
        // Render the small daily-metric response while media and report tables load.
        const summaryRequest = read(range, true).then(summary => {
          if (abort.signal.aborted) return;
          setResult(saved => saved?.key === key ? saved : {
            key, mode: summary.mode, rows: summary.rows || [], previous: [],
            coverage: [], sourceStatus: [], posts: [], monthlyPosts: [], tables: [],
            comparisonLimited: comparison !== 'No Comparison',
          });
        }).catch(() => {});
        const current = await currentRequest;
        const previous = { rows: [] as Daily[] };
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
          setResult(saved => ({
            key,
            mode: current.mode,
            rows: current.rows,
            previous: saved?.key === key ? saved.previous : safePrevious,
            comparisonLimited: saved?.key === key ? saved.comparisonLimited :
              current.mode === 'live' &&
              comparison !== 'No Comparison' &&
              !safePrevious.some((r: Daily) => r.available?.length),
            coverage: current.coverage,
            sourceStatus: current.sourceStatus || [],
            websiteRealtime: current.accounts?.find(
              (a: any) => a.source === 'ga4',
            )?.snapshot?.realtime,
            posts: current.posts || [],
            monthlyPosts: current.monthlyPosts || [],
            tables: current.tables || [],
          }));
          setError('');
          window.dispatchEvent(new Event('ysabel:sources-rendered'));
          setLoading(false);
          void summaryRequest;
          const prior = await previousRequest;
          if (!abort.signal.aborted) {
            const compared = current.mode === 'live'
              ? comparablePrevious(current.rows, prior.rows, range, previousRange(range, comparison))
              : prior.rows;
            setResult(value => value?.key === key ? {
              ...value,
              previous: compared,
              comparisonLimited: current.mode === 'live' && comparison !== 'No Comparison' &&
                !compared.some((row: Daily) => row.available?.length),
            } : value);
          }
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
    monthlyPosts: current?.monthlyPosts ?? [],
    tables: current?.tables ?? [],
    comparisonLimited: current?.comparisonLimited ?? false,
    ready: !!current,
    // A background import must not replace already-loaded charts with skeletons.
    // A new date/filter key still waits for its own correctly scoped result.
    loading: !current && loading,
    refreshing: !!current && loading,
    error,
  };
}
