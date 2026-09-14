'use client';
import { useId } from 'react';
import { Star, ArrowUpRight } from 'lucide-react';
import { calendarDate } from '@/lib/sync-window';
import { googleRatingSnapshot as snapshot, googleRatingHistory, googleRatingSourceUrl, previousMonthRating } from '@/lib/google-rating-snapshot';

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
 const {month,observation:previous}=previousMonthRating(calendarDate('Europe/Tirane'),googleRatingHistory);
 const monthLabel=new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 const checkedDate=new Date(snapshot.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const delta=previous?snapshot.rating-previous.rating:null;
 return <section className="google-rating-highlight" aria-label="Google review rating">
  <div><span className="eyebrow"><Star size={17}/> GOOGLE BUSINESS · GUEST RATING</span><h2>{snapshot.rating.toFixed(1)} <small>/ 5</small></h2><RatingStars rating={snapshot.rating}/><p>{snapshot.reviewCount} Google reviews</p></div>
  <div className="google-rating-comparison"><span className="rating-comparison-label">PREVIOUS MONTH COMPARISON{previous?.source?' · DATED REFERENCE':''}</span>
   <div className="rating-periods"><div><small>{monthLabel}</small><strong>{previous?.rating.toFixed(1)??'—'}</strong><span>{previous?`${previous.reviewCount} reviews`:'No dated reference'}</span></div><span className="rating-period-arrow" aria-hidden="true">→</span><div><small>Latest Google rating</small><strong>{snapshot.rating.toFixed(1)}</strong><span>{snapshot.reviewCount} reviews</span></div><b className="rating-change">{delta===null?'—':delta===0?'Unchanged':`${delta>0?'+':''}${delta.toFixed(1)} points`}</b></div>
   <small>{previous?.source?<><a href={previous.sourceUrl} target="_blank" rel="noreferrer">{monthLabel} reference: {previous.source}</a>. This reports Google's rating; it is not a verified month-end snapshot. </>:previous?`Previous reference: ${previous.date}. `:'A dated historical Google rating is needed for this comparison. '}Current rating checked directly on Google {checkedDate}. <a href={googleRatingSourceUrl} target="_blank" rel="noreferrer">View on Google</a></small>
  </div><button className="secondary" onClick={onOpen}>Explore reviews <ArrowUpRight size={17}/></button>
 </section>;
}

