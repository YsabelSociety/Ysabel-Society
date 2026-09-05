'use client';
import { useState, useEffect } from 'react';
import {
  Plug,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Database,
  Plus,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { METRICS, CHANNELS } from '@/lib/analytics';
import { type WorkspaceData } from './use-workspace';
import { PROVIDER_CONFIG } from '@/lib/provider-metadata';
export function ConnectionsPage({ notify }: { notify: (s: string) => void }) {
  const [connections, setConnections] = useState<any[]>(
      PROVIDER_CONFIG.map((p) => ({
        ...p,
        status: 'Disconnected',
        configured: false,
        supported: ['ga4', 'gbp'].includes(p.id),
        lastSync: null,
        missing: p.required,
      })),
    ),
    [runs, setRuns] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [busy, setBusy] = useState(''),
    [disconnect, setDisconnect] = useState<any>(null),
    [error, setError] = useState('');
  async function load() {
    try {
      const r = await fetch('/api/connections');
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConnections(d.connections);
      setRuns(d.runs);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read connections.');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(id: string, action: string) {
    setBusy(id);
    try {
      const r = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify(
        action === 'disconnect'
          ? 'Connection disabled.'
          : d.records + ' daily records synchronized.',
      );
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'The sync could not complete.');
      await load();
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="view-enter">
      <div className="connection-banner">
        <ShieldCheck size={21} />
        <div>
          <strong>Your sources. Privately connected.</strong>
          <p>
            Account credentials stay on the server. Demo data remains available
            before accounts are authorized.
          </p>
        </div>
      </div>
      {error && (
        <div className="save-error">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      <div className="connections-grid">
        {connections.map((c, i) => (
          <section className="surface connection-card" key={c.id}>
            <div className="connection-top">
              <span className="connection-mark">
                {['◎', 'f', '♪', '↗', 'G', 'm', '♪', 'A'][i]}
              </span>
              <span
                className={
                  'status-chip ' + (c.status === 'Connected' ? 'positive' : '')
                }
              >
                {busy === c.id ? 'Syncing' : c.status}
              </span>
            </div>
            <h2>{c.name}</h2>
            <p>{c.kind}</p>
            <div className="connection-detail">
              <span>Account</span>
              <strong>
                {c.configured ? 'Configured securely' : 'No account authorized'}
              </strong>
              <span>Last sync</span>
              <strong>
                {c.lastSync
                  ? new Date(c.lastSync).toLocaleString()
                  : 'No live data yet'}
              </strong>
              <span>Availability</span>
              <strong>
                {c.supported
                  ? 'Server adapter ready'
                  : c.kind === 'Future advertising'
                    ? 'Architecture reserved'
                    : 'Approval & adapter validation required'}
              </strong>
            </div>
            <div className="connection-actions">
              <button className="secondary" onClick={() => setSelected(c)}>
                {c.configured ? 'Connection details' : 'Set up connection'}
                <ArrowUpRight size={13} />
              </button>
              {c.configured && c.supported && (
                <button
                  className="icon-button"
                  aria-label={'Sync ' + c.name}
                  disabled={!!busy}
                  onClick={() => void action(c.id, 'sync')}
                >
                  <RefreshCw size={15} />
                </button>
              )}
              {c.status === 'Connected' && (
                <button className="text-link" onClick={() => setDisconnect(c)}>
                  Disconnect
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <section className="surface padded">
        <div className="section-head">
          <h2>Synchronization history</h2>
          <button className="text-link" onClick={() => void load()}>
            Refresh <RefreshCw size={13} />
          </button>
        </div>
        {runs.length ? (
          runs.map((r, i) => (
            <div className="sync-run" key={i}>
              <strong>{r.channel}</strong>
              <span>{r.status}</span>
              <span>{new Date(r.started_at).toLocaleString()}</span>
              <small>{r.message}</small>
            </div>
          ))
        ) : (
          <p className="footnote">
            No live synchronization has run. Demo observations are fixed through
            5 September 2026.
          </p>
        )}
      </section>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="setup-dialog">
          <DialogHeader>
            <DialogTitle>{selected?.name} connection</DialogTitle>
            <DialogDescription>
              Connect the account through a registered, approved platform
              application.
            </DialogDescription>
          </DialogHeader>
          <p className="muted">
            Your account administrator must configure the following securely on
            the server. Do not paste access tokens into this workspace.
          </p>
          <div className="setup-keys">
            {selected?.required.map((k: string) => (
              <div key={k}>
                <span>{k.replaceAll('_', ' ').toLowerCase()}</span>
                <span>
                  {selected.missing?.includes(k) ? 'Required' : 'Configured'}
                </span>
              </div>
            ))}
          </div>
          <p className="footnote">
            Permissions: {selected?.permissions}.{' '}
            {selected?.supported
              ? 'After configuration, Sync imports the last 30 complete days into historical storage.'
              : 'This connector needs platform approval and integration validation before live use. It is not active.'}
          </p>
          <a
            className="secondary"
            href={selected?.documentation}
            target="_blank"
            rel="noreferrer"
          >
            Official connection guide <ExternalLink size={13} />
          </a>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!disconnect}
        onOpenChange={(v) => !v && setDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnect?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stop using this source for live analytics. Historical records stay
              stored. Revoke account authorization from the platform separately
              if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void action(disconnect.id, 'disconnect')}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
export function DataSourcesPage() {
  return (
    <div className="view-enter">
      <section className="source-intro surface padded">
        <Database size={28} />
        <div>
          <h2>Every metric has a definition.</h2>
          <p>
            This workspace opens in Demo Data. The sample series is
            deterministic, anchored to 5 September 2026. It never represents
            actual Ysabel Society business results.
          </p>
        </div>
      </section>
      <div className="definition-grid">
        {METRICS.map((m) => (
          <section key={m.key} className="surface padded">
            <span className="eyebrow">{m.source}</span>
            <h2>{m.label}</h2>
            <p>{m.definition}</p>
            <span className="status-chip">Demo available</span>
          </section>
        ))}
      </div>
      <section className="surface padded">
        <h2>Attribution & availability</h2>
        {[
          [
            'Direct attribution',
            'Requires reliable UTM or event identifiers. None supplied in demo.',
          ],
          [
            'Assisted relationship',
            'Requires a documented observation window and matching evidence.',
          ],
          [
            'Correlation',
            'An observed relationship, without a claim of causation.',
          ],
          ['Unknown', 'Reservations, visits and revenue are not attributed.'],
          [
            'Organic & paid',
            'Demo content is organic. Advertising connectors remain separate.',
          ],
          [
            'Freshness',
            'Demo snapshot: 5 Sep 2026. Live-source timestamps appear in Connections.',
          ],
          [
            'Performance score',
            '35% views, 30% engagement rate, 15% saves, 20% shares. Weighted against the published sample baseline.',
          ],
          [
            'Sample photography',
            'Licensed Unsplash images, unrelated to Ysabel Society or its team.',
          ],
        ].map(([a, b]) => (
          <div className="definition-row" key={a}>
            <strong>{a}</strong>
            <p>{b}</p>
          </div>
        ))}
        <a
          href="/media/credits.json"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          Photography credits <ArrowUpRight size={13} />
        </a>
      </section>
    </div>
  );
}
export function SettingsPage({ data }: { data: WorkspaceData }) {
  const [settings, setSettings] = useState(data.settings);
  useEffect(() => setSettings(data.settings), [data.settings]);
  return (
    <div className="settings-layout">
      <section className="surface padded">
        <div className="eyebrow">WORKSPACE</div>
        <h2>Ysabel Society, by design.</h2>
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            void data.saveSettings(settings).catch(() => {});
          }}
        >
          <label>
            Workspace name
            <input
              value="Ysabel Society"
              readOnly
              aria-label="Workspace name"
            />
          </label>
          <label>
            Planning time zone
            <input
              value={settings.timezone}
              onChange={(e) =>
                setSettings({ ...settings, timezone: e.target.value })
              }
              required
            />
          </label>
          <p className="muted">
            Your analytics, content and reports belong to one workspace: Ysabel
            Society.
          </p>
          <button className="primary" disabled={data.busy || !data.ready}>
            Save workspace
          </button>
        </form>
      </section>
      <aside>
        <section className="surface padded">
          <ShieldCheck size={23} />
          <h2 className="mt-4">Private workspace</h2>
          <p className="muted panel-description">
            Access is restricted to the Site owner. User access is enforced
            before this application opens.
          </p>
          <div className="availability-row">
            <span>Signed in</span>
            <strong>{data.user.email || data.user.name}</strong>
          </div>
          <div className="availability-row">
            <span>Data mode</span>
            <span>Demo / Preview</span>
          </div>
          <div className="availability-row">
            <span>Content storage</span>
            <span>{data.ready ? 'Connected' : 'Connecting'}</span>
          </div>
        </section>
        <section className="surface padded">
          <h2>Workspace palette</h2>
          <p className="muted panel-description">
            Silver surfaces, translucent layers and a subtle signature gradient
            for each section.
          </p>
          <div className="brand-swatches">
            {['#E8EBEF', '#F7F8FA', '#677E9E', '#B9ADC5'].map((c) => (
              <div key={c}>
                <i style={{ background: c }} />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
