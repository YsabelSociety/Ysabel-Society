import {
  googleRatingHistory,
  googleRatingMonthlyReferences,
  googleRatingSourceUrl,
  type GoogleRatingObservation,
} from './google-rating-snapshot';

export type ReviewRatingPeriod = {
  month: string;
  label: string;
  rating: number | null;
  reviewCount: number | null;
  date: string | null;
  source: 'google' | 'owner-reference' | 'missing';
};
export type ReviewRatingComparison = {
  current: ReviewRatingPeriod;
  previous: ReviewRatingPeriod;
  delta: number | null;
  sourceUrl: string;
};

/** Compare Google profile observations, never an average of filtered criticisms. */
export function reviewRatingComparison(
  endDate: string,
  asOf: string,
  history: GoogleRatingObservation[] = googleRatingHistory,
  references: Record<string, number> = googleRatingMonthlyReferences,
): ReviewRatingComparison {
  const validEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    Number.isFinite(Date.parse(endDate + 'T12:00:00Z'));
  const cutoff = validEnd && endDate < asOf ? endDate : asOf;
  const month = cutoff.slice(0, 7);
  const previous = new Date(month + '-01T12:00:00Z');
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const period = (key: string): ReviewRatingPeriod => {
    const observation = history
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= cutoff &&
        r.date.slice(0, 7) === key && Number.isFinite(r.rating) &&
        r.rating >= 1 && r.rating <= 5 &&
        (!r.source || /^Google(?: Business)?(?: API)?$/i.test(r.source)))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const reference = references[key];
    const ownerReference = Number.isFinite(reference) && reference >= 1 && reference <= 5;
    return {
      month: key,
      label: new Date(key + '-01T12:00:00Z').toLocaleDateString('en-GB', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
      }),
      rating: observation ? Number(observation.rating.toFixed(1)) : ownerReference ? reference : null,
      reviewCount: observation?.reviewCount ?? null,
      date: observation?.date ?? null,
      source: observation ? 'google' : ownerReference ? 'owner-reference' : 'missing',
    };
  };
  const current = period(month), prior = period(previous.toISOString().slice(0, 7));
  return {
    current, previous: prior,
    delta: current.rating === null || prior.rating === null ? null :
      Math.round((current.rating - prior.rating) * 10) / 10,
    sourceUrl: googleRatingSourceUrl,
  };
}

export function ratingChangeLabel(comparison: ReviewRatingComparison) {
  const delta = comparison.delta;
  return delta === null ? 'Comparison unavailable' : delta === 0 ? 'No change' :
    `${delta > 0 ? '+' : ''}${delta.toFixed(1)} points`;
}

export function ratingPeriodNote(period: ReviewRatingPeriod) {
  return period.source === 'google' ? `Google observation ${period.date}` :
    period.source === 'owner-reference' ? 'Google rating reference supplied by Ysabel Society' :
    'Google rating not recorded for this month';
}
