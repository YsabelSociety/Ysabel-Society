type CoverPost = {
  id: string; name: string; format: string; category: string; status: string;
  plannedDate: string | null; caption: string; notes: string; slides: string[];
};

/** A new media record owns the new cover; the original remains recoverable in Media. */
export function replaceCarouselCover<T extends CoverPost>(post: T, media: T, sourceId?: string): T {
  // Choosing an existing slide swaps it with the old cover, keeping every picture.
  // A new upload/library image replaces only the cover, never the remaining slides.
  const slides = (post.slides || []).map(id => id === sourceId ? post.id : id);
  return {
    ...media,
    name: post.name, format: slides.length || post.format === 'Carousel' ? 'Carousel' : media.format,
    category: post.category, status: post.status, plannedDate: post.plannedDate,
    caption: post.caption, notes: post.notes, slides,
  };
}

export function replaceCoverInFeed(positions: (string | null)[], oldId: string, newId: string) {
  return positions.map(id => id === oldId ? newId : id);
}

/** Commit media details first; callers update local state only after both saves succeed. */
export async function saveCoverChange<T extends CoverPost>({ post, media, sourceId, readFeed, saveAsset, savePositions }: {
  post: T; media: T; sourceId?: string; readFeed: () => (string | null)[];
  saveAsset: (asset: T) => Promise<void>; savePositions: (positions: (string | null)[]) => Promise<void>;
}) {
  const replacement = replaceCarouselCover(post, media, sourceId);
  await saveAsset(replacement);
  const previousFeed = readFeed();
  const nextFeed = replaceCoverInFeed(previousFeed, post.id, replacement.id);
  if (previousFeed.includes(post.id)) await savePositions(nextFeed);
  return { replacement, previousFeed, nextFeed };
}
