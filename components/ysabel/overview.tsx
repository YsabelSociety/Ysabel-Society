'use client';
import {
  Camera as Instagram,
  Flag as Facebook,
  Music2,
  MapPin,
  Globe,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  CHANNELS,
  COLORS,
  METRICS,
  metricAvailable,
  compact,
  total,
  change,
  series,
  type Daily,
  type Post,
} from '@/lib/analytics';
import { Help } from './controls';
import { AnalyticsChart, Spark } from './charts';
import { MediaCards } from './content';
export default function Overview({
  rows,
  previous,
  setPage,
  posts,
  onSelect,
  onMetric,
  live = false,
}: {
  rows: Daily[];
  previous: Daily[];
  setPage: (p: string) => void;
  posts: Post[];
  onSelect: (p: Post) => void;
  onMetric: (key: string) => void;
  live?: boolean;
}) {
  return (
    <>
      <div className="metrics-strip">
        {METRICS.map((m, i) => {
          const value = total(rows, m.key),
            prior = total(previous, m.key),
            delta = change(value, prior),
            available = metricAvailable(rows, m.key);
          return (
            <div
              className={'metric-card metric-' + i}
              data-metric={m.key}
              key={m.key}
            >
              <div className="metric-label">
                {m.label}
                <Help text={m.definition} />
              </div>
              <button
                className="metric-value"
                onClick={() => onMetric(m.key)}
                aria-label={
                  m.label +
                  ': ' +
                  (available ? compact(value) : 'Unavailable') +
                  '. Open metric details.'
                }
              >
                {available ? compact(value) : '—'}
              </button>
              <div className="metric-bottom">
                <span className={delta >= 0 ? 'positive' : 'negative'}>
                  {available && prior ? (delta >= 0 ? '↗' : '↘') : ''}{' '}
                  {prior ? Math.abs(delta).toFixed(1) + '%' : '—'}
                </span>
                <span>
                  {!available
                    ? 'Not supplied'
                    : prior
                      ? 'vs. previous'
                      : 'no comparison'}
                </span>
              </div>
              {available && (
                <Spark
                  values={series(rows, m.key).map((d) => Number(d.total))}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="overview-grid">
        <AnalyticsChart rows={rows} previous={previous} />
        <section className="intelligence surface">
          <div className="section-head">
            <h2>
              <Sparkles size={16} /> Digital Intelligence
            </h2>
            <span className="pill">{live ? 'LIVE' : 'PREVIEW'}</span>
          </div>
          <p className="intelligence-intro">The story behind the numbers.</p>
          {[0, 2, 4].map((idx, i) => {
            const c = CHANNELS[idx],
              v = total(
                rows.filter((r) => r.channel === c),
                idx === 4 ? 'users' : 'views',
              );
            return (
              <button
                key={c}
                className="insight-row"
                onClick={() => setPage('Insights')}
              >
                <span className="insight-kicker">
                  {['MOMENTUM', 'CHANNEL SPOTLIGHT', 'BEYOND SOCIAL'][i]}
                </span>
                <p>
                  {c}{' '}
                  <strong>
                    {metricAvailable(
                      rows.filter((r) => r.channel === c),
                      idx === 4 ? 'users' : 'views',
                    )
                      ? compact(v)
                      : '—'}
                  </strong>{' '}
                  {idx === 4 ? 'daily active users' : 'content views'} this
                  period.
                </p>
                <span>
                  Explore the signal <ArrowUpRight size={13} />
                </span>
              </button>
            );
          })}
          <button className="text-link" onClick={() => setPage('Insights')}>
            Open intelligence <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
      <div className="section-head standalone">
        <div>
          <h2>Channel performance</h2>
          <p>Five perspectives. One connected story.</p>
        </div>
        <button className="text-link" onClick={() => setPage('Performance')}>
          Explore channels <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="channel-grid">
        {CHANNELS.map((c, i) => {
          const Icon = [Instagram, Facebook, Music2, MapPin, Globe][i],
            cr = rows.filter((r) => r.channel === c),
            prior = total(previous.filter(r => r.channel === c), i < 3 ? 'views' : i === 3 ? 'actions' : 'users'),
            available = metricAvailable(
              cr,
              i < 3 ? 'views' : i === 3 ? 'actions' : 'users',
            );
          return (
            <button
              className="channel-card surface"
              data-platform={c}
              key={c}
              onClick={() =>
                setPage(
                  c === 'Website'
                    ? 'Website'
                    : c === 'Google Business'
                      ? 'Google Business'
                      : 'Performance',
                )
              }
            >
              <div className="channel-name">
                <span className="channel-icon" style={{ color: COLORS[i] }}>
                  <Icon size={19} />
                </span>
                {c}
                <ArrowUpRight size={14} />
              </div>
              <strong>
                {available
                  ? compact(
                      total(
                        cr,
                        i < 3 ? 'views' : i === 3 ? 'actions' : 'users',
                      ),
                    )
                  : '—'}
              </strong>
              <span>
                {i < 3
                  ? 'Content views'
                  : i === 3
                    ? 'Customer actions'
                    : 'Daily active users'}
              </span>
              <div className="channel-footer">
                {available ? (
                  <>
                    {prior ? <span className="positive">
                      {total(cr, i < 3 ? 'views' : i === 3 ? 'actions' : 'users') >= prior ? '↗' : '↘'}{' '}
                      {change(
                        total(
                          cr,
                          i < 3 ? 'views' : i === 3 ? 'actions' : 'users',
                        ),
                        total(
                          previous.filter((r) => r.channel === c),
                          i < 3 ? 'views' : i === 3 ? 'actions' : 'users',
                        ),
                      ).toFixed(1)}
                      %
                    </span> : <span className="muted">No complete comparison</span>}
                    <Spark
                      values={series(
                        cr,
                        i < 3 ? 'views' : i === 3 ? 'actions' : 'users',
                      ).map((d) => Number(d.total))}
                    />
                  </>
                ) : (
                  <span className="muted">Daily metrics not supplied</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!live && (
        <>
          <div className="section-head standalone">
            <div>
              <h2>Content worth a closer look</h2>
              <p>The stories that resonated most.</p>
            </div>
            <button
              className="text-link"
              onClick={() => setPage('Content Intelligence')}
            >
              All content <ArrowUpRight size={14} />
            </button>
          </div>
          <MediaCards
            posts={posts
              .filter((p) => p.status === 'Published')
              .sort((a, b) => b.views - a.views)
              .slice(0, 4)}
            onSelect={onSelect}
          />
          <p className="footnote">
            Demo media · licensed hospitality photographs. These images do not
            depict Ysabel Society or its team.
          </p>
        </>
      )}
    </>
  );
}
