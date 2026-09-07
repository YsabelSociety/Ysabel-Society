import { type Daily, type Range } from './analytics';
import {
  emptyDaily,
  finite,
  putMetric,
  resultSet,
  type ReportTable,
} from './reporting';

// Shared by the native Google CSV importer, daily charts and period reports.
export const GBP_METRICS = [
  {
    key: 'search',
    label: 'Google Search views',
    color: '#497aca',
    description: 'Profile views on Google Search, across mobile and desktop.',
  },
  {
    key: 'maps',
    label: 'Google Maps views',
    color: '#359984',
    description: 'Profile views on Google Maps, across mobile and desktop.',
  },
  {
    key: 'directions',
    label: 'Direction requests',
    column: 'Directions',
    api: 'BUSINESS_DIRECTION_REQUESTS',
    color: '#9560bf',
    description: 'Requests for directions; these do not confirm a visit.',
  },
  {
    key: 'clicks',
    label: 'Website clicks',
    column: 'Website clicks',
    api: 'WEBSITE_CLICKS',
    color: '#c18b44',
    description:
      'Clicks on the website button in the Business Profile, separate from GA4 website sessions.',
  },
  {
    key: 'calls',
    label: 'Phone call clicks',
    column: 'Calls',
    api: 'CALL_CLICKS',
    color: '#d07789',
    description:
      'Clicks on the call button; these do not confirm an answered call.',
  },
  {
    key: 'menu',
    label: 'Menu interactions',
    column: 'Food menu clicks',
    api: 'BUSINESS_FOOD_MENU_CLICKS',
    color: '#759442',
    description: 'Menu interactions reported by Google for this location.',
  },
  {
    key: 'bookings',
    label: 'Reserve with Google bookings',
    column: 'Bookings',
    api: 'BUSINESS_BOOKINGS',
    color: '#6189aa',
    description:
      'Bookings reported through an enabled Google booking provider.',
  },
  {
    key: 'foodOrders',
    label: 'Food orders',
    column: 'Food orders',
    api: 'BUSINESS_FOOD_ORDERS',
    color: '#b67b55',
    description:
      'Pickup or delivery orders placed through an Order with Google provider.',
  },
  {
    key: 'searchMobile',
    label: 'Search · Mobile',
    column: 'Google Search - Mobile',
    api: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    color: '#598bce',
    description: 'Google Search profile views on mobile.',
  },
  {
    key: 'searchDesktop',
    label: 'Search · Desktop',
    column: 'Google Search - Desktop',
    api: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    color: '#9296ca',
    description: 'Google Search profile views on desktop.',
  },
  {
    key: 'mapsMobile',
    label: 'Maps · Mobile',
    column: 'Google Maps - Mobile',
    api: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    color: '#49a091',
    description: 'Google Maps profile views on mobile.',
  },
  {
    key: 'mapsDesktop',
    label: 'Maps · Desktop',
    column: 'Google Maps - Desktop',
    api: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    color: '#87a857',
    description: 'Google Maps profile views on desktop.',
  },
] as const;
export type GBPKey = (typeof GBP_METRICS)[number]['key'];
export const GBP_SUMMARY = 'google-performance-summary';
export const GBP_ORIGINAL = 'google-performance-export';
export const isGBPExport = (rows: Record<string, string>[]) =>
  !!rows[0] &&
  [
    'Business name',
    'Store code',
    'Google Search - Mobile',
    'Google Maps - Mobile',
  ].every((k) => k in rows[0]);
