import { type Range } from '@/lib/analytics';
import {
  collect,
  emptyDaily,
  finite,
  putMetric,
  resultSet,
  type ReportTable,
} from '@/lib/reporting';
import { requestJSON } from './providers';
import {
  WEBSITE_SOURCE,
  websiteReportFilter,
  websiteStreamFilter,
} from '@/lib/website-source';

export type ReportingContext = {
  importMode?: 'content' | 'reports';
  pageCursor?: string;
  accessToken: string;
  externalId: string;
  apiVersion?: string;
  developerToken?: string;
  loginCustomerId?: string;
  menuPath?: string;
  reservationEvent?: string;
  completedReservationEvent?: string;
  start?: string;
  end?: string;
};
export async function importGA4(context: ReportingContext, range: Range) {
  const result = resultSet(),
    headers = {
      Authorization: 'Bearer ' + context.accessToken,
      'Content-Type': 'application/json',
    };
  if (!/^\d+$/.test(context.externalId))
    throw new Error('INPUT:Enter the numeric GA4 property ID.');
  if (context.externalId !== WEBSITE_SOURCE.propertyId)
    throw new Error(
      'INPUT:Select the Ysabel Society website property 552874533.',
    );
  const endpoint =
    'https://analyticsdata.googleapis.com/v1beta/properties/' +
    context.externalId +
    ':runReport';
  async function report(
    dimensions: string[],
    metrics: string[],
    filter?: unknown,
  ) {
    const rows: Record<string, string | number | null>[] = [];
    let raw: any;
    for (let offset = 0; offset < 10000; offset += 2000) {
      raw = await requestJSON(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate: range.start, endDate: range.end }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dimensionFilter: websiteReportFilter(filter),
          offset,
          limit: 2000,
          orderBys: dimensions.map((dimensionName) => ({
            dimension: { dimensionName },
          })),
        }),
      });
      for (const row of raw.rows || []) {
        const d: Record<string, string | number | null> = {};
        (raw.dimensionHeaders || dimensions.map((name) => ({ name }))).forEach(
          (h: any, i: number) => {
            const v = row.dimensionValues?.[i]?.value;
            d[h.name] =
              h.name === 'date' && /^\d{8}$/.test(v)
                ? v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8)
                : (v ?? null);
          },
        );
        (raw.metricHeaders || metrics.map((name) => ({ name }))).forEach(
          (h: any, i: number) => {
            d[h.name] = finite(row.metricValues?.[i]?.value);
          },
        );
        rows.push(d);
      }
      if (rows.length >= Number(raw.rowCount || 0) || !raw.rows?.length) break;
    }
    return { rows, raw, truncated: Number(raw?.rowCount || 0) > rows.length };
  }
  const names = [
    'activeUsers',
    'sessions',
    'engagedSessions',
    'screenPageViews',
    'newUsers',
    'keyEvents',
    'userEngagementDuration',
  ];
  const daily = await collect(
    result,
    'daily',
    'Daily website performance',
    () => report(['date'], names),
    (r) => r.rows.length,
  );
  const map = new Map<string, ReturnType<typeof emptyDaily>>();
  for (const row of daily?.rows || []) {
    const d = emptyDaily(String(row.date), 'Website');
    for (const [key, name] of Object.entries({
      users: 'activeUsers',
      sessions: 'sessions',
      engaged: 'engagedSessions',
      pageViews: 'screenPageViews',
      newUsers: 'newUsers',
      conversions: 'keyEvents',
      engagementSeconds: 'userEngagementDuration',
    }))
      putMetric(d, key, row[name]);
    d.sourceMetrics = {
      ...row,
      reportingTimezone:
        daily?.raw?.metadata?.timeZone || 'GA4 property timezone',
      website: WEBSITE_SOURCE.website,
      streamId: WEBSITE_SOURCE.streamId,
      conversionsDefinition:
        'GA4 key events as configured in the property. Not necessarily reservations.',
    };
    map.set(d.date, d);
  }
  const specs = [
    ['website-total', 'Unique users for the imported period', [], names],
    [
      'website-traffic',
      'Traffic sources',
      ['date', 'sessionSourceMedium'],
      ['sessions', 'engagedSessions', 'keyEvents'],
    ],
    [
      'website-channels',
      'Acquisition channels',
      ['date', 'sessionDefaultChannelGroup'],
      ['sessions', 'engagedSessions', 'keyEvents'],
    ],
    [
      'website-pages',
      'Website content performance',
      ['date', 'pagePath'],
      ['screenPageViews', 'userEngagementDuration'],
    ],
    [
      'website-events',
      'Tracked events',
      ['date', 'eventName'],
      ['eventCount', 'keyEvents'],
    ],
    [
      'website-devices',
      'Devices',
      ['date', 'deviceCategory'],
      ['sessions', 'engagedSessions'],
    ],
    [
      'website-countries',
      'Website countries',
      ['date', 'country'],
      ['activeUsers', 'sessions'],
    ],
    [
      'website-cities',
      'Website cities',
      ['date', 'city'],
      ['activeUsers', 'sessions'],
    ],
    [
      'website-visitors',
      'New and returning visitors',
      ['date', 'newVsReturning'],
      ['activeUsers', 'sessions'],
    ],
  ] as const;
  for (const [key, title, dims, metrics] of specs) {
    const r = await collect(
      result,
      key,
      title,
      () => report([...dims], [...metrics]),
      (r) => r.rows.length,
    );
    if (r)
      result.tables.push({
        key,
        title,
        source: 'ga4',
        columns: [...dims, ...metrics],
        rows: r.rows,
        period: range,
        truncated: r.truncated,
        scope: dims.length
          ? 'GA4 property timezone. Daily users are not deduplicated across dates. Thresholding and sampling apply when reported by GA4.'
          : 'Period-level active users are deduplicated by GA4. Applies only to the exact imported date range.',
      });
  }
  for (const [field, dimension, match] of [
    ['menu', 'pagePath', context.menuPath],
    ['reservation', 'eventName', context.reservationEvent],
    ['bookings', 'eventName', context.completedReservationEvent],
  ] as const) {
    if (!match) {
      result.checks.push({
        key: field,
        label:
          field === 'menu'
            ? 'Menu page views'
            : field === 'reservation'
              ? 'Reservation clicks'
              : 'Completed reservations',
        status: 'unavailable',
        records: 0,
        detail:
          'Configure the exact page path or tracked event name in connection settings. Values are never inferred from traffic.',
      });
      continue;
    }
    const metric = field === 'menu' ? 'screenPageViews' : 'eventCount';
    const r = await collect(
      result,
      field,
      'Configured ' + field + ' tracking',
      () =>
        report(['date'], [metric], {
          filter: {
            fieldName: dimension,
            stringFilter: {
              matchType: 'EXACT',
              value: match,
              caseSensitive: true,
            },
          },
        }),
      (r) => r.rows.length,
    );
    for (const row of r?.rows || []) {
      const d =
        map.get(String(row.date)) || emptyDaily(String(row.date), 'Website');
      putMetric(d, field, row[metric]);
      d.sourceMetrics = { ...d.sourceMetrics, [field + 'Tracking']: match };
      map.set(d.date, d);
    }
  }
  result.daily = [...map.values()];
  const realtime = await collect(
    result,
    'website-realtime',
    'Activity in the last 30 minutes',
    () =>
      requestJSON(endpoint.replace(':runReport', ':runRealtimeReport'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dimensionFilter: websiteStreamFilter,
          metrics: ['activeUsers', 'screenPageViews', 'eventCount'].map(
            (name) => ({ name }),
          ),
        }),
      }),
    (r) => r.rows?.length || 0,
  );
  if (realtime) {
    const values = realtime.rows?.[0]?.metricValues;
    result.profile.realtime = {
      activeUsers: values ? finite(values[0]?.value) : 0,
      pageViews: values ? finite(values[1]?.value) : 0,
      events: values ? finite(values[2]?.value) : 0,
      observedAt: new Date().toISOString(),
    };
  }
  result.scope =
    'ysabelsociety.com · GA4 property 552874533 · website stream 15726284662. Daily reports include only ysabelsociety.com and www.ysabelsociety.com, excluding /marketingdata. Realtime is restricted to this website stream. Today’s reports may be incomplete while Google processes visits. Missing tracking remains unavailable.';
  result.profile.websiteSource = WEBSITE_SOURCE;
  return result;
}

