'use client';
import { useMemo, useState } from 'react';
import { Download, FileText, ExternalLink, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Picker } from './controls';
import { type CommunityRecord } from '@/lib/community';
import { type Range } from '@/lib/analytics';
import { ReviewDateControls } from './review-date-controls';
import {
  reviewPeriodRange,
  reviewPeriodLabel,
  type ReviewDateSelection,
} from '@/lib/review-dates';
import {
  DEFAULT_REVIEW_FILTERS,
  makeReviewReport,
  reportCSV,
  reportHTML,
  reviewDateLabel,
  reviewFilterLabel,
  reviewKey,
  reviewLink,
  type ReviewReport,
  type ReviewReportFilters,
} from '@/lib/review-report';

function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function embedPhotos(
  report: ReviewReport,
  progress: (n: number) => void,
) {
  const photos: Record<string, string> = {};
  let next = 0,
    completed = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, report.rows.length) }, async () => {
      while (next < report.rows.length) {
        const r = report.rows[next++];
        try {
          if (r.avatar) {
            const response = await fetch(
              '/marketingdata/api/review-photo?' +
                new URLSearchParams({ accountId: r.accountId, id: r.id }),
              { signal: AbortSignal.timeout(12000) },
            );
            if (response.status === 401)
              throw new Error('Sign in again to include profile photos.');
            if (response.ok) {
              const blob = await response.blob();
              photos[reviewKey(r)] = await new Promise<string>(
                (resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                },
              );
            }
          }
        } catch {
          /* Preserve the review and report missing photos explicitly. */
        }
        progress(++completed);
      }
    }),
  );
  return photos;
}

