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
  conversationUrl?: string;
  profileCheckedAt?: string;
  reviewUrl?: string;
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
export function nativeConversation(person: CommunityRecord) {
  const supplied = safeProfileURL(person.conversationUrl);
  if (supplied && ['facebook.com', 'www.facebook.com', 'business.facebook.com', 'www.instagram.com', 'instagram.com', 'messenger.com', 'www.messenger.com'].includes(new URL(supplied).hostname))
    return { url: supplied, direct: true };
  if (person.source === 'instagram' && /^[a-zA-Z0-9._]{1,30}$/.test(person.username || ''))
    return { url: 'https://ig.me/m/' + person.username, direct: true };
  return { url: person.source === 'instagram' ? 'https://www.instagram.com/direct/inbox/' : person.source === 'tiktok' ? 'https://www.tiktok.com/messages' : 'https://business.facebook.com/latest/inbox/all', direct: false };
}
export function clientSignals(person: CommunityRecord, messages: CommunityRecord[]) {
  const signals: { label: string; evidence: string }[] = [];
  const add = (label: string, pattern: RegExp) => {
    const record = messages.find(r => pattern.test(r.text));
    const notes = [person.profileCategory, person.profileNotes].filter(Boolean).join(' · ');
    if (record) signals.push({ label, evidence: record.text.slice(0,180) });
    else if (pattern.test(notes)) signals.push({ label, evidence: 'Team profile notes: ' + notes.slice(0,160) });
  };
  add('Reservation enquiry', /\b(reserv(?:e|ation|ations)|book(?:ing)?|table|availability|rezervim|tavoline|tavolinë|prenot(?:are|azione))\b/i);
  add('Creator / collaboration', /\b(collab(?:oration)?|partnership|influencer|content creator|blogger|vlogger|brand ambassador|sponsor(?:ship|ed)?|bashkëpunim|bashkepunim)\b/i);
  add('Travel / visitor interest', /\b(tourist|tourism|travell?er|vacation|holiday|visiting|visit your city|travel blogger|udhëtim|udhetim|turist|pushime)\b/i);
  add('Business / event interest', /\b(business dinner|business lunch|corporate|entrepreneur|founder|business owner|company event|team dinner|networking|conference|biznes|event organiz|event planner)\b/i);
  add('Food / lifestyle content', /\b(food blogger|foodie|restaurant review|food content|lifestyle creator|fashion creator|travel content)\b/i);
  if ((person.followers ?? 0) > 5000) signals.push({ label: 'Audience above 5K', evidence: person.followers!.toLocaleString('en') + ' supplied followers' });
  if (person.potentialClient) signals.unshift({ label: 'Selected by team', evidence: person.profileNotes || 'Manually selected potential client' });
  return signals;
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
    if (profile.followers == null && previous?.followers != null) {
      merged.followers = previous.followers;
      merged.followersObservedAt = previous.followersObservedAt;
    }
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
      const mergedPerson = { ...person, ...profile };
      const signals = clientSignals(mergedPerson, unanswered);
      return {
        id:
          person.source + ':' + person.accountId + ':' + person.conversationId,
        source: person.source,
        last,
        person: mergedPerson,
        signals,
        messages: list,
        waiting: unanswered.length > 0,
        ambiguous,
        unanswered,
        possibleClient:
          profile?.potentialClient ??
          signals.length > 0,
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
  if (followers >= 30000) return '30K+';
  if (followers >= 20000) return '20K–29.9K';
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
          : count >= (minimum === '10K+ followers' ? 10000 : minimum === '30K+ followers' ? 30000 : 20000)));
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
export { classifyReview as reviewTopics } from './review-language';
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
      reviewUrl: safeProfileURL(row.review_url),
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
