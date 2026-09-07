'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { type ReportTable } from '@/lib/reporting';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { Picker } from './controls';
import { WebsiteReports } from './website-reports';
import { GoogleBusinessReports } from './google-business-reports';
const labels: Record<string, string> = {
  activeUsers: 'Active users',
  sessions: 'Sessions',
  engagedSessions: 'Engaged sessions',
  screenPageViews: 'Page views',
  keyEvents: 'Key events',
  newUsers: 'New users',
  userEngagementDuration: 'Engagement seconds',
  sessionSourceMedium: 'Source / medium',
  sessionDefaultChannelGroup: 'Channel',
  pagePath: 'Page',
  eventName: 'Event',
  eventCount: 'Event count',
  deviceCategory: 'Device',
  newVsReturning: 'Visitor type',
  campaignId: 'Campaign ID',
  conversionValue: 'Conversion value',
  linkClicks: 'Link clicks',
};
function label(key: string) {
  return (
    labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')
  );
}
function download(table: ReportTable) {
  const encode = (v: unknown) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const text = [
    table.columns,
    ...table.rows.map((r) => table.columns.map((k) => r[k])),
  ]
    .map((r) => r.map(encode).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(
      new Blob([text], { type: 'text/csv;charset=utf-8' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = 'Ysabel-Society-' + table.source + '-' + table.key + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
export function SourceReports({
  tables,
  group,
  title = 'Imported source reports',
}: {
  tables: ReportTable[];
  group?: string;
  title?: string;
}) {
  const [choice, setChoice] = useState(''),
    [page, setPage] = useState(0),
    [search, setSearch] = useState('');
  const available = tables.filter(
    (t) =>
      !group ||
      (group === 'audience' &&
        (t.key.startsWith('audience') || t.key === 'website-visitors')) ||
      (group === 'website' && t.source === 'ga4') ||
      (group === 'google' && t.source === 'gbp') ||
      (group === 'advertising' && t.source.endsWith('-ads')),
  );
  const selected =
    available.find((t) => t.source + ':' + t.key === choice) || available[0];
  if (group === 'website')
    return <WebsiteReports tables={available} title={title} />;
  if (group === 'google') return <GoogleBusinessReports tables={available} />;
  if (!selected)
    return (
      <section className="surface padded">
        <h2>{title}</h2>
        <p className="muted">
          No matching source report has been imported for this period. Check the
          selected dates and the connection coverage. Provider exports can
          supply additional available reports.
        </p>
        <a className="text-link" href="/marketingdata/connections">
          Open connection & import centre
        </a>
      </section>
    );
  const rows = selected.rows.filter((r) =>
    Object.values(r).some((v) =>
      String(v ?? '')
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  return (
    <section className="surface padded source-report">
      <div className="section-head">
        <h2>{title}</h2>
        <button className="secondary" onClick={() => download(selected)}>
          <Download size={15} /> Export this data
        </button>
      </div>
      <div className="source-report-controls">
        <Picker
          label="Source report"
          value={selected.title + ' · ' + SOURCE_CHANNELS[selected.source]}
          options={available.map(
            (t) => t.title + ' · ' + SOURCE_CHANNELS[t.source],
          )}
          onChange={(v) => {
            const t = available.find(
              (t) => t.title + ' · ' + SOURCE_CHANNELS[t.source] === v,
            );
            setChoice(t ? t.source + ':' + t.key : '');
            setPage(0);
          }}
        />
        <input
          type="search"
          aria-label="Search source report"
          placeholder="Search rows"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>
      <p className="footnote">{selected.scope}</p>
      <p className="source-asof">
        Imported period: {selected.period.start} – {selected.period.end}
        {selected.observedAt
          ? ' · Refreshed ' + new Date(selected.observedAt).toLocaleString()
          : ''}
        {selected.truncated
          ? ' · Partial report: import a narrower period for remaining rows.'
          : ''}
      </p>
      <div className="report-table-scroll">
        <table>
          <thead>
            <tr>
              {selected.columns.map((key) => (
                <th key={key}>{label(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 25, (page + 1) * 25).map((row, i) => (
              <tr key={i}>
                {selected.columns.map((key) => (
                  <td key={key}>
                    {row[key] === null || row[key] === undefined
                      ? '—'
                      : typeof row[key] === 'number'
                        ? row[key].toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : String(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="muted">
          No rows returned for this selection. Unavailable values are not zero.
        </p>
      )}
      <div className="pagination">
        <span>{rows.length.toLocaleString()} rows</span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button
          disabled={(page + 1) * 25 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
