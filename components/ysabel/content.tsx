'use client';
import { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Upload,
  Grid3X3,
  List,
  Play,
  ArrowUpRight,
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  Copy,
  Trash2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Smartphone,
  Monitor,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Picker, Help } from './controls';
import { Bars } from './charts';
import {
  type Post,
  type Range,
  CHANNELS,
  compact,
  number,
  engagement,
  scorePost,
  postAvailable,
  iso,
} from '@/lib/analytics';
import { type WorkspaceData } from './use-workspace';
import { ImportedPostDetail } from './imported-post-detail';
export function Media({
  post,
  controls = false,
}: {
  post: Post;
  controls?: boolean;
}) {
  if (!post.image)
    return (
      <div className="media-unavailable">
        <Play size={24} />
        <span>Media preview unavailable</span>
      </div>
    );
  return post.mediaType === 'video' ? (
    <video
      src={post.image}
      controls={controls}
      muted={!controls}
      playsInline
      preload="metadata"
    />
  ) : (
    <img src={post.image} alt={post.title} loading="lazy" />
  );
}
export function Empty({
  title = 'No content in this view',
  text = 'Try another filter or add something new.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <Grid3X3 size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function MediaCards({
  posts,
  onSelect,
}: {
  posts: Post[];
  onSelect: (p: Post) => void;
}) {
  return (
    <div className="media-cards">
      {posts.map((p) => (
        <button
          className="media-card"
          data-platform={p.platform}
          key={p.id}
          onClick={() => onSelect(p)}
        >
          <div className="media-photo">
            <Media post={p} />
            <span className="media-platform">
              {p.platform} <span>· {p.format}</span>
            </span>
            <span className="media-score">
              {postAvailable(p, 'performanceScore') ? scorePost(p).score : '—'}{' '}
              <ArrowUpRight size={12} />
            </span>
            <div className="media-hover">
              <span>
                {postAvailable(p, 'saves') ? compact(p.saves) : '—'} saves
              </span>
              <span>
                {postAvailable(p, 'shares') ? compact(p.shares) : '—'} shares
              </span>
              <span>
                {postAvailable(p, 'engagementRate') && p.reach
                  ? ((engagement(p) / p.reach) * 100).toFixed(1) + '%'
                  : '—'}
                engagement
              </span>
            </div>
          </div>
          <h3>{p.title}</h3>
          <p>
            {p.unit} <span>·</span> {p.date}
          </p>
          <div className="media-metrics">
            <strong>
              {postAvailable(p, 'views') ? compact(p.views) : '—'}{' '}
              <small>views</small>
            </strong>
            <span>
              {postAvailable(p, 'engagements') ? compact(engagement(p)) : '—'}{' '}
              {p.origin ? 'reported interactions' : 'engagements'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
const tableFields: {
  key: keyof Post | 'engagementRate' | 'performanceScore';
  label: string;
}[] = [
  { key: 'title', label: 'Content' },
  { key: 'platform', label: 'Platform' },
  { key: 'date', label: 'Published' },
  { key: 'format', label: 'Type' },
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'saves', label: 'Saves' },
  { key: 'shares', label: 'Shares' },
  { key: 'engagementRate', label: 'Eng. rate' },
  { key: 'followers', label: 'Followers gained' },
  { key: 'visits', label: 'Website visits' },
  { key: 'performanceScore', label: 'Score' },
];
function field(p: Post, key: string) {
  if (
    [
      'views',
      'reach',
      'likes',
      'comments',
      'saves',
      'shares',
      'followers',
      'visits',
      'engagementRate',
      'performanceScore',
    ].includes(key) &&
    !postAvailable(p, key)
  )
    return '—';
  if (key === 'engagementRate')
    return p.reach ? (engagement(p) / p.reach) * 100 : 0;
  if (key === 'performanceScore') return scorePost(p).score;
  return p[key as keyof Post] as string | number;
}
export function ContentIntelligence({
  data,
  unit,
  range,
  onSelect,
}: {
  data: WorkspaceData;
  unit: string;
  range: Range;
  onSelect: (p: Post) => void;
}) {
  const [search, setSearch] = useState(''),
    [platform, setPlatform] = useState('All platforms'),
    [format, setFormat] = useState('All formats'),
    [campaign, setCampaign] = useState('All campaigns'),
    [distribution, setDistribution] = useState('All distribution'),
    [sort, setSort] = useState('views'),
    [direction, setDirection] = useState(-1),
    [page, setPage] = useState(0),
    [level, setLevel] = useState('All performance'),
    [tab, setTab] = useState('Content');
  const published = data.posts.filter(
    (p) =>
      p.status === 'Published' && p.date >= range.start && p.date <= range.end,
  );
  const filtered = published
    .filter(
      (p) =>
        (platform === 'All platforms' || p.platform === platform) &&
        (format === 'All formats' || p.format === format) &&
        (campaign === 'All campaigns' || p.campaign === campaign) &&
        (distribution === 'All distribution' ||
          p.distribution === distribution) &&
        (level === 'All performance' ||
          (level === 'Exceptional'
            ? scorePost(p).score >= 85
            : scorePost(p).score < 60)) &&
        (p.title + ' ' + p.tags.join(' '))
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const x = field(a, sort),
        y = field(b, sort);
      return (
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y))) * direction
      );
    });
  const formats = ['Reel', 'Video', 'Carousel', 'Static', 'Story'].map(
    (label) => {
      const ps = published.filter((p) => p.format === label);
      return {
        label,
        value: ps.reduce((n, p) => n + p.views, 0) / (ps.length || 1),
      };
    },
  );
  return (
    <div className="view-enter">
      {data.posts.some((p) => p.origin) && (
        <p className="source-live-note">
          Imported content · dates filter publication dates. Post metrics are
          lifetime totals observed at refresh, not activity restricted to the
          selected period. Missing fields remain unavailable.
        </p>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="page-tabs">
          {['Content', 'Formats & timing', 'Creative patterns'].map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'Content' ? (
        <>
          <div className="section-head standalone">
            <div>
              <h2>Content that moved the conversation</h2>
              <p>Published content · sorted by views</p>
            </div>
            <span className="pill">DEMO MEDIA</span>
          </div>
          {published.length ? (
            <MediaCards
              posts={[...published]
                .sort((a, b) => b.views - a.views)
                .slice(0, 4)}
              onSelect={onSelect}
            />
          ) : (
            <Empty />
          )}
          <section className="surface table-surface">
            <div className="section-head">
              <h2>Content performance</h2>
              <span className="muted">{filtered.length} posts</span>
            </div>
            <div className="content-filters">
              <label className="search-field">
                <Search size={15} />
                <input
                  aria-label="Search content"
                  placeholder="Search content or tags"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              {[
                [
                  platform,
                  setPlatform,
                  ['All platforms', ...CHANNELS.slice(0, 3)],
                ],
                [
                  format,
                  setFormat,
                  [
                    'All formats',
                    'Reel',
                    'Video',
                    'Carousel',
                    'Static',
                    'Story',
                  ],
                ],
                [
                  campaign,
                  setCampaign,
                  [
                    'All campaigns',
                    ...new Set(data.posts.map((p) => p.campaign)),
                  ],
                ],
                [
                  distribution,
                  setDistribution,
                  ['All distribution', 'Organic', 'Paid'],
                ],
                [
                  level,
                  setLevel,
                  ['All performance', 'Exceptional', 'Below baseline'],
                ],
              ].map(([value, setter, options]: any, i) => (
                <Picker
                  key={i}
                  label={
                    [
                      'Platform filter',
                      'Format filter',
                      'Campaign filter',
                      'Distribution filter',
                      'Performance filter',
                    ][i]
                  }
                  value={value}
                  options={options}
                  onChange={(v) => {
                    setter(v);
                    setPage(0);
                  }}
                />
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {tableFields.map((f) => (
                    <TableHead key={f.key}>
                      <button
                        onClick={() => {
                          setDirection(sort === f.key ? -direction : -1);
                          setSort(f.key);
                        }}
                      >
                        {f.label}{' '}
                        {sort === f.key ? (direction < 0 ? '↓' : '↑') : ''}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(page * 8, (page + 1) * 8).map((p) => (
                  <TableRow key={p.id} onClick={() => onSelect(p)}>
                    {tableFields.map((f) => (
                      <TableCell key={f.key}>
                        {f.key === 'title' ? (
                          <button
                            className="table-title"
                            onClick={() => onSelect(p)}
                          >
                            <img src={p.image} alt="" />
                            <span>
                              {p.title}
                              <small>{p.unit}</small>
                            </span>
                          </button>
                        ) : p.origin &&
                          [
                            'views',
                            'reach',
                            'likes',
                            'comments',
                            'saves',
                            'shares',
                            'followers',
                            'visits',
                            'engagementRate',
                            'performanceScore',
                          ].includes(f.key) &&
                          !postAvailable(p, f.key) ? (
                          <span className="muted">—</span>
                        ) : f.key === 'visits' && !p.origin ? (
                          <span className="muted">Unavailable</span>
                        ) : f.key === 'engagementRate' ? (
                          Number(field(p, f.key)).toFixed(1) + '%'
                        ) : f.key === 'performanceScore' ? (
                          <span className="score-pill">{field(p, f.key)}</span>
                        ) : typeof field(p, f.key) === 'number' ? (
                          compact(Number(field(p, f.key)))
                        ) : (
                          String(field(p, f.key))
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length && <Empty />}
            <div className="pagination">
              <span>
                {filtered.length ? Math.min(page * 8 + 1, filtered.length) : 0}–
                {Math.min((page + 1) * 8, filtered.length)} of {filtered.length}
              </span>
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                disabled={(page + 1) * 8 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </>
      ) : tab === 'Formats & timing' ? (
        <div className="two-col">
          <section className="surface padded">
            <h2>Average views by format</h2>
            <Bars items={formats} />
            <p className="footnote">
              Published posts in the selected period. Sample sizes differ.
            </p>
          </section>
          <Heatmap posts={published} />
        </div>
      ) : (
        <section className="surface padded">
          <h2>Creative patterns</h2>
          <p className="muted">
            Observed associations in tagged content. Correlation does not
            establish causation.
          </p>
          <Bars
            items={[
              'Chef',
              'Atmosphere',
              'Food close-up',
              'Cocktails',
              'People',
              'Interior',
              'Seasonal menu',
              'Events',
            ].map((label) => {
              const ps = published.filter((p) => p.tags.includes(label));
              return {
                label: label + ' · ' + ps.length + ' posts',
                value: ps.reduce((n, p) => n + p.shares, 0) / (ps.length || 1),
              };
            })}
          />
          <p className="footnote">
            Average shares per post. Add or change tags in the content detail
            panel.
          </p>
        </section>
      )}
    </div>
  );
}
function Heatmap({ posts }: { posts: Post[] }) {
  const [metric, setMetric] = useState('Engagement');
  const cells = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const ps = posts.filter((p) => {
        if (p.origin && (!p.publishedAt || !p.publishedAt.includes('T')))
          return false;
        const d = new Date(
          p.origin
            ? p.publishedAt!
            : p.date +
                'T' +
                (p.scheduled
                  ? p.scheduled.slice(11, 16)
                  : String(17 + (Number(p.id.replace(/\D/g, '')) % 5)).padStart(
                      2,
                      '0',
                    ) + ':00') +
                ':00Z',
        );
        return (d.getUTCDay() + 6) % 7 === day && d.getUTCHours() === hour;
      });
      return ps.length
        ? ps.reduce(
            (n, p) =>
              n +
              (metric === 'Views'
                ? p.views
                : metric === 'Reach'
                  ? p.reach
                  : metric === 'Shares'
                    ? p.shares
                    : engagement(p)),
            0,
          ) / ps.length
        : 0;
    }),
  );
  const max = Math.max(...cells.flat(), 1);
  return (
    <section className="surface padded">
      <div className="section-head">
        <h2>Best time to publish</h2>
        <Picker
          label="Heatmap metric"
          value={metric}
          onChange={setMetric}
          options={['Engagement', 'Views', 'Reach', 'Shares']}
        />
      </div>
      <div className="heatmap">
        {cells.map((row, d) => (
          <div key={d}>
            <span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]}</span>
            {row.map((v, h) => (
              <button
                key={h}
                aria-label={
                  [
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday',
                  ][d] +
                  ' ' +
                  h +
                  ':00: ' +
                  (v ? compact(v) + ' average ' + metric : 'No observations')
                }
                title={h + ':00 · ' + (v ? compact(v) : 'No observations')}
                style={{
                  background: v
                    ? 'rgba(106,127,163,' + (0.2 + (v / max) * 0.8) + ')'
                    : '#e4e9f0',
                }}
              />
            ))}
          </div>
        ))}
        <div className="heat-axis">
          <span />
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </div>
      <p className="footnote">
        Publishing hours in UTC · source timestamps when imported; demo hours in
        preview. Observed performance, not a causal recommendation. Empty cells
        have no observations.
      </p>
    </section>
  );
}
export function PostDetail({
  post,
  onClose,
  data,
}: {
  post: Post | null;
  onClose: () => void;
  data: WorkspaceData;
}) {
  const [draft, setDraft] = useState<Post | null>(null),
    [confirm, setConfirm] = useState(false),
    [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const shown = draft?.id === post?.id ? draft : post;
  const score = shown ? scorePost(shown) : null;
  if (post?.origin) return <ImportedPostDetail post={post} close={onClose} />;
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !shown) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', f);
      const r = await fetch('/marketingdata/api/media', { method: 'POST', body: form });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDraft({ ...shown, image: d.url, mediaType: d.mediaType });
      data.notify('Media uploaded. Save the content to keep this replacement.');
    } catch (e) {
      data.notify(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }
  const edit = (v: Partial<Post>) => shown && setDraft({ ...shown, ...v });
  return (
    <>
      <Sheet
        open={!!post}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            onClose();
          }
        }}
      >
        <SheetContent className="detail-drawer">
          <SheetHeader>
            <SheetTitle>{shown?.title ?? 'Content detail'}</SheetTitle>
            <SheetDescription>
              {shown?.platform} · {shown?.unit} · {shown?.status}
            </SheetDescription>
          </SheetHeader>
          {shown && (
            <div className="detail-body">
              <div className="detail-media">
                <Media post={shown} controls />
              </div>
              <div className="detail-toolbar">
                <button
                  className="secondary"
                  onClick={() => file.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Replace media'}
                </button>
                <button
                  className="icon-button"
                  aria-label="Duplicate content"
                  onClick={() => void data.duplicate(shown).catch(() => {})}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete content"
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 size={16} />
                </button>
                <input
                  ref={file}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={upload}
                />
              </div>
              <div className="detail-stats">
                {[
                  ['Views', shown.views],
                  ['Reach', shown.reach],
                  ['Likes', shown.likes],
                  ['Comments', shown.comments],
                  ['Saves', shown.saves],
                  ['Shares', shown.shares],
                  ['Followers gained', shown.followers],
                  [
                    'Engagement rate',
                    shown.reach
                      ? ((engagement(shown) / shown.reach) * 100).toFixed(1) +
                        '%'
                      : '—',
                  ],
                ].map(([label, v]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{typeof v === 'number' ? number(v) : v}</strong>
                  </div>
                ))}
              </div>
              <p className="footnote">
                Website clicks, profile visits, watch time and completion rate
                are unavailable in these sample records. No reservations are
                attributed.
              </p>
              {shown.status === 'Published' && (
                <details className="score-detail">
                  <summary>
                    <span className="score-big">{score?.score}</span>{' '}
                    Performance score <span>Inspect calculation</span>
                  </summary>
                  <p>
                    Weighted relative performance against the 12 published demo
                    posts. Baseline performance scores 60; each component is
                    capped at 100.
                  </p>
                  {score?.parts.map((p) => (
                    <div className="score-line" key={p.name}>
                      <span>
                        {p.name} · {p.weight * 100}% weight
                      </span>
                      <span>
                        {p.baseline ? (p.value / p.baseline).toFixed(2) : '—'}×
                        baseline
                      </span>
                    </div>
                  ))}
                </details>
              )}
              <div className="edit-form">
                <label>
                  Content name
                  <input
                    value={shown.title}
                    onChange={(e) => edit({ title: e.target.value })}
                  />
                </label>
                <label>
                  Caption
                  <textarea
                    rows={4}
                    value={shown.caption}
                    onChange={(e) => edit({ caption: e.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Status
                    <Picker
                      label="Content status"
                      value={shown.status}
                      onChange={(v) => edit({ status: v })}
                      options={
                        shown.status === 'Published'
                          ? ['Published', 'Archived']
                          : ['Draft', 'Approved', 'Scheduled', 'Archived']
                      }
                    />
                  </label>
                  <label>
                    Platform
                    <Picker
                      label="Content platform"
                      value={shown.platform}
                      onChange={(v) =>
                        edit({ platform: v as Post['platform'] })
                      }
                      options={[...CHANNELS.slice(0, 3)]}
                    />
                  </label>
                  <label>
                    Format
                    <Picker
                      label="Content format"
                      value={shown.format}
                      onChange={(v) => edit({ format: v })}
                      options={['Reel', 'Video', 'Carousel', 'Static', 'Story']}
                    />
                  </label>
                </div>
                <label>
                  Planned publication · {data.settings.timezone}
                  <input
                    type="datetime-local"
                    value={shown.scheduled}
                    onChange={(e) =>
                      edit({
                        scheduled: e.target.value,
                        status: e.target.value ? 'Scheduled' : 'Draft',
                      })
                    }
                  />
                </label>
                <label>
                  Tags · separate with commas
                  <input
                    value={shown.tags.join(', ')}
                    onChange={(e) =>
                      edit({
                        tags: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                  />
                </label>
                <label>
                  Campaign
                  <input
                    value={shown.campaign}
                    onChange={(e) => edit({ campaign: e.target.value })}
                  />
                </label>
                <p className="footnote">
                  Scheduling records your plan. Automatic publishing requires
                  connected publishing APIs.
                </p>
                <button
                  className="primary"
                  disabled={data.busy || uploading || !data.ready}
                  onClick={() =>
                    void data
                      .save({ ...shown, tags: shown.tags.filter(Boolean) })
                      .then(() => {
                        setDraft(null);
                        onClose();
                      })
                      .catch(() => {})
                  }
                >
                  {data.busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this content?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from your studio and library. It does not
              delete a published social post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep content</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                shown &&
                void data
                  .remove(shown.id)
                  .then(() => {
                    setDraft(null);
                    onClose();
                  })
                  .catch(() => {})
              }
            >
              Remove content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
export function Studio({
  data,
  unit,
  onSelect,
  previewOnly = false,
  library = false,
}: {
  data: WorkspaceData;
  unit: string;
  onSelect: (p: Post) => void;
  previewOnly?: boolean;
  library?: boolean;
}) {
  const [mode, setMode] = useState(previewOnly ? 'Phone' : 'Grid'),
    [status, setStatus] = useState('All states'),
    [search, setSearch] = useState(''),
    [tag, setTag] = useState('All tags'),
    [drag, setDrag] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const posts = data.posts
    .filter(
      (p) =>
        (status === 'All states' || p.status === status) &&
        (tag === 'All tags' || p.tags.includes(tag)) &&
        (p.title + ' ' + p.campaign + ' ' + p.tags.join(' '))
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.position - b.position);
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.set('file', f);
        const r = await fetch('/marketingdata/api/media', { method: 'POST', body: form });
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        await data.save({
          ...data.posts[0],
          id: crypto.randomUUID(),
          title: f.name.replace(/\.[^.]+$/, ''),
          image: d.url,
          mediaType: d.mediaType,
          caption: '',
          status: 'Draft',
          unit: 'Ysabel Society',
          scheduled: '',
          tags: [],
          campaign: '',
          views: 0,
          reach: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          followers: 0,
          visits: 0,
          score: 0,
        });
      }
    } catch (e) {
      data.notify(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }
  async function swap(id: string, target: string) {
    if (id === target) return;
    const ids = [...data.posts]
        .sort((a, b) => a.position - b.position)
        .map((p) => p.id),
      from = ids.indexOf(id),
      to = ids.indexOf(target);
    if (from < 0 || to < 0) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await data.reorder(ids);
  }
  return (
    <div className="view-enter">
      <div className="studio-toolbar">
        <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
          <TabsList className="page-tabs">
            {(library
              ? ['Grid', 'Large grid', 'List']
              : ['Grid', 'Phone', 'Desktop']
            ).map((m) => (
              <TabsTrigger key={m} value={m}>
                {m}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="inline-controls">
          <Picker
            label="Content state"
            value={status}
            onChange={setStatus}
            options={[
              'All states',
              'Draft',
              'Approved',
              'Scheduled',
              'Published',
              'Archived',
            ]}
          />
          <button
            className="primary"
            disabled={uploading || !data.ready}
            onClick={() => file.current?.click()}
          >
            <Upload size={15} />
            {uploading ? 'Uploading…' : 'Upload media'}
          </button>
          <input
            ref={file}
            type="file"
            multiple
            hidden
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
      </div>
      {library && (
        <div className="content-filters">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search media"
              placeholder="Search media, tags or campaigns"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Picker
            label="Library tags"
            value={tag}
            onChange={setTag}
            options={[
              'All tags',
              ...new Set(data.posts.flatMap((p) => p.tags)),
            ]}
          />
        </div>
      )}
      <div
        className={'studio-layout ' + (mode === 'Phone' ? 'phone-layout' : '')}
      >
        <div
          className={
            mode === 'Phone'
              ? 'phone-shell'
              : mode === 'Desktop'
                ? 'desktop-preview'
                : 'studio-canvas'
          }
        >
          <div className={mode === 'Phone' ? 'phone-island' : 'hidden'} />
          {(mode === 'Phone' || mode === 'Desktop') && (
            <div className="instagram-profile">
              <div className="profile-handle">
                ysabelsociety <span>⌄</span>
              </div>
              <div className="instagram-stats">
                <span className="profile-seal">Y</span>
                <span>
                  <strong>{posts.length}</strong>posts
                </span>
                <span>
                  <strong>19.5K</strong>followers
                </span>
                <span>
                  <strong>128</strong>following
                </span>
              </div>
              <strong>Ysabel Society</strong>
              <p>
                A place for extraordinary evenings.
                <br />
                Extraordinary evenings. Ysabel Society.
                <br />
                <span>ysabelsociety.com</span>
              </p>
              <div className="profile-actions">
                <span>Edit profile</span>
                <span>Share profile</span>
              </div>
              <p className="footnote">Profile preview · sample counts</p>
            </div>
          )}
          <div
            className={
              'studio-grid ' +
              (mode === 'Large grid' ? 'large-grid' : '') +
              (mode === 'List' ? 'media-list' : '')
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                void upload(e.dataTransfer.files);
              }
            }}
          >
            {posts.map((p, i) => (
              <div
                className="studio-tile"
                data-platform={p.platform}
                key={p.id}
                draggable={mode === 'Grid' || mode === 'Desktop'}
                onDragStart={() => setDrag(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (drag) void swap(drag, p.id).catch(() => {});
                  else if (e.dataTransfer.files.length)
                    void upload(e.dataTransfer.files);
                  setDrag(null);
                }}
              >
                <button
                  className="tile-media"
                  onClick={() => onSelect(p)}
                  aria-label={'Edit ' + p.title}
                >
                  <Media post={p} />
                  <span
                    className={'state-dot state-' + p.status.toLowerCase()}
                  />
                  {p.format === 'Reel' || p.format === 'Video' ? (
                    <Play className="tile-play" size={15} />
                  ) : null}
                  <div className="tile-overlay">
                    <strong>{p.title}</strong>
                    <span>
                      {p.status === 'Published'
                        ? compact(p.views) + ' views'
                        : p.status}
                    </span>
                  </div>
                </button>
                {mode === 'List' && (
                  <button className="list-copy" onClick={() => onSelect(p)}>
                    <h3>{p.title}</h3>
                    <p>
                      {p.platform} · {p.format} · {p.unit}
                    </p>
                    <span>
                      {p.status} · {p.scheduled || p.date}
                    </span>
                  </button>
                )}
                {mode === 'Grid' && (
                  <div className="tile-actions">
                    <span>
                      {String(i + 1).padStart(2, '0')} · {p.status}
                    </span>
                    <button
                      aria-label={'Move ' + p.title + ' earlier'}
                      disabled={i === 0 || data.busy}
                      onClick={() =>
                        void swap(p.id, posts[i - 1].id).catch(() => {})
                      }
                    >
                      <MoveUp size={12} />
                    </button>
                    <button
                      aria-label={'Move ' + p.title + ' later'}
                      disabled={i === posts.length - 1 || data.busy}
                      onClick={() =>
                        void swap(p.id, posts[i + 1].id).catch(() => {})
                      }
                    >
                      <MoveDown size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!posts.length && (
              <Empty
                title="Your next story starts here"
                text="Upload media to start planning."
              />
            )}
          </div>
        </div>
        {!library && mode === 'Grid' && (
          <aside className="studio-notes surface padded">
            <div className="eyebrow">CREATIVE DIRECTION</div>
            <h2>The grid is your canvas.</h2>
            <p>
              Arrange the rhythm of your next chapter. Drag to swap content, or
              use the arrows to move it with a keyboard.
            </p>
            <div className="studio-count">
              <strong>
                {posts.filter((p) => p.status === 'Draft').length}
              </strong>
              <span>Ideas in progress</span>
            </div>
            <div className="studio-count">
              <strong>
                {posts.filter((p) => p.status === 'Scheduled').length}
              </strong>
              <span>Planned publications</span>
            </div>
            <h3>Content states</h3>
            {['Draft', 'Approved', 'Scheduled', 'Published', 'Archived'].map(
              (s) => (
                <div className="status-key" key={s}>
                  <i className={'state-dot state-' + s.toLowerCase()} />
                  {s}
                </div>
              ),
            )}
            <p className="footnote">
              Your grid order and edits are saved privately. Planning does not
              publish to social channels.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
export function ContentCalendar({
  data,
  unit,
  onSelect,
}: {
  data: WorkspaceData;
  unit: string;
  onSelect: (p: Post) => void;
}) {
  const [month, setMonth] = useState('2026-09'),
    [view, setView] = useState('Monthly'),
    [drag, setDrag] = useState<string | null>(null),
    [week, setWeek] = useState(0);
  const start = new Date(month + '-01T12:00:00Z');
  const offset = (start.getUTCDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(start.getTime() + (i - offset) * 86400000),
  );
  const posts = data.posts.filter((p) => p.status !== 'Archived');
  const filtered = posts
    .filter((p) => (p.scheduled || p.date).startsWith(month))
    .sort((a, b) =>
      (a.scheduled || a.date).localeCompare(b.scheduled || b.date),
    );
  function moveMonth(delta: number) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(iso(d).slice(0, 7));
    setWeek(0);
  }
  return (
    <div className="view-enter">
      <div className="studio-toolbar">
        <div className="inline-controls">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <h2>
            {start.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(String(v))}>
          <TabsList className="page-tabs">
            {['Monthly', 'Weekly', 'Timeline'].map((v) => (
              <TabsTrigger value={v} key={v}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <p className="footnote calendar-note">
        Creative calendar · {data.settings.timezone}. Drag planned content to
        another date. Published posts keep their original date.
      </p>
      {view === 'Weekly' && (
        <div className="inline-controls week-control">
          <button
            disabled={week === 0}
            className="secondary"
            onClick={() => setWeek(week - 1)}
          >
            Previous week
          </button>
          <span>Week {week + 1}</span>
          <button
            disabled={week === 5}
            className="secondary"
            onClick={() => setWeek(week + 1)}
          >
            Next week
          </button>
        </div>
      )}
      {view === 'Timeline' ? (
        <section className="surface padded">
          {filtered.length ? (
            filtered.map((p) => (
              <button
                className="timeline-post"
                key={p.id}
                onClick={() => onSelect(p)}
              >
                <span>{(p.scheduled || p.date).slice(0, 10)}</span>
                <img src={p.image} alt="" />
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    {p.platform} · {p.unit}
                  </small>
                </span>
                <span className="status-chip">{p.status}</span>
              </button>
            ))
          ) : (
            <Empty
              title="Nothing planned this month"
              text="Add dates to content from the studio."
            />
          )}
        </section>
      ) : (
        <div className="calendar-grid">
          <div className="calendar-days">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            className={
              'calendar-cells ' + (view === 'Weekly' ? 'week-cells' : '')
            }
          >
            {(view === 'Weekly'
              ? days.slice(week * 7, week * 7 + 7)
              : days
            ).map((d) => {
              const date = iso(d);
              return (
                <div
                  key={date}
                  className={
                    'calendar-cell ' +
                    (!date.startsWith(month) ? 'outside-month' : '')
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const p = posts.find((p) => p.id === drag);
                    if (p && p.status !== 'Published')
                      void data
                        .save({
                          ...p,
                          status: 'Scheduled',
                          scheduled:
                            date + 'T' + (p.scheduled.slice(11, 16) || '19:00'),
                        })
                        .catch(() => {});
                    setDrag(null);
                  }}
                >
                  <span className="day-number">{d.getUTCDate()}</span>
                  {posts
                    .filter(
                      (p) => (p.scheduled || p.date).slice(0, 10) === date,
                    )
                    .map((p) => (
                      <button
                        className="calendar-post"
                        key={p.id}
                        draggable={p.status !== 'Published'}
                        onDragStart={() => setDrag(p.id)}
                        onClick={() => onSelect(p)}
                      >
                        <img src={p.image} alt="" />
                        <span>
                          {p.title}
                          <small>
                            {p.platform} ·{' '}
                            {p.scheduled.slice(11, 16) || 'Published'}
                          </small>
                        </span>
                        <i
                          className={
                            'state-dot state-' + p.status.toLowerCase()
                          }
                        />
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
