import {
  identity,
  json,
  apiError,
  requireText,
  database,
} from '@/lib/server/db';
import {
  readCommunity,
  saveCommunity,
  saveCommunityStatus,
} from '@/lib/server/community-store';
import { runCommunitySync } from '@/lib/server/community-sync';
import {
  parseCommunityCSV,
  parseMetaMessageJSON,
  safeProfileURL,
  type CommunitySource,
  type CommunityRecord,
} from '@/lib/community';

export async function GET(req: Request) {
  try {
    const owner = (await identity()).userId,
      kind = new URL(req.url).searchParams.get('kind') || 'message';
    if (!['message', 'mention', 'review'].includes(kind))
      throw new Error('INPUT:Choose messages, mentions or reviews.');
    return json(await readCommunity(owner, kind));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const owner = (await identity(req)).userId;
    if (Number(req.headers.get('content-length') || 0) > 1500000)
      throw new Error('INPUT:Use a file under 1.5 MB.');
    const raw = await req.text();
    if (raw.length > 1500000) throw new Error('INPUT:Use a file under 1.5 MB.');
    const body = JSON.parse(raw);
    const source = requireText(body.source, 30) as CommunitySource;
    if (!['facebook', 'instagram', 'tiktok', 'gbp'].includes(source))
      throw new Error('INPUT:Choose a supported platform.');
    if (body.op === 'sync')
      return json(
        await runCommunitySync(
          owner,
          source,
          body.continue === true,
          false,
          body.kind === 'mention' ? 'mention' : undefined,
        ),
      );
    if (body.op === 'auto') {
      const link = await database()
        .prepare(
          'SELECT auto_sync FROM connector_links WHERE owner=? AND source=?',
        )
        .bind(owner, source)
        .first<{ auto_sync: number }>();
      if (!link?.auto_sync) return json({ skipped: true });
      return json(
        await runCommunitySync(
          owner,
          source,
          false,
          true,
          body.kind === 'mention' ? 'mention' : undefined,
          body.force === true,
        ),
      );
    }
    if (body.op === 'preview' || body.op === 'import') {
      if (
        !['message', 'mention', 'review'].includes(body.kind) ||
        (source === 'gbp') !== (body.kind === 'review')
      )
        throw new Error('INPUT:Choose a matching record type and platform.');
      const records =
        body.format === 'meta-json' && body.kind === 'message'
          ? parseMetaMessageJSON(
              requireText(body.csv, 1400000),
              source,
              requireText(body.ownName, 200),
              body.folder,
            )
          : parseCommunityCSV(
              requireText(body.csv, 1400000),
              source,
              body.kind,
            );
      if (body.op === 'preview')
        return json({ count: records.length, preview: records.slice(0, 5) });
      await saveCommunity(owner, records);
      await saveCommunityStatus(owner, {
        source,
        kind: body.kind,
        state: 'file',
        detail:
          records.length +
          ' records imported from your file. Coverage reflects the file; automatic platform access is separate.',
      });
      return json({ imported: records.length });
    }
    if (body.op === 'profile') {
      if (source === 'gbp') throw new Error('INPUT:Choose a social profile.');
      const participantId = requireText(body.participantId, 300),
        records = (await readCommunity(owner, 'message')).records;
      const person = records.find(
        (r) =>
          r.source === source &&
          r.kind === 'message' &&
          r.participantId === participantId,
      );
      if (!person)
        throw new Error(
          'INPUT:Select a profile from an imported conversation.',
        );
      const previous = records
        .filter(
          (r) =>
            r.kind === 'profile' &&
            r.source === source &&
            r.participantId === participantId,
        )
        .sort((a, b) => b.time.localeCompare(a.time))
        .find((r) => r.origin === 'manual');
      const followers =
        body.followers === '' || body.followers === null
          ? null
          : Number(body.followers);
      if (
        followers !== null &&
        (!Number.isSafeInteger(followers) || followers < 0)
      )
        throw new Error(
          'INPUT:Enter a non-negative follower count or leave it blank.',
        );
      const profile: CommunityRecord = {
        ...person,
        ...previous,
        kind: 'profile',
        accountId: 'manual-profile',
        id: participantId,
        time: new Date().toISOString(),
        text: '',
        origin: 'manual',
        followers,
        followersObservedAt:
          followers === null ? undefined : new Date().toISOString(),
        username: body.username
          ? requireText(body.username, 200).replace(/^@/, '')
          : person.username,
        profileUrl: safeProfileURL(body.profileUrl),
        potentialClient: body.potentialClient === true,
        country:
          typeof body.country === 'string'
            ? body.country.trim().slice(0, 100)
            : previous?.country,
        city:
          typeof body.city === 'string'
            ? body.city.trim().slice(0, 100)
            : previous?.city,
        locationGroup: ['local', 'abroad', 'unknown'].includes(
          body.locationGroup,
        )
          ? body.locationGroup
          : previous?.locationGroup || 'unknown',
        profileCategory:
          typeof body.profileCategory === 'string'
            ? body.profileCategory.trim().slice(0, 120)
            : previous?.profileCategory,
        profileNotes:
          typeof body.profileNotes === 'string'
            ? body.profileNotes.trim().slice(0, 1200)
            : previous?.profileNotes,
      };
      await saveCommunity(owner, [profile]);
      return json({ saved: true });
    }
    throw new Error('INPUT:Unknown community action.');
  } catch (e) {
    return apiError(e);
  }
}
