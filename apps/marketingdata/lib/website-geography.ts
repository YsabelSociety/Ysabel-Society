import type { Range } from './analytics';

export type GeoAudience = 'all' | 'new' | 'returning';
export type GeoDevice = 'all' | 'mobile' | 'desktop' | 'tablet';
export type GeoMetric = 'sessions' | 'activeUsers' | 'engagedSessions';
export type GeoRow = { countryId?: string | null; country?: string | null; region?: string | null; city?: string | null } & Record<GeoMetric, number | null>;
export type GeoResult = {
  source: string; period: Range; audience: GeoAudience; device: GeoDevice; observedAt: string;
  totals: GeoRow | null;
  countries: { rows: GeoRow[]; truncated: boolean; thresholded: boolean; sampled: boolean; timezone: string };
  cities: { rows: GeoRow[]; truncated: boolean; thresholded: boolean; sampled: boolean; timezone: string };
};
export type CityReference = [string, string, string, number, number, string[], string[]];
export type CityPoint = { key: string; name: string; country: string; code: string; region: string; lat: number; lng: number; row: GeoRow };
export const geographyNormalize = (value: unknown) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function locationName(value: unknown) { return !value || ['(not set)', '(other)', '(not provided)'].includes(String(value)) ? 'Location not reported' : String(value); }
export function countryCode(row: GeoRow) { const code = String(row.countryId || '').toUpperCase(); return /^[A-Z]{2}$/.test(code) ? code : ''; }
export function cityKey(row: GeoRow) { return [countryCode(row), row.region || '', row.city || ''].join('|'); }

// Reference city centres, never visitor coordinates. Match within the reported
// country; use region to resolve same-name towns. Ambiguous places stay unplaced.
export function locateCities(rows: GeoRow[], references: Map<string, CityReference[]>) {
  const indexes = new Map<string, Map<string, CityReference[]>>();
  for (const [code, cities] of references) {
    const aliases = new Map<string, CityReference[]>();
    for (const city of cities) for (const name of new Set([geographyNormalize(city[1]), ...city[5]])) {
      const existing = aliases.get(name) || []; existing.push(city); aliases.set(name, existing);
    }
    indexes.set(code, aliases);
  }
  const points: CityPoint[] = [], unmapped: GeoRow[] = [];
  for (const row of rows) {
    const code = countryCode(row), name = geographyNormalize(row.city);
    let matches = indexes.get(code)?.get(name) || [];
    if (matches.length > 1 && row.region) {
      const region = geographyNormalize(row.region), narrowed = matches.filter(city => city[6].includes(region));
      if (narrowed.length) matches = narrowed;
    }
    if (!name || locationName(row.city) === 'Location not reported' || matches.length !== 1) { unmapped.push(row); continue; }
    const city = matches[0];
    points.push({ key: cityKey(row), name: String(row.city), code, country: locationName(row.country), region: String(row.region || ''), lat: city[3], lng: city[4], row });
  }
  return { points, unmapped };
}
export function geographyCSV(rows: GeoRow[]) {
  const columns = ['country', 'countryId', 'region', 'city', 'sessions', 'activeUsers', 'engagedSessions'] as const;
  const escape = (value: unknown) => { let text = String(value ?? ''); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
  return [columns.join(','), ...rows.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n');
}
