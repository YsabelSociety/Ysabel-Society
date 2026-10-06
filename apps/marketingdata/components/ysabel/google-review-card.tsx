'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MessageCircle, ShieldCheck } from 'lucide-react';
import { reviewTopics, safeProfileURL, type CommunityRecord } from '@/lib/community';
import { reviewCategoryLabel } from '@/lib/review-categories';
import { reviewDateLabel, reviewLink } from '@/lib/review-report';
import { ReviewBody, reviewHasComment } from './review-body';
import { ReviewStars } from './review-stars';
import styles from './google-reviews.module.css';

function ReviewerPortrait({ review }: { review: CommunityRecord }) {
  const original = safeProfileURL(review.avatar);
  const url = original && new URL(original).hostname.endsWith('.googleusercontent.com')
    ? original.replace(/=s(\d+)(?=-|$)/, (size, pixels) => Number(pixels) < 192 ? '=s192' : size)
    : original;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const initials = (review.name || 'Google guest').split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  return <div className={styles.portrait}>
    {url && !failed
      ? <img src={url} alt={`${review.name || 'Reviewer'}’s profile picture`} width={64} height={64} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span aria-label="Profile picture unavailable">{initials}</span>}
    <span className={styles.googleMark} aria-label="Google review">G</span>
  </div>;
}

export function GoogleReviewCard({ review, timezone, onTopicChange }: {
  review: CommunityRecord;
  timezone: string;
  onTopicChange?: (topic: string) => void;
}) {
  const topics = useMemo(() => reviewTopics(review), [review]);
  const link = reviewLink(review);
  return <article className={styles.reviewCard} aria-label={`Review by ${review.name || 'Anonymous reviewer'}`}>
    <header className={styles.reviewer}>
      <ReviewerPortrait review={review} />
      <div className={styles.identity}>
        <h4>{review.name || 'Anonymous reviewer'}</h4>
        {review.username && review.username !== review.name && <span className={styles.username}>{review.username}</span>}
        <span className={styles.reviewMeta}>{reviewDateLabel(review, timezone)}<i aria-hidden="true" />{review.origin === 'api' ? 'Google Business' : 'Imported review'}</span>
      </div>
      <div className={styles.rating}>
        <span><strong>{review.rating ?? '—'}</strong><small>/ 5</small></span>
        <ReviewStars rating={review.rating} />
      </div>
    </header>
    <ReviewBody review={review} />
    {!!topics.criticisms.length && <section className={styles.concerns} aria-label="Criticism in this review">
      <div className={styles.concernHeading}><MessageCircle size={14} aria-hidden="true" /><span>Points to improve</span><small>{topics.criticisms.length} {topics.criticisms.length === 1 ? 'topic' : 'topics'}</small></div>
      <div className={styles.concernList}>{topics.criticisms.map((issue, index) => <div className={styles.concern} key={`${issue.topic}:${index}`}>
        <strong>{reviewCategoryLabel(issue.topic)}</strong>
        <p>{'explanation' in issue && issue.explanation ? String(issue.explanation) : issue.excerpt}</p>
        {'explanation' in issue && !!issue.explanation && <blockquote>“{issue.excerpt}”</blockquote>}
        {'confidence' in issue && issue.confidence === 'low' && <small>Possible criticism · needs review</small>}
      </div>)}</div>
    </section>}
    {reviewHasComment(review) && !!topics.categories.length && <div className={styles.topics} aria-label="Review topics">{topics.categories.map(topic => onTopicChange
      ? <button key={topic} onClick={() => onTopicChange(topic)}>{topic === 'Other' ? 'General feedback' : reviewCategoryLabel(topic)}</button>
      : <span key={topic}>{topic === 'Other' ? 'General feedback' : reviewCategoryLabel(topic)}</span>)}</div>}
    <footer className={styles.reviewFooter}>
      {review.reply ? <details className={styles.ownerReply}><summary><MessageCircle size={14} aria-hidden="true" />Ysabel Society’s reply</summary><p>{review.reply}</p></details>
        : <span className={styles.replyStatus}>No owner reply recorded</span>}
      {link && <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={15} aria-hidden="true" /></a>}
      {review.origin === 'api' && <span className={styles.source}><ShieldCheck size={13} aria-hidden="true" />Google source</span>}
    </footer>
  </article>;
}
