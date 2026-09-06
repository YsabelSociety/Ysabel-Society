'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  ScanEye,
  Users,
  Globe,
  MapPin,
  Grid2X2,
  Smartphone,
  Images,
  CalendarDays,
  Sparkles,
  GitCompareArrows,
  FileText,
  Plug,
  Database,
  Settings,
  Search,
  ArrowUpRight,
  ArrowDownToLine,
  ChevronRight,
  Sun,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
  AtSign,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  METRICS,
  ANCHOR,
  iso,
  metricAvailable,
  CHANNELS,
  compact,
  total,
  filterDaily,
  dateRange,
  previousRange,
  type Post,
  type Range,
} from '@/lib/analytics';
import { Picker } from './controls';
import Overview from './overview';
import { useWorkspace } from './use-workspace';
import { useSourceAnalytics } from './use-analytics';
import { PostDetail, ContentIntelligence } from './content';
import {
  PerformancePage,
  AudiencePage,
  WebsitePage,
  GooglePage,
  ComparisonsPage,
  InsightsPage,
} from './analytics-pages';
import { ReportsPage, ExportDialog } from './reports';
import { ConnectionsPage, DataSourcesPage, SettingsPage } from './system-pages';
import { AdminPanel } from './admin-panel';
import { useAutoRefresh } from './use-auto-refresh';
import { SourceReports } from './source-reports';
import { CommunityPage, GoogleReviews } from './community';
const groups = [
  {
    label: 'WORKSPACE',
    items: [
      ['Overview', LayoutDashboard],
      ['Performance', ChartNoAxesCombined],
      ['Content Intelligence', ScanEye],
      ['Audience', Users],
      ['Website', Globe],
      ['Google Business', MapPin],
    ],
  },
  {
    label: 'COMMUNITY',
    items: [
      ['Inbox', MessageCircle],
      ['Mentions', AtSign],
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      ['Insights', Sparkles],
      ['Comparisons', GitCompareArrows],
      ['Reports', FileText],
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      ['Admin Panel', ShieldCheck],
      ['Connections', Plug],
      ['Data Sources', Database],
      ['Settings', Settings],
    ],
  },
];
const names = groups.flatMap((g) => g.items.map((i) => String(i[0])));
const dateOptions = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'Previous Month',
  'Quarter',
  'Year to Date',
  'Last Year',
  'Custom Range',
];
const headings: Record<string, [string, string]> = {
  'Admin Panel': [
    'Admin panel',
    'Manage conversations, connections and preferences for Ysabel Society.',
  ],
  Overview: [
    'A clearer view of Ysabel Society.',
    'Here’s how Ysabel Society is performing.',
  ],
  Performance: [
    'Every channel. One perspective.',
    'Follow the movement, understand the momentum.',
  ],
  'Content Intelligence': [
    'The stories that resonate.',
    'Look closer at what your audience remembers.',
  ],
  Audience: [
    'Meet your community.',
    'How your audience grows, and where it gathers.',
  ],
  Website: [
    'From attention to intention.',
    'Understand the paths people take through Ysabel Society online.',
  ],
  'Google Business': [
    'Discovery starts here.',
    'A view of Search, Maps and customer actions.',
  ],
  Inbox: [
    'Every conversation matters.',
    'Track enquiries, outstanding replies and the people waiting to hear from you.',
  ],
  Mentions: [
    'The stories around Ysabel Society.',
    'Follow captured mentions and story reposts across your community.',
  ],
  Insights: [
    'The story behind the numbers.',
    'Signals, context and the next questions worth asking.',
  ],
  Comparisons: [
    'A different point of view.',
    'Compare periods and channels with context.',
  ],
  Reports: [
    'Perspective, beautifully presented.',
    'A clear account of performance for Ysabel Society ownership.',
  ],
  Connections: [
    'One connected ecosystem.',
    'Bring the sources behind your business into view.',
  ],
  'Data Sources': [
    'Confidence in every number.',
    'Definitions, availability and where each observation comes from.',
  ],
  Settings: [
    'Your workspace, considered.',
    'A single workspace for Ysabel Society.',
  ],
};
export default function Workspace({
  initialPage = 'Overview',
}: {
  initialPage?: string;
}) {
  const data = useWorkspace();
  useAutoRefresh(data.ready);
  const unit = 'Ysabel Society';
  const [liveClock, setLiveClock] = useState(false);
  const liveInitialized = useRef(false);
  const [page, setPage] = useState(
      names.includes(initialPage) ? initialPage : 'Overview',
    ),
    [date, setDate] = useState('Previous Month'),
    [comparison, setComparison] = useState('Previous Period'),
    [custom, setCustom] = useState<Range>({
      start: '2026-08-01',
      end: '2026-08-31',
    }),
    [command, setCommand] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [post, setPost] = useState<Post | null>(null),
    [metric, setMetric] = useState<string | null>(null);
  const range = useMemo(
    () => dateRange(date, custom, liveClock ? iso(new Date()) : ANCHOR),
    [date, custom, liveClock],
  );
  const onLive = useCallback(() => {
    setLiveClock(true);
    if (!liveInitialized.current) {
      liveInitialized.current = true;
      setDate('Last 30 Days');
    }
  }, []);
  const source = useSourceAnalytics(unit, range, comparison, onLive),
    rows = source.rows,
    previous = source.previous;
  const analyticsData =
    source.mode === 'live' ? { ...data, posts: source.posts } : data;
  const visiblePosts = analyticsData.posts.filter(
    (p) => p.date >= range.start && p.date <= range.end,
  );
  function navigate(name: string) {
    if (!names.includes(name)) return;
    setPage(name);
    setCommand(false);
    window.history.pushState(
      {},
      '',
      name === 'Admin Panel'
        ? '/admin'
        : name === 'Connections'
          ? '/connections'
          : '/#' + encodeURIComponent(name),
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  useEffect(() => {
    const read = () => {
      let name =
        location.pathname.replace(/\/$/, '') === '/admin'
          ? 'Admin Panel'
          : location.pathname.replace(/\/$/, '') === '/connections'
            ? 'Connections'
            : 'Overview';
      try {
        const section = decodeURIComponent(location.hash.slice(1));
        if (names.includes(section)) name = section;
      } catch {}
      setPage(names.includes(name) ? name : 'Overview');
    };
    read();
    window.addEventListener('popstate', read);
    window.addEventListener('hashchange', read);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('popstate', read);
      window.removeEventListener('hashchange', read);
    };
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'navigate_ysabel_workspace',
      title: 'Open a Ysabel Society section',
      description:
        'Navigate to an existing section of the Ysabel Society workspace.',
      inputSchema: {
        type: 'object',
        properties: { section: { type: 'string', enum: names } },
        required: ['section'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: any) => {
        if (!input || !names.includes(input.section))
          throw new Error('Unknown section');
        navigate(input.section);
        return { section: input.section };
      },
    });
    register({
      name: 'read_ysabel_metrics',
      title: 'Read visible metrics',
      description:
        'Read the current date-filtered metrics, data mode and definitions.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => ({
        mode: source.mode,
        unit,
        range,
        metrics: METRICS.map((m) => ({
          name: m.label,
          value: metricAvailable(rows, m.key) ? total(rows, m.key) : null,
          definition: m.definition,
        })),
      }),
    });
    return () => lifecycle.abort();
  }, [unit, range, rows]);
  const heading = headings[page];
  const [greeting, setGreeting] = useState('Good afternoon.');
  useEffect(() => {
    const h = Number(
      new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: data.settings.timezone,
      }).format(new Date()),
    );
    setGreeting(
      h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.',
    );
  }, [data.settings.timezone]);
  return (
    <TooltipProvider>
      <SidebarProvider
        className="workspace-shell"
        data-section={page}
        mobileBreakpoint={640}
        open={true}
      >
        <Sidebar
          className="ys-sidebar"
          side="left"
          aria-label="Workspace navigation"
        >
          <SidebarHeader>
            <button
              onClick={() => navigate('Overview')}
              aria-label="Ysabel Society overview"
            >
              <div className="wordmark">
                YSABEL<span>S O C I E T Y</span>
              </div>
            </button>
            <div className="brand-caption">DIGITAL INTELLIGENCE</div>
          </SidebarHeader>
          <SidebarContent>
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map(([name, Icon]: any) => (
                    <SidebarMenuItem key={name}>
                      <SidebarMenuButton
                        data-nav={name}
                        isActive={page === name}
                        onClick={() => navigate(name)}
                      >
                        <Icon size={17} />
                        <span>{name}</span>
                        {page === name && <span className="nav-dot" />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <button
              className="sync-status"
              onClick={() => navigate('Connections')}
            >
              <i />
              {source.mode === 'live'
                ? source.sourceStatus.some(
                    (s) => s.status === 'Needs Attention',
                  )
                  ? 'Connections need attention'
                  : 'Source reports'
                : 'Demo workspace'}
              <span>
                {source.mode === 'live'
                  ? 'Check imports and access'
                  : 'Sample data · 5 Sep 2026'}
              </span>
            </button>
            <button className="profile" onClick={() => navigate('Admin Panel')}>
              <span className="avatar">YS</span>
              <span>
                Ysabel Society<small>Open admin panel</small>
              </span>
              <ChevronRight size={14} />
            </button>
          </SidebarFooter>
        </Sidebar>
        <main className="workspace">
          <header className="topbar">
            <div className="workspace-picker">
              <SidebarTrigger
                className="mobile-trigger"
                aria-label="Open workspace sidebar"
              />
              <span className="workspace-location">{page}</span>
            </div>
            <div className="top-actions">
              <button
                className="admin-launch"
                onClick={() => navigate('Admin Panel')}
                aria-label="Open admin panel"
                aria-current={page === 'Admin Panel' ? 'page' : undefined}
              >
                <ShieldCheck size={16} />
                <span>Admin panel</span>
              </button>
              <button
                className="demo-badge"
                onClick={() => navigate('Data Sources')}
              >
                <i />
                {source.mode === 'live' ? 'Live sources' : 'Demo Data'}
              </button>
              <button
                className="search-button"
                aria-label="Search workspace"
                onClick={() => setCommand(true)}
              >
                <Search size={17} />
                <span>Search anything</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="avatar small"
                aria-label="Open admin panel"
                onClick={() => navigate('Admin Panel')}
              >
                YS
              </button>
            </div>
          </header>
          <div className="page-body">
            <div className="breadcrumb">
              Workspace <ChevronRight size={12} />
              <span>{page}</span>
            </div>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <Sun size={13} />{' '}
                  {page === 'Overview'
                    ? 'YOUR DAILY PERSPECTIVE'
                    : 'YSABEL SOCIETY / ' + page.toUpperCase()}
                </div>
                <h1>{heading[0]}</h1>
                <p>
                  {page === 'Overview' ? greeting + ' ' : ''}
                  {heading[1]}
                </p>
              </div>
              {page !== 'Admin Panel' && (
                <button
                  className="secondary"
                  onClick={() => setExportOpen(true)}
                >
                  <ArrowDownToLine size={15} /> Export report
                </button>
              )}
            </div>
            {page !== 'Admin Panel' && (
              <div className="filter-row">
                <div className="inline-controls">
                  <CalendarDays size={15} />
                  <Picker
                    value={date}
                    onChange={setDate}
                    options={dateOptions}
                    label="Date range"
                  />
                  <span className="date-caption">
                    {new Date(range.start + 'T12:00:00Z').toLocaleDateString(
                      'en',
                      { month: 'short', day: 'numeric' },
                    )}{' '}
                    –{' '}
                    {new Date(range.end + 'T12:00:00Z').toLocaleDateString(
                      'en',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      },
                    )}
                  </span>
                  <span className="divider" />
                  <GitCompareArrows size={15} />
                  <Picker
                    value={comparison}
                    onChange={setComparison}
                    options={[
                      'Previous Period',
                      'Previous Month',
                      'Previous Year',
                      'No Comparison',
                    ]}
                    label="Comparison"
                  />
                  {date !== 'Previous Month' && (
                    <button
                      className="clear-filters"
                      onClick={() => {
                        setDate('Previous Month');
                        setComparison('Previous Period');
                      }}
                    >
                      Clear filters <X size={11} />
                    </button>
                  )}
                </div>
                <button
                  className="freshness"
                  onClick={() => navigate('Connections')}
                >
                  <span className="small-dot" />{' '}
                  {source.loading
                    ? 'Updating…'
                    : source.mode === 'live'
                      ? source.coverage.length
                        ? 'Imported source data'
                        : 'No imported data yet'
                      : 'Preview data'}
                </button>
              </div>
            )}
            {page !== 'Admin Panel' && date === 'Custom Range' && (
              <div className="custom-dates">
                <label>
                  From
                  <input
                    type="date"
                    value={custom.start}
                    max={custom.end}
                    onChange={(e) =>
                      e.target.value &&
                      e.target.value <= custom.end &&
                      setCustom({ ...custom, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={custom.end}
                    min={custom.start}
                    onChange={(e) =>
                      e.target.value &&
                      e.target.value >= custom.start &&
                      setCustom({ ...custom, end: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
            {data.error && (
              <div className="save-error" role="alert">
                <InfoSymbol />
                {data.error}
                <button onClick={() => void data.load()}>Retry</button>
              </div>
            )}
            {source.mode === 'live' && (
              <div className="source-live-note">
                {source.coverage.length
                  ? 'Imported reports from ' + source.coverage.join(', ') + '.'
                  : 'No source reports have been imported for this period.'}{' '}
                Saved connections do not guarantee data access. Unavailable
                values remain blank.
                {source.comparisonLimited &&
                  ' Comparison percentages need complete history for both selected periods.'}
              </div>
            )}
            {source.error && (
              <div className="save-error" role="alert">
                {source.error}
              </div>
            )}
            <div className="view-content" key={page}>
              {page === 'Admin Panel' && (
                <AdminPanel
                  data={data}
                  onSelect={setPost}
                  onNavigate={navigate}
                />
              )}
              {page === 'Overview' && (
                <Overview
                  live={source.mode === 'live'}
                  rows={rows}
                  previous={previous}
                  setPage={navigate}
                  posts={visiblePosts}
                  onSelect={setPost}
                  onMetric={setMetric}
                />
              )}
              {page === 'Performance' && (
                <PerformancePage
                  rows={rows}
                  previous={previous}
                  data={data}
                  range={range}
                  unit={unit}
                />
              )}
              {page === 'Content Intelligence' && (
                <ContentIntelligence
                  data={analyticsData}
                  unit={unit}
                  range={range}
                  onSelect={setPost}
                />
              )}
              {page === 'Audience' && (
                <AudiencePage
                  rows={rows}
                  previous={previous}
                  live={source.mode === 'live'}
                />
              )}
              {page === 'Audience' && source.mode === 'live' && (
                <SourceReports
                  tables={source.tables}
                  group="audience"
                  title="Audience detail"
                />
              )}
              {page === 'Website' && (
                <WebsitePage
                  rows={rows}
                  previous={previous}
                  live={source.mode === 'live'}
                  status={source.sourceStatus.find(
                    (s) => s.channel === 'Website',
                  )}
                  realtime={source.websiteRealtime}
                />
              )}
              {page === 'Website' && source.mode === 'live' && (
                <SourceReports
                  tables={source.tables}
                  group="website"
                  title="Website source reports"
                />
              )}
              {page === 'Google Business' && (
                <>
                  <GoogleReviews
                    range={range}
                    timezone={data.settings.timezone}
                  />
                  <GooglePage rows={rows} live={source.mode === 'live'} />
                </>
              )}
              {page === 'Google Business' && source.mode === 'live' && (
                <SourceReports
                  tables={source.tables}
                  group="google"
                  title="Google Business reports"
                />
              )}
              {page === 'Performance' && source.mode === 'live' && (
                <SourceReports
                  tables={source.tables}
                  group="advertising"
                  title="Advertising performance"
                />
              )}
              {(page === 'Inbox' || page === 'Mentions') && (
                <CommunityPage
                  mode={page === 'Inbox' ? 'inbox' : 'mentions'}
                  range={range}
                  timezone={data.settings.timezone}
                />
              )}
              {page === 'Insights' && (
                <InsightsPage
                  live={source.mode === 'live'}
                  rows={rows}
                  previous={previous}
                  posts={visiblePosts}
                  onNavigate={navigate}
                />
              )}
              {page === 'Comparisons' && (
                <ComparisonsPage
                  range={range}
                  rows={rows}
                  previous={previous}
                />
              )}
              {page === 'Reports' && (
                <ReportsPage data={data} range={range} unit={unit} />
              )}
              {page === 'Connections' && (
                <ConnectionsPage notify={data.notify} />
              )}
              {page === 'Data Sources' && <DataSourcesPage />}
              {page === 'Settings' && <SettingsPage data={data} />}
            </div>
            <footer className="page-footer">
              <span>
                YSABEL SOCIETY <i /> DIGITAL INTELLIGENCE
              </span>
              <span>Private by design. Informed by data.</span>
            </footer>
          </div>
        </main>
        <CommandDialog
          open={command}
          onOpenChange={setCommand}
          title="Ysabel Society command search"
          description="Navigate, search content, or create a report."
        >
          <Command>
            <CommandInput placeholder="Where would you like to go?" />
            <CommandList>
              <CommandEmpty>No matching pages or content.</CommandEmpty>
              <CommandGroup heading="Workspace">
                {names.map((n) => (
                  <CommandItem
                    key={n}
                    value={'Go to ' + n}
                    onSelect={() => navigate(n)}
                  >
                    {n}
                    <ArrowUpRight size={13} />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Content">
                {data.posts.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.title + ' ' + p.platform + ' ' + p.campaign}
                    onSelect={() => {
                      setPost(p);
                      setCommand(false);
                    }}
                  >
                    {p.title}
                    <small>{p.platform}</small>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    setExportOpen(true);
                    setCommand(false);
                  }}
                >
                  Create an export
                </CommandItem>
                {dateOptions.map((d) => (
                  <CommandItem
                    key={d}
                    value={'Date range ' + d}
                    onSelect={() => {
                      setDate(d);
                      setCommand(false);
                    }}
                  >
                    Change date range: {d}
                  </CommandItem>
                ))}
                <CommandItem onSelect={() => navigate('Connections')}>
                  Sync data / Connections
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialog>
        <Dialog open={!!metric} onOpenChange={(v) => !v && setMetric(null)}>
          <DialogContent className="metric-dialog">
            <DialogHeader>
              <DialogTitle>
                {METRICS.find((m) => m.key === metric)?.label}
              </DialogTitle>
              <DialogDescription>
                {METRICS.find((m) => m.key === metric)?.source}
              </DialogDescription>
            </DialogHeader>
            <strong className="metric-detail-value">
              {metric
                ? metricAvailable(rows, metric)
                  ? compact(total(rows, metric as any))
                  : 'Not supplied'
                : ''}
            </strong>
            <p className="muted">
              {METRICS.find((m) => m.key === metric)?.definition}
            </p>
            <div className="availability-row">
              <span>Selected period</span>
              <span>
                {range.start} — {range.end}
              </span>
            </div>
            <div className="availability-row">
              <span>Comparison value</span>
              <span>
                {metric && metricAvailable(previous, metric)
                  ? compact(total(previous, metric as any))
                  : 'No comparison selected'}
              </span>
            </div>
            <p className="footnote">
              {source.mode === 'live'
                ? 'Connected observations only. Unavailable measures stay blank in CSV exports.'
                : 'Deterministic demo observations. All source counts remain accessible in CSV exports.'}
            </p>
          </DialogContent>
        </Dialog>
        <PostDetail
          post={
            post ? (data.posts.find((p) => p.id === post.id) ?? post) : null
          }
          onClose={() => setPost(null)}
          data={data}
        />
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          rows={rows}
          posts={visiblePosts}
          range={range}
          unit={unit}
          mode={source.mode}
        />
        {data.notice && (
          <div className="toast" role="status">
            <Check size={15} />
            {data.notice}
          </div>
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
}
function InfoSymbol() {
  return <span className="pill">NOTE</span>;
}
