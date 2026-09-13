export function conversationCursor(paging: any): string {
  if (!paging?.next) return '';
  const cursor = paging.cursors?.after;
  if (typeof cursor === 'string' && cursor.length <= 8192) return cursor;
  // Some empty, filtered Meta pages supply their cursor only in the next link.
  // Extract the cursor, but never follow the URL or copy its access token.
  try {
    const u = new URL(paging.next);
    if (
      u.protocol !== 'https:' ||
      !['graph.instagram.com', 'graph.facebook.com'].includes(u.hostname) ||
      u.username ||
      u.password ||
      u.port
    )
      return '';
    const after = u.searchParams.get('after') || '';
    return after.length <= 8192 ? after : '';
  } catch {
    return '';
  }
}
