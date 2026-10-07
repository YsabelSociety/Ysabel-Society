import { getPosition, getTimes } from 'suncalc';

export const PRISHTINA = { latitude: 42.6629, longitude: 21.1655, timeZone: 'Europe/Tirane' } as const;
const partsFormat = new Intl.DateTimeFormat('en-GB', { timeZone: PRISHTINA.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const cityDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: PRISHTINA.timeZone, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
export const cityTimeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: PRISHTINA.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: PRISHTINA.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (low: number, high: number, value: number) => { const x = clamp((value - low) / (high - low)); return x * x * (3 - 2 * x); };
const localParts = (date: Date) => Object.fromEntries(partsFormat.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
export function cityUtcOffset(date: Date) {
  const p = localParts(date);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000);
}
/** Local calendar boundaries, including the 23/25-hour daylight-saving days. */
export function cityDayBounds(date: Date) {
  const p = localParts(date);
  const midnight = (day: number) => {
    const local = Date.UTC(p.year, p.month - 1, day);
    let utc = local;
    for (let i = 0; i < 3; i++) utc = local - cityUtcOffset(new Date(utc)) * 60000;
    return utc;
  };
  return { start: midnight(p.day), end: midnight(p.day + 1) };
}
export function getPrishtinaDaylight(date: Date) {
  const { latitude, longitude } = PRISHTINA;
  const { altitude } = getPosition(date, latitude, longitude);
  const times = getTimes(date, latitude, longitude, 0, cityUtcOffset(date));
  const morning = date.getTime() < times.solarNoon.getTime();
  const progress = times.sunrise && times.sunset ? clamp((date.getTime() - times.sunrise.getTime()) / (times.sunset.getTime() - times.sunrise.getTime())) : .5;
  const daylight = smooth(-6, 18, altitude);
  const golden = (1 - smooth(3, 18, altitude)) * smooth(-6, 0, altitude);
  const night = 1 - smooth(-9, 0, altitude);
  const phase = altitude < -6 ? 'Night' : altitude < -.833 ? (morning ? 'Dawn' : 'Twilight') : altitude < 12 ? (morning ? 'Morning' : 'Sunset') : 'Daylight';
  return { altitude, progress, daylight, golden, night, phase, sunOpacity: smooth(-3, 1, altitude), sunX: 92 - 84 * progress, sunY: 74 - 58 * Math.sin(Math.PI * progress), sunrise: times.sunrise, sunset: times.sunset, sunriseLabel: times.sunrise ? clockFormat.format(times.sunrise) : '—', sunsetLabel: times.sunset ? clockFormat.format(times.sunset) : '—' };
}

const blend = (a: string, b: string, amount: number) => {
  const x = a.match(/[a-f0-9]{2}/gi)!.map(v => parseInt(v, 16)), y = b.match(/[a-f0-9]{2}/gi)!.map(v => parseInt(v, 16));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * amount).toString(16).padStart(2, '0')).join('');
};
export function getPrishtinaSky(daylight: number, golden: number) {
  return { top: blend(blend('#203342', '#e5eef2', daylight), '#d8bcb0', golden * .55), horizon: blend(blend('#485363', '#f2f2e5', daylight), '#efcfb4', golden * .75) };
}
