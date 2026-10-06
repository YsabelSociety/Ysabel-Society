'use client';
import { useMemo, useState } from 'react';
import { type ReportBundle } from '@/lib/report-bundle';
import { Download, FileText, ArrowUpRight, Check, ChevronDown, Star } from 'lucide-react';
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
import { ReviewAI } from './review-ai';
import { GoogleReviewCard } from './google-review-card';
import { reviewHasComment } from './review-body';
import { ReviewTopicIcon } from './review-topic-icon';
import styles from './google-reviews.module.css';
import { ReviewRatingComparison } from './review-rating-comparison';
import { useGoogleRatingHistory } from './use-google-rating';
import { reviewRatingComparison } from '@/lib/review-rating-comparison';
import { calendarDate } from '@/lib/sync-window';
import { REVIEW_CATEGORIES, reviewCategoryLabel } from '@/lib/review-categories';
import { MiniHistory } from './mini-history';
import { reviewMonthHistory } from '@/lib/review-history';
import {
  reviewPeriodRange,
  reviewPeriodLabel,
  type ReviewDateSelection,
} from '@/lib/review-dates';
import {
  DEFAULT_REVIEW_FILTERS,
  makeReviewReport,
  reviewFilterLabel,
  reviewKey,
  type ReviewReport,
  type ReviewReportFilters,
} from '@/lib/review-report';

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
    topic: 'All topics',
    stars: [1, 2, 3, 4, 5],
    evidence: 'All matching reviews',
  });
  const [title, setTitle] = useState('Guest feedback review report');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const selectedRange = reviewPeriodRange(dates, range);
  const reportRange = selectedRange || range;
  const { history: ratingHistory, loading: ratingLoading } = useGoogleRatingHistory();
  const today = calendarDate(timezone);
  const ratingComparison = useMemo(
    () => reviewRatingComparison(selectedRange?.end || today, today, ratingHistory),
    [selectedRange?.end, today, ratingHistory],
  );
  const filters: ReviewReportFilters = {
    ...localFilters,
    period: selectedRange ? 'Selected dates' : 'All imported reviews',
    approximateDates: dates.approximate,
    periodLabel: reviewPeriodLabel(dates, range),
  };
  const [snapshot, setSnapshot] = useState<ReviewReport | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const selection = useMemo(
    () => makeReviewReport(records, filters, reportRange, timezone, title),
    [records, localFilters, dates, range.start, range.end, timezone, title],
  );
  const patch = (values: Partial<ReviewReportFilters>) =>
    setFilters((v) => ({ ...v, ...values }));
  const ratingReports = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((star) => ({
        star,
        rows: makeReviewReport(
          records,
          { ...filters, stars: [star], evidence: 'All matching reviews' },
          reportRange,
          timezone,
        ).rows,
      })),
    [records, localFilters, dates, range.start, range.end, timezone],
  );
  const ratingBasis = ratingReports.flatMap((report) => report.rows);
  const categorySelection = useMemo(
    () => makeReviewReport(records, {...filters,topic:'All topics',evidence:'Criticism detected'}, reportRange, timezone, title),
    [records, localFilters, dates, range.start, range.end, timezone, title],
  );
  const topicCards = REVIEW_CATEGORIES.map(category => ({
    ...category,
    issue: categorySelection.issues.find(issue => issue.topic === category.topic),
  })).sort((a, b) => (b.issue?.count || 0) - (a.issue?.count || 0));
  const visibleTopics = showAllTopics ? topicCards : topicCards.filter((category, index) =>
    index < 6 || filters.topic === (category.topic === 'Service' ? 'Service & staff' : category.topic));
  async function exportIllustrated(stars?: number[]) {
    if (!snapshot || busy) return;
    const selected = stars ? { ...snapshot, rows: snapshot.rows.filter(r => stars.includes(r.rating || 0)), filters: { ...snapshot.filters, stars } } : snapshot;
    if (!selected.rows.length) return;
    setBusy(true);
    setMessage('Preparing selected reviews…');
    try {
      const bundle: ReportBundle = {
        scope: 'reviews', title: selected.title, range: selected.range,
        generatedAt: selected.generatedAt, timezone: selected.timezone,
        mode: 'live', rows: [], posts: [], tables: [], records: selected.rows,
        sourceStatus: [], communityStatus: [], reviewSelection: selected.rows,
        reviewNote: reviewFilterLabel(selected),
        reviewStars: selected.filters.stars,
        ratingComparison: selected.ratingComparison,
      };
      const { downloadReportPDF } = await import('@/lib/report-pdf');
      await downloadReportPDF(bundle, setMessage);
      setMessage(
        'PDF downloaded with only your selected reviews and their criticism summary.',
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'The report could not be downloaded. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  const create = () => {
    setSnapshot(
      { ...makeReviewReport(records, filters, reportRange, timezone, title), ratingComparison },
    );
    setMessage('');
  };
  return (
    <section
      className={`surface review-report-builder ${styles.builder}`}
      aria-label="Critical review reports"
    >
      <div className={`section-head ${styles.reportHeader}`}>
        <div>
          <span className="report-kicker">
            GOOGLE BUSINESS / REVIEW INTELLIGENCE
          </span>
          <h2>Critical review reports</h2>
          <p>
            A closer look at the guest experience. Every rating, every voice,
            with the details that deserve your attention.
          </p>
        </div>
        <button
          className="primary"
          disabled={loading || ratingLoading || !selection.rows.length || truncated}
          onClick={create}
        >
          <FileText size={17} />
          Create report · {selection.rows.length}
        </button>
      </div>
      <div className={styles.selectionSummary} aria-label="Selected review summary">
        <div><span>REVIEWS IN SELECTION</span><strong>{loading ? '—' : selection.rows.length.toLocaleString()}</strong><small>{reviewPeriodLabel(dates, range)}</small></div>
        <div><span>WITH WRITTEN FEEDBACK</span><strong>{loading ? '—' : selection.rows.filter(reviewHasComment).length.toLocaleString()}</strong><small>The original guest experience</small></div>
        <div data-concern="true"><span>WITH POINTS TO IMPROVE</span><strong>{loading ? '—' : selection.rows.filter(review => review.criticisms.length > 0).length.toLocaleString()}</strong><small>Identified across all star ratings</small></div>
      </div>
      <ReviewRatingComparison comparison={ratingComparison} />
      <div className={`community-toolbar ${styles.downloadGroups}`} role="group" aria-label="Review download groups">
        {[
          { label: 'All reviews · 1–5 stars', stars: [1, 2, 3, 4, 5] },
          { label: 'Low ratings · 1–3 stars', stars: [1, 2, 3] },
          { label: 'Positive ratings · 4–5 stars', stars: [4, 5] },
        ].map(group => (
          <button key={group.label} className={group.stars.length === filters.stars.length && group.stars.every(s => filters.stars.includes(s)) ? 'primary' : 'secondary'}
            aria-pressed={group.stars.length === filters.stars.length && group.stars.every(s => filters.stars.includes(s))}
            onClick={() => patch({ stars: group.stars })}>
            <FileText size={15} />{group.label}
          </button>
        ))}
      </div>
      <div
        className={`review-report-ratings ${styles.ratingCards}`}
        role="group"
        aria-label="Report star ratings"
      >
        {ratingReports.map(({ star, rows }) => (
          <button
            key={star}
            className={styles.ratingCard}
            aria-label={`${star}-star reviews · ${rows.length} ${rows.length === 1 ? 'review' : 'reviews'}`}
            aria-pressed={filters.stars.includes(star)}
            onClick={() =>
              patch({
                stars: filters.stars.includes(star)
                  ? filters.stars.filter((v) => v !== star)
                  : [...filters.stars, star],
              })
            }
          >
            <span className={styles.ratingCardTop}><span><Star size={15} fill="currentColor" strokeWidth={1.2} aria-hidden="true" />{star}-star reviews</span><i aria-hidden="true">{filters.stars.includes(star) && <Check size={12} />}</i></span>
            <strong>{loading ? '—' : rows.length}</strong>
            <span className="review-rating-criticism">
              {loading ? '—' : rows.filter((review) => review.criticisms.length > 0).length} with criticism
            </span>
            <MiniHistory
              values={loading ? [] : reviewMonthHistory(ratingBasis, rows)}
              label="Captured reviews by month"
            />
            <small>
              {filters.stars.includes(star)
                ? 'Included in report'
                : 'Click to include'}
            </small>
          </button>
        ))}
      </div>
      <div className={`review-report-controls ${styles.filters}`}>
        <Picker
          label="Report topic"
          value={reviewCategoryLabel(filters.topic === 'Service & staff' ? 'Service' : filters.topic)}
          options={['All topics','Food & drinks',...REVIEW_CATEGORIES.map(c=>c.label)]}
          onChange={(v) => {const topic=REVIEW_CATEGORIES.find(c=>c.label===v)?.topic||v;patch({topic:(topic==='Service'?'Service & staff':topic) as ReviewReportFilters['topic']});}}
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
      <div className="community-toolbar" aria-label="Quick report periods">
        <button className="secondary" onClick={() => onDatesChange({ ...dates, mode: 'All dates' })}>
          Newest reviews · all dates
        </button>
        <button className="secondary" onClick={() => onDatesChange({ ...dates, mode: 'Monthly', approximate: true })}>
          Filter by month
        </button>
      </div>
      <ReviewDateControls
        value={dates}
        onChange={onDatesChange}
        dashboard={range}
        label="Report"
      />
      <p className="source-asof">
        Newest first · Updated after each completed sync or import. Even a five-star review can contain criticism.
      </p>
      <section className={styles.topicSection} aria-label="All criticism categories">
        <div className={styles.topicHeading}>
          <div><span className={styles.eyebrow}>UNDERSTAND THE DETAILS</span><h3>Where we can improve</h3><p>Choose a topic to read the feedback behind it. One review can raise several concerns.</p></div>
          {filters.topic !== 'All topics' && <button className="secondary" onClick={() => patch({ topic: 'All topics' })}>Clear topic</button>}
        </div>
        <div className={styles.topicGrid}>
          {visibleTopics.map(category => {
            const { issue } = category;
            const topic = category.topic === 'Service' ? 'Service & staff' : category.topic;
            const count = issue?.count || 0;
            const excerpt = categorySelection.rows.find(review => review.criticisms.some(criticism => criticism.topic === category.topic))?.criticisms.find(criticism => criticism.topic === category.topic)?.excerpt;
            return <button className={styles.topicCard} key={category.topic} aria-pressed={filters.topic === topic} onClick={() => patch({ topic, evidence: 'Criticism detected' })}>
              <div className={styles.topicTop}><span className={styles.topicIcon}><ReviewTopicIcon topic={category.topic} /></span><span className={styles.topicCount}>{loading ? '—' : count}<small>{count === 1 ? 'review' : 'reviews'}</small></span><ArrowUpRight size={17} className={styles.topicArrow} aria-hidden="true" /></div>
              <h4>{category.label}</h4><p className={styles.topicDetail}>{category.detail}</p>
              <div className={styles.topicBar}><i style={{ width: `${count / Math.max(1, categorySelection.rows.length) * 100}%` }} /></div>
              <p className={styles.topicExcerpt}>{excerpt ? `“${excerpt}”` : issue?.excerpt || (loading ? 'Loading reviews…' : 'No concerns identified in this selection.')}</p>
            </button>;
          })}
        </div>
        <button className={styles.allTopics} aria-expanded={showAllTopics} onClick={() => setShowAllTopics(value => !value)}><ChevronDown size={15} aria-hidden="true" />{showAllTopics ? 'Show key topics' : `Explore all ${REVIEW_CATEGORIES.length} topics`}</button>
      </section>
      <section className={styles.latestReviews} aria-label="Newest matching critical reviews" aria-live="polite">
        <div className={styles.topicHeading}><div><span className={styles.eyebrow}>THE PEOPLE BEHIND THE RATINGS</span><h3>Latest guest perspectives</h3><p>{selection.rows.length.toLocaleString()} matching reviews · Full comments, with points to improve set apart.</p></div><button className={styles.textLink} onClick={() => document.getElementById('google-guest-reviews')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>Browse all reviews<ArrowUpRight size={16} aria-hidden="true" /></button></div>
        <div className={styles.reviewerList}>{selection.rows.slice(0, 5).map(review => <GoogleReviewCard key={reviewKey(review)} review={review} timezone={timezone} onTopicChange={topic => patch({ topic: (topic === 'Service' ? 'Service & staff' : topic) as ReviewReportFilters['topic'] })} />)}</div>
        {!loading && !selection.rows.length && <p className="community-empty">No reviews match these filters. Try another month, topic or feedback filter.</p>}
        {selection.rows.length > 5 && <p className="source-asof">The newest 5 reviews are shown here. Your report includes all {selection.rows.length.toLocaleString()} matching reviews.</p>}
      </section>
      {truncated && (
        <p role="alert" className="save-error">
          The review collection was truncated. A complete report cannot be
          exported until all matching records are loaded.
        </p>
      )}
      <p className="source-asof">
        Downloads include every matching review, full comments, available
        profile photos and Google links. Guest photos appear when saved with the review;
        Google’s Reviews API does not supply attached photos.
      </p>

      <details className={styles.aiDisclosure}><summary>Review analysis & translations</summary><ReviewAI records={records} onUpdated={() => window.dispatchEvent(new Event('ysabel:community-updated'))} /></details>
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
                  {busy ? 'Preparing PDF…' : 'Download selected PDF'}
                </button>
                <button className="secondary" disabled={busy || !snapshot.rows.some(r => (r.rating || 0) >= 1 && (r.rating || 0) <= 3)} onClick={() => void exportIllustrated([1, 2, 3])}>
                  <Download size={16} />1–3 stars · {snapshot.rows.filter(r => (r.rating || 0) >= 1 && (r.rating || 0) <= 3).length}
                </button>
                <button className="secondary" disabled={busy || !snapshot.rows.some(r => (r.rating || 0) >= 4)} onClick={() => void exportIllustrated([4, 5])}>
                  <Download size={16} />4–5 stars · {snapshot.rows.filter(r => (r.rating || 0) >= 4).length}
                </button>
              </div>
              <p className="source-asof">
                The separate downloads use this selection’s dates, topics and search. Low star ratings
                do not automatically mean a written complaint; criticism is analysed at every rating.
              </p>
              <p className="source-asof">
                A compact PDF with a rating summary, full original comments, criticism
                highlights, reviewer names and supplied usernames, profile photos, replies,
                attached images and Google links. All {snapshot.rows.length} matching
                reviews are included, grouped by star rating.
              </p>
              <div role="status" aria-live="polite">
                {message}
              </div>
              {snapshot.ratingComparison && <ReviewRatingComparison comparison={snapshot.ratingComparison} />}
              <div className={styles.preview}>
                {[...snapshot.filters.stars].sort().map((star) => {
                  const rows = snapshot.rows.filter((r) => r.rating === star);
                  return (
                    <section key={star}>
                      <h3>
                        {star}-star reviews <span>{rows.length}</span>
                      </h3>
                      {rows.slice(0, 5).map(review => <GoogleReviewCard key={reviewKey(review)} review={review} timezone={timezone} />)}
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
