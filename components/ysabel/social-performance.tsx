'use client';
import {
  Component,
  useEffect,
  useId,
  useMemo,
  memo,
  useState,
  type ReactNode,
} from 'react';
import {
  Bar,
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { RotateCcw, Maximize2 } from 'lucide-react';
import {
  CHANNELS,
  COLORS,
  compact,
  number,
  type Daily,
  type Post,
  type Range,
} from '@/lib/analytics';
import {
  SOCIAL_METRICS,
  SOCIAL_PLATFORMS,
  performanceSeries,
  seriesTotal,
  metricBasis,
  metricExplanation,
  selectContent,
  genderDistribution,
  latestAudienceTables,
  type SocialMetric,
  type PerformanceBasis,
} from '@/lib/social-performance';
import type { ReportTable } from '@/lib/reporting';
import { Picker } from './controls';
import { useMinimalMotion } from './use-motion';
import { AudienceMap } from './audience-map';
import { PostPerformance } from './post-performance';
import { Spark } from './charts';
import { DataIcon } from './data-icons';

export class ChartBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="surface metric-error" role="alert">
        <h3>This chart could not load</h3>
        <button
          className="secondary"
          onClick={() => this.setState({ failed: false })}
        >
          <RotateCcw size={14} /> Retry this chart
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
export function DeferredChart({
  children,
  loading,
  title,
}: {
  children: ReactNode;
  loading: boolean;
  title: string;
}) {
  return (
    <div className="metric-slot" aria-busy={loading}>
      {!loading ? (
        <ChartBoundary>{children}</ChartBoundary>
      ) : (
        <section className="surface metric-placeholder">
          <h3>{title}</h3>
          <p role="status">Loading source data…</p>
          <div />
        </section>
      )}
    </div>
  );
}
export function MetricCard({
  metric,
  label,
  rows,
  posts,
  channels,
  range,
  basis,
}: {
  metric: SocialMetric;
  label: string;
  rows: Daily[];
  posts: Post[];
  channels: readonly string[];
  range: Range;
  basis: PerformanceBasis;
}) {
  const gradientId = useId().replace(/:/g, "");
  const animate = useMinimalMotion(),
    [granularity, setGranularity] = useState('Daily'),
    [hidden, setHidden] = useState<string[]>([]),
    [zoom, setZoom] = useState(false),
    [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [full]);
  const points = useMemo(
    () =>
      performanceSeries(
        rows,
        posts,
        channels,
        range,
        metric,
        basis,
        granularity,
      ),
    [rows, posts, channels, range, metric, basis, granularity],
  );
  const effective = metricBasis(metric, basis),
    content = effective === 'Published content',
    countMetric = ['posts', 'stories', 'reels', 'videos'].includes(metric);
  const summaries = channels.map((channel) => ({
    channel,
    value: seriesTotal(points, channel, metric),
  }));
  const any = summaries.some(
    (s) => s.value !== null && !hidden.includes(s.channel),
  );
  const known = summaries.filter((s) => s.value !== null),
    sum = known.reduce((n, s) => n + s.value!, 0);
  return (
    <section
      className={'surface social-metric-card ' + (full ? 'chart-full' : '')}
      data-metric={metric}
      data-platform={channels.length === 1 ? channels[0] : 'All'}
    >
      <div className="section-head">
        <div>
          <span className="metric-eyebrow">{channels.join(' · ')}</span>
          <h2>
            <DataIcon name={metric} />
            {label}
          </h2>
          <strong className="metric-total">
            {known.length ? number(sum) : 'Unavailable'}
          </strong>
          <p>
            {metric === 'followers'
              ? 'Latest recorded count'
              : countMetric
                ? 'Imported publication count'
                : content
                  ? 'Imported content · lifetime totals'
                  : 'Reported daily activity'}
            {known.length > 0 && known.length < channels.length
              ? ' · partial platform coverage'
              : ''}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label={(full ? 'Exit' : 'Open') + ' fullscreen ' + label}
          onClick={() => setFull(!full)}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="metric-card-controls">
        <div className="metric-mini-series">
          {channels.map((c) => (
            <span
              key={c}
              style={{
                color: COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])],
              }}
            >
              <Spark
                values={points.map((p) =>
                  typeof p[c] === 'number' ? (p[c] as number) : null,
                )}
              />
            </span>
          ))}
        </div>
        <Picker
          label={label + ' interval'}
          value={granularity}
          onChange={setGranularity}
          options={['Daily', 'Weekly', 'Monthly']}
        />
        <button className="text-link" onClick={() => setZoom(!zoom)}>
          {zoom ? 'Close date zoom' : 'Zoom dates'}
        </button>
      </div>
      <div className="chart-legend">
        {summaries.map((s) => (
          <button
            key={s.channel}
            aria-pressed={!hidden.includes(s.channel)}
            className={hidden.includes(s.channel) ? 'disabled-legend' : ''}
            onClick={() =>
              setHidden((h) =>
                h.includes(s.channel)
                  ? h.filter((c) => c !== s.channel)
                  : [...h, s.channel],
              )
            }
          >
            <i
              style={{
                background:
                  COLORS[
                    CHANNELS.indexOf(s.channel as (typeof CHANNELS)[number])
                  ],
              }}
            />
            {s.channel}
            <span>{s.value === null ? 'Not supplied' : compact(s.value)}</span>
          </button>
        ))}
      </div>
      <div
        className="social-chart-plot"
        role="img"
        aria-label={
          label +
          '. ' +
          summaries
            .map(
              (s) =>
                s.channel +
                ': ' +
                (s.value === null ? 'not supplied' : number(s.value)),
            )
            .join('; ')
        }
      >
        {any ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <ComposedChart
              data={points}
              margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
            >
              <defs>{channels.map(c => <linearGradient key={c} id={gradientId + c.replace(/\s/g, '')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])]} stopOpacity={0.22} /><stop offset="100%" stopColor={COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])]} stopOpacity={0.015} /></linearGradient>)}</defs>
              <CartesianGrid
                stroke="#d4dce5"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                minTickGap={40}
                tick={{ fontSize: 12, fill: '#526174' }}
                tickFormatter={(v) =>
                  new Date(v + 'T12:00:00Z').toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={52}
                tickFormatter={compact}
                tick={{ fontSize: 12, fill: '#526174' }}
                axisLine={false}
                tickLine={false}
                domain={
                  metric === 'followers' && channels.length === 1
                    ? [
                        (min: number) =>
                          Math.max(
                            0,
                            Math.floor(min - Math.max(5, min * 0.005)),
                          ),
                        (max: number) =>
                          Math.ceil(max + Math.max(5, max * 0.005)),
                      ]
                    : [(min: number) => Math.min(0, min), 'auto']
                }
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: '1px solid #c1cedb',
                  background: '#fcfdff',
                }}
                formatter={(value: any, name: any) => [
                  number(Number(value)),
                  String(name),
                ]}
                labelFormatter={(value) =>
                  (content ? 'Published ' : 'Observed ') +
                  new Date(String(value) + 'T12:00:00Z').toLocaleDateString(
                    'en',
                    { month: 'short', day: 'numeric', year: 'numeric' },
                  )
                }
              />
              {channels
                .filter((c) => !hidden.includes(c))
                .map((c) =>
                  content ? (
                    <Bar
                      key={c + granularity}
                      dataKey={c}
                      fill={
                        COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])]
                      }
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                      isAnimationActive={animate}
                      animationDuration={650}
                    />
                  ) : (
                    <Area
                      key={c + granularity}
                      dataKey={c}
                      stroke={
                        COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])]
                      }
                      type={metric === 'followers' ? 'linear' : 'monotone'}
                      fill={"url(#" + gradientId + c.replace(/\s/g, "") + ")"}
                      strokeWidth={2.3}
                      connectNulls={false}
                      dot={{ r: 3, strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={animate}
                      animationDuration={metric === 'profileViews' ? 1200 : 700}
                      animationEasing="ease-out"
                    />
                  ),
                )}
              {zoom && (
                <Brush
                  dataKey="date"
                  height={22}
                  stroke="#74899d"
                  fill="#edf2f5"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-no-data">
            <strong>
              {known.length
                ? 'Select a platform in the legend'
                : 'No ' + label.toLowerCase() + ' report supplied'}
            </strong>
            <p>
              {metric === 'profileViews' && channels.includes('TikTok')
                ? 'Profile visits are not part of TikTok’s current connection. Import the profile-views column from a TikTok Studio daily report.'
                : channels.includes('TikTok') &&
                    !content &&
                    metric !== 'followers'
                  ? 'TikTok’s current connection supplies public-video lifetime counters. Select Published content for its video results.'
                  : 'This metric needs a supported platform report or an imported export.'}
            </p>
            <a href="/marketingdata/connections">View connection coverage</a>
          </div>
        )}
      </div>
      <p className="metric-definition">{metricExplanation(metric, basis)}</p>
      <details className="metric-values">
        <summary>View chart data</summary>
        <div>
          <table>
            <caption>
              {label} ·{' '}
              {content
                ? 'publication dates, lifetime totals'
                : 'recorded activity'}
            </caption>
            <thead>
              <tr>
                <th>Date</th>
                {channels.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => channels.some((c) => p[c] !== null))
                .map((p) => (
                  <tr key={p.date}>
                    <th>{p.date}</th>
                    {channels.map((c) => (
                      <td key={c}>
                        {typeof p[c] === 'number'
                          ? number(p[c] as number)
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function AudienceBreakdown({
  tables,
  channels,
  loading = false,
  separate = false,
}: {
  tables: ReportTable[];
  channels: readonly string[];
  loading?: boolean;
  separate?: boolean;
}) {
  const animate = useMinimalMotion(),
    values = genderDistribution(tables, channels),
    reports = latestAudienceTables(tables, channels, 'gender');
  return (
    <>
      <div className="performance-chart-grid">
        {values.map((group) => (
          <DeferredChart
            key={String(group.label)}
            title={String(group.label)}
            loading={loading}
          >
            <section className="surface social-metric-card gender-card">
              <div className="section-head">
                <div>
                  <span className="metric-eyebrow">{channels.join(' · ')}</span>
                  <h2>
                    <DataIcon name={String(group.label)} />
                    {group.label}
                  </h2>
                  <p>
                    Reported follower demographics · counts or platform
                    percentages
                  </p>
                </div>
              </div>
              <div className="gender-bars">
                {channels.map((c) => (
                  <div key={c} className="gender-value">
                    <span>
                      <i
                        style={{
                          background:
                            COLORS[
                              CHANNELS.indexOf(c as (typeof CHANNELS)[number])
                            ],
                        }}
                      />
                      {c}
                    </span>
                    <strong>
                      {typeof group[c] === 'number'
                        ? reports.get(c)?.columns.includes('percentage')
                          ? Number(group[c]).toFixed(1) + '%'
                          : number(group[c] as number)
                        : 'Not supplied'}
                    </strong>
                    <div>
                      <span
                        style={{
                          width:
                            typeof group[c] === 'number'
                              ? Math.max(
                                  1,
                                  (Number(group[c]) /
                                    (reports
                                      .get(c)
                                      ?.columns.includes('percentage')
                                      ? 100
                                      : Math.max(
                                          ...channels.map((p) =>
                                            Number(group[p] || 0),
                                          ),
                                          1,
                                        ))) *
                                    100,
                                ) + '%'
                              : '0%',
                          background:
                            COLORS[
                              CHANNELS.indexOf(c as (typeof CHANNELS)[number])
                            ],
                          transition: animate ? 'width 700ms ease' : 'none',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="metric-definition">
                Gender is shown only when reported by the platform. It is never
                inferred from profiles or photographs.
              </p>
              {[...reports.entries()].map(([channel, t]) => (
                <p className="footnote" key={channel}>
                  {channel}: {t.scope}{' '}
                  {t.observedAt
                    ? 'Refreshed ' + new Date(t.observedAt).toLocaleDateString()
                    : ''}
                </p>
              ))}
            </section>
          </DeferredChart>
        ))}
      </div>
      <div className={separate ? 'performance-map-grid' : ''}>
        {(separate ? channels.map((c) => [c]) : [channels]).map((group) => (
          <DeferredChart
            key={group.join(',')}
            title="Audience around the world"
            loading={loading}
          >
            <AudienceMap
              key={group.join(',')}
              tables={tables}
              channels={group}
            />
          </DeferredChart>
        ))}
      </div>
    </>
  );
}
export const SocialPerformance = memo(function SocialPerformance({
  rows,
  posts,
  tables,
  range,
  channel,
  loading = false,
}: {
  rows: Daily[];
  posts: Post[];
  tables: ReportTable[];
  range: Range;
  channel: string;
  loading?: boolean;
}) {
  const [basisChoice, setBasisChoice] = useState('Latest available'),
    [layout, setLayout] = useState('Together'),
    [format, setFormat] = useState('All content');
  const channels = useMemo(
    () => (channel === 'All' ? [...SOCIAL_PLATFORMS] : [channel]),
    [channel],
  );
  const selectedPosts = useMemo(
    () => selectContent(posts, channels, range, format),
    [posts, channels, range, format],
  );
  const basis: PerformanceBasis =
    basisChoice === 'Latest available'
      ? channels.every((c) =>
          rows.some(
            (r) =>
              r.channel === c &&
              (!r.available || r.available.includes('views')),
          ),
        )
        ? 'Daily activity'
        : 'Published content'
      : (basisChoice as PerformanceBasis);
  const groups =
    layout === 'Separate platforms' ? channels.map((c) => [c]) : [channels];
  const summaries = [
    'profileViews',
    'views',
    'reach',
    'engagements',
    'followers',
  ].map((key) => {
    const metric = key as SocialMetric,
      points = performanceSeries(
        rows,
        selectedPosts,
        channels,
        range,
        metric,
        basis,
      );
    const values = channels
      .map((c) => seriesTotal(points, c, metric))
      .filter((v): v is number => v !== null);
    return {
      metric,
      value: values.length
        ? number(values.reduce((a, b) => a + b, 0))
        : 'Unavailable',
      partial: values.length > 0 && values.length < channels.length,
      spark: points.map((p) => {
        const v = channels
          .map((c) => p[c])
          .filter((v): v is number => typeof v === 'number');
        return v.length ? v.reduce((a, b) => a + b, 0) : null;
      }),
    };
  });
  return (
    <div className="social-performance" data-platform={channels.length === 1 ? channels[0] : "All"}>
      <div className="performance-controls surface">
        <div>
          <h2>Social performance</h2>
          <p>
            {channels.join(' · ')} · {range.start} – {range.end}
          </p>
        </div>
        <div className="inline-controls">
          <Picker
            label="Performance measurement"
            value={basisChoice}
            onChange={setBasisChoice}
            options={[
              'Latest available',
              'Daily activity',
              'Published content',
            ]}
          />
          {channels.length > 1 && (
            <Picker
              label="Chart layout"
              value={layout}
              onChange={setLayout}
              options={['Together', 'Separate platforms']}
            />
          )}
          <Picker
            label="Content type"
            value={format}
            onChange={setFormat}
            options={['All content', 'Posts', 'Stories', 'Reels', 'Videos']}
          />
        </div>
      </div>
      <p className="performance-scope">
        {basis === 'Published content'
          ? 'Published content compares the lifetime performance of posts published in these dates. This lets Instagram, Facebook and TikTok share the same measurement basis.'
          : 'Daily activity uses imported reports for each date. Missing observations remain gaps in the charts.'}{' '}
        {selectedPosts.length} imported content items match the content filter.
        Followers and users keep their own daily observation basis.
      </p>
      <div className="stat-row performance-totals" aria-busy={loading}>
        {summaries.map((s) => (
          <div key={s.metric} data-metric={s.metric}>
            <Spark values={s.spark} />
            <span>
              <DataIcon name={s.metric} badge />
              {s.metric === 'views'
                ? 'Total content views'
                : s.metric === 'followers'
                  ? 'Followers'
                  : SOCIAL_METRICS.find((m) => m.key === s.metric)?.label}
            </span>
            <strong>{loading ? 'Loading…' : s.value}</strong>
            <small>{channels.join(' · ')}</small>
            <small>
              {s.metric === 'followers'
                ? 'Latest recorded snapshot'
                : metricBasis(s.metric, basis) === 'Published content'
                  ? 'Lifetime · imported content'
                  : 'Daily activity'}
              {s.partial ? ' · partial coverage' : ''}
            </small>
          </div>
        ))}
      </div>
      <PostPerformance
        posts={selectedPosts}
        channels={channels}
        loading={loading}
      />
      <div className="performance-chart-grid">
        {SOCIAL_METRICS.flatMap((metric) =>
          groups.map((group) => (
            <DeferredChart
              key={metric.key + group.join(',') + basis + format}
              title={metric.label}
              loading={loading}
            >
              <MetricCard
                metric={metric.key}
                label={metric.label}
                rows={rows}
                posts={selectedPosts}
                channels={group}
                range={range}
                basis={basis}
              />
            </DeferredChart>
          )),
        )}
      </div>
      <AudienceBreakdown
        tables={tables}
        channels={channels}
        loading={loading}
        separate={layout === 'Separate platforms'}
      />
    </div>
  );
});
