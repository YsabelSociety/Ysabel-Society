'use client';
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
  COLORS,
  compact,
  series,
  type Daily,
  type Metric,
} from '@/lib/analytics';
import { Picker } from './controls';
import { Maximize2, ArrowUpRight } from 'lucide-react';
export function Spark({
  seed = 0,
  values: input,
}: {
  seed?: number;
  values?: number[];
}) {
  const data = input?.length
    ? input
    : Array.from({ length: 24 }, (_, i) => i + Math.sin(i + seed));
  const min = Math.min(...data),
    max = Math.max(...data);
  const values = data.map((v) => 38 - ((v - min) / (max - min || 1)) * 28);
  return (
    <svg className="spark" viewBox="0 0 120 45" aria-hidden="true">
      <path
        d={values
          .map(
            (y, i) =>
              (i ? 'L' : 'M') +
              ((i / Math.max(values.length - 1, 1)) * 120).toFixed(3) +
              ',' +
              y.toFixed(3),
          )
          .join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
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
  const chart = data.map((d, i) => ({
    ...d,
    previous: prev[i]?.total ?? null,
  }));
  return (
    <section className={'surface chart-surface ' + (full ? 'chart-full' : '')}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p>
            {stacked
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
                'conversions',
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
        {CHANNELS.map((c, i) => (
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
            <i style={{ background: COLORS[i] }} />
            {c === 'Google Business' ? 'Google' : c}
          </button>
        ))}
        <button className="legend-compare" onClick={() => setZoom(!zoom)}>
          {zoom ? 'Close zoom' : 'Select range'} <ArrowUpRight size={12} />
        </button>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chart}
            margin={{ top: 18, right: 8, left: -15, bottom: 0 }}
          >
            <defs>
              {COLORS.map((c, i) => (
                <linearGradient key={c} id={id + i} x1="0" y1="0" x2="0" y2="1">
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
                enabled.includes(c) && (
                  <Area
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stackId={stacked ? 'all' : undefined}
                    fill={'url(#' + id + i + ')'}
                    stroke={COLORS[i]}
                    strokeWidth={1.8}
                    animationDuration={350}
                  />
                ),
            )}
            {previous.length > 0 && !stacked && (
              <Line
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
      </div>
      <div className="chart-foot">
        <span>
          <i className="small-dot" />{' '}
          {rows.length
            ? 'Demo · daily observations'
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
