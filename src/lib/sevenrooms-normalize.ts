export type RawRow = Record<string,unknown>;
export const venueNames:Record<string,string>={asian:'Ysabel Asian',italian:'Ysabel Italian',garden:'Ysabel Garden'};
export const text=(x:unknown)=>x == null ? '' : String(x).trim();
export const validEmail=(x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
export function phone(x:unknown) {let s=text(x).replace(/[\s().-]/g,'');if(s.startsWith('00'))s='+'+s.slice(2);if(/^0[4][3-9]\d{6}$/.test(s))s='+383'+s.slice(1);return /^\+\d{8,15}$/.test(s)?s:'';}
export function date(x:unknown):string {
 if(x instanceof Date)return x.toISOString().slice(0,10);
 if(typeof x==='number' && x>20000&&x<90000)return new Date(Date.UTC(1899,11,30)+x*86400000).toISOString().slice(0,10);
 const s=text(x);if(/^\d{4}-\d\d-\d\d/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;return '';
}
export function birthday(x:unknown) {const d=date(x);if(d)return d.slice(5);const m=text(x).match(/^(\d{1,2})[/-](\d{1,2})$/);if(!m)return '';const mm=Number(m[1]),dd=Number(m[2]);return mm>=1&&mm<=12&&dd>=1&&dd<=new Date(2024,mm,0).getDate()?`${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:'';}
export function venue(x:unknown,aliases:Record<string,string>={}) {const s=text(x).toLowerCase();return aliases[s] || ({asian:'asian','ysabel asian':'asian',italian:'italian','ysabel italian':'italian',garden:'garden','ysabel garden':'garden'} as Record<string,string>)[s] || (s?'unmapped:'+s:'');}
const number=(x:unknown)=>Math.max(0,Math.floor(Number(x)||0));
export function tags(x:unknown) {return text(x).split(/[;|\n]/).map(x=>x.replace(/Group Marketing Opt-Ins\s*:?/gi,'Marketing preferences').trim()).filter(Boolean);}
export const clientColumns=['Full Name','Guest Email','Phone Number','Guest ID','Total Visits','Birthday Date','Last Visit (Date)','Last Visit (Venue Name)','Marketing Opt In - Parent Group (Yes / No)','Marketing Opt in- Venue Names','Total Cancellations','Total Noshows','Client Tag Categories + Names','Notes'];
export const reservationColumns=['Guest ID','Confirmation #','Venue Name','Full Name (Reservation)','Guest Email','Phone Number','Reservation Date','Reservation Time','Reservation Status','Booked Covers','Birthday','Client Notes','Reservation Notes','Client Requests','Feedback Notes','Reservation Tag Categories + Names','Client Tag Categories + Names'];
export function normalize(r:RawRow,kind:string,aliases:Record<string,string>={}) {
 const emailOriginal=text(r['Guest Email']), email=emailOriginal.toLowerCase();
 const consent=text(r['Marketing Opt In - Parent Group (Yes / No)']).toLowerCase();
 const common={external_id:text(r['Guest ID']),name:text(r[kind==='clients'?'Full Name':'Full Name (Reservation)']),email_original:emailOriginal,email:validEmail(email)?email:'',phone_original:text(r['Phone Number']),phone:phone(r['Phone Number']),birthday:birthday(r[kind==='clients'?'Birthday Date':'Birthday']),consent:consent==='yes'?'yes':consent==='no'?'no':'unknown',consent_venues:JSON.stringify(text(r['Marketing Opt in- Venue Names']).split(',').map(v=>venue(v,aliases)).filter(Boolean)),tags:JSON.stringify(tags(r['Client Tag Categories + Names'])),raw:r};
 if(kind==='clients')return {...common,source_visits:number(r['Total Visits']),source_last:date(r['Last Visit (Date)']),source_venue:venue(r['Last Visit (Venue Name)'],aliases),source_cancellations:number(r['Total Cancellations']),source_no_shows:number(r['Total Noshows']),notes:text(r.Notes),created_at:date(r['Profile Creation Date'])};
 const original=text(r['Reservation Status']),s=original.toLowerCase().replace(/[ _-]/g,'');
 return {...common,reservation_id:text(r['Confirmation #']),venue:venue(r['Venue Name'],aliases),venue_original:text(r['Venue Name']),date:date(r['Reservation Date']),time:text(r['Reservation Time']),covers:number(r['Booked Covers']),status:({complete:'completed',completed:'completed',canceled:'cancelled',cancelled:'cancelled',noshow:'no-show',future:'upcoming',confirmed:'upcoming'} as Record<string,string>)[s]||'unknown',status_original:original,reservation_tags:JSON.stringify(tags(r['Reservation Tag Categories + Names'])),notes:JSON.stringify({guest:text(r['Client Notes']),reservation:text(r['Reservation Notes']),requests:text(r['Client Requests']),feedback:text(r['Feedback Notes'])})};
}
