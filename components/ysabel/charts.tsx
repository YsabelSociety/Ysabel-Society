'use client';
import { useMinimalMotion } from './use-motion';
import { useState, useId } from 'react';
import {
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
import {
  CHANNELS,
  metricAvailable,
  COLORS,
  compact,
  series,
  type Daily,
  type Metric,
} from '@/lib/analytics';
import { Picker } from './controls';
import { Maximize2, ArrowUpRight } from 'lucide-react';
import { sparkline } from '@/lib/sparkline';
export function Spark({
  values = [],
}: {
  values?: (number | null | undefined)[];
}) {
  const id = useId().replace(/:/g, ''),
    geometry = sparkline(values),
    last = geometry.points.at(-1);
  return (
    <svg
      className="spark"
      viewBox="0 0 120 45"
      aria-hidden="true"
      data-empty={!last}
    >
      <defs>
        <linearGradient id={'spark-' + id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".3" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M3,43H117"
        stroke="currentColor"
        strokeOpacity=".14"
        strokeWidth=".6"
      />
      {last && (
        <>
          <path
            className="spark-area"
            d={geometry.areas}
            fill={'url(#spark-' + id + ')'}
          />
          <path
            className="spark-line"
            d={geometry.path}
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {geometry.points.length < 3 &&
            geometry.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1.8" fill="currentColor" />
            ))}
          <circle
            className="spark-pulse"
            cx={last.x}
            cy={last.y}
            r="3.5"
            fill="currentColor"
          />
          <circle cx={last.x} cy={last.y} r="1.8" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
export function AnalyticsChart({
  rows,
  previous = [],
  metric: outerMetric,
  title = 'Performance over time',
  stacked = false,
}: {
  rows: Daily[];
  previous?: Daily[];
  metric?: Metric;
  title?: string;
  stacked?: boolean;
}) {
  const animate = useMinimalMotion();
  const [metric, setMetric] = useState<Metric>(outerMetric ?? 'views');
  const [granularity, setGranularity] = useState('Daily');
  const [enabled, setEnabled] = useState<string[]>([...CHANNELS]);
  const [zoom, setZoom] = useState(false);
  const [full, setFull] = useState(false);
  const id = useId().replace(/:/g, '');
  const data = series(
    rows.filter((r) => enabled.includes(r.channel)),
    outerMetric ?? metric,
    granularity,
  );
  const prev = series(
    previous.filter((r) => enabled.includes(r.channel)),
    outerMetric ?? metric,
    granularity,
  );
  const activeMetric = outerMetric ?? metric;
  const supplied = metricAvailable(
    rows.filter((r) => enabled.includes(r.channel)),
    activeMetric,
  );
  const comparisonSupplied = metricAvailable(
    previous.filter((r) => enabled.includes(r.channel)),
    activeMetric,
  );
  const chart = data.map((d, i) => ({
    ...d,
    previous: prev[i]?.total ?? null,
  }));
  const plottedChannels = CHANNELS.filter((c) =>
    metricAvailable(
      rows.filter((r) => r.channel === c),
      activeMetric,
    ),
  );
  const motionKey =
    activeMetric +
    ':' +
    granularity +
    ':' +
    enabled.join(',') +
    ':' +
    data.map((d) => d.date).join(',');
  return (
    <section className={'surface chart-surface ' + (full ? 'chart-full' : '')}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p>
            {activeMetric === 'followers'
              ? 'Recorded follower snapshots. Missing dates remain gaps; a single observation appears as a point.'
              : stacked
                ? 'How attention is distributed across channels'
                : 'Every interaction, part of a bigger picture.'}
          </p>
        </div>
        <div className="inline-controls">
          {!outerMetric && (
            <Picker
              label="Chart metric"
              value={metric}
              onChange={(v) => setMetric(v as Metric)}
              options={[
                'views',
                'reach',
                'engagements',
                'followers',
                'users',
                'actions',
              ]}
            />
          )}
          <Picker
            label="Chart granularity"
            value={granularity}
            onChange={setGranularity}
            options={['Daily', 'Weekly', 'Monthly']}
          />
          <button
            className="icon-button"
            aria-label="Toggle chart fullscreen"
            onClick={() => setFull(!full)}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="chart-legend">
        {plottedChannels.map((c) => (
          <button
            key={c}
            aria-pressed={enabled.includes(c)}
            className={!enabled.includes(c) ? 'disabled-legend' : ''}
            onClick={() =>
              setEnabled(
                enabled.includes(c)
                  ? enabled.filter((x) => x !== c)
                  : [...enabled, c],
              )
            }
          >
            <i style={{ background: COLORS[CHANNELS.indexOf(c)] }} />
            {c === 'Google Business' ? 'Google' : c}
          </button>
        ))}
        <button className="legend-compare" onClick={() => setZoom(!zoom)}>
          {zoom ? 'Close zoom' : 'Select range'} <ArrowUpRight size={12} />
        </button>
      </div>
      <div className="chart-wrap">
        {supplied ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={280}
          >
            <ComposedChart
              data={chart}
              margin={{ top: 18, right: 8, left: -15, bottom: 0 }}
            >
              <defs>
                {COLORS.map((c, i) => (
                  <linearGradient
                    key={c}
                    id={id + i}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={c}
                      stopOpacity={stacked ? 0.5 : 0.2}
                    />
                    <stop offset="100%" stopColor={c} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                stroke="#d5dce6"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  new Date(v + 'T12:00:00Z').toLocaleDateString('en', {
                    month: 'short',
                    day: '2-digit',
                  })
                }
                axisLine={false}
                tickLine={false}
                minTickGap={55}
                tick={{ fill: '#657185', fontSize: 12 }}
                dy={12}
              />
              <YAxis
                tickFormatter={compact}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#657185', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#f8fafe',
                  border: '1px solid #cbd4e1',
                  borderRadius: 10,
                  color: '#29374a',
                  fontSize: 13,
                }}
                labelFormatter={(v) =>
                  new Date(String(v) + 'T12:00:00Z').toLocaleDateString('en', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }
                formatter={(v: any, n: any) => [
                  compact(Number(v)),
                  n === 'previous' ? 'Previous period' : n,
                ]}
              />
              {CHANNELS.map(
                (c, i) =>
                  enabled.includes(c) &&
                  metricAvailable(
                    rows.filter((r) => r.channel === c),
                    activeMetric,
                  ) &&
                  (activeMetric === 'followers' ? (
                    <Line
                      key={c + motionKey}
                      dataKey={c}
                      type="linear"
                      stroke={COLORS[i]}
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{
                        r: 4,
                        fill: COLORS[i],
                        stroke: '#fff',
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 7, stroke: '#fff', strokeWidth: 3 }}
                      isAnimationActive={animate}
                      animationDuration={900}
                      animationEasing="ease-in-out"
                    />
                  ) : (
                    <Area
                      isAnimationActive={animate}
                      animationDuration={800}
                      animationEasing="ease-out"
                      key={c + motionKey}
                      type="monotone"
                      dataKey={c}
                      stackId={stacked ? 'all' : undefined}
                      fill={'url(#' + id + i + ')'}
                      stroke={COLORS[i]}
                      strokeWidth={1.8}
                      dot={chart.length === 1 ? { r: 4 } : false}
                    />
                  )),
              )}
              {comparisonSupplied && !stacked && (
                <Line
                  isAnimationActive={animate}
                  animationDuration={420}
                  animationEasing="ease-out"
                  dataKey="previous"
                  type="monotone"
                  stroke="#8b96a6"
                  strokeDasharray="3 5"
                  dot={false}
                  strokeWidth={1}
                  name="previous"
                />
              )}
              {zoom && (
                <Brush
                  dataKey="date"
                  height={22}
                  stroke="#517b99"
                  fill="#edf2f8"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-no-data">
            <strong>No daily {activeMetric} available</strong>
            <p>
              Choose another metric or date range. Current social profile
              statistics are available in Connections.
            </p>
          </div>
        )}
      </div>
      <div className="chart-foot">
        <span>
          <i className="small-dot" />{' '}
          {rows.length
            ? rows.some((r) => r.available)
              ? 'Live · daily observations'
              : 'Demo · daily observations'
            : 'No data for this period'}
        </span>
        <span>
          {previous.length
            ? 'Dotted · previous period total'
            : 'Sources defined in Data Sources'}
        </span>
      </div>
    </section>
  );
}
export function Bars({
  items,
  suffix = '',
}: {
  items: { label: string; value: number }[];
  suffix?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bar-list">
      {items.map((item, i) => (
        <div className="bar-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>
              {compact(item.value)}
              {suffix}
            </strong>
          </div>
          <div className="bar-track">
            <div
              style={{
                width: (item.value / max) * 100 + '%',
                background: COLORS[i % 5],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
