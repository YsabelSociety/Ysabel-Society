'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Download,
  KeyRound,
  RefreshCw,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { csvRows, DAILY_FIELDS, POST_FIELDS } from '@/lib/import-file';
import { type DataCheck } from '@/lib/reporting';
import { iso } from '@/lib/analytics';
import { Picker } from './controls';
const GUIDES: Record<
  string,
  { console: string; guide: string; steps: string[] }
> = {
  instagram: {
    console: 'https://developers.facebook.com/apps/',
    guide:
      'https://www.postman.com/meta/instagram/folder/23987686-f659d7d1-d74c-44e4-9192-9b1e8694c511',
    steps: [
      'Use Meta sign-in above for a Facebook Page linked to a professional Instagram account. Add instagram_manage_insights to the login configuration.',
      'Already have an app? You can also use an authorized user or system-user token with the required account permissions. Select the Instagram business account ID, not the Facebook Page ID.',
      'Export additional or older information from Meta Business Suite → Insights → Export data. Import the exported daily totals, content or audience report below.',
    ],
  },
  facebook: {
    console: 'https://developers.facebook.com/apps/',
    guide: 'https://developers.facebook.com/docs/pages-api/insights/',
    steps: [
      'Use Meta sign-in above and grant pages_show_list, pages_read_engagement and read_insights. Your Facebook account needs access to the Page.',
      'An existing Page access token or authorized system-user token is another connection method. Use the Facebook Page ID and the supported Graph API version.',
      'Meta metric names change. The import checks each metric separately; current media viewers are kept separate from legacy reach. Use a Business Suite export for other available reports.',
    ],
  },
  tiktok: {
    console: 'https://developers.tiktok.com/apps/',
    guide: 'https://developers.tiktok.com/docs/en/display-api-get-started',
    steps: [
      'Create or reuse a TikTok developer app with Login Kit and Display API. Request user.info.basic, user.info.stats and video.list.',
      'Use TikTok sign-in above, or an existing authorized access token and its matching open_id. Direct tokens must be replaced when they expire.',
      'For daily traffic, retention or demographics, export the available reports from TikTok Studio → Analytics. Standard Display API provides lifetime video counters; it does not provide those daily reports. A separately approved TikTok Business integration has its own permissions and eligibility.',
    ],
  },
  ga4: {
    console: 'https://console.cloud.google.com/apis/dashboard',
    guide:
      'https://developers.google.com/analytics/devguides/reporting/data/v1/basics',
    steps: [
      'Use Google sign-in above after enabling Analytics Data API and Admin API. Your Google account must have property access.',
      'For a service account, create one in Google Cloud → IAM & Admin → Service Accounts. Add its email as a Viewer in GA4 → Admin → Property access management. Upload its JSON key here.',
      'Configure real events on your website using your existing Google tag or Tag Manager. Enter the exact menu path and reservation event names below. A reservation click is not a completed booking.',
    ],
  },
  gbp: {
    console: 'https://console.cloud.google.com/apis/dashboard',
    guide: 'https://developers.google.com/my-business/content/prereqs',
    steps: [
      'Request Business Profile API access for your Google Cloud project and enable the Performance, Account Management and Business Information APIs.',
      'Use Google sign-in above with an owner or manager of the verified business location, or an existing OAuth access token with business.manage. Use the numeric location ID.',
      'Bookings and food orders only exist when the corresponding Google service is active. Monthly search terms have privacy thresholds. Export other available performance reports from your Business Profile.',
    ],
  },
  'meta-ads': {
    console: 'https://business.facebook.com/settings/system-users',
    guide: 'https://developers.facebook.com/docs/marketing-api/insights/',
    steps: [
      'Create or reuse a Meta business app with Marketing API access. Assign the advertising account to the authorized user or system user.',
      'Generate a token with ads_read. In this form enter that token, the ad-account ID (act_… or numeric), and the supported Graph API version. No managed connector is needed.',
      'Meta attribution settings control reported conversion actions. Campaign spend and paid reach remain separate from organic metrics. Ads Manager exports can also be imported.',
    ],
  },
  'google-ads': {
    console: 'https://ads.google.com/aw/apicenter',
    guide:
      'https://developers.google.com/google-ads/api/docs/get-started/make-first-call',
    steps: [
      'Create or use a Google Ads manager account. Request a developer token in API Center and obtain access for production accounts.',
      'Use an OAuth access token with the adwords scope, or a Google service-account JSON key whose email has access to the Ads account.',
      'Enter the customer ID, approved developer token and supported Ads API version. If using a manager account, also enter its login customer ID. Configure conversion tracking in Google Ads for conversion reporting.',
    ],
  },
  'tiktok-ads': {
    console: 'https://business-api.tiktok.com/portal',
    guide: 'https://business-api.tiktok.com/portal/docs?id=1740302848100353',
    steps: [
      'Register a TikTok for Business developer app and request Marketing API reporting access.',
      'Authorize the advertiser in the TikTok Business portal. Enter the issued access token and advertiser ID below. A TikTok Display API token cannot authorize an Ads account.',
      'The app imports daily campaign spend, impressions, clicks and conversions. Pixel or Events API tracking must already be configured to report website conversions. Ads Manager CSV exports are also supported.',
    ],
  },
};
type Link = {
  source: string;
  provider: string;
  label: string;
  externalId: string;
  autoSync: boolean;
  snapshot?: {
    checks?: DataCheck[];
    observedAt?: string;
    scope?: string;
    partial?: boolean;
    method?: string;
  };
};
export function ConnectionOptions({ notify }: { notify: (s: string) => void }) {
  const [source, setSource] = useState('instagram'),
    [method, setMethod] = useState('guide'),
    [links, setLinks] = useState<Link[]>([]),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({
    label: 'Ysabel Society',
    externalId: '',
    accessToken: '',
    apiVersion: '',
    developerToken: '',
    loginCustomerId: '',
    serviceAccount: '',
    expiresAt: '',
  });
  const [kind, setKind] = useState('daily'),
    [csv, setCSV] = useState(''),
    [preview, setPreview] = useState<Record<string, string>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [fileName, setFileName] = useState('');
  const [start, setStart] = useState(iso(new Date(Date.now() - 30 * 86400000))),
    [end, setEnd] = useState(iso(new Date(Date.now() - 86400000))),
    [tokenMethod, setTokenMethod] = useState('token');
  const [permissions, setPermissions] = useState<
      { name: string; status: string }[]
    >([]),
    [tracking, setTracking] = useState<Record<string, string>>({
      menuPath: '',
      reservationEvent: '',
      completedReservationEvent: '',
    });
  const selected = links.find((l) => l.source === source),
    guide = GUIDES[source];
  async function load() {
    const r = await fetch('/api/connectors');
    if (r.ok) {
      const d = (await r.json()) as { links: Link[] };
      setLinks(d.links);
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('ysabel:sources-updated', refresh);
    return () => window.removeEventListener('ysabel:sources-updated', refresh);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setTracking({
      menuPath: '',
      reservationEvent: '',
      completedReservationEvent: '',
    });
    if (source === 'ga4') {
      void fetch('/api/connection-options?source=ga4', { signal: abort.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as {
            tracking: Record<string, string>;
          };
          if (!abort.signal.aborted) setTracking(data.tracking);
        })
        .catch(() => {});
    }
    return () => abort.abort();
  }, [source]);
  async function act(op: string, body: Record<string, unknown> = {}) {
    setBusy(op);
    setError('');
    try {
      const r = await fetch('/api/connection-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, source, ...body }),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (op === 'permissions') setPermissions(d.permissions);
      else {
        window.dispatchEvent(new Event('ysabel:sources-updated'));
        await load();
        notify(
          op === 'file'
            ? 'File imported. Review its source-labelled data in the reports.'
            : op === 'tracking'
              ? 'Tracking configuration saved. Refresh Google Analytics to import it.'
              : 'Import completed. Review the coverage results below.',
        );
      }
      return d;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'This connection needs attention.',
      );
      return null;
    } finally {
      setBusy('');
    }
  }
  function pickSource(label: string) {
    const id =
      Object.keys(SOURCE_CHANNELS).find((k) => SOURCE_CHANNELS[k] === label) ||
      'instagram';
    setSource(id);
    setForm({
      label: 'Ysabel Society',
      externalId: '',
      accessToken: '',
      apiVersion: '',
      developerToken: '',
      loginCustomerId: '',
      serviceAccount: '',
      expiresAt: '',
    });
    setTokenMethod('token');
    setError('');
    setPermissions([]);
    setPreview([]);
    setCSV('');
    setFileName('');
    setMapping({});
    if (id.endsWith('-ads')) setKind('advertising');
    else setKind('daily');
  }
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (SOURCE_CHANNELS[id]) {
        pickSource(SOURCE_CHANNELS[id]);
        setMethod('guide');
        document
          .querySelector('.connection-methods')
          ?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('ysabel:configure-source', open);
    return () => window.removeEventListener('ysabel:configure-source', open);
  }, []);
  function field(name: string, label: string, type = 'text', required = false) {
    return (
      <label key={name}>
        {label}
        <input
          type={type}
          value={form[name] || ''}
          required={required}
          autoComplete={type === 'password' ? 'new-password' : 'off'}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        />
      </label>
    );
  }
  function template() {
    const fields =
      kind === 'daily'
        ? ['date', ...DAILY_FIELDS]
        : kind === 'posts'
          ? [
              'id',
              'publishedAt',
              'title',
              'format',
              'permalink',
              'image',
              'tags',
              ...POST_FIELDS,
            ]
          : ['date', 'label', 'value'];
    const blob = new Blob([fields.join(',') + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'ysabel-' + source + '-' + kind + '-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  const keys =
    kind === 'daily'
      ? ['date', ...DAILY_FIELDS]
      : [
          'id',
          'date',
          'publishedAt',
          'title',
          'caption',
          'format',
          'permalink',
          'image',
          'tags',
          'campaign',
          ...POST_FIELDS,
        ];
  return (
    <section className="connection-methods surface padded">
      <div className="section-head">
        <div>
          <h2>Connection & import centre</h2>
          <p className="muted">
            Choose a platform, configure access, and inspect what actually
            arrived.
          </p>
        </div>
        <Picker
          label="Platform to configure"
          value={SOURCE_CHANNELS[source]}
          options={Object.values(SOURCE_CHANNELS)}
          onChange={pickSource}
        />
      </div>
      <Tabs value={method} onValueChange={(v) => setMethod(String(v))}>
        <TabsList className="page-tabs connection-method-tabs">
          <TabsTrigger value="guide">Setup guide</TabsTrigger>
          <TabsTrigger value="credentials">
            Existing access / service account
          </TabsTrigger>
          <TabsTrigger value="file">Import an export</TabsTrigger>
          <TabsTrigger value="automation">
            Automatic refresh & history
          </TabsTrigger>
        </TabsList>
        <TabsContent value="guide">
          <ol className="setup-steps">
            {guide.steps.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
          <div className="wizard-links">
            <a
              className="secondary"
              href={guide.console}
              target="_blank"
              rel="noreferrer"
            >
              Open {SOURCE_CHANNELS[source]} setup <ArrowUpRight size={15} />
            </a>
            <a
              className="text-link"
              href={guide.guide}
              target="_blank"
              rel="noreferrer"
            >
              Official documentation <ArrowUpRight size={15} />
            </a>
            {!source.endsWith('-ads') && (
              <button
                className="primary"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('ysabel:connect-provider', {
                      detail: ['instagram', 'facebook'].includes(source)
                        ? 'meta'
                        : ['ga4', 'gbp'].includes(source)
                          ? 'google'
                          : 'tiktok',
                    }),
                  )
                }
              >
                Start guided sign-in
              </button>
            )}
          </div>
          {['instagram', 'facebook'].includes(source) && (
            <div className="coverage-diagnostics">
              <button
                className="secondary"
                disabled={!!busy}
                onClick={() => void act('permissions', { provider: 'meta' })}
              >
                <ShieldCheck size={15} /> Check Meta permissions
              </button>
              {permissions.map((p) => (
                <div className="availability-row" key={p.name}>
                  <span>{p.name}</span>
                  <strong>{p.status}</strong>
                </div>
              ))}
            </div>
          )}
          {source === 'ga4' && (
            <form
              className="edit-form tracking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act('tracking', tracking);
              }}
            >
              <h3>Connect the reservation journey</h3>
              <p className="muted">
                Use names already tracked on your website. Leave missing
                tracking blank.
              </p>
              {[
                ['menuPath', 'Exact menu page path'],
                ['reservationEvent', 'Reservation click event'],
                ['completedReservationEvent', 'Confirmed reservation event'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={tracking[key]}
                    onChange={(e) =>
                      setTracking({ ...tracking, [key]: e.target.value })
                    }
                    placeholder={
                      key === 'menuPath'
                        ? '/your-menu-page'
                        : 'Exact GA4 event name'
                    }
                  />
                </label>
              ))}
              <button className="secondary" disabled={!!busy}>
                Save tracking names
              </button>
            </form>
          )}
        </TabsContent>
        <TabsContent value="credentials">
          <p className="connection-return">
            Use credentials issued by the platform. This form does not accept
            your personal account password. Tokens and keys are stored
            encrypted.
          </p>
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act('direct', { ...form, method: tokenMethod }).then((d) => {
                if (d)
                  setForm({
                    ...form,
                    accessToken: '',
                    serviceAccount: '',
                    developerToken: '',
                  });
              });
            }}
          >
            {['ga4', 'google-ads'].includes(source) && (
              <Picker
                label="Authorization method"
                value={
                  tokenMethod === 'token'
                    ? 'Existing access token'
                    : 'Google service account'
                }
                options={['Existing access token', 'Google service account']}
                onChange={(v) =>
                  setTokenMethod(
                    v === 'Google service account'
                      ? 'service-account'
                      : 'token',
                  )
                }
              />
            )}
            {field('label', 'Account label', 'text', true)}
            {field(
              'externalId',
              source === 'tiktok'
                ? 'TikTok open_id'
                : 'Account / property / location ID',
              'text',
              true,
            )}
            {tokenMethod === 'token' ? (
              <>
                {field(
                  'accessToken',
                  'Authorized access token',
                  'password',
                  true,
                )}
                {field('expiresAt', 'Token expiry, if known', 'datetime-local')}
                <p className="footnote">
                  Direct tokens need replacement when they expire or access is
                  revoked. Google and TikTok sign-in above supports automatic
                  token renewal; a Google service account issues fresh tokens
                  automatically.
                </p>
              </>
            ) : (
              <label>
                Google service-account JSON key
                <input
                  type="file"
                  accept="application/json,.json"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= 20000)
                      void file
                        .text()
                        .then((v) => setForm({ ...form, serviceAccount: v }));
                    else
                      setError(
                        'Choose a service-account JSON key smaller than 20 KB.',
                      );
                  }}
                />
                <span className="muted">
                  {form.serviceAccount
                    ? 'Key selected. Its contents remain hidden.'
                    : 'Select the JSON file from Google Cloud.'}
                </span>
              </label>
            )}
            {['instagram', 'facebook', 'meta-ads', 'google-ads'].includes(
              source,
            ) &&
              field(
                'apiVersion',
                source === 'google-ads'
                  ? 'Google Ads API version (for example v25)'
                  : 'Meta Graph API version (from your app)',
                'text',
                true,
              )}
            {source === 'google-ads' && (
              <>
                {field(
                  'developerToken',
                  'Approved Google Ads developer token',
                  'password',
                  true,
                )}
                {field(
                  'loginCustomerId',
                  'Manager login customer ID, if applicable',
                )}
              </>
            )}
            <button className="primary" disabled={!!busy}>
              <KeyRound size={15} />
              {busy === 'direct'
                ? 'Checking access & importing…'
                : 'Save, verify access & import'}
            </button>
          </form>
        </TabsContent>
        <TabsContent value="file">
          <p className="muted">
            Import reports exported from the selected platform. Daily totals
            feed the dashboard; content feeds Content Intelligence; detailed
            reports appear in their platform view and Reports. Imported fields
            retain their source definitions. Re-imports update matching dates or
            post IDs.
          </p>
          <div className="import-controls">
            <Picker
              label="Report type"
              value={kind}
              options={
                source.endsWith('-ads')
                  ? ['advertising', 'detail']
                  : [
                      'daily',
                      'posts',
                      'audience',
                      'website',
                      'business',
                      'detail',
                    ]
              }
              onChange={(v) => {
                setKind(v);
                setMapping({});
              }}
            />
            <button className="secondary" onClick={template}>
              <Download size={15} /> Download column template
            </button>
            <label className="secondary file-picker">
              <Upload size={15} /> Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 3000000) {
                    setError('Choose a CSV smaller than 3 MB.');
                    return;
                  }
                  void f.text().then((text) => {
                    try {
                      const rows = csvRows(text);
                      setCSV(text);
                      setPreview(rows);
                      setFileName(f.name);
                      setMapping({});
                      setError('');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Invalid CSV.');
                    }
                  });
                }}
              />
            </label>
          </div>
          <div className="custom-dates">
            <label>
              Report start
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Report end
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          {!!preview.length && (
            <>
              <p>
                <strong>{fileName}</strong> · {preview.length.toLocaleString()}{' '}
                rows. Confirm the period and column mappings before importing.
              </p>
              {['daily', 'posts'].includes(kind) && (
                <div className="column-mapping">
                  {keys.map((key) => (
                    <label key={key}>
                      {key}
                      <select
                        value={
                          mapping[key] ??
                          (Object.keys(preview[0]).includes(key) ? key : '')
                        }
                        onChange={(e) =>
                          setMapping({ ...mapping, [key]: e.target.value })
                        }
                      >
                        <option value="">Unavailable / skip</option>
                        {Object.keys(preview[0]).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <div className="report-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {Object.entries(r).map(([k, v]) => (
                          <td key={k}>{v || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                disabled={!!busy}
                onClick={() =>
                  void act('file', {
                    kind,
                    csv,
                    mapping,
                    range: { start, end },
                    label: fileName,
                  })
                }
              >
                {busy === 'file' ? 'Importing…' : 'Import these source values'}
              </button>
            </>
          )}
        </TabsContent>
        <TabsContent value="automation">
          <div className="automation-grid">
            <div>
              <span className="pill">Available now</span>
              <h3>Automatic refresh in this workspace</h3>
              <p>
                After you authorize and select an account, refresh is enabled
                automatically. While the workspace is open and visible, it
                checks all due accounts every 15 minutes. Each account refreshes
                at most hourly, reconciling the latest three completed days and
                observing current followers.
              </p>
              <p>
                Google and TikTok sign-in renew tokens where the provider allows
                it. Revoked access, expired Meta grants, and manual tokens may
                require your sign-in again.
              </p>
            </div>
            <div>
              <span className="pill">Hosting requirement</span>
              <h3>Refresh while the app is closed</h3>
              <p>
                This private Sites deployment does not have a configured
                background scheduler. Closing the app pauses refresh. Always-on
                imports require a server scheduler with authenticated access;
                this is not enabled by the connection form.
              </p>
              <p>
                File imports update when you upload a new export. Registering
                developer apps, accepting platform terms and approving account
                access still require the account owner.
              </p>
            </div>
          </div>
          <div className="custom-dates">
            <label>
              History from
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="footnote">
            Import up to 32 days per window. Repeat for older periods within the
            provider’s retention limits. Current follower counts and lifetime
            content totals cannot reconstruct past values.
          </p>
          <button
            className="primary"
            disabled={!!busy || !selected || selected.provider === 'file'}
            onClick={() => void act('history', { range: { start, end } })}
          >
            <RefreshCw size={15} />
            {busy === 'history' ? 'Importing history…' : 'Import this period'}
          </button>
        </TabsContent>
      </Tabs>
      {error && (
        <div className="save-error" role="alert">
          {error}
        </div>
      )}
      <div className="coverage-diagnostics">
        <h3>{SOURCE_CHANNELS[source]} · import coverage</h3>
        {selected ? (
          <>
            <p>
              {selected.label} ·{' '}
              {selected.snapshot?.observedAt
                ? 'Last import ' +
                  new Date(selected.snapshot.observedAt).toLocaleString()
                : 'No successful import yet'}
            </p>
            <p className="footnote">{selected.snapshot?.scope}</p>
            {selected.snapshot?.checks?.map((check, i) => (
              <div
                className="coverage-check"
                key={check.key + ':' + i}
                data-status={check.status}
              >
                <span>
                  {check.status === 'imported' ? (
                    <Check size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                </span>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <small>
                  {check.status === 'imported'
                    ? check.records.toLocaleString() + ' imported'
                    : check.status === 'empty'
                      ? 'No data returned'
                      : 'Needs access / unavailable'}
                </small>
              </div>
            ))}
          </>
        ) : (
          <p className="muted">
            No account connected. Start with the setup guide or import a
            provider export. A connection becomes useful only after data has
            actually been returned.
          </p>
        )}
      </div>
    </section>
  );
}
