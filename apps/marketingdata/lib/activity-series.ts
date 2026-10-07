import type { Daily, Range } from './analytics';
export function activitySeries(
  rows: Daily[],
  channel: string,
  metric: keyof Daily,
  range?: Range,
) {
  const selected = rows
    .filter((r) => r.channel === channel && (!range || r.date >= range.start && r.date <= range.end))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!selected.length && !range) return [];
  const values = new Map<string, number>();
  for (const row of selected) {
    const value = row[metric];
    if (
      (!row.available || row.available.includes(metric)) &&
      typeof value === 'number' &&
      Number.isFinite(value)
    )
      values.set(row.date, (values.get(row.date) || 0) + value);
  }
  const points: { date: string; value: number | null }[] = [];
  for (
    let time = Date.parse((range?.start || selected[0].date) + 'T12:00:00Z');
    time <= Date.parse((range?.end || selected.at(-1)!.date) + 'T12:00:00Z');
    time += 86400000
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    points.push({ date, value: values.get(date) ?? null });
  }
  return points;
}
