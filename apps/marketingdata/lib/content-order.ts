import type { Post } from './analytics';

function publicationTime(post: Post): number {
  const timestamp = Date.parse(post.publishedAt || '');
  if (Number.isFinite(timestamp)) return timestamp;
  const date = Date.parse(post.date);
  return Number.isFinite(date) ? date : -Infinity;
}

// Use the provider's publication time, never view counts or import order.
export function newestPublishedFirst(a: Post, b: Post): number {
  const first = publicationTime(a);
  const second = publicationTime(b);
  return first === second ? a.id.localeCompare(b.id) : first > second ? -1 : 1;
}
