import type { ReportTable } from './reporting';
export const WEBSITE_REPORTS = [
  ['website-total', 'Period summary'],
  ['website-traffic', 'Traffic sources'],
  ['website-channels', 'Acquisition channels'],
  ['website-pages', 'Website content performance'],
  ['website-events', 'Tracked events'],
  ['website-devices', 'Devices'],
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
  })[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
export function websitePlot(table: ReportTable, metric: string) {
  const dimension = table.columns.find(
    (c) => c !== 'date' && table.rows.some((r) => typeof r[c] === 'string'),
  );
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
      const day = dates.get(row.date) || { date: row.date };
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
