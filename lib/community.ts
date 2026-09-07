import { csvRows } from './import-file';
import { type Range } from './analytics';

export type CommunitySource = 'facebook' | 'instagram' | 'tiktok' | 'gbp';
export type CommunityRecord = {
  id: string;
  source: CommunitySource;
  kind: 'message' | 'mention' | 'review' | 'profile';
  accountId: string;
  time: string;
  timeLabel?: string;
  timePrecision?: 'relative';
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
  mentionType?: 'story_mention' | 'story_repost' | 'post_mention' | 'post_tag';
  origin: 'api' | 'file' | 'manual';
  potentialClient?: boolean;
  country?: string;
  city?: string;
  locationGroup?: 'local' | 'abroad' | 'unknown';
  profileCategory?: string;
  profileNotes?: string;
  folder?: 'primary' | 'general' | 'requests' | 'archived' | 'unknown';
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
  if (record.timePrecision === 'relative') return false;
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
      merged.country = previous.country;
      merged.city = previous.city;
      merged.locationGroup = previous.locationGroup;
      merged.profileCategory = previous.profileCategory;
      merged.profileNotes = previous.profileNotes;
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
        selectedClient: profile?.potentialClient === true,
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
export function followerTier(followers: number | null | undefined) {
  if (followers === null || followers === undefined) return 'Unknown';
  if (followers >= 20000) return '20K+';
  if (followers >= 10000) return '10K–19.9K';
  if (followers > 5000) return '>5K–9.9K';
  return '5K or fewer';
}
export function matchesProfile(
  person: CommunityRecord,
  minimum: string,
  location: string,
) {
  const count = person.followers;
  const followersMatch =
    minimum === 'Any followers' ||
    (minimum === 'Unknown followers'
      ? count == null
      : count != null &&
        (minimum === '>5K followers'
          ? count > 5000
          : count >= (minimum === '10K+ followers' ? 10000 : 20000)));
  return (
    followersMatch &&
    (location === 'All locations' ||
      (person.locationGroup || 'unknown') ===
        (
          {
            Local: 'local',
            Abroad: 'abroad',
            'Location unknown': 'unknown',
          } as Record<string, string>
        )[location])
  );
}
const TOPICS: [string, RegExp][] = [
  [
    'Food',
    /\b(food|dish|meal|steak|pasta|pizza|sushi|meat|fish|salad|dessert|taste|cooking|ushqim\w*|gatim\w*|mish\w*|peshk\w*|cibo|piatt\w*|carne|pesce|cucina)\b/i,
  ],
  [
    'Service',
    /\b(service|staff|waiters?|waitress\w*|servers?|manag\w*|security|reception\w*|rude|sherbim\w*|shërbim\w*|staf\w*|kamerier\w*|servizio|personale|camerier\w*)\b/i,
  ],
  [
    'Waiting time',
    /\b(wait(?:s|ed|ing)?|slow|delay\w*|minutes?|hours?|vones\w*|prit\w*|attesa|lento|lenta)\b/i,
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
  // Google supplies an English translation followed by the original. Analyse
  // the translation once, so negation in the original is not counted twice.
  const analysisText = review.text.startsWith('(Translated by Google)')
    ? review.text.split('(Original)')[0]
    : review.text;
  for (const sentence of analysisText.split(
    /(?<=[.!?\n])\s+|\b(?:but|however|although|por|ma)\b/i,
  )) {
    const check = sentence
      .replace(
        /\b(?:not|never|without)\s+(?:(?:very|at all|too|so)\s+)?(?:bad|expensive|slow|dirty|rude|unfriendly|disappoint\w*)\b|\bno (?:complaints|delays?)\b/gi,
        '',
      )
      .replace(/\bslow (?:down|motion)\b|\bpa vones\w*/gi, '');
    if (!NEGATIVE.test(check)) continue;
    // Attribute each negative word to the closest topic in its clause rather
    // than accusing every subject mentioned in an otherwise positive sentence.
    const mentions = TOPICS.flatMap(([topic, re]) =>
      [...check.matchAll(new RegExp(re.source, 'gi'))].map((m) => ({
        topic,
        index: m.index!,
      })),
    );
    for (const negative of check.matchAll(new RegExp(NEGATIVE.source, 'gi'))) {
      const closest = mentions
        .map((m) => ({ ...m, distance: Math.abs(m.index - negative.index!) }))
        .filter((m) => m.distance <= 80)
        .sort((a, b) => a.distance - b.distance)[0];
      if (closest && !criticisms.some((c) => c.topic === closest.topic))
        criticisms.push({
          topic: closest.topic,
          excerpt: sentence.trim().slice(0, 700),
        });
    }
  }
  return { categories: categories.length ? categories : ['Other'], criticisms };
}
// Relative labels are used only to order reviews, never as exact report dates.
export function compareReviewsNewest(a: CommunityRecord, b: CommunityRecord) {
  const order = (r: CommunityRecord) => {
    if (r.timePrecision !== 'relative') return Date.parse(r.time);
    const label = (r.timeLabel || '').toLowerCase();
    const match = label.match(
      /(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/,
    );
    const unit: Record<string, number> = {
      minute: 60,
      hour: 3600,
      day: 86400,
      week: 604800,
      month: 2629800,
      year: 31557600,
    };
    const age =
      label === 'yesterday'
        ? 86400
        : match
          ? Number(match[1]) * unit[match[2]]
          : 0;
    return Date.parse(r.time) - age * 1000;
  };
  return order(b) - order(a) || a.id.localeCompare(b.id);
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
      !['story_mention', 'story_repost', 'post_mention', 'post_tag'].includes(
        row.mention_type,
      )
    )
      fail('choose story_mention, story_repost, post_mention or post_tag.');
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
      ...(kind === 'review' && row.time_precision === 'relative'
        ? {
            timePrecision: 'relative' as const,
            timeLabel: row.time_label?.slice(0, 100),
          }
        : {}),
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
      country: row.country?.slice(0, 100),
      city: row.city?.slice(0, 100),
      locationGroup: ['local', 'abroad'].includes(row.location_group)
        ? (row.location_group as 'local' | 'abroad')
        : 'unknown',
      profileCategory: row.profile_category?.slice(0, 120),
      folder: ['primary', 'general', 'requests', 'archived'].includes(
        row.folder,
      )
        ? (row.folder as CommunityRecord['folder'])
        : 'unknown',
    };
  });
}

