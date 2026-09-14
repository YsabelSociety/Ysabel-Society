'use client';
import { Star, ArrowUpRight } from 'lucide-react';
import { googleRatingSnapshot as snapshot } from '@/lib/google-rating-snapshot';

export function GoogleRating({onOpen}:{onOpen:()=>void}) {
  const delta=snapshot.rating-snapshot.previous.rating;
  const reviewChange=snapshot.reviewCount-snapshot.previous.reviewCount;
  return <section className="google-rating-highlight" aria-label="Google review rating">
    <div><span className="eyebrow"><Star size={17}/> GOOGLE BUSINESS · GUEST RATING</span><h2>{snapshot.rating.toFixed(1)} <small>/ 5</small></h2><p>{snapshot.reviewCount} Google reviews</p></div>
    <div className="google-rating-comparison"><strong>{delta===0?'Rating unchanged':`${delta>0?'+':''}${delta.toFixed(1)} points`}</strong><p>{snapshot.previous.checkedDate}: {snapshot.previous.rating.toFixed(1)} → {snapshot.checkedDate}: {snapshot.rating.toFixed(1)} · {reviewChange>0?'+':''}{reviewChange} reviews</p><small>Exact rating displayed by Google · Last checked {snapshot.checkedDate}. <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">View on Google</a></small></div>
    <button className="secondary" onClick={onOpen}>Explore reviews <ArrowUpRight size={17}/></button>
  </section>;
}
