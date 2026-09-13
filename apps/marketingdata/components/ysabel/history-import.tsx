'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Pause, Database } from 'lucide-react';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import type { HistoryProgress } from '@/lib/history-progress';
type Status = {
  jobs: HistoryProgress[];
  connected: { source: string; label: string }[];
  content: {
    channel: string;
    earliest: string;
    latest: string;
    posts: number;
  }[];
  daily: { channel: string; earliest: string; latest: string; days: number }[];
};
const empty: Status = { jobs: [], connected: [], content: [], daily: [] };
export function HistoryImport({ source }: { source?: string }) {
  const [status, setStatus] = useState<Status>(empty),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    stop = useRef(false);
  async function refresh() {
    const r = await fetch('/marketingdata/api/history', { cache: 'no-store' });
    if (!r.ok) throw new Error('History status could not load.');
    const s = (await r.json()) as Status;
    setStatus(s);
    return s;
  }
  useEffect(() => {
    void refresh().catch(() => {});
    return () => {
      stop.current = true;
    };
  }, []);
  async function run(restart = false) {
    stop.current = false;
    setError('');
    setOpen(true);
    setBusy('Preparing');
    try {
      const s = await refresh();
      for (const link of s.connected.filter(
        (c) => !source || c.source === source,
      )) {
        if (stop.current) break;
        setBusy(SOURCE_CHANNELS[link.source]);
        try {
          const call = async (op: string) => {
            const r = await fetch('/marketingdata/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op, source: link.source, restart }),
              }),
              body = (await r.json()) as HistoryProgress & { error?: string };
            if (!r.ok) throw new Error(body.error || 'Import needs attention.');
            return body;
          };
          let job = await call('start');
          while (job.phase !== 'done' && !stop.current) {
            job = await call('step');
            await refresh();
            window.dispatchEvent(new Event('ysabel:sources-updated'));
          }
          await refresh();
        } catch (e) {
          setError((previous) =>
            [
              previous,
              SOURCE_CHANNELS[link.source] +
                ': ' +
                (e instanceof Error ? e.message : 'Import needs attention.'),
            ]
              .filter(Boolean)
              .join(' '),
          );
          await refresh();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import needs attention.');
    } finally {
      setBusy('');
      window.dispatchEvent(new Event('ysabel:sources-updated'));
    }
  }
  const jobs = status.jobs.filter((j) => !source || j.source === source),
    links = status.connected.filter((l) => !source || l.source === source),
    done = jobs.length > 0 && jobs.every((j) => j.phase === 'done');
  return (
    <section className="surface history-import-panel">
      <div className="section-head">
        <div>
          <h2>
            <Database size={18} /> Available history
          </h2>
          <p>
            Retrieve older posts and available daily reports. Saved progress
            survives closing the page.
          </p>
        </div>
        <div className="inline-controls">
          {busy ? (
            <button
              className="secondary"
              onClick={() => {
                stop.current = true;
              }}
            >
              <Pause size={15} /> Pause after this batch
            </button>
          ) : (
            <button
              className="secondary"
              disabled={!links.length}
              onClick={() => void run(done)}
            >
              <RefreshCw size={15} />{' '}
              {done
                ? 'Refresh available history'
                : jobs.length
                  ? 'Resume history import'
                  : 'Import available history'}
            </button>
          )}
          <button
            className="text-link"
            disabled={!status.content.length && !status.daily.length}
            onClick={() => {
              const starts = [...status.content, ...status.daily]
                .map((r) => r.earliest)
                .filter(Boolean)
                .sort();
              if (starts[0])
                window.dispatchEvent(
                  new CustomEvent('ysabel:history-range', {
                    detail: {
                      start: starts[0],
                      end: new Date().toISOString().slice(0, 10),
                    },
                  }),
                );
            }}
          >
            View all imported dates
          </button>
          <button className="text-link" onClick={() => setOpen(!open)}>
            {open ? 'Hide coverage' : 'View coverage'}
          </button>
        </div>
      </div>
      {busy && (
        <p role="status">
          Importing {busy}… Keep this page open to continue automatically.
        </p>
      )}
      {error && (
        <p role="alert" className="history-error">
          {error}
        </p>
      )}
      {open && (
        <div className="history-source-grid">
          {links.map((l) => {
            const job = jobs.find((j) => j.source === l.source),
              posts = status.content.find(
                (c) => c.channel === SOURCE_CHANNELS[l.source],
              ),
              daily = status.daily.find(
                (c) => c.channel === SOURCE_CHANNELS[l.source],
              );
            return (
              <div key={l.source}>
                <h3>{SOURCE_CHANNELS[l.source]}</h3>
                <p>
                  {job?.error ||
                    job?.message ||
                    'Ready to import older records.'}
                </p>
                {posts && (
                  <p>
                    <strong>{posts.posts.toLocaleString()} saved posts</strong>{' '}
                    · {posts.earliest} – {posts.latest}
                  </p>
                )}
                {daily && (
                  <p>
                    Recorded daily observations: {daily.earliest} –{' '}
                    {daily.latest}. Individual metrics may cover fewer dates.
                  </p>
                )}
                <small>{job?.note}</small>
                {job && (
                  <small>
                    {job.batches} batches completed · {job.gaps} report requests
                    unavailable
                  </small>
                )}
                {job?.checks && (
                  <details>
                    <summary>Latest report checks</summary>
                    {job.checks.map((c, i) => (
                      <p key={c.key + i}>
                        {c.label}: {c.status} · {c.detail}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
          {!links.length && (
            <p>Connect an account to import history automatically.</p>
          )}
        </div>
      )}
      {open && (
        <p className="metric-definition">
          Unavailable or expired records are never invented. Use the connection
          centre to import older provider exports or retry a specific date
          range. After importing older posts, change the workspace dates to see
          them.
        </p>
      )}
    </section>
  );
}
