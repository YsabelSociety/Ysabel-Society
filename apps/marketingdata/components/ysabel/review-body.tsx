'use client';
import type { CommunityRecord } from '@/lib/community';
import { safeProfileURL } from '@/lib/community';
export function ReviewBody({review}:{review:CommunityRecord}) {
  const ai=review.reviewAnalysis;
  return <>
    {ai ? <><p>{ai.englishText||'No written comment.'}</p><small className="source-asof">AI reviewed · {new Date(ai.analyzedAt).toLocaleDateString('en-GB')}{ai.language!=='en'?' · English translation':''}</small>{ai.englishText!==review.text&&<details><summary>Original review</summary><p>{review.text}</p></details>}</> : <p>{review.text}</p>}
    {!!review.reviewPhotos?.length&&<div className="review-customer-photos" aria-label="Photos attached to this review">{review.reviewPhotos.map(p=>safeProfileURL(p.url)&&<a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url.replace(/=s\d+-w\d+-h\d+/, '=s400-w400-h240')} width={160} height={110} alt={p.caption||'Customer photo attached to this review'} loading="lazy" decoding="async" referrerPolicy="no-referrer"/></a>)}</div>}
    {!review.reviewPhotos?.length&&<small className="source-asof">No attached photos imported for this review.</small>}
  </>;
}
