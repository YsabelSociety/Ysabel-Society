'use client';
import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import {
  GBP_METRICS,
  GBP_SUMMARY,
  GBP_ORIGINAL,
  gbpMonthlyPoints,
} from '@/lib/google-business';
import { compact, number } from '@/lib/analytics';
import { type ReportTable, finite } from '@/lib/reporting';
import { Spark } from './charts';
import { useMinimalMotion } from './use-motion';
import { DeferredChart } from './social-performance';
import styles from './google-business.module.css';

type Point = { date: string; value: number | null };
type Definition = (typeof GBP_METRICS)[number];
function MetricChart({
  metric,
  points,
}: {
  metric: Definition;
  points: Point[];
}) {
  const animate = useMinimalMotion(),
    id = useId().replace(/:/g, '');
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart
          data={points}
          margin={{ left: -14, right: 12, top: 16, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={metric.color} stopOpacity={0.32} />
              <stop offset="1" stopColor={metric.color} stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#d5dce6"
            strokeDasharray="3 6"
          />
          <XAxis
            dataKey="date"
            minTickGap={28}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => String(v).slice(5)}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [number(Number(value)), metric.label]}
          />
          <Area
            type="linear"
            dataKey="value"
            name={metric.label}
            stroke={metric.color}
            fill={'url(#' + id + ')'}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={animate}
            animationDuration={850}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function MetricCard({
  metric,
  value,
  points,
  note,
}: {
  metric: Definition;
  value: number | null;
  points: Point[];
  note?: string;
}) {
  return (
    <article
      className={styles.metric}
      style={{ '--gbp-color': metric.color } as React.CSSProperties}
    >
      <span>{metric.label}</span>
      <strong>{value === null ? '—' : number(value)}</strong>
      {points.length > 0 && <Spark values={points.map((p) => p.value)} />}
      <small>{note || metric.description}</small>
    </article>
  );
}
function download(table: ReportTable) {
  const escape = (value: unknown) =>
    '"' +
    String(value ?? '')
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const csv = [
    table.columns,
    ...table.rows.map((r) => table.columns.map((k) => r[k])),
  ]
    .map((r) => r.map(escape).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = `Ysabel-Google-Business-${table.key}-${table.period.start}-${table.period.end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function label(key: string) {
  return GBP_METRICS.find((m) => m.key === key)?.label || key;
}
export function GoogleBusinessReports({ tables }: { tables: ReportTable[] }) {
  const [selected, setSelected] = useState(''),
    animate = useMinimalMotion();
  const summaries = tables
    .filter((t) => t.source === 'gbp' && t.key === GBP_SUMMARY)
    .sort(
      (a, b) =>
        b.period.end.localeCompare(a.period.end) ||
        a.period.start.localeCompare(b.period.start),
    );
  const reportId = (t: ReportTable) => t.period.start + '/' + t.period.end;
  const active =
    summaries.find((t) => reportId(t) === selected) || summaries[0];
  const details = tables.filter(
    (t) =>
      t.source === 'gbp' &&
      t.key !== GBP_SUMMARY &&
      (t.key !== GBP_ORIGINAL || !active || reportId(t) === reportId(active)),
  );
  const monthly = GBP_METRICS.map((metric) => ({
    metric,
    points: gbpMonthlyPoints(summaries, metric.key),
  })).filter((p) => p.points.some((point) => point.value !== null));
  return (
    <section id="google-business-reports" className={styles.section}>
      <div className="section-head">
        <div>
          <span className="metric-eyebrow">Google Business reports</span>
          <h2>Reports from your Business Profile</h2>
          <p className="muted">
            Each export keeps its own reporting period. Select an imported
            period below.
          </p>
        </div>
      </div>
      {active ? (
        <>
          <div className={styles.toolbar}>
            <label>
              Imported report period
              <select
                aria-label="Google Business report period"
                value={reportId(active)}
                onChange={(e) => setSelected(e.target.value)}
              >
                {summaries.map((t) => (
                  <option key={reportId(t)} value={reportId(t)}>
                    {t.period.start} – {t.period.end}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary" onClick={() => download(active)}>
              <Download size={15} /> Download report
            </button>
          </div>
          <p className={styles.coverage}>
            {active.period.start} – {active.period.end} · Google export{' '}
            {active.observedAt
              ? 'imported ' + new Date(active.observedAt).toLocaleString()
              : ''}
            . This report uses the dates above, independently of the daily
            dashboard filter.
          </p>
          <div className={styles.cards}>
            {GBP_METRICS.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                value={finite(active.rows[0]?.[metric.key])}
                points={[]}
              />
            ))}
          </div>
          <div className={styles.grid}>
            {[
              ['searchMobile', 'searchDesktop', 'mapsMobile', 'mapsDesktop'],
              [
                'directions',
                'clicks',
                'calls',
                'menu',
                'bookings',
                'foodOrders',
              ],
            ].map((keys, index) => {
              const items = keys.flatMap((key) => {
                const metric = GBP_METRICS.find((m) => m.key === key)!;
                const value = finite(active.rows[0]?.[key]);
                return value === null
                  ? []
                  : [{ name: metric.label, value, color: metric.color }];
              });
              return (
                <section key={index} className="surface padded">
                  <h3>
                    {index
                      ? 'Customer actions by type'
                      : 'Search & Maps by device'}
                  </h3>
                  <p className="footnote">
                    {active.period.start} – {active.period.end} · each category
                    retains its own definition.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={items}
                      layout="vertical"
                      margin={{ left: 8, right: 20 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 6" />
                      <XAxis type="number" tickFormatter={compact} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={118}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v) => number(Number(v))} />
                      <Bar
                        dataKey="value"
                        radius={[0, 6, 6, 0]}
                        isAnimationActive={animate}
                        animationDuration={850}
                      >
                        {items.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              );
            })}
          </div>
          <p className="footnote">{active.scope}</p>
          {!!monthly.length && (
            <details className="surface padded" open>
              <summary>
                <strong>Monthly performance comparisons</strong>
              </summary>
              <p className="muted">
                Complete calendar-month exports, shown separately for every
                metric. Partial months and overlapping yearly totals are
                excluded from these charts.
              </p>
              <div className={styles.grid}>
                {monthly.map((p) => (
                  <DeferredChart
                    key={p.metric.key}
                    title={p.metric.label}
                    loading={false}
                  >
                    <article>
                      <h3>{p.metric.label}</h3>
                      <MetricChart metric={p.metric} points={p.points} />
                      <details>
                        <summary>Monthly values</summary>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>{p.metric.label}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.points.map((point) => (
                              <tr key={point.date}>
                                <td>{point.date}</td>
                                <td>
                                  {point.value === null
                                    ? '—'
                                    : number(point.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </article>
                  </DeferredChart>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="surface padded">
          <p className="muted">
            No performance export has been imported yet. Review imports are
            separate from Search, Maps and customer-action statistics.
          </p>
          <a
            className="text-link"
            href="/marketingdata/connections?source=gbp&method=file"
          >
            Import a Google Business performance export
          </a>
        </div>
      )}
      {details.map((t) => (
        <details className="surface padded" key={t.key + reportId(t)}>
          <summary>
            <strong>{t.title}</strong> · {t.period.start} – {t.period.end}
          </summary>
          <p className="footnote">{t.scope}</p>
          <button className="secondary" onClick={() => download(t)}>
            <Download size={15} /> Download source values
          </button>
          {t.key === 'google-searches' &&
            t.rows.some((r) => typeof r.impressions === 'number') && (
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={t.rows
                      .filter((r) => typeof r.impressions === 'number')
                      .sort(
                        (a, b) => Number(b.impressions) - Number(a.impressions),
                      )
                      .slice(0, 12)}
                  >
                    <XAxis dataKey="keyword" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={compact} />
                    <Tooltip />
                    <Bar
                      dataKey="impressions"
                      fill="#6a997c"
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={animate}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          <div className="report-table-scroll">
            <table className={styles.table}>
              <thead>
                <tr>
                  {t.columns.map((k) => (
                    <th key={k}>{label(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, i) => (
                  <tr key={i}>
                    {t.columns.map((k) => (
                      <td key={k}>
                        {row[k] === null || row[k] === undefined
                          ? '—'
                          : typeof row[k] === 'number'
                            ? number(row[k])
                            : String(row[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}
