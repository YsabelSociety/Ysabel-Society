'use client';
import { useState, useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { OpenDashboardData } from '@/lib/dashboard-navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ResponsiveContainer } from './stable-chart-container';
import {
  CHANNELS,
  COLORS,
  compact,
  number,
  total,
  metricAvailable,
  type Daily,
  type Post,
  type Range,
} from '@/lib/analytics';
import {
  SOCIAL_PLATFORMS,
  type PerformanceBasis,
  profileViewCoverage,
} from '@/lib/social-performance';
import { MetricCard, DeferredChart } from './social-performance';
import { Picker } from './controls';
import { Spark } from './charts';
import { useMinimalMotion } from './use-motion';
import { activitySeries } from '@/lib/activity-series';
import { DataIcon } from './data-icons';
import { SourceBadge } from './source-badge';
import { GoogleDiscoveryCards } from './google-discovery-cards';
import { reportingDateLabel, type WebsiteRealtime } from '@/lib/source-status';
import { calendarDate } from '@/lib/sync-window';

export function ProfileViews({
  rows,
  previous = [],
  channels = SOCIAL_PLATFORMS,
  onOpen,
}: {
  rows: Daily[];
  previous?: Daily[];
  channels?: readonly string[];
  onOpen?: OpenDashboardData;
}) {
  const Card = onOpen ? 'button' : 'article';
  return (
    <section
      className="profile-views-first"
      aria-label="Profile views by platform"
      data-dashboard-metric="profileViews"
      data-dashboard-channel="All"
      tabIndex={-1}
    >
      <div className="section-head">
        <div>
          <h2>Profile views</h2>
          <p>Visits to your social profiles during the selected dates</p>
        </div>
      </div>
      <div className="profile-views-grid">
        {channels.map((channel) => {
          const current = rows.filter((r) => r.channel === channel),
            prior = previous.filter((r) => r.channel === channel);
          const has = metricAvailable(current, 'profileViews'),
            value = total(current, 'profileViews');
          const old = metricAvailable(prior, 'profileViews')
            ? total(prior, 'profileViews')
            : null;
          return (
            <Card
              key={channel}
              type={onOpen ? 'button' : undefined}
              onClick={onOpen ? () => onOpen(channel, 'profileViews') : undefined}
              aria-label={onOpen ? 'Open ' + channel + ' profile views' : undefined}
              data-dashboard-metric="profileViews"
              data-dashboard-channel={channel}
              tabIndex={onOpen ? undefined : -1}
              className="surface profile-views-card"
              data-platform={channel}
            >
              <span>
                <DataIcon name={channel} badge />
                {channel}
              </span>
              <strong>{has ? number(value) : 'Unavailable'}</strong>
              <SourceBadge channel={channel} metric="profileViews" unavailable={!has} rows={profileViewCoverage(current, channel).rows} />
              <small>
                {!has
                  ? channel === 'TikTok'
                    ? 'Profile visits need TikTok analytics access'
                    : 'No profile-visit report for these dates'
                  : old && old > 0
                    ? (((value - old) / old) * 100).toFixed(1) +
                      '% vs. previous period'
                    : 'Reported profile visits'}
              </small>
              {has && (
                <Spark
                  values={current
                    .filter(
                      (r) =>
                        r.available?.includes('profileViews') &&
                        typeof r.profileViews === 'number',
                    )
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((r) => r.profileViews!)}
                />
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PlatformTimeline({
  channel,
  rows,
  posts,
  range,
  onOpen,
}: {
  onOpen?: () => void;
  channel: string;
  rows: Daily[];
  posts: Post[];
  range: Range;
}) {
  const hasDaily = metricAvailable(
    rows.filter((r) => r.channel === channel),
    'views',
  );
  const [choice, setChoice] = useState('Latest available');
  const basis: PerformanceBasis =
    choice === 'Latest available'
      ? hasDaily
        ? 'Daily activity'
        : 'Published content'
      : (choice as PerformanceBasis);
  return (
    <div className="platform-timeline" data-platform={channel}>
      <Picker
        label={channel + ' view measurement'}
        value={choice}
        onChange={setChoice}
        options={['Latest available', 'Daily activity', 'Published content']}
      />
      <MetricCard
        metric="views"
        label={channel + ' views'}
        rows={rows}
        posts={posts}
        channels={[channel]}
        range={range}
        basis={basis}
        onOpen={onOpen}
      />
    </div>
  );
}

export function ChannelTimeline({
  rows,
  posts,
  range,
  websiteRealtime,
  onOpen,
}: {
  rows: Daily[];
  posts: Post[];
  range: Range;
  websiteRealtime?: WebsiteRealtime;
  onOpen?: OpenDashboardData;
}) {
  return (
    <section className="channel-timeline-section">
      <div className="section-head">
        <div>
          <h2>Performance over time</h2>
          <p>Instagram · Facebook · TikTok · Website · Google Search & Maps</p>
        </div>
      </div>
      <div className="performance-chart-grid overview-social-chart-grid">
        {SOCIAL_PLATFORMS.map((channel) => (
          <DeferredChart
            key={channel}
            title={channel + ' views'}
            loading={false}
            tall
          >
            <PlatformTimeline
              channel={channel}
              rows={rows}
              posts={posts}
              range={range}
              onOpen={onOpen ? () => onOpen(channel, 'views') : undefined}
            />
          </DeferredChart>
        ))}
      </div>
      <div className="overview-discovery-grid">
        <DailyMetricGraph
          rows={rows}
          channel="Website"
          metric="pageViews"
          label="Website page views"
          range={range}
          realtime={websiteRealtime}
          color="#bc773c"
          onOpen={onOpen ? () => onOpen('Website', 'pageViews') : undefined}
        />
        <GoogleDiscoveryCards rows={rows} range={range} onOpen={onOpen} />
      </div>
    </section>
  );
}

type DailyKey =
  | 'users'
  | 'sessions'
  | 'engaged'
  | 'pageViews'
  | 'menu'
  | 'reservation'
  | 'follows'
  | 'unfollows';
export function DailyMetricGraph(props: Parameters<typeof DailyMetricGraphContent>[0]) {
  return <DeferredChart title={props.label} loading={false} metric={props.metric} channel={props.channel}>
    <DailyMetricGraphContent {...props} />
  </DeferredChart>;
}

function DailyMetricGraphContent({
  rows,
  channel,
  metric,
  label,
  color,
  range,
  realtime,
  onOpen,
}: {
  rows: Daily[];
  channel: string;
  metric: DailyKey;
  label: string;
  color: string;
  range?: Range;
  realtime?: WebsiteRealtime;
  onOpen?: () => void;
}) {
  const animate = useMinimalMotion(),
    id = useId().replace(/:/g, '');
  const data = activitySeries(rows, channel, metric, range);
  const supplied = data.filter((d) => d.value !== null);
  const latest = supplied.at(-1)?.date;
  const today = calendarDate('Europe/Tirane');
  const todayValue = data.find(point => point.date === today)?.value;
  const observed = realtime && new Date(realtime.observedAt);
  const recent = observed && Number.isFinite(+observed) && calendarDate('Europe/Tirane', observed) === today;
  return (
    <section
      className={"surface padded daily-metric-graph" + (onOpen ? " dashboard-linked-chart" : "")}
      onClick={onOpen ? event => { if (!(event.target as HTMLElement).closest('button,a,input,select,[role="combobox"]')) onOpen(); } : undefined}
      style={{ '--report-color': color } as React.CSSProperties}
    >
      <span className="metric-eyebrow">{channel} · Daily activity</span>
      <h3>
        <DataIcon name={metric} />
        {onOpen ? <button type="button" className="dashboard-chart-link" onClick={onOpen} aria-label={'Open ' + label + ' in Website'}>{label}<ArrowUpRight size={16}/></button> : label}
      </h3>
      <strong className="metric-total">
        {supplied.length
          ? number(supplied.reduce((n, d) => n + Number(d.value), 0))
          : 'Unavailable'}
      </strong>
      <small className="daily-total-label">Total in selected dates</small>
      <div className="daily-report-freshness">
        <SourceBadge channel={channel} metric={metric} rows={rows.filter(row => row.channel === channel)} unavailable={!supplied.length}/>
        <span>{latest ? 'Through ' + reportingDateLabel(latest) + (latest === today ? ' · today so far' : '') : 'Awaiting daily report'}</span>
      </div>
      {channel === 'Website' && (!range || range.end === today) && <div className="daily-report-current">
        <div><span>Today so far</span><strong>{todayValue == null ? '—' : number(todayValue)}</strong></div>
        {metric === 'pageViews' && recent && realtime?.pageViews != null && <div><span>Page views · 30 min</span><strong>{number(realtime.pageViews)}</strong><small>Captured {observed!.toLocaleTimeString('en-GB', {timeZone:'Europe/Tirane',hour:'2-digit',minute:'2-digit'})}</small></div>}
      </div>}
      <div className="website-report-chart">
        {supplied.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data}
              margin={{ left: 0, right: 18, top: 12, bottom: 5 }}
            >
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#d9e0e6"
                strokeDasharray="3 6"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={35}
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                tickFormatter={compact}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v: any) => [number(Number(v)), label]}
                contentStyle={{ borderRadius: 14 }}
              />
              <Area
                key={
                  metric + supplied.map((d) => d.date + ':' + d.value).join(',')
                }
                dataKey="value"
                type="monotone"
                stroke={color}
                strokeWidth={2.5}
                fill={'url(#' + id + ')'}
                connectNulls={false}
                dot={{
                  r: supplied.length < 12 ? 4 : 2,
                  fill: color,
                  stroke: '#fff',
                }}
                activeDot={{ r: 7 }}
                isAnimationActive={animate}
                animationDuration={850}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-no-data">
            No {label.toLowerCase()} report supplied for these dates.
          </div>
        )}
      </div>
      <p className="metric-definition">
        {supplied.length === 1
          ? 'One reported day is shown as a point. More recorded days are needed for a trend. '
          : ''}
        {metric === 'users'
          ? 'Daily active users; totals across dates are user-days, not unique people.'
          : 'Recorded daily values. Missing reports stay blank.'}
      </p>
    </section>
  );
}

export function WebsiteMetricGraphs({ rows, range }: { rows: Daily[]; range?: Range }) {
  const metrics: [DailyKey, string, string][] = [
    ['users', 'Active users', '#256ca9'],
    ['sessions', 'Sessions', '#7354ba'],
    ['engaged', 'Engaged sessions', '#20856e'],
    ['pageViews', 'Page views', '#bc773c'],
    ['menu', 'Menu page views', '#b84d86'],
    ['reservation', 'Reservation clicks', '#318992'],
  ];
  return (
    <div className="performance-chart-grid website-metric-grid">
      {metrics.map(([metric, label, color]) => (
          <DailyMetricGraph
            key={metric}
            rows={rows}
            channel="Website"
            range={range}
            metric={metric}
            label={label}
            color={color}
          />
      ))}
    </div>
  );
}

export function AudienceHistory({
  rows,
  range,
  channels,
}: {
  rows: Daily[];
  range: Range;
  channels: readonly string[];
}) {
  return (
    <section className="audience-history">
      <div className="section-head">
        <div>
          <h2>Audience movement</h2>
          <p>
            Separate scales reveal each platform’s recorded changes. A single
            snapshot stays a point.
          </p>
        </div>
      </div>
      <div className="performance-chart-grid">
        {channels.map((channel) => (
          <DeferredChart
            key={channel}
            title={channel + ' followers'}
            loading={false}
          >
            <MetricCard
              metric="followers"
              label={channel + ' followers'}
              rows={rows}
              posts={[]}
              channels={[channel]}
              range={range}
              basis="Daily activity"
            />
          </DeferredChart>
        ))}
        {channels.includes('Facebook') && (
          <>
            <DailyMetricGraph
              rows={rows}
              channel="Facebook"
              metric="follows"
              label="New Facebook followers"
              color="#3478ce"
            />
            <DailyMetricGraph
              rows={rows}
              channel="Facebook"
              metric="unfollows"
              label="Facebook unfollows"
              color="#b45485"
            />
          </>
        )}
      </div>
    </section>
  );
}
