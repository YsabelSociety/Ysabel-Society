'use client';
import {useState,useRef,useEffect} from 'react';
import {Play,Grid3X3,ArrowUpRight} from 'lucide-react';
import {type Post,postAvailable,scorePost,compact,engagement} from '@/lib/analytics';
export function Media({
  post,
  controls = false,
}: {
  post: Post;
  controls?: boolean;
}) {
  const [failed,setFailed]=useState('');
  if (!post.image || failed===post.image)
    return (
      <div className="media-unavailable">
        <Play size={24} />
        <span>Media preview unavailable</span>
      </div>
    );
  return post.mediaType === 'video' ? (
    <video
      onError={()=>setFailed(post.image)}
      src={post.image}
      controls={controls}
      muted={!controls}
      playsInline
      preload="metadata"
    />
  ) : (
    <img src={post.image} alt={post.title} loading="lazy" onError={()=>setFailed(post.image)} />
  );
}
export function Empty({
  title = 'No content in this view',
  text = 'Try another filter or add something new.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <Grid3X3 size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function MediaCards({
  posts,
  onSelect,
  deferPreviews = false,
}: {
  posts: Post[];
  onSelect: (p: Post) => void;
  deferPreviews?: boolean;
}) {
  return (
    <div className="media-cards">
      {posts.map((p) => (
        <button
          className="media-card"
          data-platform={p.platform}
          key={p.id}
          onClick={() => onSelect(p)}
        >
          <div className="media-photo">
            {deferPreviews ? <GalleryPreview post={p} /> : <Media post={p} />}
            <span className="media-platform">
              {p.platform} <span>· {p.format}</span>
            </span>
            <span className="media-score">
              {postAvailable(p, 'performanceScore') ? scorePost(p).score : '—'}{' '}
              <ArrowUpRight size={12} />
            </span>
            <div className="media-hover">
              <span>
                {postAvailable(p, 'saves') ? compact(p.saves) : '—'} saves
              </span>
              <span>
                {postAvailable(p, 'shares') ? compact(p.shares) : '—'} shares
              </span>
              <span>
                {postAvailable(p, 'engagementRate') && p.reach
                  ? ((engagement(p) / p.reach) * 100).toFixed(1) + '%'
                  : '—'}
                engagement
              </span>
            </div>
          </div>
          <h3>{p.title}</h3>
          <p>
            {p.unit} <span>·</span> {p.date}
          </p>
          <div className="media-metrics">
            <strong>
              {postAvailable(p, 'views') ? compact(p.views) : '—'}{' '}
              <small>views</small>
            </strong>
            <span>
              {postAvailable(p, 'engagements') ? compact(engagement(p)) : '—'}{' '}
              {p.origin ? 'reported interactions' : 'engagements'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
function GalleryPreview({ post }: { post: Post }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !host.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible]);
  // Every card is present; only media downloads wait until the card is nearby.
  return <div ref={host} className="content-gallery-preview">{visible && <Media post={post} />}</div>;
}
