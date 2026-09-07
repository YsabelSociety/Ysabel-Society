'use client';
import { useState } from 'react';
import { Upload, ArrowUpRight } from 'lucide-react';
import { parseTikTokStudio } from '@/lib/tiktok-studio';
import { recentSyncWindow } from '@/lib/sync-window';
export function TikTokStudioImport() {
  const [range, setRange] = useState(recentSyncWindow()),
    [files, setFiles] = useState<{ name: string; csv: string }[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  let preview = '';
  if (files.length) {
    try {
      const r = parseTikTokStudio(files, range);
      preview = `${r.daily.length} daily records · ${r.tables.length} audience/detail reports ready`;
    } catch (e) {
      preview =
        e instanceof Error
          ? e.message.replace('INPUT:', '')
          : 'Check the export period.';
    }
  }
  return (
    <details className="surface tiktok-studio-import">
      <summary>TikTok Studio · fill daily history & audience reports</summary>
      <p>
        Automatic sign-in refreshes public video counters and the current
        profile. Studio exports add daily views, profile visits, engagements,
        viewers, follower history and audience breakdowns.
      </p>
      <a
        className="text-link"
        href="https://www.tiktok.com/tiktokstudio/analytics"
        target="_blank"
        rel="noreferrer"
      >
        Open TikTok Studio <ArrowUpRight size={14} />
      </a>
      <p>
        Choose the same period in Overview, Viewers and Followers. Download CSV,
        extract the ZIP files and select their CSV files together. Set the exact
        export dates below; month/day dates need the correct year. Reimports
        update matching dates and retain the automatic connection.
      </p>
      <div className="custom-dates">
        {(['start', 'end'] as const).map((key) => (
          <label key={key}>
            Export {key}
            <input
              type="date"
              value={range[key]}
              onChange={(e) => setRange({ ...range, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="secondary file-picker">
        <Upload size={15} /> Choose TikTok Studio CSV files
        <input
          type="file"
          multiple
          accept=".csv,text/csv"
          onChange={(e) => {
            const selected = [...(e.target.files || [])];
            if (
              selected.length > 12 ||
              selected.reduce((n, f) => n + f.size, 0) > 3000000
            ) {
              setMessage('Choose up to 12 CSV files, under 3 MB together.');
              return;
            }
            void Promise.all(
              selected.map(async (f) => ({
                name: f.name,
                csv: await f.text(),
              })),
            )
              .then((f) => {
                setFiles(f);
                setMessage('');
              })
              .catch(() => setMessage('The files could not be read.'));
          }}
        />
      </label>
      {files.length > 0 && (
        <>
          <p>{files.map((f) => f.name).join(' · ')}</p>
          <p role="status">{preview}</p>
          <button
            className="primary"
            disabled={busy || !preview.endsWith('ready')}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                const r = await fetch('/marketingdata/api/tiktok-studio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files, range }),
                  }),
                  d = (await r.json()) as {
                    error?: string;
                    days: number;
                    reports: number;
                  };
                if (!r.ok)
                  throw new Error(d.error || 'TikTok Studio import failed.');
                setMessage(
                  `Imported ${d.days} daily records and ${d.reports} reports. Studio reports are current through ${range.end}.`,
                );
                setFiles([]);
                window.dispatchEvent(new Event('ysabel:sources-updated'));
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Import failed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? 'Importing Studio history…'
              : 'Import TikTok Studio reports'}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
