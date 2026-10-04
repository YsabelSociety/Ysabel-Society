export function feedbackMonthLabel(month: string) {
  if (month === 'undated') return 'Date not recorded';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'All months';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(month + '-01T12:00:00Z'));
}

export function groupFeedbackByMonth<T extends { date?: string }>(rows: T[]) {
  const groups: Record<string, T[]> = {};
  for (const row of rows) {
    const month = row.date?.slice(0, 7) || 'undated';
    (groups[month] ||= []).push(row);
  }
  return Object.entries(groups);
}

export const feedbackRatingSelections = [
  { value: 'all', label: 'All reviews together', note: 'Includes every rating and responses without an overall rating.' },
  { value: 'negative', label: 'Negative reviews (1-3 stars)', note: 'Based on the overall guest rating. Includes written comments and rating-only responses.' },
  { value: 'positive', label: 'Positive reviews (4-5 stars)', note: 'Based on the overall guest rating. Any criticism in these reviews remains highlighted in the PDF.' },
  { value: 'complaints', label: 'Complaints at any rating', note: 'Low overall or category scores, plus written criticism, including comments in 4-5 star reviews.' },
] as const;

export function feedbackRatingLabel(value: string) {
  return value === 'critical' ? 'Any score of 1-3 stars' : feedbackRatingSelections.find(selection => selection.value === value)?.label || 'All reviews together';
}
export function feedbackRatingNote(value: string) {
  return value === 'critical' ? 'An overall or category score of 1-3 stars.' : feedbackRatingSelections.find(selection => selection.value === value)?.note || feedbackRatingSelections[0].note;
}
export function feedbackReportFilename(scope: { month: string; venue: string; rating: string; comments: string }) {
  const group = scope.rating === 'all' ? '' : '-' + scope.rating;
  const content = scope.comments === 'written' ? '-comments' : '';
  return `ysabel-sevenrooms-reviews-${scope.month}-${scope.venue}${group}${content}.pdf`;
}
