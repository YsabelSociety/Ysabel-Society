'use client';
import { openDataCenter } from './data-center-navigation';
import { useState, useMemo, useId, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { ResponsiveContainer } from './stable-chart-container';
import type { ReportTable } from '@/lib/reporting';
import { number, compact } from '@/lib/analytics';
import {
  WEBSITE_REPORTS,
  websitePlot,
  reportLabel,
  websiteDimension,
  websiteLink,
} from '@/lib/website-report-model';
import { DeferredChart } from './social-performance';
import { Picker } from './controls';
import { useMinimalMotion } from './use-motion';
import { DataIcon } from './data-icons';
import { SourceBadge } from './source-badge';
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
  archive,
}: {
  table: ReportTable;
  index: number;
  archive: boolean;
}) {
  const [metric, setMetric] = useState(''),
    [view, setView] = useState(
      !websiteDimension(table) && new Set(table.rows.map((r) => r.date).filter(Boolean)).size > 1
        ? 'Over time'
        : 'Breakdown',
    ),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    animate = useMinimalMotion();
  const id = useId().replace(/:/g, '');
  const palette = colors.map((_, i) => colors[(index + i) % colors.length]);
  const metrics = table.columns.filter(
    (c) =>
      table.rows.some((r) => typeof r[c] === 'number'),
  );
  const active = metrics.includes(metric) ? metric : metrics[0] || 'sessions';
  const plot = useMemo(() => websitePlot(table, active), [table, active]);
  const dated = table.columns.includes('date');
  const dimension = websiteDimension(table);
  const ranked = plot.ranked.filter(row => row.name.toLowerCase().includes(search.toLowerCase()));
  const total = plot.ranked.reduce((sum, row) => sum + row.value, 0);
  useEffect(() => setPage(0), [search, active, table.period.start, table.period.end]);
  const title = WEBSITE_REPORTS.find(([key]) => key === table.key)?.[1] || table.title;
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
            {title}
          </h3>
        </div>
        <span className="report-number">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      {table.observedAt && <p className="source-asof"><SourceBadge channel="Website" /> Google Analytics API · Updated {new Date(table.observedAt).toLocaleString('en-GB', {timeZone:'Europe/Tirane',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>}
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
        <p className="metric-empty">Google has not returned {table.key === 'website-links' ? 'tracked destination link clicks' : table.key === 'website-downloads' ? 'file download events' : table.key === 'website-searches' ? 'website search events' : 'records'} for these dates. This is not a zero estimate.</p>
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
          <DeferredChart title={title + ' chart'} loading={false}>
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
                      key={k + active}
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
          </DeferredChart>
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
              : 'Top ten categories; all recorded entries are searchable below.'}{' '}
            {active === 'activeUsers'
              ? 'Counts added across dates are user-days, not unique people for the entire period.'
              : ''}
          </p>
        </>
      )}
      {dimension && table.rows.length > 0 && <div className="website-ranking">
        <div className="website-ranking-tools">
          <strong>{plot.ranked.length.toLocaleString()} {dimension === 'pagePath' || dimension === 'landingPage' ? 'pages' : dimension === 'linkUrl' ? 'links' : 'entries'}</strong>
          <input type="search" aria-label={'Search ' + title} placeholder="Search pages, links or names" value={search} onChange={event=>setSearch(event.target.value)} />
        </div>
        <div className="report-table-scroll"><table aria-label={title + ' ranking'}>
          <thead><tr><th scope="col">{reportLabel(dimension)}</th><th scope="col">{table.key === 'website-links' ? 'Clicks' : table.key === 'website-downloads' ? 'Downloads' : reportLabel(active)}</th><th scope="col">Share</th></tr></thead>
          <tbody>{ranked.slice(page * 10, (page + 1) * 10).map(row=><tr key={row.name}>
            <th scope="row">{websiteLink(row.name) ? <a href={websiteLink(row.name)} target="_blank" rel="noopener noreferrer">{row.name} ↗</a> : row.name}</th>
            <td>{number(row.value)}</td><td>{total ? (row.value / total * 100).toFixed(1) : '0'}%</td>
          </tr>)}</tbody>
        </table></div>
        {!ranked.length && <p>No matching entries.</p>}
        <div className="pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>{ranked.length ? page * 10 + 1 : 0}–{Math.min((page + 1) * 10, ranked.length)} of {number(ranked.length)}</span><button disabled={(page+1)*10 >= ranked.length} onClick={()=>setPage(page+1)}>Next</button></div>
      </div>}
      {archive && <details className="website-report-details">
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
      </details>}
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
  archive = true,
}: {
  tables: ReportTable[];
  title: string;
  archive?: boolean;
}) {
  const [section, setSection] = useState('Pages & links');
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
  const groups: Record<string, string[]> = {
    'Pages & links': ['website-pages', 'website-links', 'website-landing'],
    'Audience & sources': ['website-total', 'website-traffic', 'website-channels', 'website-campaigns', 'website-referrers', 'website-devices', 'website-browsers', 'website-languages', 'website-countries', 'website-cities', 'website-visitors'],
    'Events & downloads': ['website-events', 'website-downloads', 'website-searches'],
  };
  return (
    <section className="website-reports">
      <h2>{title}</h2>
      <p className="footnote">Recorded Google Analytics data for the selected dates. Pages and links include public and private routes when tracked; Google does not identify their access level. Only “Activity right now” uses the Realtime API.</p>
      <div className="website-report-tabs" role="group" aria-label="Website report sections">{[...Object.keys(groups), 'All reports'].map(name=><button key={name} type="button" aria-pressed={section===name} onClick={()=>setSection(name)}><DataIcon name={name}/>{name}</button>)}</div>
      <div className="website-reports-grid">
        {reports.filter(r=>section === 'All reports' || groups[section]?.includes(r.key)).map(({ key, name, table }, i) => (
          <div key={key}>
            {table ? (
              <WebsiteReport table={table} index={i} archive={archive} />
            ) : (
              <section className="surface padded website-report-card">
                <span className="metric-eyebrow">
                  Website · ysabelsociety.com
                </span>
                <h3>{name}</h3>
                <p>
                  This report has not been synced for the selected dates.
                  {key === 'website-total'
                    ? ' Unique users require a Google report covering these exact dates.'
                    : ''}
                </p>
                <a
                  className="text-link"
                  href="/marketingdata/connections?connect=ga4" onClick={event=>{event.preventDefault();openDataCenter('access');}}
                >
                  Refresh Google Analytics in Data Center
                </a>
              </section>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
