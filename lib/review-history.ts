import type { CommunityRecord } from './community';
// These are counts of captured records, using the imported review month.
// Existing filters decide whether approximate dates are included.
export function reviewMonthHistory(
  basis: CommunityRecord[],
  selected: CommunityRecord[],
) {
  const month = (r: CommunityRecord) =>
    /^\d{4}-(0[1-9]|1[0-2])/.test(r.time) ? r.time.slice(0, 7) : null;
  const months = [
    ...new Set(basis.map(month).filter((m): m is string => !!m)),
  ].sort();
  if (!months.length) return [];
  const counts = new Map<string, number>();
  for (const r of selected) {
    const m = month(r);
    if (m) counts.set(m, (counts.get(m) || 0) + 1);
  }
  const result: number[] = [];
  for (
    let d = new Date(months[0] + '-01T12:00:00Z');
    d.toISOString().slice(0, 7) <= months.at(-1)! && result.length < 1200;
    d.setUTCMonth(d.getUTCMonth() + 1)
  )
    result.push(counts.get(d.toISOString().slice(0, 7)) || 0);
  return result;
}
