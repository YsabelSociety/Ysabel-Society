'use client';
import { type Post, postAvailable, number } from '@/lib/analytics';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
export function ImportedPostDetail({
  post,
  close,
}: {
  post: Post;
  close: () => void;
}) {
  const extra = post as unknown as Record<string, unknown>;
  const fields = [
    ['views', 'Views'],
    ['reach', 'Reach'],
    ['likes', post.platform === 'Facebook' ? 'Reactions' : 'Likes'],
    ['comments', 'Comments'],
    ['saves', 'Saves'],
    ['shares', 'Shares'],
    ['followers', 'Followers gained'],
    ['visits', 'Website visits'],
    ['profileVisits', 'Profile visits'],
    ['mediaViewers', 'Unique media viewers'],
    ['averageWatchTimeMs', 'Average watch time · ms'],
    ['watchTimeMs', 'Total watch time · ms'],
  ];
  return (
    <Sheet open onOpenChange={(v) => !v && close()}>
      <SheetContent className="detail-drawer">
        <SheetHeader>
          <SheetTitle>{post.title}</SheetTitle>
          <SheetDescription>
            {post.platform} · published {post.publishedAt || post.date} ·{' '}
            {post.origin === 'file' ? 'Imported file' : 'Provider API'}
          </SheetDescription>
        </SheetHeader>
        <div className="detail-body">
          {post.image && (
            <div className="detail-media">
              <img src={post.image} alt={post.title} />
            </div>
          )}
          <p className="footnote">
            Lifetime content metrics observed{' '}
            {post.observedAt
              ? new Date(post.observedAt).toLocaleString()
              : 'at import'}
            . Publication-date filters do not turn these into period metrics. A
            dash means the source did not supply that field.
          </p>
          {post.permalink && (
            <a
              className="secondary"
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
            >
              Open original post ↗
            </a>
          )}
          <div className="detail-stats">
            {fields.map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>
                  {postAvailable(post, key) ? number(Number(extra[key])) : '—'}
                </strong>
              </div>
            ))}
          </div>
          <p>{post.caption}</p>
          <details>
            <summary>Source values & definitions</summary>
            <div className="source-value-list">
              {Object.entries(post.sourceMetrics || {}).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}</strong>
                  <span>
                    {typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <p className="footnote">
            Imported performance is read-only. Manage the published content on
            its original platform. A performance score requires a comparable
            observed history; demo baselines are not used.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
