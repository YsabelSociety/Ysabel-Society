import { Star } from 'lucide-react';
import { useId } from 'react';

export function ReviewStars({ rating }: { rating?: number }) {
  const id = useId().replace(/:/g, '');
  if (!rating) return <span aria-label="Rating unavailable">—</span>;
  return <span className="review-stars" role="img" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(star => {
      const fraction = Math.max(0, Math.min(1, rating - star + 1));
      const fill = fraction === 1 ? '#c8a45d' : fraction === 0 ? '#faf6ec' : `url(#${id}-${star})`;
      return <Star key={star} size={15} strokeWidth={1.3} aria-hidden="true" fill={fill} stroke={fraction > 0 ? '#b8934c' : '#d8c7a3'}>
        {fraction > 0 && fraction < 1 && <defs><linearGradient id={`${id}-${star}`}>
          <stop offset={fraction} stopColor="#c8a45d" /><stop offset={fraction} stopColor="#faf6ec" />
        </linearGradient></defs>}
      </Star>;
    })}
  </span>;
}
