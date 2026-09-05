import { secrets } from './db';
import { type Channel, type Daily, type Range, iso } from '@/lib/analytics';
export type ProviderResult = { daily: Daily[]; raw: unknown; scope: string };
export interface AnalyticsProvider {
  channel: Channel;
  required: string[];
  sync(range: Range): Promise<ProviderResult>;
}
export { PROVIDER_CONFIG } from '@/lib/provider-metadata';
import { PROVIDER_CONFIG } from '@/lib/provider-metadata';
export async function requestJSON(
  url: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<any> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    await new Promise((r) =>
      setTimeout(
        r,
        Math.min(
          Number(response.headers.get('retry-after') ?? 1) * 1000,
          2500,
        ) *
          (attempt + 1),
      ),
    );
    return requestJSON(url, init, attempt + 1);
  }
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'INPUT:The source needs authorization. Reconnect the account.'
        : 'INPUT:The source could not complete this sync. Please try again later.',
    );
  return response.json();
}
async function googleToken() {
  const e = secrets();
  const d = await requestJSON('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      refresh_token: e.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!d.access_token)
    throw new Error('INPUT:Google authorization needs attention.');
  return d.access_token as string;
}
function empty(date: string, channel: Channel): Daily {
  return {
    date,
    channel,
    unit: secrets().SOURCE_BUSINESS_UNIT || 'Society',
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
export class GA4Adapter implements AnalyticsProvider {
  channel = 'Website' as const;
  required = PROVIDER_CONFIG[3].required;
  async sync(range: Range) {
    const e = secrets();
    if (!/^\d+$/.test(e.GA4_PROPERTY_ID))
      throw new Error('INPUT:Check the Analytics property identifier.');
    const token = await googleToken();
    const names = [
      'activeUsers',
      'sessions',
      'engagedSessions',
      'screenPageViews',
    ];
    const raw = await requestJSON(
      'https://analyticsdata.googleapis.com/v1beta/properties/' +
        e.GA4_PROPERTY_ID +
        ':runReport',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: range.start, endDate: range.end }],
          dimensions: [{ name: 'date' }],
          metrics: names.map((name) => ({ name })),
          limit: 10000,
        }),
      },
    );
    const daily = (raw.rows ?? []).map((r: any) => {
      const s = r.dimensionValues[0].value;
      const d = empty(
        s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8),
        this.channel,
      );
      [d.users, d.sessions, d.engaged, d.pageViews] = r.metricValues.map(
        (v: any) => Number(v.value),
      );
      return d;
    });
    return {
      daily,
      raw,
      scope:
        'GA4 daily users, sessions, engaged sessions and page views. Conversions unavailable.',
    };
  }
}
export class GoogleBusinessAdapter implements AnalyticsProvider {
  channel = 'Google Business' as const;
  required = PROVIDER_CONFIG[4].required;
  async sync(range: Range) {
    const e = secrets();
    if (!/^\d+$/.test(e.GBP_LOCATION_ID))
      throw new Error('INPUT:Check the Google location identifier.');
    const token = await googleToken(),
      qs = new URLSearchParams();
    const keys = [
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'WEBSITE_CLICKS',
      'CALL_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
    ];
    keys.forEach((k) => qs.append('dailyMetrics', k));
    for (const [prefix, date] of [
      ['startDate', range.start],
      ['endDate', range.end],
    ]) {
      const parts = date.split('-');
      ['year', 'month', 'day'].forEach((part, i) =>
        qs.set('dailyRange.' + prefix + '.' + part, String(Number(parts[i]))),
      );
    }
    const raw = await requestJSON(
      'https://businessprofileperformance.googleapis.com/v1/locations/' +
        e.GBP_LOCATION_ID +
        ':fetchMultiDailyMetricsTimeSeries?' +
        qs,
      { headers: { Authorization: 'Bearer ' + token } },
    );
    const map = new Map<string, Daily>();
    for (const group of raw.multiDailyMetricTimeSeries ?? []) {
      for (const series of group.dailyMetricTimeSeries ?? []) {
        for (const v of series.timeSeries?.datedValues ?? []) {
          const date =
            v.date.year +
            '-' +
            String(v.date.month).padStart(2, '0') +
            '-' +
            String(v.date.day).padStart(2, '0');
          const d = map.get(date) ?? empty(date, this.channel),
            n = Number(v.value ?? 0);
          if (series.dailyMetric.includes('_SEARCH')) d.search += n;
          else if (series.dailyMetric.includes('_MAPS')) d.maps += n;
          else if (series.dailyMetric === 'WEBSITE_CLICKS') d.clicks += n;
          else if (series.dailyMetric === 'CALL_CLICKS') d.calls += n;
          else if (series.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS')
            d.directions += n;
          d.actions = d.calls + d.clicks + d.directions;
          map.set(date, d);
        }
      }
    }
    return {
      daily: [...map.values()],
      raw,
      scope:
        'Google Search and Maps visibility, calls, directions and website clicks.',
    };
  }
}
export class MetaAdapter implements AnalyticsProvider {
  channel: Channel;
  required: string[];
  constructor(channel: 'Instagram' | 'Facebook') {
    this.channel = channel;
    this.required = PROVIDER_CONFIG[channel === 'Instagram' ? 0 : 1].required;
  }
  async sync(_range: Range): Promise<ProviderResult> {
    throw new Error(
      'INPUT:Meta account approval and metric mapping must be validated before live synchronization can be enabled.',
    );
  }
}
export class TikTokAdapter implements AnalyticsProvider {
  channel = 'TikTok' as const;
  required = PROVIDER_CONFIG[2].required;
  async sync(_range: Range): Promise<ProviderResult> {
    throw new Error(
      'INPUT:TikTok authorization and approved analytics access are required. Display API lifetime video counts must not be presented as daily views.',
    );
  }
}
export const adapters: Record<string, AnalyticsProvider> = {
  ga4: new GA4Adapter(),
  gbp: new GoogleBusinessAdapter(),
  instagram: new MetaAdapter('Instagram'),
  facebook: new MetaAdapter('Facebook'),
  tiktok: new TikTokAdapter(),
};
