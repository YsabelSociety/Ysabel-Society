import type { ReportTable } from './reporting';
export const WEBSITE_REPORTS = [
  ['website-pages', 'Most visited pages'],
  ['website-links', 'Most clicked links'],
  ['website-landing', 'Landing pages'],
  ['website-total', 'Period summary'],
  ['website-traffic', 'Traffic sources'],
  ['website-channels', 'Acquisition channels'],
  ['website-campaigns', 'Campaigns'],
  ['website-referrers', 'Referring pages'],
  ['website-events', 'Tracked events'],
  ['website-downloads', 'File downloads'],
  ['website-searches', 'Website searches'],
  ['website-devices', 'Devices'],
  ['website-browsers', 'Browsers'],
  ['website-languages', 'Languages'],
  ['website-countries', 'Countries'],
  ['website-cities', 'Cities'],
  ['website-visitors', 'New and returning visitors'],
] as const;
export const reportLabel = (key: string) =>
  ({
    activeUsers: 'Active users',
    sessions: 'Sessions',
    engagedSessions: 'Engaged sessions',
    screenPageViews: 'Page views',
    newUsers: 'New users',
    userEngagementDuration: 'Engagement seconds',
    eventCount: 'Events',
    totalUsers: 'Unique users',
    keyEvents: 'Key events',
    pagePath: 'Page',
    landingPage: 'Landing page',
    linkUrl: 'Destination URL',
    pageReferrer: 'Referring page',
    sessionCampaignName: 'Campaign',
    sessionSourceMedium: 'Source / medium',
    eventName: 'Event',
    fileName: 'File',
    searchTerm: 'Search term',
  })[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
export function websiteDimension(table: ReportTable) {
  return table.columns.find(c => c !== 'date' && table.rows.some(r => typeof r[c] === 'string'));
}
export function websiteLink(value: string) {
  try {
    const url = new URL(value, 'https://ysabelsociety.com');
    if (!/^https?:$/.test(url.protocol) || (!value.startsWith('/') && !/^https?:\/\//i.test(value))) return undefined;
    return url.href;
  } catch { return undefined; }
}
export function websitePlot(table: ReportTable, metric: string) {
  const dimension = websiteDimension(table);
  const totals = new Map<string, number>(),
    dates = new Map<string, Record<string, string | number>>();
  for (const row of table.rows) {
    const value = row[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const category = dimension
      ? String(row[dimension] ?? 'Not supplied')
      : reportLabel(metric);
    totals.set(category, (totals.get(category) || 0) + value);
    if (typeof row.date === 'string') {
      const day = dates.get(row.date) || Object.assign(Object.create(null), { date: row.date });
      day[category] = Number(day[category] || 0) + value;
      dates.set(row.date, day);
    }
  }
  const ranked = [...totals]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  return {
    ranked,
    series: [...dates.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    ),
    keys: ranked.slice(0, 6).map((r) => r.name),
  };
}
