import { BRAND_NAME, type Daily, type Post, type Range } from './analytics';
import type { ReportTable } from './reporting';
import type { CommunityRecord, CommunityStatus } from './community';
import type { SourceStatus } from './source-status';
import { appPath } from './app-path';

export const REPORT_SECTIONS = [
  'Overview',
  'Performance',
  'Audience',
  'Website',
  'Google Business',
  'Posts & reels',
  'Inbox',
  'Mentions',
  'Potential clients',
  'Reviews',
  'Source details',
];
export type ReportBundle = {
  scope?: 'reviews';
  reviewSelection?: CommunityRecord[];
  reviewNote?: string;
  title: string;
  range: Range;
  generatedAt: string;
  timezone: string;
  mode: string;
  rows: Daily[];
  posts: Post[];
  tables: ReportTable[];
  records: CommunityRecord[];
  sourceStatus: SourceStatus[];
  communityStatus: CommunityStatus[];
};
export type ReportProgress = (message: string) => void;

export async function loadReportBundle(
  range: Range,
  title: string,
  progress: ReportProgress,
  signal?: AbortSignal,
): Promise<ReportBundle> {
  const read = async (path: string): Promise<any> => {
    const response = await fetch(appPath('/api/' + path), {
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'Please sign in again before downloading.'
          : 'A report category could not be loaded. Retry to download the complete report.',
      );
    return response.json();
  };
  async function pages(dataset: 'posts' | 'community') {
    const records: any[] = [];
    let cursor: string | null = null,
      statuses: CommunityStatus[] = [];
    const seen = new Set<string>();
    do {
      const q = new URLSearchParams({
        dataset,
        start: range.start,
        end: range.end,
      });
      if (cursor) q.set('cursor', cursor);
      const page = await read('report-data?' + q);
      records.push(...page.records);
      if (page.statuses?.length) statuses = page.statuses;
      cursor = page.nextCursor;
      if (cursor && seen.has(cursor))
        throw new Error(
          'The full report could not be collected. Please retry.',
        );
      if (cursor) seen.add(cursor);
      progress(
        'Collecting ' +
          (dataset === 'posts' ? 'posts' : 'messages, mentions and reviews') +
          ' · ' +
          records.length.toLocaleString() +
          ' records',
      );
    } while (cursor);
    return { records, statuses };
  }
  progress('Collecting all platforms and categories…');
  const [analytics, posts, community, state] = await Promise.all([
    read(
      'analytics?' +
        new URLSearchParams({
          unit: BRAND_NAME,
          start: range.start,
          end: range.end,
        }),
    ),
    pages('posts'),
    pages('community'),
    read('state'),
  ]);
  return {
    title,
    range: { ...range },
    generatedAt: new Date().toISOString(),
    timezone: state.settings?.timezone || 'Europe/Tirane',
    mode: analytics.mode,
    rows: analytics.rows || [],
    tables: (analytics.tables || []).filter(
      (t: ReportTable) =>
        t.source !== 'gbp' ||
        (t.period.start <= range.end && t.period.end >= range.start),
    ),
    posts: analytics.mode === 'demo' ? state.posts || [] : posts.records,
    records: community.records,
    sourceStatus: analytics.sourceStatus || [],
    communityStatus: community.statuses,
  };
}

export async function downloadFullReport(
  range: Range,
  title: string,
  progress: ReportProgress,
  signal?: AbortSignal,
) {
  const bundle = await loadReportBundle(range, title, progress, signal);
  const { downloadReportPDF } = await import('./report-pdf');
  await downloadReportPDF(bundle, progress, signal);
}
