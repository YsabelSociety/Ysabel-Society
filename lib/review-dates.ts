import { localDate, type CommunityRecord } from './community';
import { type Range } from './analytics';

export const REVIEW_PERIODS = [
  'All dates',
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom dates',
  'Dashboard dates',
] as const;
export type ReviewDateSelection = {
  mode: (typeof REVIEW_PERIODS)[number];
  anchor: string;
  start: string;
  end: string;
  approximate: boolean;
};
const day = (s: string) => new Date(s + 'T12:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(+day(value)) &&
    iso(day(value)) === value
  );
}
export function reviewPeriodRange(
  selection: ReviewDateSelection,
  dashboard: Range,
): Range | null {
  if (selection.mode === 'All dates') return null;
  if (selection.mode === 'Dashboard dates') return dashboard;
  if (selection.mode === 'Custom dates')
    return { start: selection.start, end: selection.end };
  if (!validDay(selection.anchor)) return { start: '', end: '' };
  const start = day(selection.anchor),
    end = day(selection.anchor);
  if (selection.mode === 'Weekly') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(+start);
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (selection.mode === 'Monthly') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (selection.mode === 'Yearly') {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }
  return { start: iso(start), end: iso(end) };
}
export function shiftReviewPeriod(
  s: ReviewDateSelection,
  direction: number,
): ReviewDateSelection {
  if (!validDay(s.anchor)) return s;
  const d = day(s.anchor);
  if (s.mode === 'Monthly') {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + direction);
  } else if (s.mode === 'Yearly') {
    d.setUTCMonth(0, 1);
    d.setUTCFullYear(d.getUTCFullYear() + direction);
  } else
    d.setUTCDate(d.getUTCDate() + direction * (s.mode === 'Weekly' ? 7 : 1));
  return { ...s, anchor: iso(d) };
}
// Relative source labels describe an interval, never an exact publication date.
export function reviewDateBounds(
  r: CommunityRecord,
  timezone: string,
): (Range & { approximate: boolean }) | null {
  if (!Number.isFinite(Date.parse(r.time))) return null;
  if (r.timePrecision !== 'relative') {
    const value = localDate(r.time, timezone);
    return { start: value, end: value, approximate: false };
  }
  const label = (r.timeLabel || '')
    .trim()
    .toLowerCase()
    .replace(/^edited\s+/, '');
  const capture = new Date(r.time);
  if (['yesterday', 'today', 'just now'].includes(label)) {
    const d = day(localDate(r.time, timezone));
    if (label === 'yesterday') d.setUTCDate(d.getUTCDate() - 1);
    return { start: iso(d), end: iso(d), approximate: true };
  }
  const m = label.match(
    /^(\d+|an?|one)\s+(minute|hour|day|week|month|year)s?\s+ago$/,
  );
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  if (n > 10000) return null;
  const units: Record<string, number> = {
    minute: 60000,
    hour: 3600000,
    day: 86400000,
    week: 604800000,
    month: 31 * 86400000,
    year: 366 * 86400000,
  };
  // Months and years vary in length. Widen those bounds rather than invent precision.
  const minimum =
    m[2] === 'month'
      ? 28 * 86400000
      : m[2] === 'year'
        ? 365 * 86400000
        : units[m[2]];
  const start = localDate(
    new Date(+capture - (n + 1) * units[m[2]]).toISOString(),
    timezone,
  );
  const end = localDate(
    new Date(+capture - n * minimum).toISOString(),
    timezone,
  );
  return { start, end, approximate: true };
}
export function reviewMatchesDates(
  r: CommunityRecord,
  range: Range | null,
  timezone: string,
  approximate = false,
) {
  if (!range) return true;
  if (!validDay(range.start) || !validDay(range.end) || range.start > range.end)
    return false;
  const bounds = reviewDateBounds(r, timezone);
  return (
    !!bounds &&
    (!bounds.approximate || approximate) &&
    bounds.start <= range.end &&
    bounds.end >= range.start
  );
}
export function reviewPeriodLabel(s: ReviewDateSelection, dashboard: Range) {
  const r = reviewPeriodRange(s, dashboard);
  return r ? `${s.mode} · ${r.start} – ${r.end}` : 'All imported dates';
}
