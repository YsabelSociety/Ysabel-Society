'use client';
import { useState } from 'react';
import { ArrowDownToLine, FileText, Plus, ArrowUpRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Picker } from './controls';
import { type WorkspaceData, type SavedReport } from './use-workspace';
import {
  dateRange,
  filterDaily,
  total,
  compact,
  type Range,
  type Daily,
  type Post,
} from '@/lib/analytics';
import { exportCSV, exportPDF, exportPNG } from '@/lib/exports';
import { StatRow } from './analytics-pages';
export function ExportDialog({
  open,
  onClose,
  rows,
  posts,
  range,
  unit,
  mode = 'demo',
}: {
  open: boolean;
  onClose: () => void;
  rows: Daily[];
  posts: Post[];
  range: Range;
  unit: string;
  mode?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="export-dialog">
        <DialogHeader>
          <DialogTitle>Take the perspective with you.</DialogTitle>
          <DialogDescription>
            {unit} · {range.start} to {range.end} ·{' '}
            {mode === 'live' ? 'Live source data' : 'Demo Data'}
          </DialogDescription>
        </DialogHeader>
        <div className="export-options">
          {[
            {
              name: 'Editorial PDF',
              text: 'A two-page ownership report with source notes.',
              run: () => exportPDF(rows, posts, range, unit, undefined, mode),
            },
            {
              name: 'Source data · CSV',
              text: 'Daily channel observations for further analysis.',
              run: () => exportCSV(rows, range, mode),
            },
            {
              name: 'Performance image · PNG',
              text: 'A presentation-ready summary and trend chart.',
              run: () => exportPNG(rows, range, unit, mode),
            },
          ].map((o) => (
            <button
              key={o.name}
              onClick={() => {
                o.run();
                onClose();
              }}
            >
              <FileText size={23} />
              <span>
                <strong>{o.name}</strong>
                <small>{o.text}</small>
              </span>
              <ArrowDownToLine size={16} />
            </button>
          ))}
        </div>
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
  const [type, setType] = useState('Monthly'),
    [title, setTitle] = useState('August intelligence report'),
    [start, setStart] = useState(range.start),
    [end, setEnd] = useState(range.end),
    [selected, setSelected] = useState<SavedReport | null>(null);
  const rows = filterDaily(unit, { start, end });
  return (
    <div className="view-enter">
      <div className="reports-layout">
        <section className="report-cover">
          <div className="wordmark">
            YSABEL<span>S O C I E T Y</span>
          </div>
          <div className="report-cover-title">
            <span>DIGITAL INTELLIGENCE</span>
            <h2>
              {type}
              <br />
              perspective.
            </h2>
            <p>
              {start} — {end}
            </p>
          </div>
          <span className="report-cover-foot">
            PRIVATE & CONFIDENTIAL <span>DEMO DATA</span>
          </span>
        </section>
        <section className="surface padded">
          <div className="eyebrow">OWNERSHIP REPORTING</div>
          <h2>A clear story, ready to share.</h2>
          <p className="muted panel-description">
            A considered editorial layout with performance, channels, content
            and measurement notes.
          </p>
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void data.saveReport({ title, start, end, unit }).catch(() => {});
            }}
          >
            <label>
              Report cadence
              <Picker
                label="Report cadence"
                value={type}
                options={['Weekly', 'Monthly', 'Quarterly', 'Custom']}
                onChange={(v) => {
                  setType(v);
                  const r = dateRange(
                    v === 'Weekly'
                      ? 'Last 7 Days'
                      : v === 'Quarterly'
                        ? 'Quarter'
                        : 'Previous Month',
                  );
                  if (v !== 'Custom') {
                    setStart(r.start);
                    setEnd(r.end);
                  }
                }}
              />
            </label>
            <label>
              Report title
              <input
                value={title}
                required
                maxLength={160}
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
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  required
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <div className="inline-controls">
              <button className="primary" disabled={data.busy || !data.ready}>
                <Plus size={15} /> Save report
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  exportPDF(rows, data.posts, { start, end }, unit, title)
                }
              >
                <ArrowDownToLine size={15} /> Download PDF
              </button>
            </div>
          </form>
          <p className="footnote">
            Saved reports retain their dates for Ysabel Society. Exports use the
            current records for that selection. All demo reports are visibly
            labeled.
          </p>
        </section>
      </div>
      <StatRow
        items={[
          {
            label: 'Content views in this report',
            value: compact(total(rows, 'views')),
          },
          { label: 'Engagements', value: compact(total(rows, 'engagements')) },
          { label: 'Google actions', value: compact(total(rows, 'actions')) },
        ]}
      />
      <section className="surface padded">
        <h2>Your reports</h2>
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
                  {r.unit} · {r.start} – {r.end} · Demo Data
                </small>
              </span>
              <ArrowDownToLine size={17} />
            </button>
          ))
        ) : (
          <p className="footnote">
            Save your first report using the form above.
          </p>
        )}
      </section>
      {selected && (
        <ExportDialog
          open
          onClose={() => setSelected(null)}
          rows={filterDaily(selected.unit, {
            start: selected.start,
            end: selected.end,
          })}
          posts={data.posts}
          range={{ start: selected.start, end: selected.end }}
          unit={selected.unit}
        />
      )}
    </div>
  );
}