export async function importGBP(context: ReportingContext, range: Range) {
  const result = resultSet(),
    headers = { Authorization: 'Bearer ' + context.accessToken },
    map = new Map<string, ReturnType<typeof emptyDaily>>();
  const metrics: Record<string, string> = {
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'search',
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'search',
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'maps',
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'maps',
    WEBSITE_CLICKS: 'clicks',
    CALL_CLICKS: 'calls',
    BUSINESS_DIRECTION_REQUESTS: 'directions',
    BUSINESS_BOOKINGS: 'bookings',
    BUSINESS_FOOD_ORDERS: 'foodOrders',
    BUSINESS_FOOD_MENU_CLICKS: 'menu',
  };
  for (const [metric, field] of Object.entries(metrics)) {
    const qs = new URLSearchParams({ dailyMetric: metric });
    for (const [prefix, date] of [
      ['startDate', range.start],
      ['endDate', range.end],
    ])
      date
        .split('-')
        .forEach((n, i) =>
          qs.set(
            'dailyRange.' + prefix + '.' + ['year', 'month', 'day'][i],
            String(Number(n)),
          ),
        );
    const r: any = await collect(
      result,
      metric,
      metric.toLowerCase().replaceAll('_', ' '),
      () =>
        requestJSON(
          'https://businessprofileperformance.googleapis.com/v1/locations/' +
            encodeURIComponent(context.externalId) +
            ':getDailyMetricsTimeSeries?' +
            qs,
          { headers },
        ),
      (r) => r.timeSeries?.datedValues?.length || 0,
    );
    for (const v of r?.timeSeries?.datedValues || []) {
      const date =
          v.date.year +
          '-' +
          String(v.date.month).padStart(2, '0') +
          '-' +
          String(v.date.day).padStart(2, '0'),
        d = map.get(date) || emptyDaily(date, 'Google Business');
      // Google protobuf omits value for an explicitly returned zero-valued date.
      const n = finite(v.value ?? 0);
      if (n !== null) {
        d.sourceMetrics = { ...d.sourceMetrics, [metric]: n };
        map.set(date, d);
      }
    }
  }
  for (const d of map.values()) {
    for (const field of [...new Set(Object.values(metrics))]) {
      const keys = Object.keys(metrics).filter((k) => metrics[k] === field);
      if (keys.every((k) => d.sourceMetrics?.[k] !== undefined))
        putMetric(
          d,
          field,
          keys.reduce((n, k) => n + Number(d.sourceMetrics![k]), 0),
        );
    }
    if (
      ['calls', 'clicks', 'directions'].every((k) => d.available?.includes(k))
    )
      putMetric(d, 'actions', d.calls + d.clicks + d.directions);
  }
  const month = new Date(range.start + 'T12:00:00Z');
  month.setUTCDate(1);
  const last = new Date(range.end + 'T12:00:00Z');
  last.setUTCDate(1);
  const keywords: ReportTable['rows'] = [];
  while (month <= last) {
    const qs = new URLSearchParams({
      'monthlyRange.startMonth.year': String(month.getUTCFullYear()),
      'monthlyRange.startMonth.month': String(month.getUTCMonth() + 1),
      'monthlyRange.endMonth.year': String(month.getUTCFullYear()),
      'monthlyRange.endMonth.month': String(month.getUTCMonth() + 1),
      pageSize: '100',
    });
    const r: any = await collect(
      result,
      'searches-' + month.toISOString().slice(0, 7),
      'Monthly Google search terms',
      () =>
        requestJSON(
          'https://businessprofileperformance.googleapis.com/v1/locations/' +
            encodeURIComponent(context.externalId) +
            '/searchkeywords/impressions/monthly?' +
            qs,
          { headers },
        ),
      (r) => r.searchKeywordsCounts?.length || 0,
    );
    for (const row of r?.searchKeywordsCounts || [])
      keywords.push({
        month: month.toISOString().slice(0, 7),
        keyword: row.searchKeyword,
        impressions: finite(row.insightsValue?.value),
        threshold: finite(row.insightsValue?.threshold),
      });
    if (r?.nextPageToken)
      result.checks.push({
        key: 'keywords-limit',
        label: 'Additional search terms',
        status: 'unavailable',
        records: 0,
        detail:
          'The first 100 terms per month were imported; additional terms are available in the provider export.',
      });
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  if (keywords.length)
    result.tables.push({
      key: 'google-searches',
      title: 'Google search terms',
      source: 'gbp',
      columns: ['month', 'keyword', 'impressions', 'threshold'],
      rows: keywords,
      period: range,
      scope:
        'Full calendar-month counts. Threshold is a provider privacy boundary, not an exact count.',
    });
  result.daily = [...map.values()];
  result.scope =
    'Google Search and Maps, calls, directions, website clicks, menu interactions, Reserve with Google bookings and food orders where the location supports them.';
  return result;
}
