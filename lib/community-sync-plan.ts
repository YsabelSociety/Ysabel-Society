import type { CommunityRecord } from './community';

export const SOCIAL_COMMUNITY_SOURCES = [
  'facebook',
  'instagram',
  'tiktok',
] as const;
export function communitySyncSources(source: string) {
  return SOCIAL_COMMUNITY_SOURCES.filter(
    (s) => source === 'all' || source === s,
  );
}

// Shared media, a reply to our story, and an outgoing mention are not mentions of us.
export function explicitMessageMentions(
  item: CommunityRecord,
  attachments: unknown,
): CommunityRecord[] {
  if (item.direction !== 'in') return [];
  const list = Array.isArray(attachments)
    ? attachments
    : (attachments as any)?.data;
  if (!Array.isArray(list)) return [];
  const types = new Set<string>();
  return list.flatMap((a) => {
    if (
      !['story_mention', 'story_repost'].includes(a?.type) ||
      types.has(a.type)
    )
      return [];
    types.add(a.type);
    let profileUrl = '';
    try {
      const u = new URL(a.url || a.payload?.url);
      if (u.protocol === 'https:' && !u.username && !u.password)
        profileUrl = u.href;
    } catch {
      /* An expired media URL must not discard an explicit event. */
    }
    return [
      {
        ...item,
        id: item.id + ':' + a.type,
        kind: 'mention' as const,
        mentionType: a.type,
        profileUrl,
      },
    ];
  });
}

export function facebookTaggedPosts(
  data: any[],
  accountId: string,
): CommunityRecord[] {
  return data
    .filter(
      (p) =>
        p.id && Number.isFinite(Date.parse(p.tagged_time || p.created_time)),
    )
    .map((p) => ({
      id: 'tag:' + p.id,
      source: 'facebook',
      kind: 'mention',
      accountId,
      time: new Date(p.tagged_time || p.created_time).toISOString(),
      name: p.from?.name || 'Profile unavailable',
      participantId: p.from?.id,
      text: String(p.message || '').slice(0, 12000),
      profileUrl:
        typeof p.permalink_url === 'string' &&
        p.permalink_url.startsWith('https://www.facebook.com/')
          ? p.permalink_url
          : '',
      mentionType: 'post_tag',
      origin: 'api',
    }));
}
