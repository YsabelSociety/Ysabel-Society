'use client';
import { Star, ArrowUpRight } from 'lucide-react';
import { calendarDate } from '@/lib/sync-window';
import { googleRatingSnapshot as snapshot, googleRatingHistory, googleRatingSourceUrl, previousMonthRating } from '@/lib/google-rating-snapshot';

export function GoogleRating({onOpen}:{onOpen:()=>void}) {
  const {month,observation:previous}=previousMonthRating(calendarDate('Europe/Tirane'),googleRatingHistory);
  const monthLabel=new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  const checkedDate=new Date(snapshot.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const delta=previous?snapshot.rating-previous.rating:null;
  const reviewChange=previous?snapshot.reviewCount-previous.reviewCount:null;
  return <section className="google-rating-highlight" aria-label="Google review rating">
    <div><span className="eyebrow"><Star size={17}/> GOOGLE BUSINESS · GUEST RATING</span><h2>{snapshot.rating.toFixed(1)} <small>/ 5</small></h2>
      <div className="google-rating-stars" aria-hidden="true">{Array.from({length:5},(_,i)=><span className="google-rating-star" key={i} style={{animationDelay:`${i*180}ms`}}><Star className="star-outline"/><span className="star-fill" style={{width:`${Math.max(0,Math.min(1,snapshot.rating-i))*100}%`}}><Star/></span></span>)}</div>
      <p>{snapshot.reviewCount} Google reviews</p></div>
    <div className="google-rating-comparison"><strong>{delta===null?'Previous month unavailable':delta===0?'Rating unchanged':`${delta>0?'+':''}${delta.toFixed(1)} points`}</strong>
      <p>{monthLabel}{previous?`: ${previous.rating.toFixed(1)} → Latest: ${snapshot.rating.toFixed(1)} · ${reviewChange!>0?'+':''}${reviewChange} reviews`:' · No verified Google rating was captured for this month.'}</p>
      <small>Exact rating displayed by Google · Last checked {checkedDate}.{previous?` Comparison uses the last verified observation in ${monthLabel} (${previous.date}).`:''} <a href={googleRatingSourceUrl} target="_blank" rel="noreferrer">View on Google</a></small></div>
    <button className="secondary" onClick={onOpen}>Explore reviews <ArrowUpRight size={17}/></button>
  </section>;
}
