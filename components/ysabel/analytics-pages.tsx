'use client';
import { useMinimalMotion } from './use-motion';
import { useState } from 'react';
import {
  websiteStatus,
  type SourceStatus,
  type WebsiteRealtime,
} from '@/lib/source-status';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  Sparkles,
  ArrowUpRight,
  MapPin,
  Globe,
  ArrowDown,
  Plus,
  Info,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CHANNELS,
  COLORS,
  METRICS,
  metricAvailable,
  compact,
  number,
  total,
  change,
  filterDaily,
  engagement,
  type Daily,
  type Post,
  type Range,
  type Metric,
  series,
} from '@/lib/analytics';
import { Picker, Help } from './controls';
import { AnalyticsChart, Bars } from './charts';
import { type WorkspaceData } from './use-workspace';
import { MediaCards, Empty } from './content';
import { SourceReports } from './source-reports';
import type { ReportTable } from '@/lib/reporting';
import { SocialPerformance, AudienceBreakdown } from './social-performance';
import { AudienceMap } from './audience-map';
import { SOURCE_PLATFORM, SOCIAL_PLATFORMS } from '@/lib/social-performance';
export function StatRow({
  items,
}: {
  items: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="stat-row">
      {items.map((item) => (
        <div
          key={item.label}
          data-metric={METRICS.find((m) => m.label === item.label)?.key}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface padded">
      <h2>{title}</h2>
      {description && <p className="muted panel-description">{description}</p>}
      {children}
    </section>
  );
}
export function Trend({
  data,
  keys,
  title,
}: {
  data: Record<string, any>[];
  keys: string[];
  title: string;
}) {
  const animate = useMinimalMotion();
  return (
    <Panel title={title}>
      <div className="chart-legend">
        {keys.map((k, i) => (
          <span key={k}>
            <i style={{ background: COLORS[i] }} />
            {k}
          </span>
        ))}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -15, right: 10, bottom: 8 }}>
            <CartesianGrid
              stroke="#d5dce6"
              vertical={false}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              minTickGap={45}
              tick={{ fill: '#657185', fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(5)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fill: '#657185', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#f8fafe',
                border: '1px solid #cbd4e1',
                borderRadius: 8,
              }}
            />
            {keys.map((k, i) => (
              <Area
                isAnimationActive={animate}
                animationDuration={420}
                animationEasing="ease-out"
                key={k}
                type="monotone"
                dataKey={k}
                fill={COLORS[i]}
                fillOpacity={0.055}
                stroke={COLORS[i]}
                strokeWidth={1.8}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
export function getInsights(rows: Daily[], previous: Daily[], posts: Post[]) {
  const views = total(rows, 'views'),
    prior = total(previous, 'views');
  const channels = CHANNELS.slice(0, 3)
    .map((channel) => ({
      channel,
      value: total(
        rows.filter((r) => r.channel === channel),
        'views',
      ),
    }))
    .sort((a, b) => b.value - a.value);
  const ps = posts.filter((p) => p.status === 'Published');
  const chef = ps.filter((p) => p.tags.includes('Chef'));
  const average = ps.reduce((n, p) => n + p.shares, 0) / (ps.length || 1),
    chefAverage = chef.reduce((n, p) => n + p.shares, 0) / (chef.length || 1);
  const actions = total(rows, 'actions'),
    directions = total(rows, 'directions');
  const delta = change(views, prior);
  const insights = [
    {
      type: 'PERFORMANCE',
      title: prior
        ? 'Content views ' +
          (delta >= 0 ? 'grew ' : 'declined ') +
          Math.abs(delta).toFixed(1) +
          '%'
        : 'Content generated ' + compact(views) + ' views',
      text:
        compact(views) +
        ' views across the reporting social platforms' +
        (prior
          ? ', compared with ' + compact(prior) + ' in the comparison period.'
          : '.'),
      source: 'Daily social view observations',
      recommendation:
        'Review individual channels before changing the overall content mix.',
    },
    {
      type: 'CHANNEL SPOTLIGHT',
      title: channels[0].channel + ' leads attention',
      text: views
        ? ((channels[0].value / views) * 100).toFixed(1) +
          '% of social views came from ' +
          channels[0].channel +
          ' (' +
          compact(channels[0].value) +
          ').'
        : 'There are no social views in the selected range.',
      source: 'Views by channel / total social views',
      recommendation:
        'Compare saves and shares alongside views to assess the quality of attention.',
    },
    {
      type: 'CREATIVE OPPORTUNITY',
      title:
        chef.length && average
          ? 'Chef stories: ' +
            (chefAverage / average).toFixed(1) +
            '× average shares'
          : 'Build the creative evidence base',
      text: chef.length
        ? chef.length +
          ' chef-tagged posts averaged ' +
          number(Math.round(chefAverage)) +
          ' shares; all ' +
          ps.length +
          ' published posts averaged ' +
          number(Math.round(average)) +
          '.'
        : 'Tag published content to compare creative patterns.',
      source: 'Published content in view · manually assigned tags',
      recommendation:
        'Test another preparation-led story. This association does not prove the subject caused the performance.',
    },
    {
      type: 'BEYOND SOCIAL',
      title: compact(directions) + ' requests for directions',
      text: actions
        ? 'Directions account for ' +
          ((directions / actions) * 100).toFixed(1) +
          '% of Google actions in this period.'
        : 'No Google actions in the selected period.',
      source: 'Google Business daily action counts',
      recommendation:
        'Keep Google opening hours, location details and menu links current. Direction requests are not confirmed visits.',
    },
  ];
  return insights.filter((_, i) =>
    i < 2
      ? metricAvailable(rows, 'views')
      : i === 2
        ? posts.length > 0
        : metricAvailable(rows, 'actions'),
  );
}
export function InsightsPage({
  rows,
  previous,
  posts,
  onNavigate,
  live = false,
}: {
  live?: boolean;
  rows: Daily[];
  previous: Daily[];
  posts: Post[];
  onNavigate: (p: string) => void;
}) {
  const insights = getInsights(rows, previous, posts);
  const days = metricAvailable(rows, 'views') ? series(rows, 'views') : [];
  const avg =
      days.reduce((n, d) => n + Number(d.total), 0) / (days.length || 1),
    high = [...days].sort((a, b) => Number(b.total) - Number(a.total))[0];
  return (
    <div className="view-enter">
      <div className="intelligence-hero">
        <Sparkles size={27} />
        <div>
          <div className="eyebrow">
            {live
              ? 'YSABEL SOCIETY · CONNECTED OBSERVATIONS'
              : 'YSABEL SOCIETY · DEMO OBSERVATIONS'}
          </div>
          <h2>What changed?</h2>
          <p>
            A measured perspective on performance, content and customer intent.
          </p>
        </div>
      </div>
      <div className="insights-grid">
        {!insights.length && (
          <Panel
            title="More evidence is needed"
            description="Daily social observations are not available yet. View current account statistics in Connections, or connect Google for daily website and business metrics."
          >
            <a className="secondary" href="/marketingdata/connections">
              Open Connections
            </a>
          </Panel>
        )}
        {insights.map((s, i) => (
          <section className="surface insight-large" key={s.title}>
            <span className="insight-kicker">{s.type}</span>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
            <div className="recommendation">
              <span>NEXT CONSIDERATION</span>
              <p>{s.recommendation}</p>
            </div>
            <details>
              <summary>Evidence & calculation</summary>
              <p>
                {s.source}.{' '}
                {live ? 'Connected source data.' : 'Deterministic demo data.'}{' '}
                Period filters apply to daily metrics; creative statistics use
                the published content records in view.
              </p>
            </details>
            <button
              className="text-link"
              onClick={() =>
                onNavigate(
                  [
                    'Performance',
                    'Performance',
                    'Content Intelligence',
                    'Google Business',
                  ][
                    s.type === 'BEYOND SOCIAL'
                      ? 3
                      : s.type === 'CREATIVE OPPORTUNITY'
                        ? 2
                        : 0
                  ],
                )
              }
            >
              Explore source <ArrowUpRight size={13} />
            </button>
          </section>
        ))}
      </div>
      <Panel
        title="Signals"
        description="Unusual observations deserve context, not alarm."
      >
        {high ? (
          <div className="signal">
            <span className="pill">SIGNAL</span>
            <div>
              <h3>
                {String(high.date)} · {compact(Number(high.total))} views
              </h3>
              <p>
                {avg ? (Number(high.total) / avg).toFixed(2) : '0'}× the daily
                period average. Compare the timing with your campaign
                annotations.
              </p>
            </div>
          </div>
        ) : (
          <Empty title="No signals in this period" />
        )}
      </Panel>
    </div>
  );
}
export function PerformancePage({
  rows,
  previous,
  initialChannel = 'All',
  data,
  unit,
  range,
  live = false,
  loading = false,
  websiteConnection,
  websiteRealtime,
  tables = [],
}: {
  rows: Daily[];
  previous: Daily[];
  initialChannel?: string;
  data: WorkspaceData;
  unit: string;
  range: Range;
  live?: boolean;
  loading?: boolean;
  websiteConnection?: SourceStatus;
  websiteRealtime?: WebsiteRealtime;
  tables?: ReportTable[];
}) {
  const [channel, setChannel] = useState(initialChannel),
    [note, setNote] = useState(''),
    [noteDate, setNoteDate] = useState(range.end);
  const r = rows.filter((row) => channel === 'All' || row.channel === channel),
    p = previous.filter((row) => channel === 'All' || row.channel === channel);
  const websiteTables = tables
    .filter((t) => t.source === 'ga4')
    .map((t) => ({
      ...t,
      columns: t.columns.filter(
        (c) => !['conversions', 'conversionValue', 'keyEvents'].includes(c),
      ),
    }));
  return (
    <div className="view-enter platform-workspace" data-platform={channel}>
      <div className="studio-toolbar">
        <Tabs value={channel} onValueChange={(v) => setChannel(String(v))}>
          <TabsList className="page-tabs">
            {['All', ...CHANNELS].map((c) => (
              <TabsTrigger key={c} value={c} data-platform={c}>
                {c === 'All' ? 'All social platforms' : c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {channel === 'Website' ? (
        <>
          <WebsitePage
            rows={r}
            previous={p}
            live={live}
            status={websiteConnection}
            realtime={websiteRealtime}
          />
          <AudienceMap tables={websiteTables} channels={['Website']} />
          {live && (
            <SourceReports
              tables={websiteTables}
              group="website"
              title="Website source reports"
            />
          )}
        </>
      ) : channel === 'Google Business' ? (
        <>
          <GooglePage rows={r} live={live} />
          {live && (
            <SourceReports
              tables={tables.filter((t) => t.source === 'gbp')}
              group="google"
              title="Google Business source reports"
            />
          )}
        </>
      ) : (
        <SocialPerformance
          key={channel}
          rows={r}
          posts={data.posts}
          tables={tables}
          range={range}
          channel={channel}
          loading={loading}
        />
      )}
      <details className="surface performance-notes">
        <summary>Timeline annotations</summary>
        <form
          className="performance-note-form"
          onSubmit={(e) => {
            e.preventDefault();
            void data
              .annotate(noteDate, note, unit)
              .then(() => setNote(''))
              .catch(() => {});
          }}
        >
          <label>
            Date
            <input
              type="date"
              required
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </label>
          <label>
            What happened?
            <input
              required
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="secondary" disabled={data.busy || !data.ready}>
            <Plus size={14} /> Add annotation
          </button>
        </form>
        <div className="annotation-list">
          {data.annotations
            .filter((n) => n.date >= range.start && n.date <= range.end)
            .map((n) => (
              <div key={n.id}>
                <span>{n.date}</span>
                <p>{n.text}</p>
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}
export function AudiencePage({
  rows,
  previous,
  live = false,
  tables = [],
  loading = false,
}: {
  rows: Daily[];
  previous: Daily[];
  live?: boolean;
  tables?: ReportTable[];
  loading?: boolean;
}) {
  const [channel, setChannel] = useState('All'),
    [layout, setLayout] = useState('Together');
  const channels = channel === 'All' ? [...SOCIAL_PLATFORMS] : [channel];
  const selectedRows = rows.filter((r) =>
    channels.includes(r.channel as (typeof SOCIAL_PLATFORMS)[number]),
  );
  return (
    <div className="view-enter platform-workspace" data-platform={channel}>
      <div className="studio-toolbar">
        <Tabs value={channel} onValueChange={(v) => setChannel(String(v))}>
          <TabsList className="page-tabs">
            {['All', ...SOCIAL_PLATFORMS].map((c) => (
              <TabsTrigger value={c} key={c} data-platform={c}>
                {c === 'All' ? 'All social platforms' : c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {channel === 'All' && (
          <Picker
            label="Audience map layout"
            value={layout}
            onChange={setLayout}
            options={['Together', 'Separate platforms']}
          />
        )}
      </div>
      <CommunitySummary
        key={channel}
        rows={selectedRows}
        previous={previous.filter((r) =>
          channels.includes(r.channel as (typeof SOCIAL_PLATFORMS)[number]),
        )}
        live={live}
      />
      {live && (
        <>
          <AudienceBreakdown
            tables={tables}
            channels={channels}
            loading={loading}
            separate={layout === 'Separate platforms'}
          />
          <SourceReports
            key={channel}
            tables={tables.filter((t) =>
              channels.includes(
                SOURCE_PLATFORM[t.source] as (typeof SOCIAL_PLATFORMS)[number],
              ),
            )}
            group="audience"
            title="Audience detail"
          />
        </>
      )}
    </div>
  );
}
function CommunitySummary({
  rows,
  previous,
  live = false,
}: {
  rows: Daily[];
  previous: Daily[];
  live?: boolean;
}) {
  const animate = useMinimalMotion();
  if (live && !metricAvailable(rows, 'followers'))
    return (
      <Panel
        title="Follower history is not available"
        description="Current social account statistics are shown in Connections. Daily historical follower series are not supplied by the connected sources."
      >
        <a className="secondary" href="/marketingdata/connections">
          View account snapshots
        </a>
      </Panel>
    );
  const followers = total(rows, 'followers'),
    prior = total(previous, 'followers'),
    dayCount = new Set(rows.map((r) => r.date)).size;
  const distribution = CHANNELS.slice(0, 3).map((label, i) => ({
    label,
    value: total(
      rows.filter((r) => r.channel === label),
      'followers',
    ),
    color: COLORS[i],
  }));
  return (
    <div className="view-enter">
      <StatRow
        items={[
          {
            label: 'Community',
            value: number(followers),
            note: 'Latest combined social followers',
          },
          {
            label: 'Net new followers',
            value: prior ? number(followers - prior) : '—',
            note: 'Since comparison period end',
          },
          {
            label: 'Growth',
            value: prior ? change(followers, prior).toFixed(1) + '%' : '—',
          },
          {
            label: 'Average daily growth',
            value: prior
              ? ((followers - prior) / (dayCount || 1)).toFixed(0)
              : '—',
          },
        ]}
      />
      <AnalyticsChart
        rows={rows}
        previous={previous}
        metric="followers"
        title="Community growth"
      />
      {live ? (
        <Panel
          title="Community by platform"
          description="Latest captured follower count per platform in the selected dates. The same person may follow more than one account."
        >
          <div className="audience-distribution">
            <div
              className="donut audience-donut"
              role="img"
              aria-label={distribution
                .filter((d) => d.value > 0)
                .map((d) => d.label + ': ' + number(d.value))
                .join('; ')}
            >
              <ResponsiveContainer width="100%" height={260} minWidth={1}>
                <PieChart>
                  <Pie
                    key={distribution.map((d) => d.value).join(',')}
                    data={distribution.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={83}
                    outerRadius={110}
                    paddingAngle={3}
                    cornerRadius={7}
                    stroke="#f8f9fb"
                    strokeWidth={3}
                    isAnimationActive={animate}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  >
                    {distribution
                      .filter((d) => d.value > 0)
                      .map((d) => (
                        <Cell key={d.label} fill={d.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => number(Number(v))}
                    contentStyle={{
                      borderRadius: 16,
                      background: '#f8fafe',
                      border: '1px solid #c6d1df',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <strong>
                {compact(followers)}
                <small>followers</small>
              </strong>
            </div>
            <div>
              <Bars
                items={distribution.filter((d) =>
                  metricAvailable(
                    rows.filter((r) => r.channel === d.label),
                    'followers',
                  ),
                )}
              />
              <p className="footnote">
                Counts are observations, not a reconstructed history.
                Demographic reports below retain Meta’s time scope and privacy
                limits.
              </p>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <div className="three-col">
            <Panel title="Platform distribution">
              <div className="donut">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      isAnimationActive={animate}
                      animationDuration={420}
                      animationEasing="ease-out"
                      data={distribution}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={65}
                      outerRadius={84}
                      stroke="none"
                      paddingAngle={3}
                    >
                      {distribution.map((d) => (
                        <Cell key={d.label} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#f8fafe',
                        border: '1px solid #cbd4e1',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <strong>
                  {compact(followers)}
                  <small>community</small>
                </strong>
              </div>
              <Bars items={distribution} />
            </Panel>
            <Panel
              title="Top countries"
              description="Sample audience snapshot · percentages"
            >
              <Bars
                items={[
                  { label: 'Albania', value: 74 },
                  { label: 'Italy', value: 11 },
                  { label: 'Kosovo', value: 7 },
                  { label: 'United Kingdom', value: 5 },
                  { label: 'Other', value: 3 },
                ]}
                suffix="%"
              />
            </Panel>
            <Panel
              title="Top cities"
              description="Sample audience snapshot · percentages"
            >
              <Bars
                items={[
                  { label: 'Tirana', value: 62 },
                  { label: 'Durrës', value: 14 },
                  { label: 'Pristina', value: 9 },
                  { label: 'Milan', value: 7 },
                  { label: 'Other', value: 8 },
                ]}
                suffix="%"
              />
            </Panel>
          </div>
          <div className="two-col">
            <Panel
              title="Age distribution"
              description="Illustrative demographic snapshot, separate from date-filtered activity."
            >
              <Bars
                items={[
                  { label: '18–24', value: 17 },
                  { label: '25–34', value: 42 },
                  { label: '35–44', value: 26 },
                  { label: '45–54', value: 11 },
                  { label: '55+', value: 4 },
                ]}
                suffix="%"
              />
            </Panel>
            <Panel title="Audience availability">
              <div className="availability-row">
                <span>Gender</span>
                <span>Not supplied</span>
              </div>
              <div className="availability-row">
                <span>Languages</span>
                <span>Not supplied</span>
              </div>
              <div className="availability-row">
                <span>New / returning visitors</span>
                <span>Requires GA4 identity reporting</span>
              </div>
              <p className="footnote">
                Only permitted, sufficiently aggregated demographics should
                appear once accounts are connected. No individual profiles are
                inferred.
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
export function WebsitePage({
  rows,
  previous,
  live = false,
  status,
  realtime,
}: {
  rows: Daily[];
  previous: Daily[];
  live?: boolean;
  status?: SourceStatus;
  realtime?: WebsiteRealtime;
}) {
  const [refreshing, setRefreshing] = useState(false),
    [refreshError, setRefreshError] = useState('');
  const r = rows.filter((r) => r.channel === 'Website'),
    p = previous.filter((r) => r.channel === 'Website');
  const connection = websiteStatus(status, metricAvailable(r, 'users'));
  async function refreshWebsite() {
    setRefreshing(true);
    setRefreshError('');
    try {
      const response = await fetch('/marketingdata/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'refresh', source: 'ga4' }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Website refresh failed.');
    } catch (e) {
      setRefreshError(
        e instanceof Error ? e.message : 'Website refresh failed.',
      );
    } finally {
      setRefreshing(false);
      window.dispatchEvent(new Event('ysabel:sources-updated'));
    }
  }
  const connectionPanel = live && (
    <Panel title={connection.title} description={connection.detail}>
      <p className="footnote">
        Website source:{' '}
        <a href="https://ysabelsociety.com" target="_blank" rel="noreferrer">
          ysabelsociety.com
        </a>{' '}
        · Google Analytics. Dashboard visits are excluded from daily website
        reports.
      </p>
      {status?.lastSync && (
        <p className="footnote">
          Last successful report check:{' '}
          {new Date(status.lastSync).toLocaleString()}.
        </p>
      )}
      <div className="inline-controls">
        <a className="secondary" href="/marketingdata/connections">
          Manage Google connection
        </a>
        {status && (
          <button
            className="secondary"
            disabled={refreshing}
            onClick={() => void refreshWebsite()}
          >
            {refreshing ? 'Refreshing website…' : 'Refresh website data'}
          </button>
        )}
      </div>
      {refreshError && <p role="alert">{refreshError}</p>}
      {realtime && (
        <>
          <h3>Activity in the last 30 minutes</h3>
          <p className="footnote">
            Snapshot checked {new Date(realtime.observedAt).toLocaleString()}.
            This is the 30-minute window before that check, separate from the
            selected dates. Refresh to update it.
          </p>
          <StatRow
            items={[
              {
                label: 'Active users · 30 min',
                value:
                  realtime.activeUsers == null
                    ? '—'
                    : number(realtime.activeUsers),
              },
              {
                label: 'Page views · 30 min',
                value:
                  realtime.pageViews == null ? '—' : number(realtime.pageViews),
              },
              {
                label: 'Events · 30 min',
                value: realtime.events == null ? '—' : number(realtime.events),
              },
            ]}
          />
        </>
      )}
    </Panel>
  );
  if (live && !metricAvailable(r, 'users'))
    return <div className="view-enter">{connectionPanel}</div>;
  const users = total(r, 'users'),
    sessions = total(r, 'sessions'),
    engaged = total(r, 'engaged'),
    pages = total(r, 'pageViews');
  return (
    <div className="view-enter">
      {connectionPanel}
      <StatRow
        items={[
          {
            label: 'Daily active users',
            value: number(users),
            note: 'Daily sum · not period-unique',
          },
          {
            label: 'Sessions',
            value: metricAvailable(r, 'sessions') ? number(sessions) : '—',
          },
          {
            label: 'Engaged sessions',
            value: metricAvailable(r, 'engaged') ? number(engaged) : '—',
          },
          {
            label: 'Engagement rate',
            value: sessions
              ? ((engaged / sessions) * 100).toFixed(1) + '%'
              : '—',
          },
          {
            label: 'Page views',
            value: metricAvailable(r, 'pageViews') ? number(pages) : '—',
          },
        ]}
      />
      <AnalyticsChart
        rows={r}
        previous={p}
        metric="users"
        title="Traffic over time"
      />
      {live ? (
        <Panel
          title="From discovery to intent"
          description="Configured website tracking. These counts do not establish a same-person funnel."
        >
          <StatRow
            items={[
              {
                label: 'Menu page views',
                value: metricAvailable(r, 'menu')
                  ? number(total(r, 'menu'))
                  : '—',
              },
              {
                label: 'Reservation clicks',
                value: metricAvailable(r, 'reservation')
                  ? number(total(r, 'reservation'))
                  : '—',
              },
              {
                label: 'Confirmed reservation events',
                value: metricAvailable(r, 'bookings')
                  ? number(total(r, 'bookings'))
                  : '—',
              },
              {
                label: 'Engagement time',
                value: metricAvailable(r, 'engagementSeconds')
                  ? Math.round(
                      total(r, 'engagementSeconds') / 60,
                    ).toLocaleString() + ' min'
                  : '—',
              },
            ]}
          />
          <p className="footnote">
            Set tracking names in Connections. The source tables below contain
            traffic, page, device and event breakdowns where access permits
            them.
          </p>
        </Panel>
      ) : (
        <>
          <div className="two-col">
            <Panel
              title="Traffic sources"
              description="Demo session allocation"
            >
              <Bars
                items={[
                  'Organic search',
                  'Social',
                  'Direct',
                  'Referral',
                  'Paid',
                  'Other',
                ].map((label, i) => ({
                  label,
                  value: Math.round(
                    sessions * [0.38, 0.31, 0.19, 0.07, 0.03, 0.02][i],
                  ),
                }))}
              />
            </Panel>
            <Panel
              title="Social referrals"
              description="Demo session allocation · referral does not imply a booking"
            >
              <Bars
                items={['Instagram', 'Facebook', 'TikTok', 'Other'].map(
                  (label, i) => ({
                    label,
                    value: Math.round(
                      sessions * 0.31 * [0.57, 0.24, 0.15, 0.04][i],
                    ),
                  }),
                )}
              />
            </Panel>
          </div>
          <Panel
            title="From discovery to intent"
            description="Observed website events in demo data. Stages are not linked to the same person."
          >
            <div className="funnel">
              {[
                { label: 'Website activity', value: users },
                { label: 'Menu page views', value: total(r, 'menu') },
                {
                  label: 'Reservation button clicks',
                  value: total(r, 'reservation'),
                },
              ].map((s, i) => (
                <div key={s.label}>
                  <span>0{i + 1}</span>
                  <strong>{compact(s.value)}</strong>
                  <p>{s.label}</p>
                  <div
                    style={{
                      width: Math.max(10, (s.value / (users || 1)) * 100) + '%',
                    }}
                  />
                </div>
              ))}
              <div className="unmeasured">
                <span>04</span>
                <strong>—</strong>
                <p>Completed reservations</p>
                <small>Tracking unavailable</small>
              </div>
            </div>
            <p className="footnote">
              Attribution: unknown. Reservation clicks are not completed
              reservations. Cross-platform social impressions cannot be joined
              into a user funnel.
            </p>
          </Panel>
          <Panel
            title="Website content performance"
            description="Deterministic page allocation from the demo page-view total"
          >
            <div className="simple-table">
              <div className="simple-table-row table-label">
                <span>Page</span>
                <span>Views</span>
                <span>Share</span>
              </div>
              {[
                'Menu',
                'Dining',
                'Experiences',
                'Reservations',
                'About',
                'Contact',
              ].map((page, i) => (
                <div className="simple-table-row" key={page}>
                  <strong>/{page.toLowerCase()}</strong>
                  <span>
                    {number(
                      Math.round(
                        pages * [0.32, 0.2, 0.18, 0.17, 0.08, 0.05][i],
                      ),
                    )}
                  </span>
                  <span>{[32, 20, 18, 17, 8, 5][i]}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
export function GooglePage({
  rows,
  live = false,
}: {
  rows: Daily[];
  live?: boolean;
}) {
  const r = rows.filter((r) => r.channel === 'Google Business');
  if (live && !r.length)
    return (
      <Panel
        title="Business Profile metrics are not available for this period"
        description="Connect a Google Business Profile location or choose a date range with imported observations."
      >
        <a className="secondary" href="/marketingdata/connections">
          Open Connections
        </a>
      </Panel>
    );
  const grouped = new Map<string, any>();
  r.forEach((d) => {
    const v = grouped.get(d.date) ?? { date: d.date, Search: 0, Maps: 0 };
    v.Search += d.search;
    v.Maps += d.maps;
    grouped.set(d.date, v);
  });
  return (
    <div className="view-enter">
      <StatRow
        items={[
          {
            label: 'Google Search views',
            value: metricAvailable(r, 'search')
              ? number(total(r, 'search'))
              : '—',
          },
          {
            label: 'Google Maps views',
            value: metricAvailable(r, 'maps') ? number(total(r, 'maps')) : '—',
          },
          {
            label: 'Website clicks',
            value: metricAvailable(r, 'clicks')
              ? number(total(r, 'clicks'))
              : '—',
          },
          {
            label: 'Phone call clicks',
            value: metricAvailable(r, 'calls')
              ? number(total(r, 'calls'))
              : '—',
          },
          {
            label: 'Direction requests',
            value: metricAvailable(r, 'directions')
              ? number(total(r, 'directions'))
              : '—',
          },
          {
            label: 'Reserve with Google bookings',
            value: metricAvailable(r, 'bookings')
              ? number(total(r, 'bookings'))
              : '—',
          },
          {
            label: 'Menu interactions',
            value: metricAvailable(r, 'menu') ? number(total(r, 'menu')) : '—',
          },
          {
            label: 'Food orders',
            value: metricAvailable(r, 'foodOrders')
              ? number(total(r, 'foodOrders'))
              : '—',
          },
        ]}
      />
      <Trend
        title="Search & Maps visibility"
        data={[...grouped.values()]}
        keys={['Search', 'Maps']}
      />
      <div className="two-col">
        <Panel
          title="Customer actions"
          description="What people did after discovering Ysabel Society"
        >
          <Bars
            items={[
              { label: 'Direction requests', value: total(r, 'directions') },
              { label: 'Website clicks', value: total(r, 'clicks') },
              { label: 'Phone call clicks', value: total(r, 'calls') },
            ]}
          />
          <p className="footnote">
            These actions do not measure completed visits, answered calls or
            reservations. Bookings, menu interactions and food orders depend on
            the services enabled for your location.
          </p>
        </Panel>
        <Panel
          title="Ysabel Society at a glance"
          description="Search visibility and customer intent for your brand"
        >
          <div className="simple-table">
            <div className="simple-table-row table-label">
              <span>Workspace</span>
              <span>Search</span>
              <span>Maps</span>
              <span>Actions</span>
            </div>
            <div className="simple-table-row">
              <strong>Ysabel Society</strong>
              <span>{compact(total(r, 'search'))}</span>
              <span>{compact(total(r, 'maps'))}</span>
              <span>{compact(total(r, 'actions'))}</span>
            </div>
          </div>
          <p className="footnote">
            All connected Google Business sources are shown together for Ysabel
            Society.
          </p>
        </Panel>
      </div>
    </div>
  );
}
export function ComparisonsPage({
  range,
  rows,
  previous,
}: {
  range: Range;
  rows: Daily[];
  previous: Daily[];
}) {
  const [mode, setMode] = useState('Channels'),
    [left, setLeft] = useState('Instagram'),
    [right, setRight] = useState('TikTok');
  const options = [...CHANNELS];
  const a = mode === 'Periods' ? rows : rows.filter((r) => r.channel === left),
    b = mode === 'Periods' ? previous : rows.filter((r) => r.channel === right);
  return (
    <div className="view-enter">
      <div className="studio-toolbar">
        <Picker
          label="Comparison type"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setLeft('Instagram');
            setRight('TikTok');
          }}
          options={['Channels', 'Periods']}
        />
        {mode !== 'Periods' && (
          <div className="inline-controls">
            <Picker
              label="First comparison"
              value={left}
              onChange={setLeft}
              options={options}
            />
            <span className="muted">versus</span>
            <Picker
              label="Second comparison"
              value={right}
              onChange={setRight}
              options={options}
            />
          </div>
        )}
      </div>
      <div className="compare-heading">
        <h2>{mode === 'Periods' ? 'Selected period' : left}</h2>
        <span>VS</span>
        <h2>{mode === 'Periods' ? 'Comparison period' : right}</h2>
      </div>
      <div className="comparison-rows">
        {METRICS.map((m) => {
          const v = total(a, m.key),
            w = total(b, m.key);
          return (
            <div className="comparison-row" key={m.key}>
              <strong>{metricAvailable(a, m.key) ? compact(v) : '—'}</strong>
              <div>
                <span>
                  {m.label} <Help text={m.definition} />
                </span>
                <div className="compare-bars">
                  <i
                    style={{ width: (v / (Math.max(v, w) || 1)) * 48 + '%' }}
                  />
                  <i
                    style={{ width: (w / (Math.max(v, w) || 1)) * 48 + '%' }}
                  />
                </div>
              </div>
              <strong>{metricAvailable(b, m.key) ? compact(w) : '—'}</strong>
            </div>
          );
        })}
      </div>
      <div className="two-col">
        <AnalyticsChart
          rows={a}
          title={mode === 'Periods' ? 'Selected period' : left}
        />
        <AnalyticsChart
          rows={b}
          title={mode === 'Periods' ? 'Comparison period' : right}
        />
      </div>
      <p className="footnote">
        Source-specific definitions apply. Cross-channel reach and daily users
        are not unique people. Paid media comparison becomes available after
        advertising data is connected.
      </p>
    </div>
  );
}
