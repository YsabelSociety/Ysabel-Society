import { CHANNELS, type Channel, type Range } from './analytics';
import { SOURCE_CHANNELS } from './connector-catalog';
import {
  emptyDaily,
  finite,
  importedPost,
  putMetric,
  putPost,
  resultSet,
  safeMedia,
} from './reporting';
export const DAILY_FIELDS = [
  'views',
  'reach',
  'engagements',
  'followers',
  'users',
  'actions',
  'conversions',
  'search',
  'maps',
  'calls',
  'directions',
  'clicks',
  'sessions',
  'engaged',
  'pageViews',
  'menu',
  'reservation',
  'bookings',
  'foodOrders',
  'newUsers',
  'engagementSeconds',
  'profileViews',
  'follows',
  'unfollows',
  'mediaViewers',
  'likes',
  'comments',
  'shares',
  'reshares',
  'reposts',
];
export const POST_FIELDS = [
  'views',
  'reach',
  'likes',
  'comments',
  'saves',
  'shares',
  'reshares',
  'reposts',
  'engagements',
  'mediaViewers',
  'followers',
  'visits',
];
export function csvRows(text: string): Record<string, string>[] {
  text = text.replace(/^\uFEFF/, '');
  if (text.length > 3000000)
    throw new Error('INPUT:Use a CSV file smaller than 3 MB.');
  const delimiter =
    (text.split(/\r?\n/)[0].match(/;/g) || []).length >
    (text.split(/\r?\n/)[0].match(/,/g) || []).length
      ? ';'
      : ',';
  const records: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!cell || quoted) quoted = !quoted;
      else throw new Error('INPUT:Invalid CSV quoting. Export the file again.');
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((v) => v.trim())) records.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('INPUT:A CSV quoted cell was not closed.');
  row.push(cell);
  if (row.some((v) => v.trim())) records.push(row);
  const headers = records.shift()?.map((s) => s.trim());
  if (
    !headers?.length ||
    new Set(headers).size !== headers.length ||
    headers.some(
      (s) => !s || ['__proto__', 'constructor', 'prototype'].includes(s),
    )
  )
    throw new Error('INPUT:CSV needs unique, non-empty column headings.');
  if (headers.length > 80 || records.length > 10000)
    throw new Error('INPUT:Use at most 80 columns and 10,000 rows per import.');
  return records.map((row, i) => {
    if (row.length !== headers.length)
      throw new Error(
        'INPUT:CSV row ' + (i + 2) + ' has a different number of columns.',
      );
    return Object.fromEntries(headers.map((h, n) => [h, row[n]]));
  });
}
function date(value: unknown) {
  const s = String(value || '').slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error(
      'INPUT:Dates must use YYYY-MM-DD. Check the date column mapping.',
    );
  return s;
}
function numberValue(value: unknown, row: number, key: string) {
  if (value === undefined || String(value).trim() === '') return null;
  const n = finite(String(value).replaceAll(',', ''));
  if (n === null)
    throw new Error(
      'INPUT:Row ' +
        row +
        ' has an invalid non-negative number in ' +
        key +
        '. Leave unavailable values blank.',
    );
  return n;
}
export function parseImport(
  source: string,
  kind: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  range: Range,
  title: string,
) {
  const channel = SOURCE_CHANNELS[source];
  if (!channel) throw new Error('INPUT:Choose a supported platform.');
  if (!rows.length) throw new Error('INPUT:The file has no rows.');
  const result = resultSet(),
    get = (r: Record<string, string>, key: string) =>
      r[
        Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : key
      ];
  if (kind === 'daily') {
    if (!(CHANNELS as readonly string[]).includes(channel))
      throw new Error(
        'INPUT:Advertising files belong in an advertising report, separate from organic daily data.',
      );
    const seen = new Set<string>();
    result.daily = rows.map((r, i) => {
      const day = date(get(r, 'date'));
      if (day < range.start || day > range.end)
        throw new Error(
          'INPUT:All daily dates must fall within the stated import period.',
        );
      if (seen.has(day))
        throw new Error(
          'INPUT:Only one total per date is allowed. Remove duplicate dates or select a detailed report import.',
        );
      seen.add(day);
      const d = emptyDaily(day, channel as Channel);
      for (const key of DAILY_FIELDS)
        putMetric(d, key, numberValue(get(r, key), i + 2, key));
      if (!d.available?.length)
        throw new Error(
          'INPUT:Map at least one numeric metric for each daily row.',
        );
      d.sourceMetrics = {
        origin: 'file',
        original: r,
        definition:
          'User-mapped daily totals from the uploaded export. File values have not been verified against the provider.',
      };
      return d;
    });
  } else if (kind === 'posts') {
    if (!['Instagram', 'Facebook', 'TikTok'].includes(channel))
      throw new Error('INPUT:Post imports are for social platforms.');
    const ids = new Set<string>();
    result.posts = rows.map((r, i) => {
      const id = get(r, 'id');
      if (!id || id.length > 200 || ids.has(id))
        throw new Error('INPUT:Posts need unique provider post IDs.');
      ids.add(id);
      const timestamp = get(r, 'publishedAt') || get(r, 'date');
      const day = date(timestamp);
      if (day < range.start || day > range.end)
        throw new Error(
          'INPUT:Post publication dates must fall within the stated period.',
        );
      const p = importedPost(
        channel as Channel,
        id,
        timestamp,
        get(r, 'title') || 'Imported content',
      );
      p.date = day;
      p.origin = 'file';
      p.caption = get(r, 'caption') || p.title;
      p.image = safeMedia(get(r, 'image'));
      p.permalink = safeMedia(get(r, 'permalink'));
      p.format = get(r, 'format') || 'Post';
      p.tags = (get(r, 'tags') || '').split('|').filter(Boolean);
      p.campaign = get(r, 'campaign') || '';
      for (const key of POST_FIELDS)
        putPost(p, key, numberValue(get(r, key), i + 2, key));
      p.sourceMetrics = { original: r, origin: 'file' };
      return p;
    });
  } else {
    if (
      !['audience', 'website', 'business', 'advertising', 'detail'].includes(
        kind,
      )
    )
      throw new Error('INPUT:Choose a report type.');
    const normalized = rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([key, value]) => [
          key,
          value === ''
            ? null
            : /^-?\d+(\.\d+)?$/.test(value)
              ? Number(value)
              : value,
        ]),
      ),
    );
    result.tables.push({
      key:
        kind +
        '-file-' +
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 50),
      title,
      source,
      columns: Object.keys(rows[0]),
      rows: normalized,
      period: range,
      scope:
        'Uploaded provider export for the stated period. Original column definitions and aggregation apply. These file values have not been independently verified against the provider.',
    });
  }
  result.checks.push({
    key: 'file',
    label: title,
    status: 'imported',
    records: rows.length,
    detail:
      'File imported with original source columns retained. Blank cells remain unavailable.',
  });
  result.scope = 'Uploaded file. Refresh by uploading the next export.';
  return result;
}
