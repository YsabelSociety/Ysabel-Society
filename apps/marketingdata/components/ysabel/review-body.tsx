'use client';
import { useState } from 'react';
import { ChevronDown, ImageIcon, Languages, Quote } from 'lucide-react';
import { safeProfileURL, type CommunityRecord } from '@/lib/community';
import styles from './google-reviews.module.css';

function AttachedPhoto({ url, caption }: { url: string; caption?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <a className={styles.photoFallback} href={url} target="_blank" rel="noreferrer"><ImageIcon size={20} />Open attached photo</a>;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url.replace(/=s\d+-w\d+-h\d+/, '=s640-w640-h480')} width={192} height={144} alt={caption || 'Customer photo attached to this review'} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></a>;
}

export function reviewHasComment(review: CommunityRecord) {
  const text = (review.reviewAnalysis?.englishText || review.text)?.trim() || '';
  return !!text && !/^(?:no written comment\.?|no comment\.?|rated without (?:a )?written comment\.?)$/i.test(text);
}

export function ReviewBody({ review }: { review: CommunityRecord }) {
  const [expanded, setExpanded] = useState(false);
  const ai = review.reviewAnalysis;
  const text = (ai?.englishText || review.text)?.trim() || '';
  const hasComment = reviewHasComment(review);
  const translated = !!ai?.englishText && hasComment && ai.englishText !== review.text;
  const longComment = hasComment && text.length > 700;
  const photos = (review.reviewPhotos || []).filter(photo => safeProfileURL(photo.url));
  return <>
    <div className={styles.officialReview} data-empty={!hasComment}>
      <div className={styles.quoteLabel}><Quote size={15} aria-hidden="true" /><span>{translated ? 'Review · English translation' : 'The guest’s review'}</span></div>
      <p className={styles.reviewText} data-collapsed={longComment && !expanded}>{hasComment ? text : 'This guest left a star rating without a written comment.'}</p>
      {longComment && <button className={styles.expandReview} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read full review'}<ChevronDown size={14} aria-hidden="true" /></button>}
    </div>
    {ai && hasComment && <div className={styles.analysisNote}><Languages size={13} aria-hidden="true" />{ai.language !== 'en' ? 'Translated into English · ' : ''}AI reviewed {new Date(ai.analyzedAt).toLocaleDateString('en-GB')}
      {translated && <details><summary>Read original review</summary><p>{review.text}</p></details>}
    </div>}
    {!!photos.length && <section className={styles.photos} aria-label="Photos attached to this review"><span className={styles.photoLabel}><ImageIcon size={14} aria-hidden="true" />Guest photos · {photos.length}</span><div className={styles.photoGrid}>{photos.map(photo => <AttachedPhoto key={photo.url} url={photo.url} caption={photo.caption} />)}</div></section>}
  </>;
}
