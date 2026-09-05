import { csvRows } from './import-file';
import { type Range } from './analytics';

export type CommunitySource = 'facebook' | 'instagram' | 'tiktok' | 'gbp';
export type CommunityRecord = {
  id: string;
  source: CommunitySource;
  kind: 'message' | 'mention' | 'review' | 'profile';
  accountId: string;
  time: string;
  conversationId?: string;
  participantId?: string;
  name?: string;
  username?: string;
  avatar?: string;
  profileUrl?: string;
  followers?: number | null;
  followersObservedAt?: string;
  direction?: 'in' | 'out';
  text: string;
  rating?: number;
  reply?: string;
  mentionType?: 'story_mention' | 'story_repost' | 'post_mention';
  origin: 'api' | 'file' | 'manual';
  potentialClient?: boolean;
};
export type CommunityStatus = {
  source: string;
  kind: string;
  state: string;
  detail: string;
  syncedAt?: string;
  count?: number;
  cursor?: string;
  total?: number;
  accountId?: string;
};
export const COMMUNITY_NAMES: Record<CommunitySource, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  gbp: 'Google Business',
};
export function safeProfileURL(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}
export function localDate(time: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  return ['year', 'month', 'day']
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join('-');
}
export function inWindow(
  record: CommunityRecord,
  range: Range,
  timezone: string,
) {
  const date = localDate(record.time, timezone);
  return date >= range.start && date <= range.end;
}
export function inboxModel(
  records: CommunityRecord[],
  range: Range,
  timezone: string,
  source = 'all',
) {
  const messages = records.filter(
    (r) => r.kind === 'message' && (source === 'all' || r.source === source),
  );
  const profiles = new Map<string, CommunityRecord>();
  // Explicitly verified details persist when a later API response omits them.
  for (const profile of records
    .filter((r) => r.kind === 'profile')
    .sort((a, b) => a.time.localeCompare(b.time))) {
    const key = profile.source + ':' + profile.participantId,
      previous = profiles.get(key);
    const merged = { ...previous, ...profile };
    if (previous?.origin === 'manual' && profile.origin !== 'manual') {
      merged.origin = 'manual';
      merged.potentialClient = previous.potentialClient;
      merged.username = previous.username || profile.username;
      merged.profileUrl = previous.profileUrl || profile.profileUrl;
      merged.followers = previous.followers ?? profile.followers;
      merged.followersObservedAt =
        previous.followers !== null && previous.followers !== undefined
          ? previous.followersObservedAt
          : profile.followersObservedAt;
    }
    merged.avatar = profile.avatar || previous?.avatar;
    profiles.set(key, merged);
  }
  const threads = new Map<string, CommunityRecord[]>();
  for (const r of messages) {
    const key = r.source + ':' + r.accountId + ':' + r.conversationId;
    threads.set(key, [...(threads.get(key) || []), r]);
  }
  const conversations = [...threads.values()]
    .map((list) => {
      list.sort(
        (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
      );
      const inbound = list.filter((r) => r.direction === 'in'),
        last = list.at(-1)!;
      const lastOut =
        list.filter((r) => r.direction === 'out').at(-1)?.time || '';
      const unanswered = inbound.filter((r) => r.time > lastOut);
      const person = inbound.at(-1) || last;
      const profile = profiles.get(person.source + ':' + person.participantId);
      const ambiguous = inbound.at(-1)?.time === lastOut;
      return {
        id:
          person.source + ':' + person.accountId + ':' + person.conversationId,
        source: person.source,
        last,
        person: { ...person, ...profile },
        messages: list,
        waiting: unanswered.length > 0,
        ambiguous,
        unanswered,
        possibleClient:
          profile?.potentialClient ??
          inbound.some((r) =>
            /\b(reserv(?:e|ation|ations)|book(?:ing)?|table|availability|collab(?:oration)?|partnership|rezervim|tavoline|tavolinë|prenot(?:are|azione))\b/i.test(
              r.text,
            ),
          ),
      };
    })
    .sort((a, b) => b.last.time.localeCompare(a.last.time));
  const received = messages.filter(
    (r) => r.direction === 'in' && inWindow(r, range, timezone),
  );
  const waiting = conversations.filter((c) => c.waiting);
  return {
    conversations,
    received,
    waiting,
    unanswered: waiting
      .flatMap((c) => c.unanswered)
      .filter((r) => inWindow(r, range, timezone)),
    priority: waiting.filter(
      (c) => (c.person.followers ?? 0) > 5000 || c.possibleClient,
    ),
    influencerCount: waiting.filter((c) => (c.person.followers ?? 0) > 5000)
      .length,
  };
}
const TOPICS: [string, RegExp][] = [
  [
    'Food',
    /\b(food|dish|meal|steak|pasta|pizza|sushi|meat|fish|salad|dessert|taste|cooking|ushqim\w*|gatim\w*|mish\w*|peshk\w*|cibo|piatt\w*|carne|pesce|cucina)\b/i,
  ],
  [
    'Service',
    /\b(service|staff|waiter|waitress|server|manager|rude|sherbim\w*|shërbim\w*|staf\w*|kamerier\w*|servizio|personale|camerier\w*)\b/i,
  ],
  [
    'Waiting time',
    /\b(wait\w*|slow|delay\w*|minute\w*|hour\w*|vones\w*|prit\w*|attesa|lento|lenta)\b/i,
  ],
  [
    'Price & value',
    /\b(price\w*|expensive|overpriced|bill|cost\w*|value|shtrenjt\w*|çmim\w*|cmim\w*|prezz\w*|caro|cara|conto)\b/i,
  ],
  [
    'Atmosphere',
    /\b(atmosphere|music|noise|noisy|loud|ambien\w*|decor|muzik\w*|zhurm\w*|rumore)\b/i,
  ],
  [
    'Cleanliness',
    /\b(clean\w*|dirty|hygiene|toilet\w*|bathroom|pist\w*|pastër\w*|paster\w*|sporco|sporca|pulizi\w*)\b/i,
  ],
];
const NEGATIVE =
  /\b(bad|poor|terrible|awful|disappoint\w*|cold|raw|burnt|overcook\w*|undercook\w*|salty|bland|rude|slow|dirty|overpriced|expensive|noisy|loud|wrong|forgot\w*|unfriendly|unhelpful|worst|unpleasant|miserable|inedible|keq\w*|ftoh\w*|shtrenjt\w*|pist\w*|vones\w*|dobët|dobet|pessim\w*|cattiv\w*|fredd\w*|crudo|bruciat\w*|caro|cara|sporco|sporca|scortese|lento|lenta)\b/i;
export function reviewTopics(review: CommunityRecord) {
  const categories = TOPICS.filter(([, re]) => re.test(review.text)).map(
    ([label]) => label,
  );
  const criticisms: { topic: string; excerpt: string }[] = [];
  for (const sentence of review.text.split(
    /(?<=[.!?\n])\s+|\b(?:but|however|although|por|ma)\b/i,
  )) {
    const check = sentence.replace(
      /\b(not (?:bad|expensive|slow|dirty)|no complaints)\b/gi,
      '',
    );
    if (!NEGATIVE.test(check)) continue;
    for (const [topic, re] of TOPICS)
      if (re.test(check) && !criticisms.some((c) => c.topic === topic))
        criticisms.push({ topic, excerpt: sentence.trim().slice(0, 700) });
  }
  return { categories: categories.length ? categories : ['Other'], criticisms };
}
export function bucketActivity(
  records: CommunityRecord[],
  grain: string,
  timezone: string,
) {
  const buckets = new Map<string, number>();
  for (const r of records) {
    let date = localDate(r.time, timezone);
    if (grain === 'Month') date = date.slice(0, 7) + '-01';
    if (grain === 'Week') {
      const d = new Date(date + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      date = d.toISOString().slice(0, 10);
    }
    buckets.set(date, (buckets.get(date) || 0) + 1);
  }
  return [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
export function parseCommunityCSV(
  text: string,
  source: CommunitySource,
  kind: 'message' | 'mention' | 'review',
) {
  const rows = csvRows(text);
  if (!rows.length || rows.length > 2000)
    throw new Error('INPUT:Import 1–2,000 records at a time.');
  const ids = new Set<string>();
  return rows.map((row, i): CommunityRecord => {
    const fail = (message: string): never => {
      throw new Error('INPUT:Row ' + (i + 2) + ': ' + message);
    };
    const id = row.id?.trim();
    if (!id || id.length > 300 || ids.has(id)) fail('use a unique id.');
    ids.add(id);
    if (
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(row.time || '') ||
      !Number.isFinite(Date.parse(row.time))
    )
      fail('time needs an ISO timestamp with timezone.');
    const followers = row.followers?.trim() ? Number(row.followers) : null;
    if (
      followers !== null &&
      (!Number.isSafeInteger(followers) || followers < 0)
    )
      fail('followers must be a non-negative integer or blank.');
    if (
      kind === 'message' &&
      (!row.conversation_id ||
        !row.participant_id ||
        !['in', 'out'].includes(row.direction))
    )
      fail(
        'messages need conversation_id, participant_id and direction (in/out).',
      );
    if (
      kind === 'mention' &&
      !['story_mention', 'story_repost', 'post_mention'].includes(
        row.mention_type,
      )
    )
      fail('choose story_mention, story_repost or post_mention.');
    const rating = row.rating ? Number(row.rating) : undefined;
    if (
      kind === 'review' &&
      (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5)
    )
      fail('rating must be 1–5.');
    if ((row.text || '').length > 12000 || (row.reply || '').length > 12000)
      fail('text is too long.');
    return {
      id,
      source,
      kind,
      accountId: 'file',
      time: new Date(row.time).toISOString(),
      conversationId: row.conversation_id?.slice(0, 300),
      participantId: row.participant_id?.slice(0, 300),
      name: row.name?.slice(0, 200),
      username: row.username?.slice(0, 200),
      avatar: safeProfileURL(row.avatar),
      profileUrl: safeProfileURL(row.profile_url),
      followers,
      followersObservedAt:
        followers !== null ? new Date().toISOString() : undefined,
      direction: row.direction as 'in' | 'out',
      text: row.text || '',
      rating,
      reply: row.reply || '',
      mentionType: row.mention_type as CommunityRecord['mentionType'],
      origin: 'file',
    };
  });
}