// Official Meta JSON downloads can restore message history the API no longer returns.
export function parseMetaMessageJSON(
  text: string,
  source: CommunitySource,
  ownName: string,
  folder: string = 'unknown',
  maximumMessages = 2000,
) {
  if (!['facebook', 'instagram'].includes(source))
    throw new Error('INPUT:Choose Facebook or Instagram.');
  const document = JSON.parse(text);
  if (
    !Array.isArray(document.messages) ||
    !Array.isArray(document.participants)
  )
    throw new Error(
      'INPUT:Choose a message_1.json (or another message part) from your Meta information download.',
    );
  if (!document.messages.length || document.messages.length > maximumMessages)
    throw new Error(
      'INPUT:Import a message part containing 1–' +
        maximumMessages.toLocaleString('en-US') +
        ' messages.',
    );
  const normalized = (v: string) => v.trim().normalize('NFKC').toLowerCase();
  const people = document.participants
    .map((p: any) => String(p.name || '').trim())
    .filter(Boolean);
  if (
    !ownName.trim() ||
    !people.some((p: string) => normalized(p) === normalized(ownName))
  )
    throw new Error(
      'INPUT:Your account name must exactly match one of the participants in this export. This identifies your replies correctly.',
    );
  if (people.length !== 2)
    throw new Error(
      'INPUT:Only one-to-one conversations are supported; this file has a different participant count.',
    );
  const peer = people.find(
    (p: string) => normalized(p) !== normalized(ownName),
  );
  if (!peer)
    throw new Error('INPUT:The other participant could not be identified.');
  const hash = (s: string) => {
    let a = 2166136261,
      b = 5381;
    for (const ch of s) {
      a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
      b = Math.imul(b, 33) ^ ch.charCodeAt(0);
    }
    return (a >>> 0).toString(16) + (b >>> 0).toString(16);
  };
  const thread =
    String(document.thread_path || '')
      .split('/')
      .filter(Boolean)
      .at(-1) || hash([...people].sort().join('|'));
  const seen = new Map<string, number>();
  return document.messages.map((m: any): CommunityRecord => {
    const sender = String(m.sender_name || '');
    if (
      !people.some((p: string) => normalized(p) === normalized(sender)) ||
      !Number.isFinite(m.timestamp_ms) ||
      !Number.isFinite(new Date(m.timestamp_ms).getTime())
    )
      throw new Error(
        'INPUT:Every message needs a valid sender_name and timestamp_ms.',
      );
    const content =
      typeof m.content === 'string' ? m.content.slice(0, 12000) : '';
    const signature = hash(
      JSON.stringify([
        m.timestamp_ms,
        sender,
        content,
        m.photos,
        m.videos,
        m.share,
      ]),
    );
    const duplicate = seen.get(signature) || 0;
    seen.set(signature, duplicate + 1);
    return {
      id: String(m.message_id || thread + ':' + signature + ':' + duplicate),
      source,
      kind: 'message',
      accountId: 'meta-export:' + hash(normalized(ownName)),
      conversationId: thread,
      participantId: 'export:' + hash(normalized(peer)),
      name: peer,
      time: new Date(m.timestamp_ms).toISOString(),
      direction: normalized(sender) === normalized(ownName) ? 'out' : 'in',
      text: content || '[Media or unsupported message in Meta export]',
      origin: 'file',
      followers: null,
      folder: ['primary', 'general', 'requests', 'archived'].includes(folder)
        ? (folder as CommunityRecord['folder'])
        : 'unknown',
    };
  });
}

// Preview the original part before splitting it. Explicit stable IDs retain
// repeated identical messages across upload boundaries and on re-import.
export function prepareMetaMessageParts(
  text: string,
  source: CommunitySource,
  ownName: string,
  folder = 'unknown',
) {
  const records = parseMetaMessageJSON(text, source, ownName, folder, 100000);
  const original = JSON.parse(text);
  const parts: { csv: string; count: number; folder: string }[] = [];
  let messages: any[] = [],
    size = 0;
  const flush = () => {
    if (!messages.length) return;
    parts.push({
      csv: JSON.stringify({
        participants: original.participants,
        thread_path: original.thread_path,
        messages,
      }),
      count: messages.length,
      folder,
    });
    messages = [];
    size = 0;
  };
  for (let i = 0; i < records.length; i++) {
    const m = original.messages[i];
    const safeMessage = {
      message_id: records[i].id,
      sender_name: m.sender_name,
      timestamp_ms: m.timestamp_ms,
      content: typeof m.content === 'string' ? m.content.slice(0, 12000) : '',
    };
    const length = JSON.stringify(safeMessage).length;
    if (messages.length >= 1000 || size + length > 450000) flush();
    messages.push(safeMessage);
    size += length;
  }
  flush();
  return { parts, count: records.length, preview: records.slice(0, 5) };
}
