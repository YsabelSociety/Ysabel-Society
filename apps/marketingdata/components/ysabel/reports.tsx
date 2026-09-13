'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  FileText,
  BookmarkPlus,
  CheckCircle2,
  LoaderCircle,
  X,
} from 'lucide-react';
import { BrandLogo } from './brand-logo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Picker } from './controls';
import { DataIcon } from './data-icons';
import { type WorkspaceData, type SavedReport } from './use-workspace';
import {
  CHANNELS,
  dateRange,
  iso,
  type Range,
  type Daily,
  type Post,
} from '@/lib/analytics';
import { REPORT_SECTIONS, downloadFullReport } from '@/lib/report-bundle';
import styles from './reports.module.css';

export function useReportDownload() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const cancel = () => controller.current?.abort();
  const run = async (range: Range, title: string) => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setMessage('Collecting all platforms…');
    try {
      await downloadFullReport(range, title, setMessage, abort.signal);
      setMessage('Your complete PDF has been downloaded.');
    } catch (e) {
      if (abort.signal.aborted) setMessage('Report cancelled.');
      else {
        setError(
          e instanceof Error
            ? e.message
            : 'The PDF could not be generated. Please retry.',
        );
        setMessage('');
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  };
  return { busy, message, error, run, cancel };
}
function DownloadStatus({
  task,
}: {
  task: ReturnType<typeof useReportDownload>;
}) {
  return (
    <>
      <div className={styles.progress} role="status" aria-live="polite">
        {task.message && (
          <>
            {task.busy ? (
              <LoaderCircle className={styles.spin} size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{task.message}</span>
            {task.busy && (
              <button type="button" className="text-link" onClick={task.cancel}>
                Cancel
              </button>
            )}
          </>
        )}
      </div>
      {task.error && (
        <p className="save-error" role="alert">
          {task.error}
        </p>
      )}
    </>
  );
}
export function ReportDownloadButton({
  range,
  title,
  label = 'Download PDF',
}: {
  range: Range;
  title: string;
  label?: string;
}) {
  const task = useReportDownload();
  return (
    <div>
      <button
        className="secondary"
        disabled={task.busy}
        onClick={() => void task.run(range, title)}
      >
        <ArrowDownToLine size={15} />
        {task.busy ? 'Preparing PDF…' : label}
      </button>
      <DownloadStatus task={task} />
    </div>
  );
}
export function ExportDialog({
  open,
  onClose,
  range,
  title = 'Ysabel Society marketing report',
}: {
  open: boolean;
  onClose: () => void;
  range: Range;
  title?: string;
  rows?: Daily[];
  posts?: Post[];
  unit?: string;
  mode?: string;
}) {
  const task = useReportDownload();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          task.cancel();
          onClose();
        }
      }}
    >
      <DialogContent className="export-dialog">
        <DialogHeader>
          <DialogTitle>Download complete PDF</DialogTitle>
          <DialogDescription>
            {title} · {range.start} to {range.end}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.platforms}>
          {CHANNELS.map((c) => (
            <span key={c}>
              <DataIcon name={c} />
              {c}
            </span>
          ))}
        </div>
        <p className="muted">
          All categories, platform charts, individual posts, website reports,
          reviews, inbox and mentions in one organized report.
        </p>
        <div className={styles.sections}>
          {REPORT_SECTIONS.map((name) => (
            <span key={name}>
              <DataIcon name={name} />
              {name}
            </span>
          ))}
        </div>
        <button
          className="primary"
          disabled={task.busy}
          onClick={() => void task.run(range, title)}
        >
          <ArrowDownToLine size={16} />
          {task.busy ? 'Preparing your report…' : 'Download PDF'}
        </button>
        <DownloadStatus task={task} />
      </DialogContent>
    </Dialog>
  );
}
export function ReportsPage({
  data,
  range,
  unit,
}: {
  data: WorkspaceData;
  range: Range;
  unit: string;
}) {
  const [cadence, setCadence] = useState('Custom'),
    [title, setTitle] = useState('Ysabel Society marketing report'),
    [start, setStart] = useState(range.start),
    [end, setEnd] = useState(range.end),
    [selected, setSelected] = useState<SavedReport | null>(null);
  const task = useReportDownload();
  const valid = !!start && !!end && start <= end;
  useEffect(() => {
    setStart(range.start);
    setEnd(range.end);
    setCadence('Custom');
  }, [range.start, range.end]);
  return (
    <div className="view-enter">
      <div className="reports-layout">
        <section className="report-cover">
          <BrandLogo />
          <div className="report-cover-title">
            <span>ALL PLATFORMS · PDF</span>
            <h2>
              Marketing
              <br />
              report.
            </h2>
            <p>
              {start} — {end}
            </p>
          </div>
          <span className="report-cover-foot">
            YSABEL SOCIETY <span>INTERNAL USE</span>
          </span>
        </section>
        <section className="surface padded">
          <div className="eyebrow">REPORTS</div>
          <h2>Every platform. One report.</h2>
          <p className="muted panel-description">
            Your dashboard cards, charts and detailed records, organized by
            category and platform.
          </p>
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) void task.run({ start, end }, title);
            }}
          >
            <label>
              Report period
              <Picker
                label="Report period"
                value={cadence}
                options={['Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom']}
                onChange={(v) => {
                  setCadence(v);
                  if (v !== 'Custom') {
                    const next = dateRange(
                      v === 'Weekly'
                        ? 'Last 7 Days'
                        : v === 'Monthly'
                          ? 'Previous Month'
                          : v === 'Quarterly'
                            ? 'Quarter'
                            : 'Year to Date',
                      undefined,
                      iso(new Date()),
                    );
                    setStart(next.start);
                    setEnd(next.end);
                  }
                }}
              />
            </label>
            <label>
              Report title
              <input
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                From
                <input
                  type="date"
                  required
                  value={start}
                  max={end}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setCadence('Custom');
                  }}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  required
                  value={end}
                  min={start}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setCadence('Custom');
                  }}
                />
              </label>
            </div>
            <div className="inline-controls">
              <button
                className="primary"
                disabled={task.busy || !valid || !data.ready}
              >
                <ArrowDownToLine size={16} />
                {task.busy ? 'Preparing PDF…' : 'Generate & download PDF'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={data.busy || task.busy || !valid || !data.ready}
                onClick={() =>
                  void data
                    .saveReport({ title, start, end, unit, mode: 'live' })
                    .catch(() => {})
                }
              >
                <BookmarkPlus size={16} />
                Save selection
              </button>
            </div>
            <DownloadStatus task={task} />
          </form>
          <p className="footnote">
            Downloads collect every platform, regardless of the platform
            selected elsewhere. Saved selections use current imported data when
            downloaded.
          </p>
        </section>
      </div>
      <section className="surface padded">
        <div className="section-head">
          <h2>Included in every PDF</h2>
          <span className="pill">PDF only</span>
        </div>
        <div className={styles.platforms}>
          {CHANNELS.map((name) => (
            <span key={name}>
              <DataIcon name={name} />
              {name}
            </span>
          ))}
        </div>
        <div className={styles.sections}>
          {REPORT_SECTIONS.map((name, i) => (
            <div key={name}>
              <DataIcon name={name} />
              <span>{name}</span>
              <small>{String(i + 1).padStart(2, '0')}</small>
            </div>
          ))}
        </div>
        <p className="footnote">
          Each source keeps its reporting period. Missing platform data is
          identified in the report; exported records are not limited to the rows
          currently visible on screen.
        </p>
      </section>
      <section className="surface padded">
        <h2>Saved reports</h2>
        {data.reports.length ? (
          data.reports.map((r) => (
            <button
              className="report-list-row"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <FileText size={20} />
              <span>
                <strong>{r.title}</strong>
                <small>
                  {r.start} – {r.end} · All platforms · PDF
                </small>
              </span>
              <ArrowDownToLine size={17} />
            </button>
          ))
        ) : (
          <p className="footnote">
            Save a selection to download the same reporting period again.
          </p>
        )}
      </section>
      {selected && (
        <ExportDialog
          open
          onClose={() => setSelected(null)}
          title={selected.title}
          range={{ start: selected.start, end: selected.end }}
        />
      )}
    </div>
  );
}
