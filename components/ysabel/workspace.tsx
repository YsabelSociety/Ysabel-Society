'use client';
import { BrandLogo } from './brand-logo';
import { useScrollBudget } from './use-scroll-budget';
import { ChartBoundary } from './social-performance';
import { Activity, memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ChevronDown,
  Menu,
  LogOut,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceIntro, useWorkspaceIntro } from './workspace-intro';
import { SyncSettings } from './sync-details';
import { AdminGate } from './admin-gate';
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
  ComparisonsPage,
  InsightsPage,
} from './analytics-pages';
import { ReportsPage, ExportDialog } from './reports';
import { ConnectionsPage, DataSourcesPage, SettingsPage } from './system-pages';
import { AdminPanel } from './admin-panel';
import { useInboxSync } from './use-inbox-sync';
import { useAutoRefresh } from './use-auto-refresh';
import { calendarDate } from '@/lib/sync-window';
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
const StableOverview = memo(Overview);
const StablePerformance = memo(PerformancePage);
const names = groups.flatMap((g) => g.items.map((i) => String(i[0])));
const dateOptions = [
  'Today',
  'Yesterday',
  'Last 3 Days',
  'Last 7 Days',
  'Previous 7 Days',
  'This Week',
  'Previous Week',
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
function MobileCategoryMenu({ page }: { page: string }) {
  const { openMobile, toggleSidebar } = useSidebar();
  const label = page === 'Overview' ? 'Marketing Data' : page;
  return (
    <button
      type="button"
      className="mobile-category-menu"
      onClick={toggleSidebar}
      aria-label={`Categories: ${label}`}
      aria-expanded={openMobile}
      aria-haspopup="dialog"
      title={`Browse categories · ${label}`}
    >
      <Menu size={16} aria-hidden="true" />
      <span>{label}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </button>
  );
}

export default function Workspace({
  initialPage = 'Overview',
}: {
  initialPage?: string;
}) {
  useScrollBudget();
  const data = useWorkspace();
  const syncState = useAutoRefresh(data.ready, data.settings.timezone);
  useInboxSync(data.ready);
  const unit = 'Ysabel Society';
  const [liveClock, setLiveClock] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [today, setToday] = useState(() => calendarDate('Europe/Tirane'));
  const liveInitialized = useRef(false);
  const [page, setPage] = useState(
      names.includes(initialPage) ? initialPage : 'Overview',
    ),
    [date, setDate] = useState('This Month'),
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
    () => dateRange(date, custom, today),
    [date, custom, today],
  );
  useEffect(() => {
    const update = () => setToday(calendarDate(data.settings.timezone));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [data.settings.timezone]);
  const onLive = useCallback(() => {
    setLiveClock(true);
    if (!liveInitialized.current) {
      liveInitialized.current = true;
      setDate('This Month');
    }
  }, []);
  const source = useSourceAnalytics(unit, range, comparison, onLive),
    rows = source.rows,
    previous = source.previous;
  const analyticsData = useMemo(() =>
    source.mode === 'live' ? { ...data, posts: source.posts } : data,
    [source.mode, source.posts, data.posts, data.settings, data.annotations, data.reports, data.user, data.ready, data.error, data.busy, data.notice]);
  useEffect(() => {
    const showHistory = (event: Event) => {
      const value = (event as CustomEvent<Range>).detail;
      if (
        !value ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.start) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.end) ||
        value.start > value.end
      )
        return;
      setCustom(value);
      setDate('Custom Range');
      setComparison('No Comparison');
    };
    window.addEventListener('ysabel:history-range', showHistory);
    return () =>
      window.removeEventListener('ysabel:history-range', showHistory);
  }, []);
  const visiblePosts = useMemo(() => analyticsData.posts.filter(
    (p) => p.date >= range.start && p.date <= range.end,
  ), [analyticsData.posts, range]);
  const navigate = useCallback((name: string) => {
    if (!names.includes(name)) return;
    if (name === 'Overview') setDate('This Month');
    setMobileMenuOpen(false);
    setPage(name);
    setCommand(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    const read = () => {
      let name =
        location.pathname.replace(/\/$/, '') === '/marketingdata/admin'
          ? 'Admin Panel'
          : location.pathname.replace(/\/$/, '') ===
              '/marketingdata/connections'
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
  const currentMetricsRef = useRef({ mode: source.mode, unit, range, rows });
  currentMetricsRef.current = { mode: source.mode, unit, range, rows };
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
        mode: currentMetricsRef.current.mode,
        unit: currentMetricsRef.current.unit,
        range: currentMetricsRef.current.range,
        metrics: METRICS.map((m) => ({
          name: m.label,
          value: metricAvailable(currentMetricsRef.current.rows, m.key)
            ? total(currentMetricsRef.current.rows, m.key)
            : null,
          definition: m.definition,
        })),
      }),
    });
    register({
      name: 'read_ysabel_history',
      title: 'Read imported history coverage',
      description:
        'Read saved history-import progress and earliest and latest available records for the connected accounts.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const r = await fetch('/marketingdata/api/history', {
          cache: 'no-store',
        });
        if (!r.ok) throw new Error('History status unavailable.');
        return r.json();
      },
    });
    register({
      name: 'read_ysabel_connections',
      title: 'Read connection and refresh status',
      description:
        'Read connected account labels, granted permission names, latest import times and report coverage. Does not return credentials or tokens.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const response = await fetch('/marketingdata/api/connectors', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Connection status unavailable.');
        const result: any = await response.json();
        return {
          groups: result.groups.map((g: any) => ({
            id: g.id,
            configured: g.configured,
            authorized: g.authorized,
            grantedScopes: g.grantedScopes,
          })),
          links: result.links.map((l: any) => ({
            source: l.source,
            label: l.label,
            autoSync: l.autoSync,
            snapshot: l.snapshot,
          })),
        };
      },
    });
    register({
      name: 'import_ysabel_history_batch',
      title: 'Import an available-history batch',
      description:
        'Start or continue a saved history import for an already connected account. Imports one bounded batch and saves progress; call again until done. Does not change permissions or connect new accounts.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['instagram', 'facebook', 'tiktok', 'ga4', 'gbp'],
          },
        },
        required: ['source'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: any) => {
        if (
          !['instagram', 'facebook', 'tiktok', 'ga4', 'gbp'].includes(
            input?.source,
          )
        )
          throw new Error('Choose a connected reporting source.');
        const call = async (op: string) => {
          const r = await fetch('/marketingdata/api/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source: input.source, op }),
            }),
            body: any = await r.json();
          if (!r.ok) throw new Error(body.error || 'Import unavailable.');
          return body;
        };
        const job = await call('start');
        const result = job.phase === 'done' ? job : await call('step');
        window.dispatchEvent(new Event('ysabel:sources-updated'));
        return result;
      },
    });
    return () => lifecycle.abort();
  }, []);
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
  const [communityLoad, setCommunityLoad] = useState({
    kind: '',
    ready: false,
    error: '',
  });
  const communityKind =
    page === 'Google Business'
      ? 'review'
      : page === 'Inbox'
        ? 'message'
        : page === 'Mentions'
          ? 'mention'
          : '';
  const communityReady =
    !communityKind ||
    (communityLoad.kind === communityKind && communityLoad.ready);
  const initialError =
    (!data.ready ? data.error : '') ||
    (!source.ready ? source.error : '') ||
    (communityKind === communityLoad.kind ? communityLoad.error : '');
  const initialReady =
    data.ready && source.ready && communityReady && !initialError;
  const initialStages = [
    data.ready,
    source.ready,
    ...(communityKind ? [communityReady] : []),
  ];
  const initialProgress =
    initialStages.filter(Boolean).length / initialStages.length;
  const syncBusy = syncState.running || source.refreshing;
  const refreshingScene = syncState.foreground;
  const syncProgress = syncState.job?.tasks.length
    ? syncState.job.completed / syncState.job.tasks.length
    : 0;
  const intro = useWorkspaceIntro(!!initialReady);
  const introProgress = refreshingScene ? syncProgress : initialProgress;
  const showLoadingScene = intro.visible || refreshingScene;
  const retryInitialLoad = () => {
    void data.load();
    window.dispatchEvent(new Event('ysabel:sources-updated'));
    window.dispatchEvent(new Event('ysabel:community-updated'));
  };
  return (
    <>
      {showLoadingScene && (
        <WorkspaceIntro
          leaving={
            (intro.leaving && !refreshingScene) || syncState.foregroundLeaving
          }
          progress={introProgress}
          complete={
            !!initialReady &&
            (!refreshingScene || syncState.foregroundLeaving)
          }
          refreshing={refreshingScene && !syncState.foregroundLeaving}
          error={initialError}
          onRetry={retryInitialLoad}
        />
      )}
      <div
        inert={showLoadingScene}
        aria-hidden={showLoadingScene || undefined}
      >
        <TooltipProvider>
          <SidebarProvider
            className="workspace-shell"
            data-section={page}
            mobileBreakpoint={640}
            open={true}
            openMobile={mobileMenuOpen}
            onOpenMobileChange={setMobileMenuOpen}
          >
            <Sidebar
              className="ys-sidebar"
              side="left"
              aria-label="Workspace navigation"
            >
              <SidebarHeader>
                <button
                  onClick={() => navigate('Overview')}
                  className="workspace-brand-button"
                  type="button"
                  aria-label="Ysabel Society overview"
                >
                  <BrandLogo />
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
                            type="button"
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
                <button
                  className="profile"
                  onClick={() => navigate('Admin Panel')}
                >
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
                  <MobileCategoryMenu page={page} />
                  <span className="workspace-location">{page}</span>
                </div>
                <div className="top-actions">
                  <button
                    className="secondary sync-now"
                    disabled={!data.ready || syncBusy}
                    onClick={() => void syncState.sync()}
                    aria-label="Sync all connected platforms now"
                    aria-busy={syncBusy}
                  >
                    <span className="header-sync-icon" aria-hidden="true">
                      <RefreshCw size={16} />
                    </span>
                    <span className="header-desktop-label">
                      {syncBusy ? 'Syncing…' : 'Sync now'}
                    </span>
                    <span className="header-mobile-label" aria-hidden="true">
                      {syncBusy ? 'Syncing' : 'Sync'}
                    </span>
                  </button>
                  <button
                    className="admin-launch header-sign-out"
                    onClick={async () => {
                      const response = await fetch(
                        '/marketingdata/api/session',
                        {
                          method: 'DELETE',
                        },
                      );
                      if (response.ok) location.assign('/marketingdata/login');
                    }}
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut
                      className="header-mobile-label"
                      size={18}
                      aria-hidden="true"
                    />
                    <span className="header-desktop-label">Sign out</span>
                  </button>
                  <button
                    className="admin-launch header-admin"
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
                    className="avatar small header-admin"
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
                        {new Date(
                          range.start + 'T12:00:00Z',
                        ).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
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
                      {date !== 'This Month' && (
                        <button
                          className="clear-filters"
                          onClick={() => {
                            setDate('This Month');
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
                {source.error && (
                  <div className="save-error" role="alert">
                    {source.error}
                  </div>
                )}
                <div className="view-content">
                  {page === 'Admin Panel' && (
                    <AdminGate title="Admin panel">
                      <AdminPanel
                        data={data}
                        onSelect={setPost}
                        onNavigate={navigate}
                        syncSettings={<SyncSettings {...syncState} />}
                      />
                    </AdminGate>
                  )}
                  <Activity mode={page === 'Overview' ? 'visible' : 'hidden'}><StableOverview
                      sceneEnabled={!intro.visible}
                      live={source.mode === 'live'}
                      range={range}
                      rows={rows}
                      previous={previous}
                      setPage={navigate}
                      posts={visiblePosts}
                      monthlyPosts={source.mode === 'live' ? source.monthlyPosts : data.posts}
                      onSelect={setPost}
                      onMetric={setMetric}
                    /></Activity>
                  <Activity mode={page === 'Performance' ? 'visible' : 'hidden'}><ChartBoundary><StablePerformance
                      rows={rows}
                      previous={previous}
                      data={analyticsData}
                      loading={source.loading}
                      range={range}
                      unit={unit}
                      live={source.mode === 'live'}
                      websiteConnection={source.sourceStatus.find(
                        (s) => s.channel === 'Website',
                      )}
                      websiteRealtime={source.websiteRealtime}
                      tables={source.tables}
                    /></ChartBoundary></Activity>
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
                      range={range}
                      rows={rows}
                      previous={previous}
                      live={source.mode === 'live'}
                      tables={source.tables}
                      loading={source.loading}
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
                        onLoadState={setCommunityLoad}
                      >
                        {source.mode === 'live' && (
                          <SourceReports
                            tables={source.tables}
                            group="google"
                            title="Google Business reports"
                          />
                        )}
                      </GoogleReviews>
                    </>
                  )}
                  {(page === 'Inbox' || page === 'Mentions') && (
                    <CommunityPage
                      mode={page === 'Inbox' ? 'inbox' : 'mentions'}
                      range={range}
                      timezone={data.settings.timezone}
                      onLoadState={setCommunityLoad}
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
                    <AdminGate title="Connections">
                      <ConnectionsPage notify={data.notify} />
                    </AdminGate>
                  )}
                  {page === 'Data Sources' && (
                    <AdminGate title="Data Sources">
                      <DataSourcesPage />
                    </AdminGate>
                  )}
                  {page === 'Settings' && (
                    <AdminGate title="Settings">
                      <SettingsPage data={data} />
                    </AdminGate>
                  )}
                </div>
                <footer className="page-footer">
                  <span>
                    YSABEL SOCIETY <i /> DIGITAL INTELLIGENCE
                  </span>
                  <span>
                    App developed and created by{' '}
                    <a
                      href="https://arberhalili.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      arberhalili.com
                    </a>
                  </span>
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
      </div>
    </>
  );
}
function InfoSymbol() {
  return <span className="pill">NOTE</span>;
}
