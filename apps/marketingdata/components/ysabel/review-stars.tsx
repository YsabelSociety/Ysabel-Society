import { Star } from 'lucide-react';

export function ReviewStars({ rating }: { rating?: number }) {
  if (!rating) return <span aria-label="Rating unavailable">—</span>;
  return <span className="review-stars" role="img" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={15} strokeWidth={1.3} aria-hidden="true" fill={star <= rating ? '#c8a45d' : '#faf6ec'} stroke={star <= rating ? '#b8934c' : '#d8c7a3'} />)}
  </span>;
}
