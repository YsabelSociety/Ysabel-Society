import type { Post, Range } from './analytics';
import { emptyDaily, putMetric } from './reporting';
export const TIKTOK_PROFILE_SCOPES = ['user.insights', 'user.info.username'];
export function hasTikTokProfileAccess(scopes: unknown) {
  const granted = new Set(typeof scopes === 'string' ? scopes.split(/[\s,]+/) : []);
  return TIKTOK_PROFILE_SCOPES.every(scope => granted.has(scope));
}
const day = (time: number) => new Date(time).toISOString().slice(0, 10);
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && day(Date.parse(value)) === value;
}
// TikTok reports UTC dates, permits a 60-day lookback, and processes daily data later.
export function tikTokProfileWindow(range?: Range, now = Date.now()): Range | null {
  const today = Date.parse(day(now));
  const floor = day(today - 60 * 86400000), yesterday = day(today - 86400000);
  if (range && (!validDate(range.start) || !validDate(range.end) || range.start > range.end))
    throw new Error('INPUT:Choose valid dates for TikTok profile visits.');
  const start = range && range.start > floor ? range.start : floor;
  const end = range && range.end < yesterday ? range.end : yesterday;
  return start <= end ? { start, end } : null;
}
// Open IDs differ between apps. Match the Business username to a canonical share
// URL from the authorized Display API; a display name is insufficient evidence.
export function tikTokPublishedHandles(posts: Post[]) {
  const handles = new Set<string>();
  for (const post of posts) {
    if (post.platform !== 'TikTok') continue;
    try {
      const url = new URL(post.permalink || '');
      const match = /^\/@([\w.]+)\/video\/\d+\/?$/.exec(url.pathname);
      if (url.protocol === 'https:' && ['www.tiktok.com', 'tiktok.com'].includes(url.hostname) && match)
        handles.add(match[1].toLowerCase());
    } catch { /* Missing or short URLs cannot verify account identity. */ }
  }
  return handles;
}
export function tikTokProfileRows(response: any, expectedHandles: Set<string>, range: Range) {
  if (response?.code !== 0 || !response.data || typeof response.data !== 'object')
    throw new Error('INPUT:TikTok denied profile analytics. Check Accounts API approval and user.insights authorization.');
  const username = typeof response.data.username === 'string' ? response.data.username.toLowerCase() : '';
  if (expectedHandles.size !== 1 || !expectedHandles.has(username))
    throw new Error('INPUT:The analytics account could not be matched to the connected TikTok account. Authorize the same account with user.info.username.');
  if (response.data.metrics !== undefined && !Array.isArray(response.data.metrics))
    throw new Error('INPUT:TikTok returned an unreadable profile analytics report. Retry later.');
  const seen = new Set<string>(), rows = [];
  for (const metric of response.data.metrics || []) {
    if (!validDate(metric?.date)) throw new Error('INPUT:TikTok returned an invalid profile analytics date. Retry later.');
    if (metric.date < range.start || metric.date > range.end) continue;
    if (seen.has(metric.date)) throw new Error('INPUT:TikTok returned duplicate profile analytics dates. Retry later.');
    seen.add(metric.date);
    const value = metric.profile_views;
    // Omitted / pending values are not zero. Only supplied counts qualify.
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) continue;
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) continue;
    const row = emptyDaily(metric.date, 'TikTok');
    putMetric(row, 'profileViews', count);
    row.sourceMetrics = { origin: 'api', accountAnalytics: true, timeZone: 'UTC',
      metricOrigins: { profileViews: 'api' }, analyticsUsername: username };
    rows.push(row);
  }
  return rows.sort((a,b) => a.date.localeCompare(b.date));
}
