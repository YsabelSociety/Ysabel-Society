import { type Daily, type Post, type Range } from './analytics';
import { type ReportTable } from './reporting';

export const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'TikTok'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialMetric =
  | 'profileViews'
  | 'views'
  | 'reach'
  | 'engagements'
  | 'followers'
  | 'users'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'reshares'
  | 'reposts'
  | 'posts'
  | 'stories'
  | 'reels'
  | 'videos';
export type PerformanceBasis = 'Published content' | 'Daily activity';
export const SOCIAL_METRICS: { key: SocialMetric; label: string }[] = [
  { key: 'profileViews', label: 'Profile views' },
  { key: 'views', label: 'Content views' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagements', label: 'Engagements' },
  { key: 'followers', label: 'Followers' },
  { key: 'users', label: 'Users / viewers' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'reshares', label: 'Reshares' },
  { key: 'reposts', label: 'Reposts' },
  { key: 'posts', label: 'Published posts' },
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
  { key: 'videos', label: 'Videos' },
];
export const SOURCE_PLATFORM: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  ga4: 'Website',
  gbp: 'Google Business',
};
const valid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
function read(record: Daily | Post, key: string): number | null {
  const value = (record as unknown as Record<string, unknown>)[key];
  return (!record.available || record.available.includes(key)) && valid(value)
    ? value
    : null;
}
export function contentKind(post: Post) {
  const format = post.format.toLowerCase();
  return format.includes('story')
    ? 'Stories'
    : format.includes('reel')
      ? 'Reels'
      : format.includes('video')
        ? 'Videos'
        : 'Posts';
}
export function selectContent(
  posts: Post[],
  channels: readonly string[],
  range: Range,
  format = 'All content',
) {
  // Newer observations replace duplicate records; lifetime and period metrics are never mixed.
  const selected = new Map<string, Post>();
  for (const post of posts) {
    if (
      !channels.includes(post.platform) ||
      post.date < range.start ||
      post.date > range.end ||
      post.status !== 'Published' ||
      post.metricScope === 'period' ||
      (format !== 'All content' && contentKind(post) !== format)
    )
      continue;
    const key = post.platform + ':' + post.id;
    if (
      !selected.has(key) ||
      (post.observedAt || '') > (selected.get(key)?.observedAt || '')
    )
      selected.set(key, post);
  }
  return [...selected.values()];
}
export function postValue(post: Post, metric: SocialMetric): number | null {
  if (metric === 'followers' || metric === 'profileViews') return null;
  if (metric === 'posts') return contentKind(post) === 'Stories' ? 0 : 1;
  if (['stories', 'reels', 'videos'].includes(metric))
    return contentKind(post).toLowerCase() === metric ? 1 : 0;
  if (metric === 'users') return read(post, 'mediaViewers');
  if (metric === 'engagements') {
    const supplied = read(post, 'engagements');
    if (supplied !== null) return supplied;
    const actions = ['likes', 'comments', 'shares', 'saves']
      .map((key) => read(post, key))
      .filter(valid);
    return actions.length ? actions.reduce((a, b) => a + b, 0) : null;
  }
  return read(post, metric);
}
export function dailyValue(row: Daily, metric: SocialMetric): number | null {
  if (metric === 'users')
    return read(row, 'users') ?? read(row, 'mediaViewers');
  return read(row, metric);
}
export function metricBasis(metric: SocialMetric, basis: PerformanceBasis) {
  return metric === 'followers' ||
    metric === 'users' ||
    metric === 'profileViews'
    ? 'Daily activity'
    : ['posts', 'stories', 'reels', 'videos'].includes(metric)
      ? 'Published content'
      : basis;
}
export function bucketDate(date: string, granularity: string) {
  if (granularity === 'Monthly') return date.slice(0, 7) + '-01';
  if (granularity !== 'Weekly') return date;
  const day = new Date(date + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export type MetricPoint = { date: string } & Record<
  string,
  string | number | null
>;
export function performanceSeries(
  rows: Daily[],
  posts: Post[],
  channels: readonly string[],
  range: Range,
  metric: SocialMetric,
  basis: PerformanceBasis,
  granularity = 'Daily',
) {
  const effective = metricBasis(metric, basis);
  const buckets = new Map<string, MetricPoint>();
  // Explicit nulls preserve missing days, including when another platform has data.
  for (
    let time = Date.parse(range.start + 'T12:00:00Z');
    time <= Date.parse(range.end + 'T12:00:00Z');
    time += 86400000
  ) {
    const date = bucketDate(
      new Date(time).toISOString().slice(0, 10),
      granularity,
    );
    if (!buckets.has(date))
      buckets.set(date, {
        date,
        ...Object.fromEntries(channels.map((c) => [c, null])),
      });
  }
  const input =
    effective === 'Published content'
      ? selectContent(posts, channels, range).map((p) => ({
          channel: p.platform,
          date: p.date,
          value: postValue(p, metric),
        }))
      : rows
          .filter(
            (r) =>
              channels.includes(r.channel) &&
              r.date >= range.start &&
              r.date <= range.end,
          )
          .map((r) => ({
            channel: r.channel,
            date: r.date,
            value: dailyValue(r, metric),
          }));
  const latest = new Map<string, string>();
  for (const record of input) {
    if (record.value === null) continue;
    const key = bucketDate(record.date, granularity),
      point = buckets.get(key);
    if (!point) continue;
    const latestKey = key + record.channel;
    if (metric === 'followers') {
      if (!latest.has(latestKey) || record.date >= latest.get(latestKey)!) {
        point[record.channel] = record.value;
        latest.set(latestKey, record.date);
      }
    } else
      point[record.channel] = Number(point[record.channel] ?? 0) + record.value;
  }
  return [...buckets.values()];
}
export function seriesTotal(
  points: MetricPoint[],
  channel: string,
  metric: SocialMetric,
): number | null {
  const values = points.map((p) => p[channel]).filter(valid);
  return values.length
    ? metric === 'followers'
      ? values.at(-1)!
      : values.reduce((a, b) => a + b, 0)
    : null;
}
export function metricExplanation(
  metric: SocialMetric,
  basis: PerformanceBasis,
) {
  if (metric === 'profileViews')
    return 'Visits to the account profile or Facebook Page on each date. TikTok profile visits require a TikTok Studio report; the current connection supplies public video totals only.';
  if (metric === 'followers')
    return 'Recorded follower snapshots. Missing dates stay blank; weekly and monthly points use the latest observation.';
  if (metric === 'users')
    return 'Provider-reported daily users or unique media viewers. Repeat viewers across dates are not deduplicated. Reach is not substituted for users.';
  if (['posts', 'stories', 'reels', 'videos'].includes(metric))
    return 'Counts of imported published content, grouped by publication date. Expired or unimported stories are not included. Posts exclude stories; reels and videos are subsets of posts.';
  if (metricBasis(metric, basis) === 'Published content')
    return (
      'Lifetime totals on imported content published in the selected dates, grouped by publication date. These are not activity totals for that day.' +
      (metric === 'reach'
        ? ' Reach is summed across posts and is not a deduplicated audience.'
        : metric === 'engagements'
          ? ' Uses reported engagements, or the available likes, comments, shares and saves; missing actions are omitted.'
          : '')
    );
  return 'Activity reported for each day. Missing platform reports remain blank. Platform definitions may differ.';
}
export function latestAudienceTables(
  tables: ReportTable[],
  channels: readonly string[],
  dimension: 'country' | 'gender',
) {
  const chosen = new Map<string, ReportTable>();
  for (const table of tables) {
    const platform = SOURCE_PLATFORM[table.source];
    if (!channels.includes(platform)) continue;
    const normalizedExport =
      table.key.startsWith('audience-file-') &&
      table.columns.includes(dimension) &&
      table.columns.includes('followers');
    const matching =
      normalizedExport ||
      (dimension === 'gender'
        ? table.key === 'audience-gender'
        : table.key === 'audience-country' ||
          table.key === 'audience-page_follows_country' ||
          table.key === 'website-countries');
    if (!matching) continue;
    const previous = chosen.get(platform);
    if (
      !previous ||
      table.period.end > previous.period.end ||
      (table.period.end === previous.period.end &&
        (table.observedAt || '') > (previous.observedAt || ''))
    )
      chosen.set(platform, table);
  }
  return chosen;
}
export function genderDistribution(
  tables: ReportTable[],
  channels: readonly string[],
) {
  const selected = latestAudienceTables(tables, channels, 'gender');
  return ['Women', 'Men', 'Other / unspecified'].map((label) => {
    const point: Record<string, string | number | null> = { label };
    for (const channel of channels) {
      const table = selected.get(channel);
      const matches = table?.rows.filter((r) => {
        const gender = String(r.gender ?? '')
          .trim()
          .toLowerCase();
        return (
          (['f', 'female', 'woman', 'women'].includes(gender)
            ? 'Women'
            : ['m', 'male', 'man', 'men'].includes(gender)
              ? 'Men'
              : 'Other / unspecified') === label
        );
      });
      const values = matches?.map((r) => r.followers).filter(valid) || [];
      point[channel] = values.length ? values.reduce((a, b) => a + b, 0) : null;
    }
    return point;
  });
}
