export const CHANNELS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'Google Business',
  'Website',
] as const;
export type Channel = (typeof CHANNELS)[number];
export const COLORS = ['#b83d83', '#3478ce', '#228d97', '#49916a', '#407b78'];
export const BRAND_NAME = 'Ysabel Society';
export const UNITS = [BRAND_NAME];
export type Metric =
  | 'views'
  | 'reach'
  | 'engagements'
  | 'followers'
  | 'users'
  | 'actions'
  | 'conversions';
export const METRICS: {
  key: Metric;
  label: string;
  source: string;
  definition: string;
}[] = [
  {
    key: 'views',
    label: 'Total content views',
    source: 'Instagram · Facebook · TikTok',
    definition:
      'Total reported social content views, including repeats. Platform definitions differ.',
  },
  {
    key: 'reach',
    label: 'Aggregated reach',
    source: 'Instagram · Facebook',
    definition:
      'Sum of daily reach across Instagram and Facebook. Repeated audiences across dates and platforms cannot be deduplicated. TikTok reach is unavailable.',
  },
  {
    key: 'engagements',
    label: 'Engagements',
    source: 'Instagram · Facebook · TikTok',
    definition:
      'Likes, comments, saves and shares. Available actions vary by platform.',
  },
  {
    key: 'followers',
    label: 'Community',
    source: 'Instagram · Facebook · TikTok',
    definition:
      'Latest follower count across social accounts. A person may follow multiple accounts.',
  },
  {
    key: 'users',
    label: 'Website users',
    source: 'Google Analytics 4',
    definition:
      'Sum of daily active users in this preview. Multi-day unique totals require a period-level GA4 query.',
  },
  {
    key: 'actions',
    label: 'Google actions',
    source: 'Google Business Profile',
    definition:
      'Website clicks, phone call clicks and direction requests. Actions are not completed visits.',
  },
];
export type Daily = {
  date: string;
  unit: string;
  channel: Channel;
  views: number;
  reach: number;
  engagements: number;
  followers: number;
  users: number;
  actions: number;
  conversions: number;
  search: number;
  maps: number;
  calls: number;
  directions: number;
  clicks: number;
  sessions: number;
  engaged: number;
  pageViews: number;
  menu: number;
  reservation: number;
};
export const ANCHOR = '2026-09-05';
const ms = 86400000;
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export type Range = { start: string; end: string };
export function dateRange(preset: string, custom?: Range): Range {
  const end = new Date(ANCHOR + 'T12:00:00Z'),
    start = new Date(end);
  switch (preset) {
    case 'Today':
      break;
    case 'Yesterday':
      start.setUTCDate(start.getUTCDate() - 1);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
    case 'Last 7 Days':
      start.setUTCDate(start.getUTCDate() - 6);
      break;
    case 'This Month':
      start.setUTCDate(1);
      break;
    case 'Previous Month':
      start.setUTCMonth(start.getUTCMonth() - 1, 1);
      end.setUTCDate(0);
      break;
    case 'Quarter':
      start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
      break;
    case 'Year to Date':
      start.setUTCMonth(0, 1);
      break;
    case 'Last Year':
      start.setUTCFullYear(2025, 0, 1);
      end.setUTCFullYear(2025, 11, 31);
      break;
    case 'Custom Range':
      return custom ?? { start: '2026-08-01', end: '2026-08-31' };
    default:
      start.setUTCDate(start.getUTCDate() - 29);
  }
  return { start: iso(start), end: iso(end) };
}
export function previousRange(range: Range, comparison: string): Range {
  const s = new Date(range.start + 'T12:00:00Z'),
    e = new Date(range.end + 'T12:00:00Z');
  if (comparison === 'Previous Year') {
    s.setUTCFullYear(s.getUTCFullYear() - 1);
    e.setUTCFullYear(e.getUTCFullYear() - 1);
  } else if (comparison === 'Previous Month') {
    const move = (d: Date) => {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - 1);
      const last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate();
      d.setUTCDate(Math.min(day, last));
    };
    move(s);
    move(e);
  } else {
    const len = (e.getTime() - s.getTime()) / ms + 1;
    s.setUTCDate(s.getUTCDate() - len);
    e.setUTCDate(e.getUTCDate() - len);
  }
  return { start: iso(s), end: iso(e) };
}
export function demoDaily(): Daily[] {
  const result: Daily[] = [];
  const start = new Date('2024-01-01T12:00:00Z');
  for (let i = 0; i <= 978; i++) {
    const d = new Date(start.getTime() + i * ms);
    if (iso(d) > ANCHOR) break;
    [0.42, 0.34, 0.24].forEach((weight, u) =>
      CHANNELS.forEach((channel, c) => {
        const trend = 0.62 + i / 1550;
        const wave =
          1 + Math.sin(i * 0.43 + c) * 0.19 + Math.cos(i * 0.17 + u) * 0.12;
        const spike =
          i % 31 === 18 || i % 31 === 19 ? (c === 2 ? 1.8 : 1.4) : 1;
        const social = c < 3;
        const v = Math.round(
          [16100, 5400, 12200, 3800, 760][c] * weight * trend * wave * spike,
        );
        const actions = c === 3 ? Math.round(v * 0.051) : 0;
        const users = c === 4 ? Math.round(v * 0.72) : 0;
        result.push({
          date: iso(d),
          unit: BRAND_NAME,
          channel,
          views: social ? v : 0,
          reach: c < 2 ? Math.round(v * 0.53) : 0,
          engagements: social ? Math.round(v * [0.041, 0.028, 0.052][c]) : 0,
          followers: social
            ? Math.round([19000, 9400, 12400][c] * weight * (0.52 + i / 1900))
            : 0,
          users,
          actions,
          conversions: 0,
          search: c === 3 ? Math.round(v * 0.57) : 0,
          maps: c === 3 ? Math.round(v * 0.43) : 0,
          calls: Math.round(actions * 0.18),
          directions: Math.round(actions * 0.48),
          clicks:
            actions - Math.round(actions * 0.18) - Math.round(actions * 0.48),
          sessions: Math.round(users * 1.36),
          engaged: Math.round(users * 0.93),
          pageViews: Math.round(users * 2.9),
          menu: Math.round(users * 0.39),
          reservation: Math.round(users * 0.12),
        });
      }),
    );
  }
  return consolidateDaily(result);
}
// Preserve every source observation when folding older workspace labels into one brand.
export function consolidateDaily(rows: Daily[]): Daily[] {
  const grouped = new Map<string, Daily>();
  for (const row of rows) {
    const key = row.date + ':' + row.channel;
    const prior = grouped.get(key);
    if (!prior) grouped.set(key, { ...row, unit: BRAND_NAME });
    else {
      for (const field of Object.keys(row) as (keyof Daily)[]) {
        if (typeof row[field] === 'number') {
          (prior as unknown as Record<string, unknown>)[field] =
            Number(prior[field]) + Number(row[field]);
        }
      }
    }
  }
  return [...grouped.values()];
}
export const DAILY = demoDaily();
export function filterDaily(
  _unit: string,
  range: Range,
  channels: readonly string[] = CHANNELS,
) {
  return DAILY.filter(
    (d) =>
      d.date >= range.start &&
      d.date <= range.end &&
      channels.includes(d.channel),
  );
}
export function total(rows: Daily[], metric: keyof Daily): number {
  if (metric === 'followers') {
    const latest = rows.reduce((v, r) => (r.date > v ? r.date : v), '');
    return rows
      .filter((r) => r.date === latest)
      .reduce((n, r) => n + r.followers, 0);
  }
  return rows.reduce((n, r) => n + Number(r[metric] ?? 0), 0);
}
export function series(rows: Daily[], metric: Metric, granularity = 'Daily') {
  const buckets = new Map<string, Record<string, string | number>>();
  rows.forEach((r) => {
    let date = r.date;
    if (granularity === 'Monthly') date = r.date.slice(0, 7) + '-01';
    if (granularity === 'Weekly') {
      const d = new Date(r.date + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      date = iso(d);
    }
    const item = buckets.get(date) ?? { date, total: 0 };
    item[r.channel] = Number(item[r.channel] ?? 0) + r[metric];
    item.total = Number(item.total) + r[metric];
    buckets.set(date, item);
  });
  if (metric === 'followers') {
    for (const [date, item] of buckets) {
      const rs = rows.filter((r) =>
        granularity === 'Monthly'
          ? r.date.slice(0, 7) === date.slice(0, 7)
          : granularity === 'Weekly'
            ? r.date >= date &&
              r.date <
                iso(new Date(new Date(date + 'T12:00:00Z').getTime() + 7 * ms))
            : r.date === date,
      );
      CHANNELS.forEach(
        (c) =>
          (item[c] = total(
            rs.filter((r) => r.channel === c),
            'followers',
          )),
      );
      item.total = CHANNELS.reduce((n, c) => n + Number(item[c]), 0);
    }
  }
  return [...buckets.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}
export const compact = (v: number) =>
  Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);
export const number = (v: number) => Intl.NumberFormat('en').format(v);
export const change = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
export type Post = {
  id: string;
  title: string;
  caption: string;
  image: string;
  platform: Channel;
  format: string;
  unit: string;
  date: string;
  status: string;
  tags: string[];
  campaign: string;
  distribution: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  followers: number;
  visits: number;
  score: number;
  position: number;
  scheduled: string;
  mediaType: 'image' | 'video';
};
const titles = [
  'The art of an evening',
  'A little fire. A lot of soul.',
  'A summer evening, plated',
  'Behind every perfect bite',
  'A toast to the unexpected',
  'Where the evening unfolds',
  'Made slowly. Remembered always.',
  'A table worth gathering around',
  'The chef’s finishing touch',
  'Ysabel Society after dark',
  'The first pour',
  'From our kitchen, with love',
  'A new seasonal ritual',
  'Moments between courses',
  'The details make the night',
  'A taste of what’s next',
  'Your next favourite evening',
  'Save a seat for September',
];
export const POSTS: Post[] = titles.map((title, i) => {
  const views = [
    128400, 96300, 82700, 68400, 54300, 42200, 38000, 31900, 28100, 22400,
    19200, 17500,
  ][i % 12];
  return {
    id: 'demo-' + (i + 1),
    title,
    caption:
      title +
      '. An invitation to slow down and savour the moment. #YsabelSociety',
    image: '/media/' + ((i % 6) + 1) + '.jpg',
    platform: CHANNELS[i % 3],
    format: ['Reel', 'Video', 'Carousel', 'Static'][i % 4],
    unit: BRAND_NAME,
    date: '2026-08-' + String(31 - i).padStart(2, '0'),
    status:
      i < 12
        ? 'Published'
        : i < 15
          ? 'Scheduled'
          : i === 15
            ? 'Approved'
            : 'Draft',
    tags: [
      ['Atmosphere', 'Interior'],
      ['Chef', 'Food close-up'],
      ['Seasonal menu', 'Food close-up'],
      ['Chef', 'People'],
      ['Cocktails'],
      ['Atmosphere', 'Events'],
    ][i % 6],
    campaign: i % 2 ? 'Summer evenings' : 'A taste of Ysabel Society',
    distribution: 'Organic',
    views: i < 12 ? views : 0,
    reach: i < 12 ? Math.round(views * 0.64) : 0,
    likes: i < 12 ? Math.round(views * 0.028) : 0,
    comments: i < 12 ? Math.round(views * 0.0019) : 0,
    saves: i < 12 ? Math.round(views * 0.006) : 0,
    shares: i < 12 ? Math.round(views * (i % 6 === 1 ? 0.015 : 0.006)) : 0,
    followers: i < 12 ? Math.round(views * 0.0012) : 0,
    visits: 0,
    score: i < 12 ? Math.round(96 - i * 3.8) : 0,
    position: i,
    scheduled:
      i >= 12 ? '2026-09-' + String(i - 5).padStart(2, '0') + 'T19:00' : '',
    mediaType: 'image',
  };
});
export function engagement(p: Post) {
  return p.likes + p.comments + p.saves + p.shares;
}
export function scorePost(
  p: Post,
  baseline: Post[] = POSTS.filter((p) => p.status === 'Published'),
) {
  const avg = (fn: (p: Post) => number) =>
    baseline.reduce((n, p) => n + fn(p), 0) / (baseline.length || 1);
  const parts = [
    {
      name: 'Views',
      weight: 0.35,
      value: p.views,
      baseline: avg((p) => p.views),
    },
    {
      name: 'Engagement rate',
      weight: 0.3,
      value: p.reach ? engagement(p) / p.reach : 0,
      baseline: avg((p) => (p.reach ? engagement(p) / p.reach : 0)),
    },
    {
      name: 'Saves',
      weight: 0.15,
      value: p.saves,
      baseline: avg((p) => p.saves),
    },
    {
      name: 'Shares',
      weight: 0.2,
      value: p.shares,
      baseline: avg((p) => p.shares),
    },
  ];
  return {
    score: Math.round(
      parts.reduce(
        (n, p) =>
          n +
          Math.min(100, p.baseline ? (p.value / p.baseline) * 60 : 0) *
            p.weight,
        0,
      ),
    ),
    parts,
  };
}
