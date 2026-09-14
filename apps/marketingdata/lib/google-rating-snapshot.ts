// Direct Google observations. Owner-provided monthly references stay separate.
export const googleRatingMonthlyReferences: Record<string, number> = {'2026-08':4.1};
export type GoogleRatingObservation = {rating:number;reviewCount:number;date:string;source?:string;sourceUrl?:string};
export const googleRatingHistory: GoogleRatingObservation[] = [
  {rating:4.2,reviewCount:335,date:'2026-09-13'},
  {rating:4.2,reviewCount:341,date:'2026-09-14'},
];
export const googleRatingSnapshot = googleRatingHistory[googleRatingHistory.length-1];
export const googleRatingSourceUrl = 'https://www.google.com/maps/place/Ysabel+Society/data=!4m2!3m1!1s0x13549f756907d059:0xdc8ba3228b3c148b';
export function previousMonthRating(today:string,history:GoogleRatingObservation[]) {
  const start=new Date(today.slice(0,7)+'-01T12:00:00Z');
  start.setUTCMonth(start.getUTCMonth()-1);
  const month=start.toISOString().slice(0,7);
  // Latest dated reference in the previous calendar month; UI preserves source provenance.
  const observation=history.filter(r=>r.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date))[0] ?? null;
  return {month,observation};
}
