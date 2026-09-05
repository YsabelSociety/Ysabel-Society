'use client';
import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  Sparkles,
  ArrowUpRight,
  MapPin,
  Globe,
  ArrowDown,
  Plus,
  Info,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CHANNELS,
  COLORS,
  METRICS,
  compact,
  number,
  total,
  change,
  filterDaily,
  engagement,
  type Daily,
  type Post,
  type Range,
  type Metric,
  series,
} from '@/lib/analytics';
import { Picker, Help } from './controls';
import { AnalyticsChart, Bars } from './charts';
import { type WorkspaceData } from './use-workspace';
import { MediaCards, Empty } from './content';
export function StatRow({
  items,
}: {
  items: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="stat-row">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface padded">
      <h2>{title}</h2>
      {description && <p className="muted panel-description">{description}</p>}
      {children}
    </section>
  );
}
export function Trend({
  data,
  keys,
  title,
}: {
  data: Record<string, any>[];
  keys: string[];
  title: string;
}) {
  return (
    <Panel title={title}>
      <div className="chart-legend">
        {keys.map((k, i) => (
          <span key={k}>
            <i style={{ background: COLORS[i] }} />
            {k}
          </span>
        ))}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -15, right: 10, bottom: 8 }}>
            <CartesianGrid
              stroke="#d5dce6"
              vertical={false}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              minTickGap={45}
              tick={{ fill: '#657185', fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(5)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fill: '#657185', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#f8fafe',
                border: '1px solid #cbd4e1',
                borderRadius: 8,
              }}
            />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                fill={COLORS[i]}
                fillOpacity={0.055}
                stroke={COLORS[i]}
                strokeWidth={1.8}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
