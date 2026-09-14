'use client';
import { useEffect, useState } from 'react';
import { Star, ArrowUpRight } from 'lucide-react';
import type { CommunityRecord } from '@/lib/community';
import { calendarDate } from '@/lib/sync-window';

export function GoogleRating({onOpen}:{onOpen:()=>void}) {
  const [reviews,setReviews]=useState<CommunityRecord[]>([]);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    const load=()=>void fetch('/marketingdata/api/community?kind=review',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{setReviews(d.records || []);setError(false);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    load();window.addEventListener('ysabel:community-updated',load);
    return()=>{controller.abort();window.removeEventListener('ysabel:community-updated',load);};
  },[]);
  const month=calendarDate('Europe/Tirane').slice(0,7);
  const rated=reviews.filter(r=>r.source==='gbp'&&Number.isFinite(r.rating)&&r.rating!>=1&&r.rating!<=5);
  const earlier=rated.filter(r=>/^\d{4}-\d{2}/.test(r.time)&&r.time.slice(0,7)<month);
  const average=(rs:CommunityRecord[])=>rs.reduce((n,r)=>n+r.rating!,0)/rs.length;
  const current=rated.length?average(rated):null,prior=earlier.length?average(earlier):null;
  const delta=current!==null&&prior!==null?current-prior:null;
  return <section className="google-rating-highlight" aria-label="Google review rating">
    <div><span className="eyebrow"><Star size={17}/> GOOGLE BUSINESS · GUEST RATING</span><h2>{current===null?'—':current.toFixed(2)} <small>/ 5</small></h2><p>{rated.length?`${rated.length} captured rated reviews`:error?'Rating temporarily unavailable':'Loading saved reviews…'}</p></div>
    <div className="google-rating-comparison"><strong>{delta===null?'Comparison pending':`${delta>0?'+':''}${delta.toFixed(2)} points`}</strong><p>{prior===null?'No dated earlier reviews available':`Before this month: ${prior.toFixed(2)} → Latest captured: ${current!.toFixed(2)}`}</p><small>Average of imported Google reviews. Earlier average uses their recorded review dates, which may be approximate; this is not a historical snapshot of Google’s displayed rating.</small></div>
    <button className="secondary" onClick={onOpen}>Explore reviews <ArrowUpRight size={17}/></button>
  </section>;
}
