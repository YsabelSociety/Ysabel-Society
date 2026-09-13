import { csvRows } from './import-file';
import { emptyDaily, finite, putMetric, resultSet } from './reporting';
import type { Range } from './analytics';

const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
function studioDate(value: string, range: Range) {
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= range.start &&
    value <= range.end
  )
    return value;
  const match = value.trim().match(/^([a-z]+)\s+(\d{1,2})$/i);
  if (!match) throw new Error('INPUT:Unrecognized TikTok date: ' + value);
  const month = months.indexOf(match[1].toLowerCase()) + 1;
  const candidates = [];
  for (
    let year = Number(range.start.slice(0, 4));
    year <= Number(range.end.slice(0, 4));
    year++
  ) {
    const date = `${year}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    if (
      month &&
      date >= range.start &&
      date <= range.end &&
      new Date(date).toISOString().slice(0, 10) === date
    )
      candidates.push(date);
  }
  if (candidates.length !== 1)
    throw new Error(
      'INPUT:Choose the exact TikTok export period so each month/day has one matching year.',
    );
  return candidates[0];
}
export function parseTikTokStudio(
  files: { name: string; csv: string }[],
  range: Range,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(range.end) ||
    range.start > range.end ||
    Date.parse(range.end) - Date.parse(range.start) > 365 * 86400000
  )
    throw new Error('INPUT:Choose an export period of up to one year.');
  if (
    !files.length ||
    files.length > 12 ||
    files.reduce((n, f) => n + f.csv.length, 0) > 3000000
  )
    throw new Error(
      'INPUT:Choose up to 12 TikTok Studio CSV files totalling less than 3 MB.',
    );
  const result = resultSet(),
    days = new Map<string, ReturnType<typeof emptyDaily>>();
  for (const file of files) {
    const rows = csvRows(file.csv),
      name = file.name.replace(/\.csv$/i, '');
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const fields: Record<string, string> = headers.includes('Video Views')
      ? {
          'Video Views': 'views',
          'Profile Views': 'profileViews',
          Likes: 'likes',
          Comments: 'comments',
          Shares: 'shares',
        }
      : headers.includes('Total Viewers')
        ? { 'Total Viewers': 'mediaViewers', 'New Viewers': 'newUsers' }
        : headers.includes('Followers') && headers.includes('Date')
          ? { Followers: 'followers' }
          : {};
    if (Object.keys(fields).length) {
      const seen = new Set<string>();
      for (const row of rows) {
        const date = studioDate(row.Date, range);
        if (seen.has(date))
          throw new Error('INPUT:Duplicate dates in ' + file.name);
        seen.add(date);
        const day = days.get(date) || emptyDaily(date, 'TikTok');
        for (const [from, to] of Object.entries(fields)) {
          const raw = row[from];
          if (['undefined', 'null', '--', ''].includes(raw?.trim())) continue;
          // Studio can report negative net interactions after removals. Keep
          // those supplied adjustments instead of silently replacing them by zero.
          if (
            ['likes', 'comments', 'shares'].includes(to) &&
            Number.isFinite(Number(raw)) &&
            Number(raw) < 0
          ) {
            (day as unknown as Record<string, unknown>)[to] = Number(raw);
            day.available = [...new Set([...(day.available || []), to])];
            continue;
          }
          if (finite(raw) === null)
            throw new Error('INPUT:Invalid TikTok statistic in ' + file.name);
          putMetric(day, to, raw);
        }
        if (
          headers.includes('Video Views') &&
          ['Likes', 'Comments', 'Shares'].every(
            (k) => row[k]?.trim() && Number.isFinite(Number(row[k])),
          )
        ) {
          (day as unknown as Record<string, unknown>).engagements =
            Number(row.Likes) + Number(row.Comments) + Number(row.Shares);
          day.available = [
            ...new Set([...(day.available || []), 'engagements']),
          ];
        }
        day.sourceMetrics = {
          ...day.sourceMetrics,
          studioImport: true,
          studioPeriod: range,
          definition:
            'TikTok Studio daily report. Engagements sum likes, comments and shares, including provider-reported negative net adjustments. Undefined cells remain unavailable. Video views are daily activity, not lifetime content views.',
        };
        if (day.available?.length) days.set(date, day);
      }
    } else if (headers.includes('Distribution')) {
      const dimension = headers.includes('Gender')
        ? 'gender'
        : headers.includes('Top territories')
          ? 'country'
          : headers.includes('Age')
            ? 'age'
            : '';
      if (!dimension)
        throw new Error('INPUT:Unrecognized TikTok audience export.');
      const from =
        dimension === 'gender'
          ? 'Gender'
          : dimension === 'country'
            ? 'Top territories'
            : 'Age';
      const normalized = rows.map((row) => {
        const fraction = finite(row.Distribution);
        if (fraction === null || fraction > 1)
          throw new Error('INPUT:TikTok distribution must be between 0 and 1.');
        return {
          [dimension]: row[from],
          percentage: Number((fraction * 100).toFixed(4)),
        };
      });
      const viewer = name.toLowerCase().startsWith('viewer');
      result.tables.push({
        key: (viewer ? 'viewer-' : 'audience-') + dimension,
        title:
          'TikTok ' + (viewer ? 'viewers' : 'followers') + ' by ' + dimension,
        source: 'tiktok',
        columns: [dimension, 'percentage'],
        rows: normalized,
        period: range,
        scope:
          'TikTok Studio ' +
          (viewer
            ? 'viewer distribution for the selected period'
            : 'current follower distribution at export') +
          '. Percentages supplied by TikTok; these are not inferred follower counts.',
      });
    } else if (
      headers.includes('Active followers') &&
      headers.includes('Hour')
    ) {
      result.tables.push({
        key: 'studio-follower-activity',
        title: 'TikTok follower active hours',
        source: 'tiktok',
        columns: headers,
        rows: rows.map((row) => ({
          ...row,
          'Active followers': finite(row['Active followers']),
        })),
        period: range,
        scope:
          'TikTok Studio recent active hours. The export contains its recent activity window even when a longer history is selected; dates are preserved exactly as supplied.',
      });
    } else
      throw new Error('INPUT:Unrecognized TikTok Studio CSV: ' + file.name);
    result.checks.push({
      key: 'studio-' + name,
      label: name,
      status: 'imported',
      records: rows.length,
      detail:
        'TikTok Studio source file imported. Undefined values are left blank.',
    });
  }
  result.daily = [...days.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  result.scope =
    'TikTok Studio reports imported alongside the automatic Display API connection. Studio daily and audience reports refresh when a new export is imported.';
  return result;
}