export function getInsights(rows: Daily[], previous: Daily[], posts: Post[]) {
  const views = total(rows, 'views'),
    prior = total(previous, 'views');
  const channels = CHANNELS.slice(0, 3)
    .map((channel) => ({
      channel,
      value: total(
        rows.filter((r) => r.channel === channel),
        'views',
      ),
    }))
    .sort((a, b) => b.value - a.value);
  const ps = posts.filter((p) => p.status === 'Published');
  const chef = ps.filter((p) => p.tags.includes('Chef'));
  const average = ps.reduce((n, p) => n + p.shares, 0) / (ps.length || 1),
    chefAverage = chef.reduce((n, p) => n + p.shares, 0) / (chef.length || 1);
  const actions = total(rows, 'actions'),
    directions = total(rows, 'directions');
  const delta = change(views, prior);
  return [
    {
      type: 'PERFORMANCE',
      title: prior
        ? 'Content views ' +
          (delta >= 0 ? 'grew ' : 'declined ') +
          Math.abs(delta).toFixed(1) +
          '%'
        : 'Content generated ' + compact(views) + ' views',
      text:
        compact(views) +
        ' views across three social platforms' +
        (prior
          ? ', compared with ' + compact(prior) + ' in the comparison period.'
          : '.'),
      source: 'Daily social view observations',
      recommendation:
        'Review individual channels before changing the overall content mix.',
    },
    {
      type: 'CHANNEL SPOTLIGHT',
      title: channels[0].channel + ' leads attention',
      text: views
        ? ((channels[0].value / views) * 100).toFixed(1) +
          '% of social views came from ' +
          channels[0].channel +
          ' (' +
          compact(channels[0].value) +
          ').'
        : 'There are no social views in the selected range.',
      source: 'Views by channel / total social views',
      recommendation:
        'Compare saves and shares alongside views to assess the quality of attention.',
    },
    {
      type: 'CREATIVE OPPORTUNITY',
      title:
        chef.length && average
          ? 'Chef stories: ' +
            (chefAverage / average).toFixed(1) +
            '× average shares'
          : 'Build the creative evidence base',
      text: chef.length
        ? chef.length +
          ' chef-tagged posts averaged ' +
          number(Math.round(chefAverage)) +
          ' shares; all ' +
          ps.length +
          ' published posts averaged ' +
          number(Math.round(average)) +
          '.'
        : 'Tag published content to compare creative patterns.',
      source: 'Published demo content · manually assigned tags',
      recommendation:
        'Test another preparation-led story. This association does not prove the subject caused the performance.',
    },
    {
      type: 'BEYOND SOCIAL',
      title: compact(directions) + ' requests for directions',
      text: actions
        ? 'Directions account for ' +
          ((directions / actions) * 100).toFixed(1) +
          '% of Google actions in this period.'
        : 'No Google actions in the selected period.',
      source: 'Google Business daily action counts',
      recommendation:
        'Keep Google opening hours, location details and menu links current. Direction requests are not confirmed visits.',
    },
  ];
}
export function InsightsPage({
  rows,
  previous,
  posts,
  onNavigate,
}: {
  rows: Daily[];
  previous: Daily[];
  posts: Post[];
  onNavigate: (p: string) => void;
}) {
  const insights = getInsights(rows, previous, posts);
  const days = series(rows, 'views');
  const avg =
      days.reduce((n, d) => n + Number(d.total), 0) / (days.length || 1),
    high = [...days].sort((a, b) => Number(b.total) - Number(a.total))[0];
  return (
    <div className="view-enter">
      <div className="intelligence-hero">
        <Sparkles size={27} />
        <div>
          <div className="eyebrow">YSABEL INTELLIGENCE · DEMO OBSERVATIONS</div>
          <h2>What changed?</h2>
          <p>
            A measured perspective on performance, content and customer intent.
          </p>
        </div>
      </div>
      <div className="insights-grid">
        {insights.map((s, i) => (
          <section className="surface insight-large" key={s.title}>
            <span className="insight-kicker">{s.type}</span>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
            <div className="recommendation">
              <span>NEXT CONSIDERATION</span>
              <p>{s.recommendation}</p>
            </div>
            <details>
              <summary>Evidence & calculation</summary>
              <p>
                {s.source}. Deterministic demo data. Period filters apply to
                daily metrics; creative statistics use the published content
                records in view.
              </p>
            </details>
            <button
              className="text-link"
              onClick={() =>
                onNavigate(
                  [
                    'Performance',
                    'Performance',
                    'Content Intelligence',
                    'Google Business',
                  ][i],
                )
              }
            >
              Explore source <ArrowUpRight size={13} />
            </button>
          </section>
        ))}
      </div>
      <Panel
        title="Signals"
        description="Unusual observations deserve context, not alarm."
      >
        {high ? (
          <div className="signal">
            <span className="pill">SIGNAL</span>
            <div>
              <h3>
                {String(high.date)} · {compact(Number(high.total))} views
              </h3>
              <p>
                {avg ? (Number(high.total) / avg).toFixed(2) : '0'}× the daily
                period average. Compare the timing with your campaign
                annotations.
              </p>
            </div>
          </div>
        ) : (
          <Empty title="No signals in this period" />
        )}
      </Panel>
    </div>
  );
}
export function PerformancePage({
  rows,
  previous,
  initialChannel = 'All',
  data,
  unit,
  range,
}: {
  rows: Daily[];
  previous: Daily[];
  initialChannel?: string;
  data: WorkspaceData;
  unit: string;
  range: Range;
}) {
  const [channel, setChannel] = useState(initialChannel),
    [metric, setMetric] = useState<Metric>('views'),
    [note, setNote] = useState(''),
    [noteDate, setNoteDate] = useState(range.end);
  const r =
      channel === 'All' ? rows : rows.filter((r) => r.channel === channel),
    p =
      channel === 'All'
        ? previous
        : previous.filter((r) => r.channel === channel);
  return (
    <div className="view-enter">
      <div className="studio-toolbar">
        <Tabs value={channel} onValueChange={(v) => setChannel(String(v))}>
          <TabsList className="page-tabs">
            {['All', ...CHANNELS].map((c) => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <StatRow
        items={METRICS.slice(0, 4).map((m) => ({
          label: m.label,
          value: compact(total(r, m.key)),
          note: total(p, m.key)
            ? change(total(r, m.key), total(p, m.key)).toFixed(1) +
              '% vs comparison'
            : m.source,
        }))}
      />
      <AnalyticsChart rows={r} previous={p} />
      <div className="two-col">
        <div>
          <div className="section-head standalone">
            <h2>Channel contribution</h2>
            <Picker
              label="Contribution metric"
              value={metric}
              onChange={(v) => setMetric(v as Metric)}
              options={['views', 'engagements', 'users', 'actions']}
            />
          </div>
          <AnalyticsChart
            rows={rows}
            metric={metric}
            title="Share of the story"
            stacked
          />
        </div>
        <Panel
          title="Timeline annotations"
          description="Connect a moment in the business to a movement in performance."
        >
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void data
                .annotate(noteDate, note, unit)
                .then(() => setNote(''))
                .catch(() => {});
            }}
          >
            <label>
              Date
              <input
                type="date"
                required
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
              />
            </label>
            <label>
              What happened?
              <input
                required
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A new menu. A collaboration. An evening."
              />
            </label>
            <button className="secondary" disabled={data.busy || !data.ready}>
              <Plus size={14} /> Add annotation
            </button>
          </form>
          <div className="annotation-list">
            {data.annotations
              .filter((n) => n.date >= range.start && n.date <= range.end)
              .map((n) => (
                <div key={n.id}>
                  <span>{n.date}</span>
                  <p>{n.text}</p>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
export function AudiencePage({
  rows,
  previous,
  live = false,
}: {
  rows: Daily[];
  previous: Daily[];
  live?: boolean;
}) {
  const followers = total(rows, 'followers'),
    prior = total(previous, 'followers'),
    dayCount = new Set(rows.map((r) => r.date)).size;
  const distribution = CHANNELS.slice(0, 3).map((label, i) => ({
    label,
    value: total(
      rows.filter((r) => r.channel === label),
      'followers',
    ),
    color: COLORS[i],
  }));
  return (
    <div className="view-enter">
      <StatRow
        items={[
          {
            label: 'Community',
            value: number(followers),
            note: 'Latest combined social followers',
          },
          {
            label: 'Net new followers',
            value: prior ? number(followers - prior) : '—',
            note: 'Since comparison period end',
          },
          {
            label: 'Growth',
            value: prior ? change(followers, prior).toFixed(1) + '%' : '—',
          },
          {
            label: 'Average daily growth',
            value: prior
              ? ((followers - prior) / (dayCount || 1)).toFixed(0)
              : '—',
          },
        ]}
      />
      <AnalyticsChart
        rows={rows}
        previous={previous}
        metric="followers"
        title="Community growth"
      />
      {live ? (
        <Panel
          title="Audience detail unavailable"
          description="Demographic snapshots require authorized social analytics. No sample demographic values are mixed into this live view."
        >
          <p className="footnote">
            Follower history appears when the connected source supplies it.
          </p>
        </Panel>
      ) : (
        <>
          <div className="three-col">
            <Panel title="Platform distribution">
              <div className="donut">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={65}
                      outerRadius={84}
                      stroke="none"
                      paddingAngle={3}
                    >
                      {distribution.map((d) => (
                        <Cell key={d.label} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#f8fafe',
                        border: '1px solid #cbd4e1',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <strong>
                  {compact(followers)}
                  <small>community</small>
                </strong>
              </div>
              <Bars items={distribution} />
            </Panel>
            <Panel
              title="Top countries"
              description="Sample audience snapshot · percentages"
            >
              <Bars
                items={[
                  { label: 'Albania', value: 74 },
                  { label: 'Italy', value: 11 },
                  { label: 'Kosovo', value: 7 },
                  { label: 'United Kingdom', value: 5 },
                  { label: 'Other', value: 3 },
                ]}
                suffix="%"
              />
            </Panel>
            <Panel
              title="Top cities"
              description="Sample audience snapshot · percentages"
            >
              <Bars
                items={[
                  { label: 'Tirana', value: 62 },
                  { label: 'Durrës', value: 14 },
                  { label: 'Pristina', value: 9 },
                  { label: 'Milan', value: 7 },
                  { label: 'Other', value: 8 },
                ]}
                suffix="%"
              />
            </Panel>
          </div>
          <div className="two-col">
            <Panel
              title="Age distribution"
              description="Illustrative demographic snapshot, separate from date-filtered activity."
            >
              <Bars
                items={[
                  { label: '18–24', value: 17 },
                  { label: '25–34', value: 42 },
                  { label: '35–44', value: 26 },
                  { label: '45–54', value: 11 },
                  { label: '55+', value: 4 },
                ]}
                suffix="%"
              />
            </Panel>
            <Panel title="Audience availability">
              <div className="availability-row">
                <span>Gender</span>
                <span>Not supplied</span>
              </div>
              <div className="availability-row">
                <span>Languages</span>
                <span>Not supplied</span>
              </div>
              <div className="availability-row">
                <span>New / returning visitors</span>
                <span>Requires GA4 identity reporting</span>
              </div>
              <p className="footnote">
                Only permitted, sufficiently aggregated demographics should
                appear once accounts are connected. No individual profiles are
                inferred.
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
export function WebsitePage({
  rows,
  previous,
  live = false,
}: {
  rows: Daily[];
  previous: Daily[];
  live?: boolean;
}) {
  const r = rows.filter((r) => r.channel === 'Website'),
    p = previous.filter((r) => r.channel === 'Website');
  const users = total(r, 'users'),
    sessions = total(r, 'sessions'),
    engaged = total(r, 'engaged'),
    pages = total(r, 'pageViews');
  return (
    <div className="view-enter">
      <StatRow
        items={[
          {
            label: 'Daily active users',
            value: number(users),
            note: 'Daily sum · not period-unique',
          },
          { label: 'Sessions', value: number(sessions) },
          { label: 'Engaged sessions', value: number(engaged) },
          {
            label: 'Engagement rate',
            value: sessions
              ? ((engaged / sessions) * 100).toFixed(1) + '%'
              : '—',
          },
          { label: 'Page views', value: number(pages) },
          {
            label: 'Conversions',
            value: 'Unavailable',
            note: 'No verified reservation event',
          },
        ]}
      />
      <AnalyticsChart
        rows={r}
        previous={p}
        metric="users"
        title="Traffic over time"
      />
      {live ? (
        <Panel
          title="Deeper website reporting"
          description="Traffic-source, page and event breakdowns require additional GA4 queries. No estimated allocations are applied to live data."
        >
          <p className="footnote">
            The connected adapter supplies daily active users, sessions, engaged
            sessions and page views.
          </p>
        </Panel>
      ) : (
        <>
          <div className="two-col">
            <Panel
              title="Traffic sources"
              description="Demo session allocation"
            >
              <Bars
                items={[
                  'Organic search',
                  'Social',
                  'Direct',
                  'Referral',
                  'Paid',
                  'Other',
                ].map((label, i) => ({
                  label,
                  value: Math.round(
                    sessions * [0.38, 0.31, 0.19, 0.07, 0.03, 0.02][i],
                  ),
                }))}
              />
            </Panel>
            <Panel
              title="Social referrals"
              description="Demo session allocation · referral does not imply a booking"
            >
              <Bars
                items={['Instagram', 'Facebook', 'TikTok', 'Other'].map(
                  (label, i) => ({
                    label,
                    value: Math.round(
                      sessions * 0.31 * [0.57, 0.24, 0.15, 0.04][i],
                    ),
                  }),
                )}
              />
            </Panel>
          </div>
          <Panel
            title="From discovery to intent"
            description="Observed website events in demo data. Stages are not linked to the same person."
          >
            <div className="funnel">
              {[
                { label: 'Website activity', value: users },
                { label: 'Menu page views', value: total(r, 'menu') },
                {
                  label: 'Reservation button clicks',
                  value: total(r, 'reservation'),
                },
              ].map((s, i) => (
                <div key={s.label}>
                  <span>0{i + 1}</span>
                  <strong>{compact(s.value)}</strong>
                  <p>{s.label}</p>
                  <div
                    style={{
                      width: Math.max(10, (s.value / (users || 1)) * 100) + '%',
                    }}
                  />
                </div>
              ))}
              <div className="unmeasured">
                <span>04</span>
                <strong>—</strong>
                <p>Completed reservations</p>
                <small>Tracking unavailable</small>
              </div>
            </div>
            <p className="footnote">
              Attribution: unknown. Reservation clicks are not completed
              reservations. Cross-platform social impressions cannot be joined
              into a user funnel.
            </p>
          </Panel>
          <Panel
            title="Website content performance"
            description="Deterministic page allocation from the demo page-view total"
          >
            <div className="simple-table">
              <div className="simple-table-row table-label">
                <span>Page</span>
                <span>Views</span>
                <span>Share</span>
                <span>Conversions</span>
              </div>
              {[
                'Menu',
                'Dining',
                'Experiences',
                'Reservations',
                'About',
                'Contact',
              ].map((page, i) => (
                <div className="simple-table-row" key={page}>
                  <strong>/{page.toLowerCase()}</strong>
                  <span>
                    {number(
                      Math.round(
                        pages * [0.32, 0.2, 0.18, 0.17, 0.08, 0.05][i],
                      ),
                    )}
                  </span>
                  <span>{[32, 20, 18, 17, 8, 5][i]}%</span>
                  <span className="muted">Unavailable</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
export function GooglePage({ rows }: { rows: Daily[] }) {
  const r = rows.filter((r) => r.channel === 'Google Business');
  const grouped = new Map<string, any>();
  r.forEach((d) => {
    const v = grouped.get(d.date) ?? { date: d.date, Search: 0, Maps: 0 };
    v.Search += d.search;
    v.Maps += d.maps;
    grouped.set(d.date, v);
  });
  return (
    <div className="view-enter">
      <StatRow
        items={[
          { label: 'Google Search views', value: number(total(r, 'search')) },
          { label: 'Google Maps views', value: number(total(r, 'maps')) },
          { label: 'Website clicks', value: number(total(r, 'clicks')) },
          { label: 'Phone call clicks', value: number(total(r, 'calls')) },
          {
            label: 'Direction requests',
            value: number(total(r, 'directions')),
          },
          { label: 'Bookings', value: 'Unavailable' },
        ]}
      />
      <Trend
        title="Search & Maps visibility"
        data={[...grouped.values()]}
        keys={['Search', 'Maps']}
      />
      <div className="two-col">
        <Panel
          title="Customer actions"
          description="What people did after discovering Ysabel Society"
        >
          <Bars
            items={[
              { label: 'Direction requests', value: total(r, 'directions') },
              { label: 'Website clicks', value: total(r, 'clicks') },
              { label: 'Phone call clicks', value: total(r, 'calls') },
            ]}
          />
          <p className="footnote">
            These actions do not measure completed visits, answered calls or
            reservations. Menu interactions and food orders are not supplied.
          </p>
        </Panel>
        <Panel
          title="Ysabel Society at a glance"
          description="Search visibility and customer intent for your brand"
        >
          <div className="simple-table">
            <div className="simple-table-row table-label">
              <span>Workspace</span>
              <span>Search</span>
              <span>Maps</span>
              <span>Actions</span>
            </div>
            <div className="simple-table-row">
              <strong>Ysabel Society</strong>
              <span>{compact(total(r, 'search'))}</span>
              <span>{compact(total(r, 'maps'))}</span>
              <span>{compact(total(r, 'actions'))}</span>
            </div>
          </div>
          <p className="footnote">
            All connected Google Business sources are shown together for Ysabel
            Society.
          </p>
        </Panel>
      </div>
    </div>
  );
}
export function ComparisonsPage({
  range,
  rows,
  previous,
}: {
  range: Range;
  rows: Daily[];
  previous: Daily[];
}) {
  const [mode, setMode] = useState('Channels'),
    [left, setLeft] = useState('Instagram'),
    [right, setRight] = useState('TikTok');
  const options = [...CHANNELS];
  const a = mode === 'Periods' ? rows : rows.filter((r) => r.channel === left),
    b = mode === 'Periods' ? previous : rows.filter((r) => r.channel === right);
  return (
    <div className="view-enter">
      <div className="studio-toolbar">
        <Picker
          label="Comparison type"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setLeft('Instagram');
            setRight('TikTok');
          }}
          options={['Channels', 'Periods']}
        />
        {mode !== 'Periods' && (
          <div className="inline-controls">
            <Picker
              label="First comparison"
              value={left}
              onChange={setLeft}
              options={options}
            />
            <span className="muted">versus</span>
            <Picker
              label="Second comparison"
              value={right}
              onChange={setRight}
              options={options}
            />
          </div>
        )}
      </div>
      <div className="compare-heading">
        <h2>{mode === 'Periods' ? 'Selected period' : left}</h2>
        <span>VS</span>
        <h2>{mode === 'Periods' ? 'Comparison period' : right}</h2>
      </div>
      <div className="comparison-rows">
        {METRICS.map((m) => {
          const v = total(a, m.key),
            w = total(b, m.key);
          return (
            <div className="comparison-row" key={m.key}>
              <strong>{compact(v)}</strong>
              <div>
                <span>
                  {m.label} <Help text={m.definition} />
                </span>
                <div className="compare-bars">
                  <i
                    style={{ width: (v / (Math.max(v, w) || 1)) * 48 + '%' }}
                  />
                  <i
                    style={{ width: (w / (Math.max(v, w) || 1)) * 48 + '%' }}
                  />
                </div>
              </div>
              <strong>{compact(w)}</strong>
            </div>
          );
        })}
      </div>
      <div className="two-col">
        <AnalyticsChart
          rows={a}
          title={mode === 'Periods' ? 'Selected period' : left}
        />
        <AnalyticsChart
          rows={b}
          title={mode === 'Periods' ? 'Comparison period' : right}
        />
      </div>
      <p className="footnote">
        Source-specific definitions apply. Cross-channel reach and daily users
        are not unique people. Paid media comparison becomes available after
        advertising data is connected.
      </p>
    </div>
  );
}