export function ReviewReports({
  records,
  range,
  timezone,
  loading,
  truncated,
  dates,
  onDatesChange,
}: {
  records: CommunityRecord[];
  range: Range;
  timezone: string;
  loading: boolean;
  truncated?: boolean;
  dates: ReviewDateSelection;
  onDatesChange: (v: ReviewDateSelection) => void;
}) {
  const [localFilters, setFilters] = useState<ReviewReportFilters>({
    ...DEFAULT_REVIEW_FILTERS,
    stars: [1, 2, 3],
  });
  const [title, setTitle] = useState('Guest feedback review report');
  const selectedRange = reviewPeriodRange(dates, range);
  const reportRange = selectedRange || range;
  const filters: ReviewReportFilters = {
    ...localFilters,
    period: selectedRange ? 'Selected dates' : 'All imported reviews',
    approximateDates: dates.approximate,
    periodLabel: reviewPeriodLabel(dates, range),
  };
  const [snapshot, setSnapshot] = useState<ReviewReport | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState('');
  const selection = useMemo(
    () => makeReviewReport(records, filters, reportRange, timezone, title),
    [records, localFilters, dates, range.start, range.end, timezone, title],
  );
  const patch = (values: Partial<ReviewReportFilters>) =>
    setFilters((v) => ({ ...v, ...values }));
  const filename =
    'Ysabel-Society-Review-Report-' +
    (snapshot?.generatedAt || selection.generatedAt).slice(0, 10);
  async function exportIllustrated() {
    if (!snapshot || busy) return;
    setBusy(true);
    setProgress(0);
    setMessage('');
    try {
      const photos = await embedPhotos(snapshot, setProgress);
      download(
        reportHTML(snapshot, photos),
        'text/html;charset=utf-8',
        filename + '.html',
      );
      const missing = snapshot.rows.length - Object.keys(photos).length;
      setMessage(
        missing
          ? `Report downloaded with all ${snapshot.rows.length} reviews. ${missing} profile photos were unavailable and are marked in the report.`
          : `Report downloaded with all ${snapshot.rows.length} reviews and embedded profile photos.`,
      );
    } catch {
      setMessage('The report could not be downloaded. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const create = () => {
    setSnapshot(
      makeReviewReport(records, filters, reportRange, timezone, title),
    );
    setMessage('');
    setProgress(0);
  };
  return (
    <section
      className="surface review-report-builder"
      aria-label="Critical review reports"
    >
      <div className="section-head">
        <div>
          <span className="report-kicker">
            GOOGLE BUSINESS · INTERNAL REPORTS
          </span>
          <h2>Critical review reports</h2>
          <p>
            Separate criticism about food, drinks, service and atmosphere, then
            export the complete selection.
          </p>
        </div>
        <button
          className="primary"
          disabled={loading || !selection.rows.length || truncated}
          onClick={create}
        >
          <FileText size={17} />
          Create report · {selection.rows.length}
        </button>
      </div>
      <div
        className="review-report-ratings"
        role="group"
        aria-label="Report star ratings"
      >
        {[1, 2, 3].map((star) => (
          <button
            key={star}
            aria-pressed={filters.stars.includes(star)}
            onClick={() =>
              patch({
                stars: filters.stars.includes(star)
                  ? filters.stars.filter((v) => v !== star)
                  : [...filters.stars, star],
              })
            }
          >
            <span>
              <Star size={16} />
              {star}-star reviews
            </span>
            <strong>
              {loading
                ? '—'
                : makeReviewReport(
                    records,
                    { ...filters, stars: [star] },
                    reportRange,
                    timezone,
                  ).rows.length}
            </strong>
            <small>
              {filters.stars.includes(star)
                ? 'Included in report'
                : 'Click to include'}
            </small>
          </button>
        ))}
      </div>
      <div className="review-report-controls">
        <Picker
          label="Report topic"
          value={filters.topic}
          options={[
            'Food & drinks',
            'Food',
            'Drinks',
            'Service & staff',
            'Atmosphere',
            'Waiting time',
            'Price & value',
            'Cleanliness',
            'All topics',
          ]}
          onChange={(v) => patch({ topic: v as ReviewReportFilters['topic'] })}
        />
        <Picker
          label="Report feedback"
          value={filters.evidence}
          options={['Criticism detected', 'All matching reviews']}
          onChange={(v) =>
            patch({ evidence: v as ReviewReportFilters['evidence'] })
          }
        />
        <input
          aria-label="Search report comments"
          type="search"
          placeholder="Search comments or names"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
        />
        <label>
          Report title
          <input
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <ReviewDateControls
        value={dates}
        onChange={onDatesChange}
        dashboard={range}
        label="Report"
      />
      <p className="source-asof">
        Criticism is suggested from context and related terms. Choose “All
        matching reviews” to include topic mentions without a detected
        complaint.
      </p>
      {truncated && (
        <p role="alert" className="save-error">
          The review collection was truncated. A complete report cannot be
          exported until all matching records are loaded.
        </p>
      )}
      <div className="review-report-summary">
        <div>
          <strong>{loading ? '—' : selection.rows.length}</strong>
          <span>reviews in this report</span>
        </div>
        <div>
          <strong>
            {selection.issues.find((v) => v.topic === 'Food')?.count || 0}
          </strong>
          <span>with food criticism</span>
        </div>
        <div>
          <strong>
            {selection.issues.find((v) => v.topic === 'Drinks')?.count || 0}
          </strong>
          <span>with drink criticism</span>
        </div>
      </div>
      {!!selection.rows.length && (
        <div
          className="review-report-issues"
          aria-label="Most frequent criticism in selected reviews"
        >
          {selection.issues.slice(0, 6).map((issue) => (
            <div key={issue.topic}>
              <span>
                {issue.topic}
                <b>{issue.count}</b>
              </span>
              <div>
                <i
                  style={{
                    width: (issue.count / selection.rows.length) * 100 + '%',
                  }}
                />
              </div>
              <p>{issue.excerpt}</p>
            </div>
          ))}
        </div>
      )}
      {!loading && !selection.rows.length && (
        <p className="community-empty">
          No reviews match this combination. Include a star rating, broaden the
          topic or choose “All matching reviews”.
        </p>
      )}
      <p className="source-asof">
        Downloads include every matching review, full comments, available
        profile photos and Google links. Original review links are used where
        supplied; otherwise the reviewer’s Google reviews link is clearly
        identified.
      </p>

      <Dialog
        open={!!snapshot}
        onOpenChange={(open) => {
          if (!open && !busy) setSnapshot(null);
        }}
      >
        <DialogContent className="review-report-dialog">
          <DialogHeader>
            <DialogTitle>{snapshot?.title}</DialogTitle>
            <DialogDescription>
              {snapshot && reviewFilterLabel(snapshot)}
            </DialogDescription>
          </DialogHeader>
          {snapshot && (
            <>
              <div className="review-report-downloads">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void exportIllustrated()}
                >
                  <Download size={16} />
                  {busy
                    ? `Preparing photos ${progress}/${snapshot.rows.length}…`
                    : 'Download illustrated report'}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    download(
                      reportCSV(snapshot),
                      'text/csv;charset=utf-8',
                      filename + '.csv',
                    )
                  }
                >
                  <Download size={16} />
                  Download CSV
                </button>
              </div>
              <p className="source-asof">
                The illustrated report opens in your browser, includes embedded
                photos for offline use, and has a Print / Save as PDF button.
                All {snapshot.rows.length} matching reviews are included,
                grouped by star rating.
              </p>
              <div role="status" aria-live="polite">
                {message}
              </div>
              <div className="review-report-preview">
                {[...snapshot.filters.stars].sort().map((star) => {
                  const rows = snapshot.rows.filter((r) => r.rating === star);
                  return (
                    <section key={star}>
                      <h3>
                        {star}-star reviews <span>{rows.length}</span>
                      </h3>
                      {rows.slice(0, 5).map((r) => {
                        const link = reviewLink(r);
                        return (
                          <article key={reviewKey(r)}>
                            <div className="review-report-author">
                              {r.avatar && (
                                <img
                                  src={r.avatar}
                                  alt=""
                                  width={44}
                                  height={44}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div>
                                <strong>
                                  {r.name || 'Anonymous reviewer'}
                                </strong>
                                <small>{reviewDateLabel(r, timezone)}</small>
                              </div>
                              <span aria-label={`${r.rating} stars`}>
                                {'★'.repeat(r.rating || 0)}
                              </span>
                            </div>
                            <p className="review-text">
                              {r.text || 'Rating without written feedback.'}
                            </p>
                            {link && (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {link.label}
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </article>
                        );
                      })}
                      {rows.length > 5 && (
                        <p className="source-asof">
                          Previewing 5 of {rows.length}; the download includes
                          all {rows.length}.
                        </p>
                      )}
                      {!rows.length && <p>No matches for this rating.</p>}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
