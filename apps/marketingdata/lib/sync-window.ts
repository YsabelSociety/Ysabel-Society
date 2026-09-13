import { dateRange, type Range } from './analytics';
export function calendarDate(timezone = 'Europe/Tirane', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
export function recentSyncWindow(timezone?: string, now = new Date()): Range {
  return dateRange('Last 7 Days', undefined, calendarDate(timezone, now));
}
