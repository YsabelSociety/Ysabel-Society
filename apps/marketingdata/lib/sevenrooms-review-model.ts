import { classifyReview } from './review-language';
import type { CommunityRecord } from './community';
import type { GuestReview } from './sevenrooms-review-pdf';

export const SEVENROOMS_VENUE_THEMES: Record<string, { name: string; color: string; end: string; tint: string; ink: string }> = {
  garden: { name: 'Ysabel Garden', color: '#1D3428', end: '#52765F', tint: '#EDF3EE', ink: '#FFFFFF' },
  asian: { name: 'Ysabel Asian', color: '#970C21', end: '#CD061E', tint: '#FAEEF0', ink: '#FFFFFF' },
  italian: { name: 'Ysabel Italian', color: '#EAC426', end: '#F6E49A', tint: '#FBF7E8', ink: '#352C13' },
};
export type GuestReviewConcern = { topic: string; excerpt: string; evidence: 'Written feedback' | 'Category rating' };

/** Use the same contextual text detector as Google reviews; keep score evidence separate. */
export function guestReviewConcerns(row: GuestReview): GuestReviewConcern[] {
  const analysis = classifyReview({ text: row.feedback || '', rating: row.scores.overall ?? undefined } as CommunityRecord);
  const issues: GuestReviewConcern[] = analysis.criticisms.map(issue => ({ topic: issue.topic, excerpt: issue.excerpt, evidence: 'Written feedback' }));
  const add = (topic: string, excerpt: string) => {
    if (!issues.some(issue => issue.topic === topic && issue.evidence === 'Written feedback')) issues.push({ topic, excerpt: excerpt.trim(), evidence: 'Written feedback' });
  };
  // SevenRooms comments often use short fragments rather than full sentences.
  for (const sentence of (row.feedback || '').split(/(?<=[.!?;\n])\s+/)) {
    if (/\b(?:small|tiny|stingy|insufficient)\s+(?:portions?|servings?)\b/i.test(sentence)) add('Food', sentence);
  }
  for (const topic of ['food', 'drinks', 'service', 'atmosphere']) {
    const score = row.scores[topic];
    if (score != null && score >= 1 && score <= 3) issues.push({ topic: topic[0].toUpperCase() + topic.slice(1), excerpt: `${topic[0].toUpperCase() + topic.slice(1)} score: ${score} / 5`, evidence: 'Category rating' });
  }
  return issues;
}

/** Unrated and category-only responses stay in their own group; never invent overall stars. */
export function guestReviewStar(row: GuestReview) {
  const value = row.scores.overall;
  return Number.isInteger(value) && value! >= 1 && value! <= 5 ? value as number : null;
}
export function guestReviewRatingGroups(rows: GuestReview[]) {
  return [1, 2, 3, 4, 5, null].map(star => ({
    star,
    rows: rows.filter(row => guestReviewStar(row) === star).sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || '') || a.id.localeCompare(b.id)),
  }));
}
export function guestReviewVenueGroups(rows: GuestReview[], selectedVenue: string) {
  const keys = selectedVenue === 'all'
    ? [...Object.keys(SEVENROOMS_VENUE_THEMES), ...new Set(rows.map(row => row.venue).filter(venue => !SEVENROOMS_VENUE_THEMES[venue]))]
    : [selectedVenue];
  return keys.map(venue => ({ venue, rows: rows.filter(row => row.venue === venue) }));
}
