'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  MessageCircle,
  AtSign,
  ArrowUpRight,
  RefreshCw,
  Users,
  Star,
  Upload,
  Settings2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { DataIcon, DataTab as TabsTrigger } from './data-icons';
import { MiniHistory } from './mini-history';
import { reviewMonthHistory } from '@/lib/review-history';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Picker } from './controls';
import { useMinimalMotion } from './use-motion';
import {
  bucketActivity,
  COMMUNITY_NAMES,
  inboxModel,
  nativeConversation,
  inWindow,
  reviewTopics,
  compareReviewsNewest,
  matchesProfile,
  followerTier,
  prepareMetaMessageParts,
  type CommunityRecord,
  type CommunitySource,
  type CommunityStatus,
} from '@/lib/community';
import { number, type Range } from '@/lib/analytics';
import { InstagramMessaging } from './instagram-messaging';
import { ReviewReports } from './review-reports';
import { ReviewDateControls } from './review-date-controls';
import {
  reviewMatchesDates,
  reviewPeriodRange,
  reviewPeriodLabel,
  type ReviewDateSelection,
} from '@/lib/review-dates';
import { reviewDateLabel } from '@/lib/review-report';
import { communitySyncSources } from '@/lib/community-sync-plan';
import { AdminGate } from './admin-gate';
type LoadState = { kind: string; ready: boolean; error: string };

