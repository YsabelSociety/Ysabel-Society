'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Images,
  PenLine,
  Plug,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ConnectionsPage, SettingsPage } from './system-pages';
import { type WorkspaceData } from './use-workspace';
import { BRAND_NAME, type Post } from '@/lib/analytics';

type ConnectionSummary = {
  id: string;
  name: string;
  channel: string;
  kind: string;
  status: string;
  lastSync: string | null;
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

  { name: 'Connections', theme: 'Connections', icon: Plug },
  { name: 'Preferences', theme: 'Settings', icon: Settings },
];

export function AdminPanel({
  data,
  onSelect,
  onNavigate,
}: {
  data: WorkspaceData;
  onSelect: (post: Post) => void;
  onNavigate: (page: string) => void;
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
            onManage={setTab}
          />
        </TabsContent>
        <TabsContent value="Connections">
          <ConnectionsPage notify={data.notify} />
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
            Follow unanswered conversations, priority enquiries and captured
            mentions.
          </p>
          <div className="admin-section-foot">
            <button className="secondary" onClick={() => onNavigate('Inbox')}>
              Open inbox <ArrowUpRight size={15} />
            </button>
            <button
              className="secondary"
              onClick={() => onNavigate('Mentions')}
            >
              Mentions <ArrowUpRight size={15} />
            </button>
            <button
              className="secondary"
              onClick={() => onNavigate('Google Business')}
            >
              Guest reviews <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <section className="surface admin-section">
          <div className="section-head">
            <h2>Platform connections</h2>
            <button
              className="icon-button"
              disabled={loading}
              onClick={refresh}
              aria-label="Refresh connection status"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {error ? (
            <div className="save-error" role="alert">
              {error}
              <button onClick={refresh}>Retry</button>
            </div>
          ) : sources ? (
            sources.connections
              .filter((c) => c.kind !== 'Future advertising')
              .map((connection) => (
                <button
                  className="admin-source-row"
                  data-platform={connection.channel}
                  key={connection.id}
                  onClick={() => onManage('Connections')}
                >
                  <span className="admin-source-dot" />
                  <span>
                    <strong>{connection.name}</strong>
                    <small>
                      {connection.lastSync
                        ? 'Synced ' +
                          new Date(connection.lastSync).toLocaleDateString()
                        : 'No live sync yet'}
                    </small>
                  </span>
                  <span className="status-chip">{connection.status}</span>
                </button>
              ))
          ) : (
            <p className="admin-empty">Loading connection status…</p>
          )}
          <div className="admin-section-foot">
            <button
              className="secondary"
              onClick={() => onManage('Connections')}
            >
              <Plug size={15} />
              Manage connections
            </button>
          </div>
        </section>
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
