export const FEED_SIZE = 15;
const PREVIOUS_FEED_SIZE = 12;
const TOP_ROW_SIZE = FEED_SIZE - PREVIOUS_FEED_SIZE;

export const emptyFeed = () => Array<string | null>(FEED_SIZE).fill(null);

// The server already has 15 slots; the old UI exposed only slots 0–11.
// Present the three spare slots first. Keep this mapping at the API boundary
// so existing drafts and published snapshots gain a top row without a data
// migration, repeated shifts on refresh, or changes to their media records.
export function readStoredFeed(stored: readonly (string | null)[]) {
  return Array.from({ length: FEED_SIZE }, (_, index) =>
    stored[(index + PREVIOUS_FEED_SIZE) % FEED_SIZE] || null);
}

export function writeStoredFeed(feed: readonly (string | null)[]) {
  return Array.from({ length: FEED_SIZE }, (_, index) =>
    feed[(index + TOP_ROW_SIZE) % FEED_SIZE] || null);
}

export function readStoredFeedRows(rows: readonly { position: number; mediaId: string | null }[]) {
  const stored = emptyFeed();
  for (const row of rows) {
    if (Number.isInteger(row.position) && row.position >= 0 && row.position < FEED_SIZE) stored[row.position] = row.mediaId;
  }
  return readStoredFeed(stored);
}

export function workspacePayload(payload: Record<string, unknown>) {
  return Array.isArray(payload.positions)
    ? { ...payload, positions: writeStoredFeed(payload.positions) }
    : payload;
}