export function gbpFileRange(name: string): Range | null {
  const match = name.match(
    /Performance Report\) - (\d{4}-\d{1,2}-\d{1,2}) - (\d{4}-\d{1,2}-\d{1,2})/,
  );
  if (!match) return null;
  const normalize = (s: string) =>
    s
      .split('-')
      .map((n, i) => (i ? n.padStart(2, '0') : n))
      .join('-');
  return { start: normalize(match[1]), end: normalize(match[2]) };
}
export function gbpDailyValue(row: Daily, key: GBPKey): number | null {
  const definition = GBP_METRICS.find((m) => m.key === key)!;
  if (
    'api' in definition &&
    (key.endsWith('Mobile') || key.endsWith('Desktop'))
  )
    return finite(row.sourceMetrics?.[definition.api]);
  return !row.available || row.available.includes(key)
    ? finite((row as unknown as Record<string, unknown>)[key])
    : null;
}
export function parseGBPExport(
  rows: Record<string, string>[],
  range: Range,
  title: string,
) {
  if (!isGBPExport(rows))
    throw new Error(
      'INPUT:Choose the original Google Business Profile Performance Report CSV.',
    );
  const dated = gbpFileRange(title);
  if (dated && (dated.start !== range.start || dated.end !== range.end))
    throw new Error(
      'INPUT:The selected dates must match the dates in the Google export filename.',
    );
  const businesses = rows.filter((r) => r['Business name']?.trim());
  if (
    businesses.length !== 1 ||
    businesses[0]['Business name'].trim().toLowerCase() !== 'ysabel society'
  )
    throw new Error(
      'INPUT:Export only the Ysabel Society business location. Other businesses cannot be combined with this workspace.',
    );
  const original = businesses[0],
    values: Record<string, number | null> = {};
  const numeric = (value: string | undefined) => {
    if (
      value === undefined ||
      !value.trim() ||
      /^(n\/a|not available|—|--|-)$/i.test(value.trim())
    )
      return null;
    const n = finite(value.replaceAll(',', '').trim());
    if (n === null)
      throw new Error(
        'INPUT:An exported Google metric is not a non-negative number. Preserve blank or unavailable values.',
      );
    return n;
  };
  for (const metric of GBP_METRICS)
    if ('column' in metric)
      values[metric.key] = numeric(original[metric.column]);
  for (const key of ['search', 'maps'])
    values[key] =
      values[key + 'Mobile'] !== null && values[key + 'Desktop'] !== null
        ? values[key + 'Mobile']! + values[key + 'Desktop']!
        : null;
  const result = resultSet();
  const scope =
    'Google Business Profile Performance export · Ysabel Society. These are totals for the stated period, not unique people across the entire period. A multi-day total is never spread across individual days. Google may revise recent values.';
  result.tables.push({
    key: GBP_SUMMARY,
    title: 'Business Profile performance',
    source: 'gbp',
    columns: GBP_METRICS.map((m) => m.key),
    rows: [values],
    period: range,
    scope,
  });
  result.tables.push({
    key: GBP_ORIGINAL,
    title: 'Original Google export',
    source: 'gbp',
    columns: Object.keys(original),
    rows: [original],
    period: range,
    scope:
      'Original provider columns, including inactive or inapplicable services. A zero in Messages or Hotel bookings does not establish availability of that service. Store code is preserved as text.',
  });
  if (range.start === range.end) {
    const daily = emptyDaily(range.start, 'Google Business');
    for (const metric of GBP_METRICS) {
      if (!metric.key.endsWith('Mobile') && !metric.key.endsWith('Desktop'))
        putMetric(daily, metric.key, values[metric.key]);
      if ('api' in metric && values[metric.key] !== null)
        daily.sourceMetrics = {
          ...daily.sourceMetrics,
          [metric.api]: values[metric.key],
        };
    }
    if (values.search !== null && values.maps !== null)
      putMetric(daily, 'views', values.search + values.maps);
    if (['calls', 'clicks', 'directions'].every((k) => values[k] !== null))
      putMetric(
        daily,
        'actions',
        values.calls! + values.clicks! + values.directions!,
      );
    daily.sourceMetrics = {
      ...daily.sourceMetrics,
      origin: 'file',
      original,
      reportPeriod: range,
      definition: scope,
    };
    result.daily.push(daily);
  }
  result.checks.push({
    key: 'google-performance-export',
    label: 'Google Business performance export',
    status: 'imported',
    records: 1,
    detail: `${range.start} – ${range.end}. ${range.start === range.end ? 'Daily values feed dashboard charts.' : 'Period totals appear in Google Business reports; daily history is not inferred.'}`,
  });
  result.scope =
    'Google Business export imported. Upload another export to refresh; automatic reporting requires approved Google API access.';
  return result;
}

// Keep Google period reports visible and distinct. Never merge overlapping totals.
export function googlePeriodTable(table: ReportTable) {
  return table.source === 'gbp' && !table.rows.some((row) => row.date);
}
export function gbpMonthlyPoints(tables: ReportTable[], key: GBPKey) {
  const byMonth = new Map<string, ReportTable>();
  for (const t of tables) {
    if (t.source !== 'gbp' || t.key !== GBP_SUMMARY) continue;
    const [year, month] = t.period.start.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (!t.period.start.endsWith('-01') || t.period.end !== last) continue;
    const bucket = t.period.start.slice(0, 7),
      prior = byMonth.get(bucket);
    if (!prior || (t.observedAt || '') > (prior.observedAt || ''))
      byMonth.set(bucket, t);
  }
  const months = [...byMonth.keys()].sort(),
    points: { date: string; value: number | null }[] = [];
  if (!months.length) return points;
  for (
    let d = new Date(months[0] + '-01T12:00:00Z');
    d.toISOString().slice(0, 7) <= months.at(-1)!;
    d.setUTCMonth(d.getUTCMonth() + 1)
  ) {
    const date = d.toISOString().slice(0, 7);
    points.push({ date, value: finite(byMonth.get(date)?.rows[0]?.[key]) });
  }
  return points;
}
