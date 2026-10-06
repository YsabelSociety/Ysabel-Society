'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Images,
  PenLine,
  Plug,
  Database,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { SettingsPage } from './system-pages';
import { type WorkspaceData } from './use-workspace';
import { BRAND_NAME, type Post } from '@/lib/analytics';

type ConnectionSummary = {
  id: string;
  name: string;
  channel: string;
  kind: string;
  status: string;
  lastSync: string | null;
  autoSync?: boolean;
  snapshot?: {
    method?: string;
    observedAt?: string;
    scope?: string;
    period?: { start: string; end: string };
    checks?: { label: string; status: string; detail: string }[];
  };
};
type SourceState = {
  connections: ConnectionSummary[];
  runs: {
    channel: string;
    status: string;
    started_at: string;
    message: string | null;
  }[];
};
const sections = [
  { name: 'Dashboard', theme: 'Admin Panel', icon: ShieldCheck },

  { name: 'Preferences', theme: 'Settings', icon: Settings },
];

export function AdminPanel({
  data,
  onSelect,
  onNavigate,
  syncSettings,
}: {
  data: WorkspaceData;
  onSelect: (post: Post) => void;
  onNavigate: (page: string) => void;
  syncSettings?: ReactNode;
}) {
  const [tab, setTab] = useState('Dashboard');
  return (
    <div className="admin-panel">
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="page-tabs admin-tabs" aria-label="Admin sections">
          {sections.map(({ name, theme, icon: Icon }) => (
            <TabsTrigger key={name} value={name} data-nav={theme}>
              <Icon size={16} />
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Dashboard">
          <AdminDashboard
            data={data}
            onSelect={onSelect}
            onNavigate={onNavigate}
            onManage={(section) => section === 'Connections' ? onNavigate('Connections') : setTab(section)}
          />
        </TabsContent>
        <TabsContent value="Preferences">
          <SettingsPage data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminDashboard({
  data,
  onSelect,
  onNavigate,
  onManage,
}: {
  data: WorkspaceData;
  onSelect: (post: Post) => void;
  onNavigate: (page: string) => void;
  onManage: (tab: string) => void;
}) {
  const [sources, setSources] = useState<SourceState | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    window.addEventListener('ysabel:sources-updated', refresh);
    return () => window.removeEventListener('ysabel:sources-updated', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/marketingdata/api/connections', { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as SourceState & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error || 'Could not load source status.');
        if (!controller.signal.aborted) {
          setSources(result);
          setError('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load source status.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const stats = [
    {
      label: 'Platform connections',
      value:
        sources?.connections.filter((c) => c.status === 'Connected').length ??
        '—',
      icon: Plug,
      theme: 'Connections',
      action: () => onManage('Connections'),
    },
    {
      label: 'Saved reports',
      value: data.reports.length,
      icon: FileText,
      theme: 'Reports',
      action: () => onNavigate('Reports'),
    },
  ];
  return (
    <div className="admin-dashboard">
      <section className="admin-account surface">
        <span className="admin-seal">
          <ShieldCheck size={25} />
        </span>
        <div>
          <h2>{BRAND_NAME}</h2>
          <p>
            {data.ready
              ? data.user.email || data.user.name
              : 'Opening your saved workspace…'}
          </p>
        </div>
        <span className="admin-account-status">
          {data.ready ? 'Private workspace' : 'Connecting…'}
        </span>
      </section>
      <div className="admin-stats">
        {stats.map(({ label, value, icon: Icon, theme, action }) => (
          <button
            className="admin-stat"
            data-nav={theme}
            key={label}
            onClick={action}
          >
            <span>
              <Icon size={18} />
              {label}
              <ArrowUpRight size={15} />
            </span>
            <strong>{data.ready ? value : '—'}</strong>
            <small>All dates</small>
          </button>
        ))}
      </div>
      <div className="admin-columns">
        <section className="surface admin-section">
          <h2>Community monitoring</h2>
          <p>
            Follow unanswered conversations, priority enquiries from Instagram and Facebook.
          </p>
          <div className="admin-section-foot">
            <button className="secondary" onClick={() => onNavigate('Inbox')}>
              Open inbox <ArrowUpRight size={15} />
            </button>
            <button
              className="secondary"
              onClick={() => onNavigate('Google Business')}
            >
              Guest reviews <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <section className="surface admin-section"><h2>Daily data management</h2><p>Refresh sources, check imports, and manage account access in one place.</p><button className="secondary" onClick={()=>onNavigate('Data Center')}><Database size={15}/>Open Data Center<ArrowUpRight size={15}/></button></section>
      </div>
      <div className="admin-bottom">
        <button
          className="surface admin-shortcut"
          data-nav="Settings"
          onClick={() => onManage('Preferences')}
        >
          <Settings size={23} />
          <span>
            <strong>Workspace preferences</strong>
            <small>Review your workspace and reporting time zone.</small>
          </span>
          <ArrowUpRight size={18} />
        </button>
        <button
          className="surface admin-shortcut"
          data-nav="Data Sources"
          onClick={() => onNavigate('Data Sources')}
        >
          <FileText size={23} />
          <span>
            <strong>Data definitions</strong>
            <small>Review metric definitions and source availability.</small>
          </span>
          <ArrowUpRight size={18} />
        </button>
      </div>
    </div>
  );
}
