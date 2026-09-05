import {
  BRAND_NAME,
  type Channel,
  type Daily,
  type Post,
  type Range,
} from './analytics';

export type ReportTable = {
  key: string;
  title: string;
  source: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
  period: Range;
  scope: string;
  observedAt?: string;
  truncated?: boolean;
};
export type DataCheck = {
  key: string;
  label: string;
  status: 'imported' | 'empty' | 'unavailable';
  records: number;
  detail: string;
};
export type ImportResult = {
  daily: Daily[];
  posts: Post[];
  tables: ReportTable[];
  checks: DataCheck[];
  profile: Record<string, unknown>;
  scope: string;
};
// Leave room below D1's per-row limit for identifiers and observed timestamps.
export function validateImportSize(result: ImportResult) {
  const encoder = new TextEncoder();
  for (const item of [
    ...result.daily.map((row) => [row, row.sourceMetrics || {}]),
    ...result.posts,
    ...result.tables,
  ]) {
    if (encoder.encode(JSON.stringify(item)).byteLength > 1500000)
      throw new Error(
        'INPUT:This report is too large to store in one import. Choose a shorter date range or split the export into smaller files. No rows from this import were saved.',
      );
  }
}
export function emptyDaily(date: string, channel: Channel): Daily {
  return {
    date,
    channel,
    unit: BRAND_NAME,
    available: [],
    views: 0,
    reach: 0,
    engagements: 0,
    followers: 0,
    users: 0,
    actions: 0,
    conversions: 0,
    search: 0,
    maps: 0,
    calls: 0,
    directions: 0,
    clicks: 0,
    sessions: 0,
    engaged: 0,
    pageViews: 0,
    menu: 0,
    reservation: 0,
  };
}
export function finite(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    typeof value === 'boolean'
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function putMetric(row: Daily, key: string, value: unknown) {
  const n = finite(value);
  if (n === null) return;
  (row as unknown as Record<string, unknown>)[key] = n;
  row.available = [...new Set([...(row.available || []), key])];
}
export function mergeDaily(old: Daily | undefined, current: Daily): Daily {
  if (!old) return current;
  const merged = {
    ...old,
    ...Object.fromEntries(
      (current.available || []).map((key) => [
        key,
        (current as unknown as Record<string, unknown>)[key],
      ]),
    ),
  };
  merged.available = [
    ...new Set([...(old.available || []), ...(current.available || [])]),
  ];
  return merged;
}
export function importedPost(
  platform: Channel,
  id: string,
  timestamp: string,
  title: string,
): Post {
  return {
    id: platform + ':' + id,
    title: title.slice(0, 200) || 'Published content',
    caption: title,
    image: '',
    platform,
    format: 'Static',
    unit: BRAND_NAME,
    date: timestamp.slice(0, 10),
    publishedAt: timestamp,
    status: 'Published',
    tags: [],
    campaign: '',
    distribution: 'Organic',
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    followers: 0,
    visits: 0,
    score: 0,
    position: 0,
    scheduled: '',
    mediaType: 'image',
    origin: 'api',
    available: [],
    metricScope: 'lifetime',
    observedAt: new Date().toISOString(),
  };
}
export function putPost(post: Post, key: string, value: unknown) {
  const n = finite(value);
  if (n === null) return;
  (post as unknown as Record<string, unknown>)[key] = n;
  post.available = [...new Set([...(post.available || []), key])];
}
export function safeMedia(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}
export function resultSet(): ImportResult {
  return {
    daily: [],
    posts: [],
    tables: [],
    checks: [],
    profile: {},
    scope: 'Source-defined metrics. Unavailable values are omitted.',
  };
}
export async function collect<T>(
  result: ImportResult,
  key: string,
  label: string,
  run: () => Promise<T>,
  count: (value: T) => number,
): Promise<T | undefined> {
  try {
    const value = await run(),
      records = count(value);
    result.checks.push({
      key,
      label,
      status: records ? 'imported' : 'empty',
      records,
      detail: records
        ? 'Provider returned data.'
        : 'The provider returned no data for this request. This does not mean zero.',
    });
    return value;
  } catch (error) {
    result.checks.push({
      key,
      label,
      status: 'unavailable',
      records: 0,
      detail:
        error instanceof Error && error.message.startsWith('INPUT:')
          ? error.message.slice(6)
          : 'This report could not be imported. Check access, supported metrics and the selected dates.',
    });
    return undefined;
  }
}
export function dateList(range: Range) {
  const days: string[] = [];
  for (
    let time = Date.parse(range.start + 'T00:00:00Z');
    time <= Date.parse(range.end + 'T00:00:00Z');
    time += 86400000
  )
    days.push(new Date(time).toISOString().slice(0, 10));
  return days;
}
