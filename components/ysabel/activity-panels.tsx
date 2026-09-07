'use client';
import { useState, useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
} from '@/lib/social-performance';
import { MetricCard, DeferredChart } from './social-performance';
import { Picker } from './controls';
import { Spark } from './charts';
import { useMinimalMotion } from './use-motion';
import { activitySeries } from '@/lib/activity-series';
import { DataIcon } from './data-icons';

export function ProfileViews({
  rows,
  previous = [],
  channels = SOCIAL_PLATFORMS,
}: {
  rows: Daily[];
  previous?: Daily[];
  channels?: readonly string[];
}) {
  return (
    <section
      className="profile-views-first"
      aria-label="Profile views by platform"
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
            <article
              key={channel}
              className="surface profile-views-card"
              data-platform={channel}
            >
              <span>
                <DataIcon name={channel} badge />
                {channel}
              </span>
              <strong>{has ? number(value) : 'Unavailable'}</strong>
              <small>
                {!has
                  ? channel === 'TikTok'
                    ? 'TikTok Studio report needed'
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
            </article>
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
}: {
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
      />
    </div>
  );
}

export function ChannelTimeline({
  rows,
  posts,
  range,
}: {
  rows: Daily[];
  posts: Post[];
  range: Range;
}) {
  return (
    <section className="channel-timeline-section">
      <div className="section-head">
        <div>
          <h2>Performance over time</h2>
          <p>Instagram · Facebook · TikTok · Website</p>
        </div>
      </div>
      <div className="performance-chart-grid">
        {SOCIAL_PLATFORMS.map((channel) => (
          <DeferredChart
            key={channel}
            title={channel + ' views'}
            loading={false}
          >
            <PlatformTimeline
              channel={channel}
              rows={rows}
              posts={posts}
              range={range}
            />
          </DeferredChart>
        ))}
        <DailyMetricGraph
          rows={rows}
          channel="Website"
          metric="pageViews"
          label="Website page views"
          color="#bc773c"
        />
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
export function DailyMetricGraph({
  rows,
  channel,
  metric,
  label,
  color,
}: {
  rows: Daily[];
  channel: string;
  metric: DailyKey;
  label: string;
  color: string;
}) {
  const animate = useMinimalMotion(),
    id = useId().replace(/:/g, '');
  const data = activitySeries(rows, channel, metric);
  const supplied = data.filter((d) => d.value !== null);
  return (
    <section
      className="surface padded daily-metric-graph"
      style={{ '--report-color': color } as React.CSSProperties}
    >
      <span className="metric-eyebrow">{channel} · Daily activity</span>
      <h3>
        <DataIcon name={metric} />
        {label}
      </h3>
      <strong className="metric-total">
        {supplied.length
          ? number(supplied.reduce((n, d) => n + Number(d.value), 0))
          : 'Unavailable'}
      </strong>
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

export function WebsiteMetricGraphs({ rows }: { rows: Daily[] }) {
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
        <DeferredChart key={metric} title={label} loading={false}>
          <DailyMetricGraph
            rows={rows}
            channel="Website"
            metric={metric}
            label={label}
            color={color}
          />
        </DeferredChart>
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
