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
