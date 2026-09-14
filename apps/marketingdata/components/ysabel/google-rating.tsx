'use client';
import { useId, useEffect, useState } from 'react';
import { Star, ArrowUpRight } from 'lucide-react';
import { SourceBadge } from './source-badge';
import { calendarDate } from '@/lib/sync-window';
import { googleRatingSnapshot as savedSnapshot, googleRatingHistory, googleRatingMonthlyReferences, googleRatingSourceUrl, previousMonthRating, type GoogleRatingObservation } from '@/lib/google-rating-snapshot';
type RatingFeed = GoogleRatingObservation & {observedAt:string;history:GoogleRatingObservation[]};

function RatingStars({rating}:{rating:number}) {
 const id=useId().replace(/:/g,'');
 const path='M12 2.7 14.8 8.5 21.2 9.4 16.6 13.9 17.7 20.3 12 17.3 6.3 20.3 7.4 13.9 2.8 9.4 9.2 8.5Z';
 return <div className="rating-metal-stars" aria-hidden="true">{Array.from({length:5},(_,i)=><svg key={i} viewBox="0 0 24 24" className="rating-metal-star" style={{animationDelay:`${i*120}ms`}}>
  <defs><linearGradient id={`${id}-gold-${i}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff1c4"/><stop offset=".32" stopColor="#cfad62"/><stop offset=".52" stopColor="#f9e6a5"/><stop offset=".72" stopColor="#a4823b"/><stop offset="1" stopColor="#e8ce88"/></linearGradient><linearGradient id={`${id}-silver-${i}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fcfbff"/><stop offset=".5" stopColor="#b8b0c5"/><stop offset="1" stopColor="#eeeaf5"/></linearGradient><clipPath id={`${id}-fill-${i}`}><rect width={Math.max(0,Math.min(1,rating-i))*24} height="24"/></clipPath><clipPath id={`${id}-shape-${i}`}><path d={path}/></clipPath><linearGradient id={`${id}-light-${i}`}><stop stopColor="white" stopOpacity="0"/><stop offset=".5" stopColor="white" stopOpacity=".8"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient></defs>
  <path d={path} fill={`url(#${id}-silver-${i})`} stroke="#9a90aa" strokeWidth=".5" strokeLinejoin="round"/>
  <path d={path} clipPath={`url(#${id}-fill-${i})`} fill={`url(#${id}-gold-${i})`} stroke="#aa8843" strokeWidth=".5" strokeLinejoin="round"/>
  <path d="M12 3.9 14.4 9 19.8 9.8" fill="none" stroke="#fff9e4" strokeOpacity=".75" strokeWidth=".55"/>
  <g clipPath={`url(#${id}-shape-${i})`}><rect className="rating-star-light" style={{animationDelay:`${i*160}ms`}} x="-15" y="0" width="12" height="24" fill={`url(#${id}-light-${i})`}/></g>
 </svg>)}</div>;
}
export function GoogleRating({onOpen}:{onOpen:()=>void}) {
 const [feed,setFeed]=useState<RatingFeed|null>(null);
 useEffect(()=>{
  const controller=new AbortController(); let pending=false;
  async function update() {
   if(pending || document.visibilityState==='hidden') return;
   pending=true;
   try {
    const response=await fetch('/marketingdata/api/google-rating',{cache:'no-store',signal:controller.signal});
    if(!response.ok) return;
    const {rating}=await response.json() as {rating:RatingFeed|null};
    if(rating && Number.isFinite(rating.rating) && rating.rating>=1 && rating.rating<=5 && Number.isInteger(rating.reviewCount) && Array.isArray(rating.history)) setFeed(rating);
   } catch {} finally {pending=false;}
  }
  void update();
  const timer=window.setInterval(update,60000);
  window.addEventListener('ysabel:sources-updated',update);
  window.addEventListener('ysabel:community-updated',update);
  document.addEventListener('visibilitychange',update);
  return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('ysabel:sources-updated',update);window.removeEventListener('ysabel:community-updated',update);document.removeEventListener('visibilitychange',update);};
 },[]);
 const snapshot=feed || savedSnapshot;
 const history=feed ? [...googleRatingHistory.filter(r=>!feed.history.some(h=>h.date===r.date)),...feed.history] : googleRatingHistory;
 const {month,observation:previous}=previousMonthRating(calendarDate('Europe/Tirane'),history);
 const monthLabel=new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 const checkedDate=new Date(snapshot.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const reference=previous?.rating ?? googleRatingMonthlyReferences[month];
 const delta=reference!==undefined?Math.round((snapshot.rating-reference)*10)/10:null;
 return <section className="google-rating-highlight" aria-label="Google review rating">

  <div><span className="eyebrow"><Star size={17}/> GOOGLE BUSINESS · GUEST RATING</span><h2>{snapshot.rating.toFixed(1)} <small>/ 5</small></h2><RatingStars rating={snapshot.rating}/><p>{snapshot.reviewCount} Google reviews</p><SourceBadge channel="Google Business" imported={!feed} /></div>
  <div className="google-rating-comparison"><span className="rating-comparison-label">PREVIOUS MONTH · GOOGLE RATING</span>
   <div className="rating-periods"><div><small>{monthLabel}</small><strong>{reference?.toFixed(1)??'—'}</strong><span>{previous?`${previous.reviewCount} reviews`:reference!==undefined?'Owner-provided reference':'Not recorded'}</span></div><span className="rating-period-arrow" aria-hidden="true">→</span><div><small>Latest Google rating</small><strong>{snapshot.rating.toFixed(1)}</strong><span>{snapshot.reviewCount} reviews</span></div><b className="rating-change">{delta===null?'—':delta===0?'Unchanged':`${delta>0?'+':''}${delta.toFixed(1)} points`}</b></div>
   <small>{previous ? `Google observation recorded ${previous.date}. ` : reference!==undefined ? `${monthLabel} rating reference provided by Ysabel Society. ` : `No verified Google rating was recorded for ${monthLabel}. `}{feed ? `Synced from Google Business ${new Date(feed.observedAt).toLocaleString()}. ` : `Google rating recorded ${checkedDate}. `}<a href={googleRatingSourceUrl} target="_blank" rel="noreferrer">View on Google</a></small>
  </div><button className="secondary" onClick={onOpen}>Explore reviews <ArrowUpRight size={17}/></button>
 </section>;
}