async function communityAction(body: unknown) {
  const r = await fetch('/marketingdata/api/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The import did not finish. Saved messages and history progress are retained; retry to continue.',
    );
  const data: any = await r.json();
  if (!r.ok) throw new Error(data.error || 'Unable to complete this action.');
  return data;
}
function useCommunity(kind: string) {
  const loadedKind = useRef('');
  const [data, setData] = useState<{
    records: CommunityRecord[];
    statuses: (CommunityStatus & { more?: boolean })[];
    truncated?: boolean;
  }>({ records: [], statuses: [] });
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(loadedKind.current !== kind);
    setError('');
    void fetch('/marketingdata/api/community?kind=' + kind, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
    })
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!controller.signal.aborted) {
          setData(d);
          loadedKind.current = kind;
          setError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, revision]);
  useEffect(() => {
    const update = () => refresh();
    const visibleUpdate = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = kind === 'message' ? setInterval(visibleUpdate, 30000) : undefined;
    window.addEventListener('ysabel:community-updated', update);
    window.addEventListener('focus', visibleUpdate);
    return () => {
      window.removeEventListener('ysabel:community-updated', update);
      window.removeEventListener('focus', visibleUpdate);
      if (timer) clearInterval(timer);
    };
  }, [kind]);
  return { ...data, error, setError, loading, refresh };
}
function Portrait({ person }: { person: CommunityRecord }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person.avatar]);
  return person.avatar && !failed ? (
    <img
      className="community-avatar"
      src={person.kind === 'profile' && person.origin === 'api' && ['facebook','instagram'].includes(person.source)
        ? '/marketingdata/api/community/avatar?' + new URLSearchParams({source:person.source,id:person.accountId+':'+person.id,revision:person.profileCheckedAt || person.time}).toString()
        : person.avatar}
      alt=""
      referrerPolicy="no-referrer"
      onError={(e) => {
        setFailed(true);
      }}
    />
  ) : (
    <span className="community-avatar community-initial">
      {(person.name || person.username || '?').slice(0, 1)}
    </span>
  );
}
function Activity({
  records,
  timezone,
}: {
  records: CommunityRecord[];
  timezone: string;
}) {
  const [grain, setGrain] = useState('Day'),
    animate = useMinimalMotion();
  const data = bucketActivity(records, grain, timezone);
  return (
    <section className="surface community-panel">
      <div className="section-head">
        <div>
          <h2>Activity over time</h2>
          <p>Captured events · {timezone}</p>
        </div>
        <Picker
          label="Activity grouping"
          value={grain}
          onChange={setGrain}
          options={['Day', 'Week', 'Month']}
        />
      </div>
      {data.length ? (
        <>
          <div
            className="community-chart"
            role="img"
            aria-label={data.map((d) => d.date + ': ' + d.count).join('; ')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Captured events"
                  fill="#9eafcc"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={animate}
                  animationDuration={400}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="community-empty">
          No captured activity for these dates. Missing access is shown below.
        </p>
      )}
    </section>
  );
}
function CountCards({
  items,
}: {
  items: {
    label: string;
    value: number | null;
    detail: string;
    history?: number[];
  }[];
}) {
  return (
    <div className="community-counts">
      {items.map((m, i) => (
        <div className={'metric-card metric-' + i} key={m.label}>
          <span className="metric-label">
            <DataIcon name={m.label} badge />
            {m.label}
          </span>
          <strong>{m.value === null ? '—' : number(m.value)}</strong>
          {m.history && (
            <MiniHistory values={m.history} label="Captured reviews by month" />
          )}
          <p>{m.detail}</p>
        </div>
      ))}
    </div>
  );
}
function AccessStatus({
  statuses,
  kind,
  source,
}: {
  statuses: (CommunityStatus & { more?: boolean })[];
  kind: string;
  source: string;
}) {
  const platforms =
    source === 'all' ? ['facebook', 'instagram', 'tiktok'] : [source];
  const relevant = platforms.map(
    (platform) =>
      statuses.find((s) => s.kind === kind && s.source === platform) || {
        source: platform,
        kind,
        state: 'missing',
        detail:
          kind === 'review'
            ? 'Connect Google Business and import reviews.'
            : kind === 'mention'
              ? 'No mention history imported. Automatic story-event collection is not active.'
              : platform === 'tiktok'
                ? 'TikTok Display API does not supply messages. Use a reviewed message export.'
                : 'Messaging access has not been verified. Use Access & import to check the requirements.',
        syncedAt: undefined,
      },
  );
  return (
    <div className="community-coverage">
      {relevant.length ? (
        relevant.map((s) => (
          <details key={s.source + ':' + s.kind}>
            <summary>
              <strong>
                {COMMUNITY_NAMES[s.source as CommunitySource]} ·{' '}
                {s.state === 'synced'
                  ? 'Imported'
                  : s.state === 'partial'
                    ? 'Limited history'
                    : s.state === 'file'
                      ? 'File import'
                      : s.state === 'syncing'
                        ? 'Importing'
                        : s.state === 'needs-attention'
                          ? 'Needs attention'
                          : 'Needs access'}{' '}
                · View details
              </strong>
            </summary>
            <p>{s.detail}</p>
            {s.syncedAt && (
              <small>
                Last checked {new Date(s.syncedAt).toLocaleString()}
              </small>
            )}
          </details>
        ))
      ) : (
        <div>
          <strong>
            {kind === 'review'
              ? 'Reviews have not been imported'
              : kind === 'mention'
                ? 'Mention history has not been imported'
                : 'Messaging access has not been checked'}
          </strong>
          <p>
            {kind === 'mention'
              ? 'Only explicit story mentions or repost records count. Private, expired and untagged stories cannot be reconstructed. Import an available export to add verified history.'
              : kind === 'review'
                ? 'Connect the Google account that manages your location, then import its reviews.'
                : 'Analytics sign-in does not automatically grant inbox access. Use Access & import to see the additional requirements.'}
          </p>
        </div>
      )}
    </div>
  );
}
function ImportAccess({
  open,
  onOpenChange,
  kind,
  source,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: 'message' | 'mention' | 'review';
  source: CommunitySource;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<CommunitySource>(source),
    [csv, setCsv] = useState(''),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelected(source);
    setPreview(null);
    setError('');
  }, [source, open]);
  const headers =
    kind === 'message'
      ? 'id,time,conversation_id,participant_id,direction,name,username,followers,avatar,profile_url,text'
      : kind === 'mention'
        ? 'id,time,participant_id,name,username,mention_type,profile_url,text'
        : 'id,time,name,rating,text,reply,avatar,profile_url,review_url';
  function template() {
    const a = document.createElement('a'),
      url = URL.createObjectURL(
        new Blob([headers + '\n'], { type: 'text/csv' }),
      );
    a.href = url;
    a.download = 'ysabel-' + kind + '-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function act(op: string) {
    setBusy(true);
    setError('');
    try {
      const result = await communityAction({ op, source: selected, kind, csv });
      if (op === 'preview') setPreview(result);
      else {
        onSaved();
        onOpenChange(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="community-dialog">
        <DialogHeader>
          <DialogTitle>Access & import</DialogTitle>
          <DialogDescription>
            Connect supported data or import records you have reviewed. No
            messages are sent from this workspace.
          </DialogDescription>
        </DialogHeader>
        <AdminGate title="Connection access and imports">
          <Tabs defaultValue="access">
            <TabsList className="page-tabs">
              <TabsTrigger value="access">Platform access</TabsTrigger>
              {kind === 'message' && (
                <TabsTrigger value="instagram">Direct Instagram</TabsTrigger>
              )}
              <TabsTrigger value="file">Import CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="access">
              <div className="community-help">
                {kind === 'review' ? (
                  <>
                    <h3>Google reviews</h3>
                    <p>
                      Connect a Google account with access to the verified
                      Business Profile. The Business Profile reviews API and
                      business.manage authorization are required. “Import
                      reviews” collects pages of reviews; continue if more
                      history is available.
                    </p>
                    <a
                      className="secondary"
                      href="/marketingdata/connections?connect=gbp"
                    >
                      Connect Google Business <ArrowUpRight size={15} />
                    </a>
                    <a
                      href="https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google review requirements
                    </a>
                  </>
                ) : (
                  <>
                    <h3>Facebook Inbox</h3>
                    <p>
                      In the existing Meta app, add <code>pages_messaging</code>{' '}
                      and <code>pages_manage_metadata</code>. Include
                      them in Facebook Login for Business, then authorize again.
                      Your Page role must allow messaging. Advanced Access, App
                      Review and business verification may be required for
                      customer conversations.
                    </p>
                    <p>
                      The import checks recent accessible messages. Message
                      history and request folders have platform limits. Follower
                      counts and profile photos appear only when Meta supplies
                      them; you can record a manually verified count from a
                      conversation.
                    </p>
                    <a
                      className="secondary"
                      href="/marketingdata/connections?connect=meta"
                    >
                      Update Facebook access <ArrowUpRight size={15} />
                    </a>
                    <a
                      href="https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Meta messaging requirements
                    </a>
                    <h3>TikTok</h3>
                    <a
                      className="secondary"
                      href="/marketingdata/tiktok-business"
                    >
                      Set up TikTok messages & mentions{' '}
                      <ArrowUpRight size={15} />
                    </a>
                    <p>
                      The current TikTok Display API connection does not include
                      direct messages. TikTok Business Messaging is separately
                      approved. This workspace supports reviewed TikTok message
                      exports; an automatic TikTok messaging adapter is not
                      connected.
                    </p>
                    <a
                      href="https://business-api.tiktok.com/portal/docs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      TikTok Business Messaging access
                    </a>
                    <h3>Instagram approval</h3>
                    <p>
                      If Meta reports that conversations involve users without
                      an app role, request Advanced Access to
                      instagram_manage_messages. In the app’s Instagram
                      permissions, choose Actions → Add to App Review. Meta may
                      require business verification, access verification and
                      Tech Provider status. Meta describes the Tech Provider
                      decision as irreversible; review that step before
                      accepting it. Granting a permission in a login
                      configuration is not the same as Meta approving live
                      access.
                    </p>
                    <a
                      className="secondary"
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Meta app review <ArrowUpRight size={15} />
                    </a>
                    <h3>Story mentions, tags & reposts</h3>
                    <p>
                      These are separate events. A tagged story mention is not
                      counted as a repost. The Mentions page can import
                      available Facebook and Instagram tagged posts, plus
                      explicit story events from readable messages. Only
                      explicit records supplied by the platform or your import
                      are counted. A general shared post does not prove a story
                      repost. Complete story monitoring requires an approved
                      event receiver; it is not configured. Facebook tags
                      require pages_read_user_content. Untagged, expired and
                      private stories may remain unavailable.
                    </p>
                  </>
                )}
              </div>
            </TabsContent>
            {kind === 'message' && (
              <TabsContent value="instagram">
                <InstagramMessaging onSaved={onSaved} />
              </TabsContent>
            )}
            <TabsContent value="file">
              <div className="community-help">
                <p>
                  Use the template columns below. A message is one row,
                  including outgoing replies. Re-importing an identical ID
                  updates the record. File records remain separate from API
                  records, so avoid importing overlapping history from both
                  methods.
                </p>
                {kind !== 'review' && (
                  <Picker
                    label="Import platform"
                    value={COMMUNITY_NAMES[selected]}
                    options={['Facebook', 'Instagram', 'TikTok']}
                    onChange={(v) => {
                      setSelected(
                        Object.keys(COMMUNITY_NAMES).find(
                          (k) => COMMUNITY_NAMES[k as CommunitySource] === v,
                        ) as CommunitySource,
                      );
                      setPreview(null);
                    }}
                  />
                )}
                <button className="secondary" onClick={template}>
                  Download CSV template
                </button>
                <code className="community-csv-columns">{headers}</code>
                <p>
                  Use ISO timestamps with a timezone, e.g.
                  2026-09-06T14:00:00+02:00.{' '}
                  {kind === 'message'
                    ? 'Direction is in or out. Leave followers blank when unknown.'
                    : kind === 'mention'
                      ? 'mention_type is story_mention, story_repost or post_mention.'
                      : 'Rating is 1–5; blank reply means no reply was supplied.'}
                </p>
                <label className="secondary file-picker">
                  <Upload size={15} />
                  Choose CSV
                  <input
                    aria-label="Choose community CSV"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 1400000) {
                        setError('Use a CSV under 1.4 MB.');
                        return;
                      }
                      setCsv(await f.text());
                      setPreview(null);
                      setError('');
                    }}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={!csv || busy}
                  onClick={() => void act('preview')}
                >
                  Preview import
                </button>
                {kind === 'review' && (
                  <label className="review-paste-label">
                    Paste review CSV
                    <textarea
                      aria-label="Paste review CSV"
                      value={csv}
                      maxLength={1400000}
                      onChange={(e) => {
                        setCsv(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                )}
                {preview && (
                  <div className="community-import-preview">
                    <strong>{preview.count} records ready</strong>
                    {preview.preview.map((r: CommunityRecord) => (
                      <p key={r.id}>
                        {r.time} · {r.name || r.username || r.id} ·{' '}
                        {r.text.slice(0, 150)}
                      </p>
                    ))}
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void act('import')}
                    >
                      Import {preview.count} records
                    </button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </AdminGate>
        {error && (
          <p className="save-error" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function MetaArchiveImport({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState('instagram'),
    [ownName, setOwnName] = useState('Ysabel Society'),
    [folder, setFolder] = useState('Unknown'),
    [archiveParts, setArchiveParts] = useState<File[]>([]),
    [progress, setProgress] = useState(''),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const reset = () => setPreview(null);
  async function act(op: string) {
    setBusy(true);
    setError('');
    try {
      if (op === 'preview') {
        const ready: { csv: string; folder: string; count: number }[] = [],
          skipped: string[] = [];
        const sample: CommunityRecord[] = [];
        let count = 0;
        for (const part of archiveParts) {
          const partFolder = /(?:^|\/)message_requests\//.test(
            part.webkitRelativePath,
          )
            ? 'requests'
            : folder.toLowerCase();
          try {
            const prepared = prepareMetaMessageParts(
              await part.text(),
              source as CommunitySource,
              ownName,
              partFolder,
            );
            count += prepared.count;
            sample.push(
              ...prepared.preview.slice(0, Math.max(0, 5 - sample.length)),
            );
            ready.push(...prepared.parts);
          } catch (e) {
            skipped.push(
              (part.webkitRelativePath || part.name) +
                ': ' +
                (e as Error).message.replace(/^INPUT:/, ''),
            );
          }
        }
        setPreview({ count, preview: sample, ready, skipped });
        setProgress('');
      } else {
        let imported = 0;
        for (let index = 0; index < preview.ready.length; index++) {
          const part = preview.ready[index];
          setProgress(
            'Importing part ' +
              (index + 1) +
              ' of ' +
              preview.ready.length +
              '…',
          );
          const result = await communityAction({
            op: 'import',
            source,
            kind: 'message',
            format: 'meta-json',
            csv: part.csv,
            ownName,
            folder: part.folder,
          });
          imported += result.imported;
        }
        setProgress(
          imported +
            ' messages imported in ' +
            preview.ready.length +
            ' parts. Re-importing the same files updates existing records.',
        );
        setPreview(null);
        onSaved();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="community-dialog">
        <DialogHeader>
          <DialogTitle>Import older Meta messages</DialogTitle>
          <DialogDescription>
            Add available history from Facebook or Instagram’s official JSON
            download.
          </DialogDescription>
        </DialogHeader>
        <ol className="archive-steps">
          <li>
            In Accounts Center, open Your information and permissions → Export
            your information. Select the business account, Messages, All time
            and JSON.
          </li>
          <li>
            Extract the download and choose the message JSON files, or select
            the extracted folder to include multiple conversations together.
          </li>
          <li>
            Enter your own sender name exactly as it appears in the file, then
            review the preview before importing.
          </li>
        </ol>
        <a
          className="secondary"
          href="https://accountscenter.instagram.com/info_and_permissions/"
          target="_blank"
          rel="noreferrer"
        >
          Open Accounts Center <ArrowUpRight size={15} />
        </a>
        <div className="community-profile-grid">
          <label>
            Platform
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                reset();
              }}
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </label>
          <label>
            Your exact sender name
            <input
              value={ownName}
              onChange={(e) => {
                setOwnName(e.target.value);
                reset();
              }}
            />
          </label>
          <label>
            Original folder
            <select
              value={folder}
              onChange={(e) => {
                setFolder(e.target.value);
                reset();
              }}
            >
              {['Unknown', 'Primary', 'General', 'Requests', 'Archived'].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Message JSON files
            <input
              type="file"
              accept=".json,application/json"
              multiple
              onChange={(e) => {
                reset();
                setError('');
                setProgress('');
                const selected = Array.from(e.target.files || []);
                if (
                  selected.length > 1000 ||
                  selected.some((f) => f.size > 20000000) ||
                  selected.reduce((n, f) => n + f.size, 0) > 100000000
                ) {
                  setArchiveParts([]);
                  setError(
                    'Choose up to 1,000 message files, each under 20 MB, totalling under 100 MB.',
                  );
                  return;
                }
                setArchiveParts(selected);
              }}
            />
          </label>
          <label>
            Or select the extracted export folder
            <input
              type="file"
              multiple
              {...{ webkitdirectory: '' }}
              onChange={(e) => {
                reset();
                setError('');
                setProgress('');
                const selected = Array.from(e.target.files || []).filter((f) =>
                  /^message_\d+\.json$/i.test(f.name),
                );
                if (
                  selected.length > 1000 ||
                  selected.some((f) => f.size > 20000000) ||
                  selected.reduce((n, f) => n + f.size, 0) > 100000000
                ) {
                  setArchiveParts([]);
                  setError(
                    'Select a smaller group of conversation folders: up to 1,000 files under 20 MB each and 100 MB total.',
                  );
                  return;
                }
                setArchiveParts(selected);
                if (!selected.length)
                  setError(
                    'No message JSON files were found. Extract the Meta download first.',
                  );
              }}
            />
          </label>
        </div>
        <p className="source-asof">
          {archiveParts.length} files selected · One-to-one conversations only.
          Choose Unknown unless the export identifies its folder. Downloads
          cannot restore messages Meta has already deleted. File and API
          histories are separate; overlapping dates may count twice.
        </p>
        {error && (
          <p role="alert" className="save-error">
            {error}
          </p>
        )}
        {preview && (
          <div className="archive-preview">
            <strong>{number(preview.count)} messages ready</strong>
            <p>
              {preview.ready.length} upload parts ready. Large files are split
              automatically. {preview.skipped.length} files need attention and
              will not be imported.
            </p>
            {preview.skipped.length > 0 && (
              <details>
                <summary>Review skipped files</summary>
                <ul>
                  {preview.skipped.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </details>
            )}
            {preview.preview.map((m: CommunityRecord) => (
              <p key={m.id}>
                <b>{m.direction === 'out' ? 'Your reply' : m.name}</b> ·{' '}
                {new Date(m.time).toLocaleString()}
                <br />
                {m.text.slice(0, 240)}
              </p>
            ))}
          </div>
        )}
        {progress && <p role="status">{progress}</p>}
        <button
          className="primary"
          disabled={
            busy ||
            !archiveParts.length ||
            !ownName.trim() ||
            (preview && !preview.ready.length)
          }
          onClick={() => void act(preview ? 'import' : 'preview')}
        >
          {busy
            ? 'Checking…'
            : preview
              ? 'Import reviewed messages'
              : 'Preview messages'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
function ConversationDetail({
  conversation,
  onClose,
  onSaved,
}: {
  conversation: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const p = conversation.person,
    [followers, setFollowers] = useState(
      p.followers === null || p.followers === undefined
        ? ''
        : String(p.followers),
    ),
    [username, setUsername] = useState(p.username || ''),
    [profileUrl, setProfileUrl] = useState(p.profileUrl || ''),
    [country, setCountry] = useState(p.country || ''),
    [city, setCity] = useState(p.city || ''),
    [locationGroup, setLocationGroup] = useState(p.locationGroup || 'unknown'),
    [profileCategory, setProfileCategory] = useState(p.profileCategory || ''),
    [profileNotes, setProfileNotes] = useState(p.profileNotes || ''),
    [lead, setLead] = useState(!!p.potentialClient),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    try {
      await communityAction({
        op: 'profile',
        source: p.source,
        participantId: p.participantId,
        followers,
        username,
        profileUrl,
        potentialClient: lead,
        country,
        city,
        locationGroup,
        profileCategory,
        profileNotes,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="community-dialog">
        <DialogHeader>
          <DialogTitle>{p.name || p.username || 'Conversation'}</DialogTitle>
          <DialogDescription>
            {COMMUNITY_NAMES[p.source as CommunitySource]} ·{' '}
            {conversation.ambiguous
              ? 'Messages share a timestamp; verify reply order in the platform inbox'
              : conversation.waiting
                ? 'Awaiting your reply'
                : 'Latest captured message was your reply'}
          </DialogDescription>
        </DialogHeader>
        <div className="community-thread">
          {conversation.messages.map((m: CommunityRecord) => (
            <div
              className="community-bubble"
              data-direction={m.direction}
              key={m.id}
            >
              <small>
                {m.direction === 'out'
                  ? 'Ysabel Society'
                  : m.name || m.username || 'Customer'}{' '}
                · {new Date(m.time).toLocaleString()}
              </small>
              <p>{m.text || 'Attachment or unsupported message'}</p>
            </div>
          ))}
        </div>
        <a
          className="secondary"
          href={
            p.source === 'tiktok'
              ? 'https://www.tiktok.com/messages'
              : 'https://business.facebook.com/latest/inbox/all'
          }
          target="_blank"
          rel="noreferrer"
        >
          Open platform inbox <ArrowUpRight size={15} />
        </a>
        <div className="community-profile-form">
          <h3>Verified profile details</h3>
          <p>
            Enter a follower count only after checking the profile.
            Potential-client labels are your own notes.
          </p>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Profile link
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
            />
          </label>
          <label>
            Verified follower count
            <input
              type="number"
              min="0"
              step="1"
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="Unknown"
            />
          </label>
          <label className="community-check">
            <Checkbox
              checked={lead}
              onCheckedChange={(v) => setLead(v === true)}
            />
            Select as potential client
          </label>
          <div className="community-profile-grid">
            <label>
              Country shown on profile
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Unknown"
              />
            </label>
            <label>
              City shown on profile
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Unknown"
              />
            </label>
            <label>
              Location group
              <select
                value={locationGroup}
                onChange={(e) => setLocationGroup(e.target.value)}
              >
                <option value="unknown">Location unknown</option>
                <option value="local">Local</option>
                <option value="abroad">Abroad</option>
              </select>
            </label>
            <label>
              Profile category
              <input
                value={profileCategory}
                onChange={(e) => setProfileCategory(e.target.value)}
                placeholder="Food creator, travel, lifestyle…"
              />
            </label>
          </div>
          <label>
            Why this profile is a potential client
            <textarea
              value={profileNotes}
              maxLength={1200}
              onChange={(e) => setProfileNotes(e.target.value)}
              placeholder="Record relevant public profile details or collaboration interest."
            />
          </label>
          <p className="source-asof">
            Use a stated location or your verified knowledge. Names, language
            and appearance do not establish where someone lives.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void save()}
          >
            Save verified details
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function CommunityPage({
  mode,
  range,
  timezone,
  onLoadState,
}: {
  mode: 'inbox' | 'mentions';
  range: Range;
  timezone: string;
  onLoadState?: (state: LoadState) => void;
}) {
  const kind = mode === 'inbox' ? 'message' : 'mention',
    data = useCommunity(kind),
    [source, setSource] = useState('all'),
    [tab, setTab] = useState('waiting'),
    [search, setSearch] = useState(''),
    [minimum, setMinimum] = useState('Any followers'),
    [location, setLocation] = useState('All locations'),
    [replyFilter, setReplyFilter] = useState('Any reply status'),
    [folder, setFolder] = useState('All folders'),
    [clientFilter, setClientFilter] = useState('Unanswered suggestions'),
    [archive, setArchive] = useState(false),
    [setup, setSetup] = useState(false),
    [busy, setBusy] = useState(false),
    [syncResults, setSyncResults] = useState<
      { source: CommunitySource; detail: string }[]
    >([]),
    [mentionType, setMentionType] = useState('All types'),
    [mentionDates, setMentionDates] = useState('Selected dates'),
    [selected, setSelected] = useState<any>(null);
  useEffect(() => {
    if (mode !== 'inbox') return;
    const url=new URL(window.location.href), outcome=url.searchParams.get('instagramLogin');
    if (!outcome) return;
    url.searchParams.delete('instagramLogin'); window.history.replaceState(null,'',url);
    if (outcome !== 'authorized') { setSyncResults([{source:'instagram',detail:'Instagram sign-in did not complete. The previous connection is preserved. Open Access & import to try again.'}]);setSetup(true);return; }
    setBusy(true);
    void communityAction({op:'sync',source:'instagram'})
      .then(async result => {setSyncResults([{source:'instagram',detail:result.detail || 'Instagram import finished.'}]);await communityAction({op:'profiles',source:'instagram'});})
      .catch(e=>setSyncResults([{source:'instagram',detail:e.message}]))
      .finally(()=>{setBusy(false);window.dispatchEvent(new Event('ysabel:community-updated'));});
  }, [mode]);
  useEffect(() => {
    onLoadState?.({
      kind,
      ready: !data.loading && !data.error,
      error: data.error,
    });
  }, [kind, data.loading, data.error, onLoadState]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => window.dispatchEvent(new Event('ysabel:community-updated')),
      8000,
    );
    return () => clearInterval(timer);
  }, [busy]);
  const model = useMemo(
    () => inboxModel(data.records, range, timezone, source),
    [data.records, range, timezone, source],
  );
  const records = data.records.filter(
    (r) =>
      r.kind === 'mention' &&
      (source === 'all' || r.source === source) &&
      (mentionDates === 'All imported history' || inWindow(r, range, timezone)),
  );
  const visibleMentions = records.filter(
    (r) =>
      mentionType === 'All types' ||
      {
        story_mention: 'Story mentions',
        story_repost: 'Story reposts',
        post_mention: 'Post mentions',
        post_tag: 'Tagged posts',
      }[r.mentionType || 'post_tag'] === mentionType,
  );
  const mentionCount = (type: CommunityRecord['mentionType']) =>
    data.records.some(
      (r) =>
        r.kind === 'mention' &&
        r.mentionType === type &&
        (source === 'all' || r.source === source),
    )
      ? records.filter((r) => r.mentionType === type).length
      : null;
  const ready =
    data.records.some(
      (r) => r.kind === kind && (source === 'all' || r.source === source),
    ) ||
    data.statuses.some(
      (s) =>
        s.kind === kind &&
        ['partial', 'synced', 'file'].includes(s.state) &&
        (source === 'all' || s.source === source),
    );
  async function sync(older = false) {
    setBusy(true);
    data.setError('');
    setSyncResults([]);
    const targets = communitySyncSources(source).filter(
      (s) =>
        !older ||
        data.statuses.some(
          (status) =>
            status.source === s &&
            (status.kind === kind ||
              (mode === 'mentions' && status.kind === 'message')) &&
            status.more,
        ),
    );
    await Promise.allSettled(
      targets.map(async (s) => {
        try {
          if (mode === 'inbox' && (s === 'facebook' || s === 'instagram')) {
            try { await communityAction({op:'profiles', source:s}); data.refresh(); } catch { /* Message import remains independent. */ }
          }
          let returned = 0;
          for (let batch = 0; batch < 10; batch++) {
            const result = await communityAction({
              op: 'sync',
              source: s,
              kind,
              continue: older || batch > 0,
            });
            returned += Number(result.imported || 0);
            setSyncResults((items) => [
              ...items.filter((item) => item.source !== s),
              {
                source: s,
                detail: result.skipped
                  ? 'An import is already running. Saved records stay visible while it completes.'
                  : (result.needsAttention ? 'Access needs attention. ' : '') +
                    returned +
                    ' records returned. ' +
                    (result.detail || ''),
              },
            ]);
            data.refresh();
            if (
              mode !== 'inbox' ||
              !result.more ||
              result.needsAttention ||
              result.skipped
            )
              break;
          }
        } catch (e) {
          setSyncResults((items) => [
            ...items.filter((item) => item.source !== s),
            { source: s, detail: (e as Error).message },
          ]);
        }
        data.refresh();
      }),
    );
    data.refresh();
    setBusy(false);
  }
  const conversations = (
    tab === 'waiting'
      ? model.waiting
      : tab === 'influencers'
        ? model.conversations.filter((c) => (c.person.followers ?? 0) > 5000)
        : tab === 'leads'
          ? model.conversations.filter((c) =>
              clientFilter === 'Unanswered suggestions'
                ? c.waiting && !c.ambiguous && ((c.person.followers ?? 0) > 5000 || c.possibleClient)
                : clientFilter === 'Selected clients'
                ? c.selectedClient
                : c.possibleClient && !c.selectedClient,
            )
          : tab === 'history'
            ? model.conversations
            : model.conversations.filter((c) =>
                c.messages.some((r) => inWindow(r, range, timezone)),
              )
  ).filter(
    (c) =>
      matchesProfile(c.person, minimum, location) &&
      (replyFilter === 'Any reply status' ||
        (replyFilter === 'Awaiting reply'
          ? c.waiting
          : !c.waiting && !c.ambiguous)) &&
      (folder === 'All folders' ||
        c.messages.some(
          (m) => (m.folder || 'unknown') === folder.toLowerCase(),
        )) &&
      [c.person.name, c.person.username, c.last.text]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="community-view">
      <div className="community-toolbar">
        <Picker
          label="Community platform"
          value={
            source === 'all'
              ? 'All platforms'
              : COMMUNITY_NAMES[source as CommunitySource]
          }
          onChange={(v) =>
            setSource(
              v === 'All platforms'
                ? 'all'
                : Object.keys(COMMUNITY_NAMES).find(
                    (k) => COMMUNITY_NAMES[k as CommunitySource] === v,
                  )!,
            )
          }
          options={['All platforms', 'Facebook', 'Instagram', 'TikTok']}
        />
        <button className="secondary" onClick={() => setSetup(true)}>
          <Settings2 size={16} />
          Access & import
        </button>
        {
          <button
            className="primary"
            disabled={busy}
            onClick={() => void sync()}
          >
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
            {busy
              ? 'Importing…'
              : mode === 'inbox'
                ? source === 'all'
                  ? 'Sync all inboxes'
                  : 'Sync ' +
                    COMMUNITY_NAMES[source as CommunitySource] +
                    ' inbox'
                : source === 'all'
                  ? 'Sync all mentions'
                  : 'Sync ' +
                    COMMUNITY_NAMES[source as CommunitySource] +
                    ' mentions'}
          </button>
        }
        {data.statuses.some(
          (s) =>
            (s.kind === kind ||
              (mode === 'mentions' && s.kind === 'message')) &&
            s.more &&
            (source === 'all' || s.source === source),
        ) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void sync(true)}
          >
            {mode === 'inbox'
              ? 'Load older conversations'
              : 'Load older mentions'}
          </button>
        )}
        {mode === 'inbox' && (
          <button className="secondary" onClick={() => setArchive(true)}>
            <Upload size={16} /> Import Meta history
          </button>
        )}
      </div>
      <AccessStatus statuses={data.statuses} kind={kind} source={source} />
      {!!syncResults.length && (
        <div
          className="community-coverage"
          role="status"
          aria-label="Results of this sync"
        >
          {syncResults.map((result) => (
            <details key={result.source}>
              <summary>
                <strong>{COMMUNITY_NAMES[result.source]}</strong> ·{' '}
                {result.detail.split('. ')[0]}
              </summary>
              <p>{result.detail}</p>
            </details>
          ))}
        </div>
      )}
      {data.error && (
        <div className="save-error" role="alert">
          {data.error}
        </div>
      )}
      {data.truncated && (
        <p className="source-live-note">
          The newest 10,000 stored records are shown. Totals cover these records
          only.
        </p>
      )}
      {mode === 'inbox' ? (
        <>
          <CountCards
            items={[
              {
                label: 'Messages received',
                value: ready ? model.received.length : null,
                detail: 'Captured incoming messages · selected dates',
              },
              {
                label: 'Unanswered messages',
                value: ready ? model.unanswered.length : null,
                detail:
                  'Incoming messages in these dates with no later captured reply',
              },
              {
                label: 'Conversations awaiting reply',
                value: ready ? model.waiting.length : null,
                detail: 'Current backlog · all captured dates',
              },
              {
                label: 'Influencers awaiting reply',
                value: ready ? model.influencerCount : null,
                detail: 'Verified or supplied followers strictly above 5,000',
              },
            ]}
          />
          <section className="surface community-panel" aria-label="Unanswered client priorities">
            <div className="section-head"><div><h2>People waiting to connect</h2><p>Unanswered influencer and client enquiries · Instagram & Facebook</p></div><span className="pill">1-minute checks · 30-minute background sync</span></div>
            <p className="source-asof">Suggestions consider unanswered enquiries, creator collaborations, travel visits, business events and verified profile notes. Each signal shows its evidence; follower count is optional. Unavailable social activity or personal style is not guessed.</p>
            <div className="community-filters">
              {['>5K followers', '10K+ followers', '20K+ followers', '30K+ followers'].map(tier => <button key={tier} className="secondary" onClick={() => { setTab('leads'); setClientFilter('Unanswered suggestions'); setMinimum(tier); }}>{tier} · {model.priority.filter(c => !c.ambiguous && matchesProfile(c.person, tier, 'All locations')).length}</button>)}
            </div>
            {model.priority.filter(c => !c.ambiguous).sort((a,b) => Number(b.selectedClient)-Number(a.selectedClient) || (b.person.followers ?? 0)-(a.person.followers ?? 0) || a.unanswered[0].time.localeCompare(b.unanswered[0].time)).slice(0,6).map(c => <article className="conversation-card" key={c.id}>
              <Portrait person={c.person}/><div className="conversation-main"><button className="conversation-title" onClick={() => setSelected(c)}>{c.person.name || c.person.username || 'Profile unavailable'}</button><p>{COMMUNITY_NAMES[c.source]} · {c.person.followers != null ? `${number(c.person.followers)} followers · ${followerTier(c.person.followers)}` : 'Follower count unknown'}</p><p>{c.last.text || 'Attachment'}</p>{c.signals.map(signal => <div key={signal.label}><small>{signal.label}</small><p>{signal.evidence}</p></div>)}<small>No later captured reply</small></div><a className="secondary" href={nativeConversation(c.person).url} target="_blank" rel="noopener noreferrer">{nativeConversation(c.person).direct ? `Open chat in ${COMMUNITY_NAMES[c.source]}` : `Open ${COMMUNITY_NAMES[c.source]} inbox`} <ArrowUpRight size={15}/></a><button className="secondary" onClick={() => setSelected(c)}>Profile details</button>
            </article>)}
            {!model.priority.length && <p>No verified influencer or client enquiries awaiting a reply in the captured messages. Profiles with unknown follower counts remain in the inbox.</p>}
          </section>
          <Activity records={model.received} timezone={timezone} />
          <div className="inbox-coverage-note">
            <strong>
              {source === 'all'
                ? 'All captured conversations · one inbox'
                : COMMUNITY_NAMES[source as CommunitySource] + ' inbox'}
            </strong>
            <p>
              {source === 'tiktok' ? (
                'TikTok profile and video statistics do not include messages. Business messaging approval and account authorization are separate. Imported message files appear here once supplied.'
              ) : (
                <>
                  All API-accessible folders are requested together. Instagram
                  excludes Requests inactive for 30 days and restricts older
                  message details. Use a Meta JSON download to add available
                  older history. Folder names are shown only when supplied in
                  your import.
                </>
              )}
            </p>
          </div>
          <section className="surface community-panel">
            <div className="section-head">
              <h2>Conversations</h2>
              <input
                className="community-search"
                aria-label="Search conversations"
                placeholder="Search name, username or message"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="page-tabs community-tabs">
                <TabsTrigger value="all">Selected dates</TabsTrigger>
                <TabsTrigger value="history">All conversations</TabsTrigger>
                <TabsTrigger value="waiting">
                  Unanswered · all dates
                </TabsTrigger>
                <TabsTrigger value="influencers">
                  Influencers &gt;5K
                </TabsTrigger>
                <TabsTrigger value="leads">Potential clients</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="community-filters">
              <Picker
                label="Follower threshold"
                value={minimum}
                onChange={setMinimum}
                options={[
                  'Any followers',
                  '>5K followers',
                  '10K+ followers',
                  '20K+ followers',
                  '30K+ followers',
                  'Unknown followers',
                ]}
              />
              <Picker
                label="Client location"
                value={location}
                onChange={setLocation}
                options={[
                  'All locations',
                  'Local',
                  'Abroad',
                  'Location unknown',
                ]}
              />
              <Picker
                label="Reply status"
                value={replyFilter}
                onChange={setReplyFilter}
                options={['Any reply status', 'Awaiting reply', 'Replied']}
              />
              <Picker
                label="Message folder"
                value={folder}
                onChange={setFolder}
                options={[
                  'All folders',
                  'Primary',
                  'General',
                  'Requests',
                  'Archived',
                  'Unknown',
                ]}
              />
              {tab === 'leads' && (
                <Picker
                  label="Client selection"
                  value={clientFilter}
                  onChange={setClientFilter}
                  options={['Unanswered suggestions', 'Selected clients', 'Enquiry suggestions']}
                />
              )}
            </div>
            <p className="source-asof">
              “Unanswered” means the latest captured message is incoming.
              Messages sharing an incoming/outgoing timestamp have uncertain
              reply order and are excluded from the unanswered count.
              Read/unread status is different. Select potential clients after
              reviewing their profiles. Enquiry suggestions are separate. Local
              means Kosovo unless you classify a profile differently; unknown
              locations stay unclassified. These filters affect the conversation
              list, while the counters above describe all captured activity for
              the chosen platform and dates.
            </p>
            {data.loading ? (
              <p className="community-empty">Loading captured conversations…</p>
            ) : conversations.length ? (
              conversations.slice(0, 200).map((c) => (
                <article
                  className="conversation-card"
                  data-platform={COMMUNITY_NAMES[c.source]}
                  key={c.id}
                >
                  <Portrait person={c.person} />
                  <div className="conversation-main">
                    <button
                      className="conversation-title"
                      onClick={() => setSelected(c)}
                    >
                      {c.person.name ||
                        c.person.username ||
                        'Profile unavailable'}
                    </button>
                    <span className="muted">
                      {c.person.username ? '@' + c.person.username + ' · ' : ''}
                      {COMMUNITY_NAMES[c.source]}
                      {c.person.followers !== null &&
                      c.person.followers !== undefined
                        ? ' · ' + number(c.person.followers) + ' followers'
                        : ' · Followers unavailable'}
                    </span>
                    <p>{c.last.text || 'Attachment or unsupported message'}</p>
                    <span className="profile-context">
                      {[
                        c.person.profileCategory,
                        c.person.city,
                        c.person.country,
                        c.person.locationGroup === 'local'
                          ? 'Local'
                          : c.person.locationGroup === 'abroad'
                            ? 'Abroad'
                            : 'Location unknown',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {c.person.profileNotes && (
                      <p className="profile-notes">{c.person.profileNotes}</p>
                    )}
                    <small>
                      {new Date(c.last.time).toLocaleString()} ·{' '}
                      {c.ambiguous
                        ? 'Reply order uncertain'
                        : c.waiting
                          ? 'Awaiting reply'
                          : 'Replied'}
                      {c.person.origin === 'manual'
                        ? ' · Manually verified profile'
                        : ''}
                    </small>
                  </div>
                  <div className="conversation-actions">
                    {(c.person.followers ?? 0) > 5000 && (
                      <span className="pill">
                        {followerTier(c.person.followers)}
                      </span>
                    )}
                    {c.possibleClient && (
                      <span className="pill">
                        {c.selectedClient
                          ? 'Selected client'
                          : 'Possible enquiry'}
                      </span>
                    )}
                    {c.person.profileUrl && (
                      <a
                        href={c.person.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View profile <ArrowUpRight size={14} />
                      </a>
                    )}
                    <button
                      className="secondary"
                      onClick={() => setSelected(c)}
                    >
                      Review profile & messages
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="community-empty">
                {data.loading
                  ? 'Loading saved conversations…'
                  : model.conversations.length
                    ? 'No conversations match these filters. Choose All conversations to include older imported messages, or clear the profile and folder filters.'
                    : 'No conversations have been imported for this platform. Open its access status above to see the current blocker, or use Access & import.'}
              </p>
            )}
            {conversations.length > 200 && (
              <p>
                Showing 200 matching conversations. Narrow your search to see
                others.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <CountCards
            items={[
              {
                label: 'Story mentions',
                value: mentionCount('story_mention'),
                detail: 'Explicit story events · ' + mentionDates.toLowerCase(),
              },
              {
                label: 'Story reposts',
                value: mentionCount('story_repost'),
                detail: 'Explicit repost records · not inferred from a share',
              },
              {
                label: 'Post mentions',
                value: mentionCount('post_mention'),
                detail: 'Tracked separately from stories',
              },
              {
                label: 'Tagged posts',
                value: mentionCount('post_tag'),
                detail:
                  'Platform-supplied post tags · ' + mentionDates.toLowerCase(),
              },
            ]}
          />
          <div className="community-toolbar">
            <Picker
              label="Mention type"
              value={mentionType}
              onChange={setMentionType}
              options={[
                'All types',
                'Story mentions',
                'Story reposts',
                'Post mentions',
                'Tagged posts',
              ]}
            />
            <Picker
              label="Mention dates"
              value={mentionDates}
              onChange={setMentionDates}
              options={['Selected dates', 'All imported history']}
            />
          </div>
          <Activity records={visibleMentions} timezone={timezone} />
          <section className="surface community-panel">
            <h2>Mention history</h2>
            <p className="source-asof">
              Sync checks available Facebook and Instagram tagged posts and
              explicit story events in readable messages. TikTok needs its
              separate Business access. Caption mentions and story reposts
              require explicit records; shares are not counted as reposts.
              Continuous story monitoring is not configured. A dash means no
              verified records of that type have been imported.
            </p>
            {visibleMentions.length ? (
              visibleMentions.slice(0, 300).map((r) => (
                <article
                  className="conversation-card"
                  key={r.source + ':' + r.accountId + ':' + r.id}
                >
                  <Portrait person={r} />
                  <div className="conversation-main">
                    <strong>
                      {r.username
                        ? '@' + r.username
                        : r.name || 'Profile unavailable'}
                    </strong>
                    <small>
                      {COMMUNITY_NAMES[r.source]} ·{' '}
                      {new Date(r.time).toLocaleString()} ·{' '}
                      {r.mentionType?.replaceAll('_', ' ')}
                    </small>
                    <p>{r.text}</p>
                  </div>
                  {r.profileUrl && (
                    <a href={r.profileUrl} target="_blank" rel="noreferrer">
                      Open source <ArrowUpRight size={14} />
                    </a>
                  )}
                </article>
              ))
            ) : (
              <p className="community-empty">
                {data.loading
                  ? 'Loading saved mentions…'
                  : 'No imported mentions match these filters. Check the platform access status above, or choose All imported history to include older records.'}
              </p>
            )}
            {visibleMentions.length > 300 && (
              <p>
                Showing the newest 300 matching mentions. Select a shorter date
                range to see others.
              </p>
            )}
          </section>
        </>
      )}
      {archive && (
        <MetaArchiveImport
          onClose={() => setArchive(false)}
          onSaved={data.refresh}
        />
      )}
      <ImportAccess
        open={setup}
        onOpenChange={setSetup}
        kind={kind}
        source={source === 'all' ? 'instagram' : (source as CommunitySource)}
        onSaved={data.refresh}
      />
      {selected && (
        <ConversationDetail
          key={selected.id}
          conversation={selected}
          onClose={() => setSelected(null)}
          onSaved={data.refresh}
        />
      )}
    </div>
  );
}
export function GoogleReviews({
  range,
  timezone,
  children,
  onLoadState,
}: {
  range: Range;
  timezone: string;
  children?: React.ReactNode;
  onLoadState?: (state: LoadState) => void;
}) {
  const data = useCommunity('review'),
    [dates, setDates] = useState<ReviewDateSelection>({
      mode: 'All dates',
      anchor: range.end,
      start: range.start,
      end: range.end,
      approximate: true,
    }),
    [category, setCategory] = useState('All topics'),
    [stars, setStars] = useState('All ratings'),
    [search, setSearch] = useState(''),
    [setup, setSetup] = useState(false),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  useEffect(() => {
    onLoadState?.({
      kind: 'review',
      ready: !data.loading && !data.error,
      error: data.error,
    });
  }, [data.loading, data.error, onLoadState]);
  const all = data.records
      .filter((r) => r.kind === 'review')
      .sort(compareReviewsNewest),
    status = data.statuses.find(
      (s) => s.source === 'gbp' && s.kind === 'review',
    );
  const reviewRange = reviewPeriodRange(dates, range);
  const dated = all.filter((r) =>
    reviewMatchesDates(r, reviewRange, timezone, dates.approximate),
  );
  const reviews = dated
    .map((r) => ({ ...r, ...reviewTopics(r) }))
    .filter(
      (r) =>
        (category === 'All topics' || r.categories.includes(category)) &&
        (stars === 'All ratings' ||
          (stars === 'Unanswered reviews'
            ? !r.reply
            : r.rating === Number(stars[0]))) &&
        [r.name, r.text].join(' ').toLowerCase().includes(search.toLowerCase()),
    );
  const issues = new Map<string, { count: number; examples: string[] }>();
  for (const r of dated)
    for (const c of reviewTopics(r).criticisms) {
      const item = issues.get(c.topic) || { count: 0, examples: [] };
      item.count++;
      if (item.examples.length < 3) item.examples.push(c.excerpt);
      issues.set(c.topic, item);
    }
  const ranked = [...issues].sort((a, b) => b[1].count - a[1].count),
    ready = all.length > 0 || status?.state === 'synced';
  async function sync() {
    setBusy(true);
    data.setError('');
    try {
      await communityAction({
        op: 'sync',
        source: 'gbp',
        continue: status?.more === true,
      });
      data.refresh();
    } catch (e) {
      data.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(
    () => setPage(1),
    [dates, range.start, range.end, category, stars, search],
  );
  return (
    <section className="community-view google-reviews">
      {children}
      <div className="section-head">
        <div>
          <h2>Guest reviews</h2>
          <p>
            All captured Google reviews and their original feedback. Removed
            reviews may remain in captured history.
          </p>
        </div>
        <div className="community-toolbar">
          <button className="secondary" onClick={() => setSetup(true)}>
            Access & import
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void sync()}
          >
            <RefreshCw size={16} />
            {busy
              ? 'Importing reviews…'
              : status?.more
                ? 'Continue review import'
                : 'Import reviews'}
          </button>
        </div>
      </div>
      {data.error && (
        <div className="save-error" role="alert">
          {data.error}
        </div>
      )}
      <ReviewDateControls value={dates} onChange={setDates} dashboard={range} />
      {reviewRange && dated.some((r) => r.timePrecision === 'relative') && (
        <p className="source-asof">
          {dated.filter((r) => r.timePrecision === 'relative').length} of{' '}
          {dated.length} date matches are approximate. Each review keeps
          Google’s original date label.
        </p>
      )}
      <CountCards
        items={[
          {
            label: 'Imported reviews',
            value: ready ? dated.length : null,
            history: ready ? reviewMonthHistory(dated, dated) : [],
            detail: reviewPeriodLabel(dates, range),
          },
          {
            label: 'Food-related reviews',
            history: ready
              ? reviewMonthHistory(
                  dated,
                  dated.filter((r) =>
                    reviewTopics(r).categories.includes('Food'),
                  ),
                )
              : [],
            value: ready
              ? dated.filter((r) => reviewTopics(r).categories.includes('Food'))
                  .length
              : null,
            detail: 'Positive and critical feedback about food',
          },
          {
            label: 'Reviews without a reply',
            value: ready ? dated.filter((r) => !r.reply).length : null,
            history: ready
              ? reviewMonthHistory(
                  dated,
                  dated.filter((r) => !r.reply),
                )
              : [],
            detail: 'No owner reply supplied by Google or the import',
          },
        ]}
      />
      <div className="surface community-panel">
        <h3>What guests criticize most</h3>
        <p className="source-asof">
          Suggestions consider dishes, ingredients, drinks, staff behaviour and
          the surrounding language, including negation and mixed feedback.
          Review the quoted evidence before acting. One review can raise several
          issues; a low rating alone does not identify the cause.
        </p>
        {ranked.length ? (
          <div className="review-issues">
            {ranked.map(([topic, v]) => (
              <button key={topic} onClick={() => setCategory(topic)}>
                <span>
                  <DataIcon name={topic} />
                  {topic}
                  <b>{v.count} reviews</b>
                </span>
                <div className="review-issue-bar">
                  <i
                    style={{
                      width: (v.count / ranked[0][1].count) * 100 + '%',
                    }}
                  />
                </div>
                <p>“{v.examples[0]}”</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="community-empty">
            {ready
              ? 'No explicit criticism matched the supported wording. Read the review text for other feedback.'
              : 'Import reviews to identify recurring criticism.'}
          </p>
        )}
      </div>
      <div className="community-toolbar">
        <Picker
          label="Review topic"
          value={category}
          onChange={setCategory}
          options={[
            'All topics',
            'Food',
            'Drinks',
            'Service',
            'Waiting time',
            'Price & value',
            'Atmosphere',
            'Cleanliness',
            'Other',
          ]}
        />
        <Picker
          label="Review rating"
          value={stars}
          onChange={setStars}
          options={[
            'All ratings',
            '1 star',
            '2 stars',
            '3 stars',
            '4 stars',
            '5 stars',
            'Unanswered reviews',
          ]}
        />
        <input
          className="community-search"
          aria-label="Search reviews"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search review text or reviewer"
        />
      </div>
      <div className="review-list">
        {data.loading ? (
          <p className="community-empty">Loading reviews…</p>
        ) : reviews.length ? (
          reviews.slice((page - 1) * 30, page * 30).map((r) => (
            <article
              className="surface review-card"
              key={r.accountId + ':' + r.id}
            >
              <div className="review-author">
                <Portrait person={r} />
                <div>
                  <strong>{r.name || 'Anonymous reviewer'}</strong>
                  <small>
                    {reviewDateLabel(r, timezone)} ·{' '}
                    {r.origin === 'api' ? 'Google' : 'Imported file'}
                  </small>
                </div>
                <span
                  className="review-stars"
                  aria-label={r.rating + ' out of 5 stars'}
                >
                  {'★'.repeat(r.rating || 0)}
                  {'☆'.repeat(5 - (r.rating || 0))}
                </span>
              </div>
              <p className="review-text">
                {r.text || 'Rating without written feedback.'}
              </p>
              <div className="review-tags">
                {r.categories.map((c) => (
                  <button
                    className="pill"
                    key={c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {r.criticisms.map((c) => (
                <div className="review-criticism" key={c.topic}>
                  <strong>{c.topic} · possible criticism</strong>
                  <p>“{c.excerpt}”</p>
                </div>
              ))}
              {r.reply ? (
                <div className="review-reply">
                  <strong>Ysabel Society’s reply</strong>
                  <p>{r.reply}</p>
                </div>
              ) : (
                <span className="pill">No reply supplied</span>
              )}
            </article>
          ))
        ) : (
          <p className="community-empty">
            No reviews match these filters. Connect Google Business or import a
            reviewed export.
          </p>
        )}
      </div>
      {reviews.length > 30 && (
        <div className="community-toolbar">
          <button
            className="secondary"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(reviews.length / 30)}
          </span>
          <button
            className="secondary"
            disabled={page * 30 >= reviews.length}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </button>
        </div>
      )}
      {data.truncated && <p>The newest 10,000 stored reviews are shown.</p>}
      <AccessStatus statuses={data.statuses} kind="review" source="gbp" />
      <ImportAccess
        open={setup}
        onOpenChange={setSetup}
        kind="review"
        source="gbp"
        onSaved={data.refresh}
      />
      <ReviewReports
        records={all}
        range={range}
        timezone={timezone}
        loading={data.loading}
        truncated={data.truncated}
        dates={dates}
        onDatesChange={setDates}
      />
    </section>
  );
}
