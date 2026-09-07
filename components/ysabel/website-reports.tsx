'use client';
import { useState, useMemo, useId } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ReportTable } from '@/lib/reporting';
import { number, compact } from '@/lib/analytics';
import {
  WEBSITE_REPORTS,
  websitePlot,
  reportLabel,
} from '@/lib/website-report-model';
import { DeferredChart } from './social-performance';
import { Picker } from './controls';
import { useMinimalMotion } from './use-motion';
import { DataIcon } from './data-icons';
const colors = [
  '#297b98',
  '#8167ba',
  '#269982',
  '#be8452',
  '#547dd0',
  '#b5658b',
];
function WebsiteReport({
  table,
  index,
}: {
  table: ReportTable;
  index: number;
}) {
  const [metric, setMetric] = useState(''),
    [view, setView] = useState(
      new Set(table.rows.map((r) => r.date).filter(Boolean)).size > 1
        ? 'Over time'
        : 'Breakdown',
    ),
    [page, setPage] = useState(0),
    animate = useMinimalMotion();
  const id = useId().replace(/:/g, '');
  const palette = colors.map((_, i) => colors[(index + i) % colors.length]);
  const metrics = table.columns.filter(
    (c) =>
      !['conversions', 'conversionValue', 'keyEvents'].includes(c) &&
      table.rows.some((r) => typeof r[c] === 'number'),
  );
  const active = metrics.includes(metric) ? metric : metrics[0] || 'sessions';
  const plot = useMemo(() => websitePlot(table, active), [table, active]);
  const dated = table.columns.includes('date');
  return (
    <section
      className="surface padded website-report-card"
      style={
        {
          '--report-color': colors[index % colors.length],
        } as React.CSSProperties
      }
    >
      <div className="section-head">
        <div>
          <span className="metric-eyebrow">Website · ysabelsociety.com</span>
          <h3>
            <DataIcon name={table.key} />
            {table.title}
          </h3>
        </div>
        <span className="report-number">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="inline-controls">
        {metrics.length > 0 && (
          <Picker
            label={table.title + ' metric'}
            value={reportLabel(active)}
            options={metrics.map(reportLabel)}
            onChange={(v) =>
              setMetric(metrics.find((k) => reportLabel(k) === v) || active)
            }
          />
        )}{' '}
        {dated && (
          <Picker
            label={table.title + ' chart view'}
            value={view}
            options={['Over time', 'Breakdown']}
            onChange={setView}
          />
        )}
      </div>
      {!table.rows.length ? (
        <p className="metric-empty">No records supplied for this period.</p>
      ) : !dated ? (
        <div className="website-report-summary">
          {metrics.map((m) => (
            <div key={m}>
              <span>
                <DataIcon name={m} badge />
                {reportLabel(m)}
              </span>
              <strong>{number(Number(table.rows[0][m]))}</strong>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="website-report-chart">
            <ResponsiveContainer width="100%" height={280}>
              {view === 'Over time' ? (
                <AreaChart
                  data={plot.series}
                  margin={{ left: 0, right: 15, bottom: 10 }}
                >
                  <defs>
                    {plot.keys.map((k, i) => (
                      <linearGradient
                        key={k}
                        id={id + i}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={palette[i % palette.length]}
                          stopOpacity={0.32}
                        />
                        <stop
                          offset="100%"
                          stopColor={palette[i % palette.length]}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    stroke="#d6dfe5"
                    strokeDasharray="3 6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => String(v).slice(5)}
                    minTickGap={40}
                    fontSize={12}
                  />
                  <YAxis tickFormatter={compact} fontSize={12} />
                  <Tooltip />
                  {plot.keys.map((k, i) => (
                    <Area
                      key={k + active + table.observedAt}
                      dataKey={k}
                      type="monotone"
                      stroke={palette[i % palette.length]}
                      fill={'url(#' + id + i + ')'}
                      strokeWidth={2.5}
                      dot={{
                        r: plot.series.length < 10 ? 4 : 2,
                        fill: palette[i % palette.length],
                        stroke: '#fff',
                      }}
                      activeDot={{ r: 7 }}
                      connectNulls={false}
                      isAnimationActive={animate}
                      animationDuration={600}
                    />
                  ))}
                </AreaChart>
              ) : (
                <BarChart
                  data={plot.ranked.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 0, right: 20, bottom: 10 }}
                >
                  <CartesianGrid
                    stroke="#d6dfe5"
                    strokeDasharray="3 6"
                    horizontal={false}
                  />
                  <XAxis type="number" tickFormatter={compact} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tickFormatter={(v) =>
                      String(v).length > 18 ? String(v).slice(0, 17) + '…' : v
                    }
                    fontSize={12}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name={reportLabel(active)}
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={animate}
                    animationDuration={600}
                  >
                    {plot.ranked.slice(0, 10).map((r, i) => (
                      <Cell key={r.name} fill={palette[i % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {(view === 'Over time' ? plot.keys : []).map((k, i) => (
              <span key={k}>
                <i style={{ background: palette[i % palette.length] }} />
                {k}
              </span>
            ))}
          </div>
          <p className="metric-definition">
            {view === 'Over time'
              ? 'Up to six leading categories; missing dates are not filled with zero.'
              : 'Top ten categories; the detail table contains every imported row.'}{' '}
            {active === 'activeUsers'
              ? 'Counts added across dates are user-days, not unique people for the entire period.'
              : ''}
          </p>
        </>
      )}
      <details className="website-report-details">
        <summary>
          Report details · {table.rows.length.toLocaleString()} rows
        </summary>
        <div className="report-table-scroll">
          <table>
            <thead>
              <tr>
                {table.columns
                  .filter(
                    (c) =>
                      !['conversions', 'conversionValue', 'keyEvents'].includes(
                        c,
                      ),
                  )
                  .map((c) => (
                    <th key={c}>{reportLabel(c)}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(page * 25, (page + 1) * 25).map((r, i) => (
                <tr key={i}>
                  {table.columns
                    .filter(
                      (c) =>
                        ![
                          'conversions',
                          'conversionValue',
                          'keyEvents',
                        ].includes(c),
                    )
                    .map((c) => (
                      <td key={c}>
                        {r[c] === null || r[c] === undefined
                          ? '—'
                          : typeof r[c] === 'number'
                            ? number(r[c])
                            : String(r[c])}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous rows
          </button>
          <button
            disabled={(page + 1) * 25 >= table.rows.length}
            onClick={() => setPage(page + 1)}
          >
            Next rows
          </button>
        </div>
      </details>
      <p className="metric-definition">
        {table.period.start} – {table.period.end} · {table.scope}
        {table.truncated
          ? ' · Partial: narrow the import dates to collect remaining rows.'
          : ''}
      </p>
    </section>
  );
}
export function WebsiteReports({
  tables,
  title,
}: {
  tables: ReportTable[];
  title: string;
}) {
  const available = tables.filter((t) => t.source === 'ga4');
  const reports = [
    ...WEBSITE_REPORTS.map(([key, name]) => ({
      key,
      name,
      table: available.find((t) => t.key === key),
    })),
    ...available
      .filter((t) => !WEBSITE_REPORTS.some(([key]) => key === t.key))
      .map((t) => ({ key: t.key, name: t.title, table: t })),
  ];
  return (
    <section className="website-reports">
      <h2>{title}</h2>
      <div className="website-reports-grid">
        {reports.map(({ key, name, table }, i) => (
          <DeferredChart
            key={key + table?.observedAt + table?.period.start}
            title={name}
            loading={false}
          >
            {table ? (
              <WebsiteReport table={table} index={i} />
            ) : (
              <section className="surface padded website-report-card">
                <span className="metric-eyebrow">
                  Website · ysabelsociety.com
                </span>
                <h3>{name}</h3>
                <p>
                  No report has been supplied for these exact dates.
                  {key === 'website-total'
                    ? ' Unique period totals require an import matching the selected dates.'
                    : ''}
                </p>
                <a
                  className="text-link"
                  href="/marketingdata/connections?connect=ga4"
                >
                  Import website reports
                </a>
              </section>
            )}
          </DeferredChart>
        ))}
      </div>
    </section>
  );
}
