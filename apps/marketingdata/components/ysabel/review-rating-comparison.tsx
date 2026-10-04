import { ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  ratingChangeLabel, ratingPeriodNote,
  type ReviewRatingComparison as Comparison,
} from '@/lib/review-rating-comparison';
import { ReviewStars } from './review-stars';
import styles from './review-rating-comparison.module.css';

export function ReviewRatingComparison({ comparison }: { comparison: Comparison }) {
  const { current, previous, delta } = comparison;
  const Change = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return <section className={styles.card} aria-label="Google rating compared with previous month">
    <div className={styles.heading}>
      <div><span>GOOGLE BUSINESS RATING</span><h3>Compared with the previous month</h3></div>
      <b className={styles.change} data-direction={delta !== null && delta < 0 ? 'down' : 'up'}>
        <Change size={17} aria-hidden="true" />{ratingChangeLabel(comparison)}
      </b>
    </div>
    <div className={styles.periods}>
      {[previous, current].map((period, i) => <div key={period.month} className={styles.period}>
        <small>{i === 0 ? 'PREVIOUS MONTH' : 'REPORT MONTH'} · {period.label}</small>
        <div className={styles.value}><strong>{period.rating?.toFixed(1) ?? '—'}</strong><span>/ 5</span>
          {period.rating !== null && <ReviewStars rating={period.rating} />}
        </div>
        <p>{ratingPeriodNote(period)}{period.reviewCount !== null ? ` · ${period.reviewCount} reviews` : ''}</p>
      </div>)}
      <ArrowRight className={styles.arrow} size={21} aria-hidden="true" />
    </div>
    <p className={styles.note}>Latest recorded Google rating in each month, separate from the average of your selected reviews. <a href={comparison.sourceUrl} target="_blank" rel="noreferrer">View on Google</a></p>
  </section>;
}
