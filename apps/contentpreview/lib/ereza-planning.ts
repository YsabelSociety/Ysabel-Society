export const VENUES = ['Ysabel Garden', 'Ysabel Asian', 'Ysabel Italian'] as const;
export type Venue = typeof VENUES[number];
export const VENUE_COLORS: Record<Venue, string> = { 'Ysabel Garden': '#dce9d5', 'Ysabel Asian': '#f2d9d7', 'Ysabel Italian': '#f6e8b9' };
export const FORMATS = ['Story', 'Reel', 'Photo', 'Carousel', 'Video', 'Other'] as const;
export const CHANNELS = ['Instagram', 'Facebook', 'TikTok'] as const;
export const STATUSES = ['Idea', 'Planned', 'Ready', 'Posted'] as const;
export type Plan = {
  id: string; date: string; time: string; venue: Venue; title: string;
  format: typeof FORMATS[number]; channels: string[]; status: typeof STATUSES[number];
  notes: string; referenceUrl: string; color: string | null; revision: number;
};
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const validMonth = (value: string) => /^(19|20|21|22)\d{2}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) <= 2200;
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0, 7))) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function shiftMonth(month: string, amount: number) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + count ? `${month}-${String(i - offset + 1).padStart(2, '0')}` : null);
}
export function colorInk(color: string) {
  const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? '#171c17' : '#ffffff';
}
export class PlanInputError extends Error {}
export function validatePlan(value: unknown): Plan {
  if (!value || typeof value !== 'object') throw new PlanInputError('Add the content details first.');
  const p = value as Record<string, unknown>;
  const text = (field: string, max: number) => {
    if (typeof p[field] !== 'string' || (p[field] as string).length > max) throw new PlanInputError(`Check the ${field} field.`);
    return (p[field] as string).trim();
  };
  const id = text('id', 36);
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new PlanInputError('Invalid plan ID.');
  const date = text('date', 10), time = text('time', 5), title = text('title', 180);
  if (!validDate(date)) throw new PlanInputError('Choose a valid date between 1900 and 2200.');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new PlanInputError('Choose a valid posting time.');
  if (!title) throw new PlanInputError('Give this content a title.');
  if (!VENUES.includes(p.venue as Venue) || !FORMATS.includes(p.format as Plan['format']) || !STATUSES.includes(p.status as Plan['status'])) throw new PlanInputError('Choose a venue, format and status.');
  if (!Array.isArray(p.channels) || p.channels.some(c => !CHANNELS.includes(c as typeof CHANNELS[number]))) throw new PlanInputError('Choose valid social channels.');
  if (p.color !== null && !validColor(p.color)) throw new PlanInputError('Choose a valid color.');
  if (typeof p.revision !== 'number' || !Number.isSafeInteger(p.revision) || p.revision < 0) throw new PlanInputError('Invalid plan revision.');
  const referenceUrl = text('referenceUrl', 2000);
  if (referenceUrl) {
    try { if (!['https:', 'http:'].includes(new URL(referenceUrl).protocol)) throw new Error(); }
    catch { throw new PlanInputError('Use a complete http or https reference link.'); }
  }
  return { id, date, time, title, venue: p.venue as Venue, format: p.format as Plan['format'], status: p.status as Plan['status'], channels: [...new Set(p.channels)] as string[], color: p.color as string | null, notes: text('notes', 10000), referenceUrl, revision: p.revision };
}
