'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, RotateCcw, Globe } from 'lucide-react';
import { number, CHANNELS, COLORS } from '@/lib/analytics';
import { latestAudienceTables } from '@/lib/social-performance';
import type { ReportTable } from '@/lib/reporting';

type Country = {
  code: string;
  name: string;
  aliases: string[];
  path: string;
  x: number;
  y: number;
};
const normalize = (name: string) =>
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const mapColors = [
  '#b8dfdb',
  '#64bfba',
  '#319fbd',
  '#4271b8',
  '#7954a6',
  '#ab467e',
];
const countryColor = (value: number, max: number) =>
  mapColors[Math.min(5, Math.floor(Math.sqrt(value / max) * 6))];
export function AudienceMap({
  tables,
  channels,
}: {
  tables: ReportTable[];
  channels: readonly string[];
}) {
  const reports = latestAudienceTables(tables, channels, 'country');
  // Percentages from one audience must never be added to another platform's counts.
  if (
    channels.length > 1 &&
    [...reports.values()].some((t) => t.columns.includes('percentage'))
  )
    return (
      <div className="performance-map-grid">
        {channels.map((c) => (
          <AudienceMapView key={c} tables={tables} channels={[c]} />
        ))}
      </div>
    );
  return <AudienceMapView tables={tables} channels={channels} />;
}
function AudienceMapView({
  tables,
  channels,
}: {
  tables: ReportTable[];
  channels: readonly string[];
}) {
  const [countries, setCountries] = useState<Country[]>([]),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(''),
    [hover, setHover] = useState(''),
    [search, setSearch] = useState(''),
    [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    fetch('/marketingdata/maps/world-countries.json', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((value) => {
        if (!Array.isArray(value)) throw new Error('Invalid map data');
        setCountries(value as Country[]);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            'The map could not load. Country totals remain available below.',
          );
      });
    return () => abort.abort();
  }, [revision]);
  const reports = useMemo(
    () => latestAudienceTables(tables, channels, 'country'),
    [tables, channels],
  );
  const lookup = useMemo(() => {
    const map = new Map<string, Country>();
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (const country of countries) {
      for (const alias of [country.name, country.code, ...country.aliases])
        map.set(normalize(alias), country);
      try {
        map.set(normalize(names.of(country.code) || ''), country);
      } catch {}
    }
    for (const [alias, code] of Object.entries({
      UK: 'GB',
      'United States of America': 'US',
      'Republic of Kosovo': 'XK',
      XKX: 'XK',
      Türkiye: 'TR',
    })) {
      const country = countries.find((c) => c.code === code);
      if (country) map.set(normalize(alias), country);
    }
    return map;
  }, [countries]);
  const rows = useMemo(() => {
    const totals = new Map<
      string,
      {
        id: string;
        name: string;
        country?: Country;
        values: Record<string, number>;
        total: number;
      }
    >();
    for (const [channel, report] of reports) {
      for (const row of report.rows) {
        const raw = String(row.country ?? row.location ?? '').trim();
        const value = row.followers ?? row.activeUsers ?? row.percentage;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
          continue;
        const country = lookup.get(normalize(raw)),
          id = country?.code || raw || '(not set)',
          entry = totals.get(id) || {
            id,
            name: country?.name || raw || 'Location not supplied',
            country,
            values: {},
            total: 0,
          };
        entry.values[channel] = (entry.values[channel] ?? 0) + value;
        entry.total += value;
        totals.set(id, entry);
      }
    }
    return [...totals.values()].sort((a, b) => b.total - a.total);
  }, [reports, lookup]);
  const byCode = new Map(rows.filter((r) => r.country).map((r) => [r.id, r])),
    maximum = Math.max(...rows.map((r) => r.total), 1),
    active =
      byCode.get(hover || selected) || rows.find((r) => r.id === selected),
    activeCountry = countries.find((c) => c.code === (hover || selected));
  const percent = [...reports.values()].some((t) =>
    t.columns.includes('percentage'),
  );
  const formatValue = (v: number) => (percent ? v.toFixed(1) + '%' : number(v));
  const unit = percent
    ? 'of followers'
    : channels.length === 1 && channels[0] === 'Website'
      ? 'daily active users'
      : 'reported followers';
  const color =
    channels.length === 1
      ? COLORS[CHANNELS.indexOf(channels[0] as (typeof CHANNELS)[number])]
      : '#4668a2';
  const changeZoom = (factor: number) =>
    setView((v) => ({
      ...v,
      scale: Math.min(5, Math.max(1, v.scale * factor)),
      ...(v.scale * factor <= 1 ? { x: 0, y: 0 } : {}),
    }));
  return (
    <section className="surface audience-map-card">
      <div className="section-head">
        <div>
          <span className="metric-eyebrow">{channels.join(' · ')}</span>
          <h2>
            <Globe size={20} /> Audience around the world
          </h2>
          <p>Country distribution · {unit}</p>
        </div>
        <div className="map-controls">
          <button
            aria-label="Zoom in world map"
            className="icon-button"
            onClick={() => changeZoom(1.4)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Zoom out world map"
            className="icon-button"
            onClick={() => changeZoom(1 / 1.4)}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Reset world map"
            className="icon-button"
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div className="map-platform-status">
        {channels.map((c) => (
          <span key={c}>
            <i
              style={{
                background:
                  COLORS[CHANNELS.indexOf(c as (typeof CHANNELS)[number])],
              }}
            />
            {c}:{' '}
            {reports.has(c)
              ? 'Country report loaded'
              : 'Geography not supplied'}
          </span>
        ))}
      </div>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button
            className="text-link"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry map
          </button>
        </p>
      ) : !countries.length ? (
        <p role="status">Loading world map…</p>
      ) : null}
      <div className="world-map-stage">
        <svg
          viewBox="0 0 900 430"
          className="world-map"
          aria-label={'Interactive country map for ' + channels.join(', ')}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              startX: view.x,
              startY: view.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const rect = e.currentTarget.getBoundingClientRect(),
              dx = ((e.clientX - d.x) * 900) / rect.width,
              dy = ((e.clientY - d.y) * 430) / rect.height;
            if (Math.abs(dx) + Math.abs(dy) > 4) {
              d.moved = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setView((v) => ({
                ...v,
                x: Math.max(
                  (-900 * (v.scale - 1)) / 2,
                  Math.min((900 * (v.scale - 1)) / 2, d.startX + dx),
                ),
                y: Math.max(
                  (-430 * (v.scale - 1)) / 2,
                  Math.min((430 * (v.scale - 1)) / 2, d.startY + dy),
                ),
              }));
            }
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            setTimeout(() => {
              drag.current = null;
            }, 0);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <rect width="900" height="430" fill="#e8eef4" rx="14" />
          <g
            transform={
              'translate(' +
              (450 + view.x) +
              ' ' +
              (215 + view.y) +
              ') scale(' +
              view.scale +
              ') translate(-450 -215)'
            }
          >
            {[75, 150, 225, 300, 375].map((y) => (
              <path
                key={y}
                d={'M0 ' + y + 'H900'}
                stroke="#d2dce7"
                strokeWidth="0.5"
              />
            ))}
            {countries.map((country) => {
              const value = byCode.get(country.code),
                isActive = country.code === (hover || selected);
              return (
                <path
                  key={country.code}
                  d={country.path}
                  fill={value ? countryColor(value.total, maximum) : '#f1f3f5'}
                  fillOpacity={1}
                  stroke={isActive ? '#24384d' : '#b4c4d5'}
                  strokeWidth={isActive ? 1.6 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  fillRule="evenodd"
                  role="button"
                  tabIndex={value ? 0 : -1}
                  aria-label={
                    country.name +
                    ': ' +
                    (value
                      ? formatValue(value.total) + ' ' + unit
                      : 'not supplied')
                  }
                  onPointerEnter={() => setHover(country.code)}
                  onPointerLeave={() => setHover('')}
                  onFocus={() => setHover(country.code)}
                  onBlur={() => setHover('')}
                  onClick={() => {
                    if (!drag.current?.moved) setSelected(country.code);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(country.code);
                    }
                  }}
                >
                  <title>
                    {country.name}:{' '}
                    {value
                      ? formatValue(value.total) + ' ' + unit
                      : 'not supplied'}
                  </title>
                </path>
              );
            })}
            {rows
              .filter((r) => r.country && r.total > 0)
              .slice(0, 12)
              .map((r) => (
                <circle
                  key={r.id}
                  cx={r.country!.x}
                  cy={r.country!.y}
                  r={3 / view.scale}
                  fill={color}
                  stroke="white"
                  strokeWidth={1 / view.scale}
                  pointerEvents="none"
                />
              ))}
          </g>
        </svg>
        <div className="map-detail" aria-live="polite">
          <strong>
            {active?.name || activeCountry?.name || 'Explore your audience'}
          </strong>
          {active ? (
            <>
              <span>
                {formatValue(active.total)} {unit}
              </span>
              {channels.map((c) => (
                <small key={c}>
                  {c}:{' '}
                  {active.values[c] === undefined
                    ? 'Not supplied'
                    : formatValue(active.values[c])}
                </small>
              ))}
            </>
          ) : (
            <span>
              {activeCountry
                ? 'No country total supplied'
                : 'Hover or select a country. Zoom and drag to explore.'}
            </span>
          )}
        </div>
      </div>
      {!reports.size && (
        <p className="performance-scope">
          No country breakdown has been imported for this selection. Account
          totals cannot identify a country.{' '}
          {channels.includes('TikTok')
            ? 'TikTok’s current sign-in does not provide audience geography.'
            : ''}{' '}
          <a href="/marketingdata/connections">View available reports</a>
        </p>
      )}
      <div className="map-table-head">
        <label>
          Find a country
          <input
            type="search"
            placeholder="Search countries"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p>
          Teal to plum shows increasing audience concentration. Grey countries
          have no supplied value.
        </p>
      </div>
      <div className="map-color-legend" aria-label="Audience count color scale">
        {mapColors.map((c, i) => (
          <span key={c}>
            <i style={{ background: c }} />
            {formatValue(maximum * (i / 6) ** 2)}
            {i === 5 ? '–' + formatValue(maximum) : '+'}
          </span>
        ))}
      </div>
      <div className="map-country-table">
        <table>
          <caption>Country totals · {channels.join(' · ')}</caption>
          <thead>
            <tr>
              <th>Country</th>
              {channels.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => normalize(r.name).includes(normalize(search)))
              .map((r) => (
                <tr
                  key={r.id}
                  className={selected === r.id ? 'selected-country' : ''}
                >
                  <th>
                    <button
                      onClick={() => {
                        setSelected(r.id);
                        if (r.country)
                          setView({
                            scale: 2.5,
                            x: (450 - r.country.x) * 2.5,
                            y: (215 - r.country.y) * 2.5,
                          });
                      }}
                    >
                      {r.name}
                    </button>
                    {!r.country && countries.length > 0 && (
                      <small>Not mapped</small>
                    )}
                  </th>
                  {channels.map((c) => (
                    <td key={c}>
                      {r.values[c] === undefined
                        ? '—'
                        : formatValue(r.values[c])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {[...reports.entries()].map(([channel, report]) => (
        <p className="metric-definition" key={channel}>
          {channel}: {report.scope} Imported period {report.period.start} –{' '}
          {report.period.end}
          {report.observedAt
            ? ' · refreshed ' + new Date(report.observedAt).toLocaleDateString()
            : ''}
          .
        </p>
      ))}
      <p className="metric-definition">
        Country counts are aggregated, not individual locations or live
        check-ins. Follower geography describes the audience, not where each
        engagement occurred. Combined platform counts are not deduplicated.{' '}
        <a
          href="https://www.naturalearthdata.com/about/terms-of-use/"
          target="_blank"
          rel="noreferrer"
        >
          Map: Natural Earth
        </a>
        .
      </p>
    </section>
  );
}
