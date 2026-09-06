'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONNECTOR_GROUPS, SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { Picker } from './controls';
type GroupState = {
  id: string;
  configured: boolean;
  clientId: string;
  apiVersion: string;
  configId: string;
  authorized: boolean;
  callback: string;
};
type State = {
  ready: boolean;
  groups: GroupState[];
  links: {
    source: string;
    provider: string;
    label: string;
    autoSync: boolean;
    snapshot: Record<string, unknown> | null;
  }[];
};
type Resource = { source: string; id: string; label: string };
async function readState() {
  const r = await fetch('/marketingdata/api/connectors');
  const d = (await r.json()) as State & { error?: string };
  if (!r.ok) throw new Error(d.error || 'Connection setup is unavailable.');
  return d;
}
export function ConnectionAssistant({
  onChanged,
  notify,
}: {
  onChanged: () => void;
  notify: (message: string) => void;
}) {
  const [state, setState] = useState<State | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [step, setStep] = useState('setup'),
    [clientId, setClientId] = useState(''),
    [clientSecret, setClientSecret] = useState(''),
    [apiVersion, setApiVersion] = useState(''),
    [configId, setConfigId] = useState(''),
    [googleSource, setGoogleSource] = useState('Website Analytics only'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [resources, setResources] = useState<Resource[]>([]),
    [warnings, setWarnings] = useState<string[]>([]),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [returnNotice, setReturnNotice] = useState('');
  const returned = useRef(false);
  const group = CONNECTOR_GROUPS.find((g) => g.id === selected),
    configured = state?.groups.find((g) => g.id === selected);
  async function request<T = { saved: boolean }>(body: unknown) {
    const r = await fetch('/marketingdata/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = (await r.json()) as T & { error?: string };
    if (!r.ok)
      throw new Error(d.error || 'Connection setup could not complete.');
    return d;
  }
  async function load() {
    const d = await readState();
    setState(d);
    return d;
  }
  function open(id: string, data = state) {
    const g = data?.groups.find((g) => g.id === id);
    setSelected(id);
    setClientId(g?.clientId || '');
    setClientSecret('');
    setApiVersion(g?.apiVersion || '');
    setConfigId(g?.configId || '');
    setStep(g?.configured ? 'authorize' : 'setup');
    setError('');
    setResources([]);
    setWarnings([]);
    setChoices({});
  }
  async function discover(id: string) {
    setBusy('discover');
    setError('');
    try {
      const d = await request<{ resources: Resource[]; warnings: string[] }>({
        op: 'discover',
        provider: id,
      });
      setResources(d.resources);
      setChoices(
        Object.fromEntries(
          [...new Set(d.resources.map((r) => r.source))].flatMap((source) => {
            const options = d.resources.filter((r) => r.source === source);
            return options.length === 1 ? [[source, options[0].id]] : [];
          }),
        ),
      );
      setWarnings(d.warnings);
      setStep('accounts');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Accounts could not be listed.',
      );
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    void readState()
      .then((d) => {
        setState(d);
        if (returned.current) return;
        returned.current = true;
        const q = new URLSearchParams(window.location.search),
          provider = q.get('provider');
        const startProvider = q.get('connect');
        if (
          startProvider &&
          CONNECTOR_GROUPS.some((g) => g.id === startProvider)
        )
          open(startProvider, d);
        if (q.has('status')) {
          setReturnNotice(
            q.get('status') === 'authorized'
              ? 'Authorization complete. Choose the Ysabel Society accounts to import.'
              : 'Authorization did not finish. Check your app settings, approvals and callback URL, then try again.',
          );
          if (provider && CONNECTOR_GROUPS.some((g) => g.id === provider)) {
            open(provider, d);
            if (q.get('status') === 'authorized') void discover(provider);
          }
          window.history.replaceState(
            {},
            '',
            window.location.pathname + window.location.hash,
          );
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Could not load setup.'),
      );
  }, []);
  const openRequested = useEffectEvent((id: string) => {
    if (CONNECTOR_GROUPS.some((g) => g.id === id)) open(id);
  });
  useEffect(() => {
    const show = (event: Event) =>
      openRequested((event as CustomEvent<string>).detail);
    const refresh = () =>
      void readState()
        .then(setState)
        .catch(() => {});
    window.addEventListener('ysabel:connect-provider', show);
    window.addEventListener('ysabel:sources-updated', refresh);
    return () => {
      window.removeEventListener('ysabel:connect-provider', show);
      window.removeEventListener('ysabel:sources-updated', refresh);
    };
  }, []);
  async function saveApp(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      await request({
        op: 'saveApp',
        provider: selected,
        clientId,
        clientSecret,
        apiVersion,
        configId,
      });
      setClientSecret('');
      await load();
      setStep('authorize');
      notify('App details saved securely. Continue to account authorization.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save app details.');
    } finally {
      setBusy('');
    }
  }
  async function authorize() {
    setBusy('authorize');
    setError('');
    try {
      const sourceQuery =
        selected === 'google'
          ? '?source=' +
            (googleSource === 'Website Analytics only'
              ? 'ga4'
              : googleSource === 'Business Profile only'
                ? 'gbp'
                : 'both')
          : '';
      const r = await fetch('/marketingdata/api/oauth/' + selected + '/start' + sourceQuery, {
        method: 'POST',
      });
      const d = (await r.json()) as { url: string; error?: string };
      if (!r.ok) throw new Error(d.error);
      window.location.assign(d.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not start authorization.',
      );
      setBusy('');
    }
  }
  async function connect(source: string) {
    setBusy(source);
    setError('');
    try {
      const d = await request<{
        needsAttention?: boolean;
        message: string;
        records: number;
      }>({
        op: 'select',
        provider: selected,
        source,
        resourceId: choices[source],
      });
      await load();
      onChanged();
      window.dispatchEvent(new Event('ysabel:sources-updated'));
      notify(
        d.needsAttention
          ? d.message
          : 'Account connected. ' +
              (d.records
                ? d.records + ' daily records imported.'
                : 'Current profile statistics imported.'),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not connect this account.',
      );
    } finally {
      setBusy('');
    }
  }
  async function connectChosen() {
    setBusy('all');
    setError('');
    const outcomes: string[] = [];
    try {
      for (const source of group?.sources || []) {
        if (!choices[source]) continue;
        const result = await request<{
          needsAttention?: boolean;
          records?: number;
        }>({
          op: 'select',
          provider: selected,
          source,
          resourceId: choices[source],
        });
        outcomes.push(
          SOURCE_CHANNELS[source] +
            (result.needsAttention ? ' needs attention' : ' imported'),
        );
      }
      await load();
      onChanged();
      window.dispatchEvent(new Event('ysabel:sources-updated'));
      notify(outcomes.join(' · '));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Account import needs attention.',
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <section className="connection-assistant surface">
        <div className="assistant-heading">
          <span className="assistant-icon">
            <Sparkles size={23} />
          </span>
          <div>
            <h2>Connect your real data</h2>
            <p>
              Set up each provider once. Then sign in, choose your accounts and
              let the workspace refresh them.
            </p>
          </div>
        </div>
        {returnNotice && (
          <output className="connection-return">{returnNotice}</output>
        )}
        {error && !selected && (
          <div className="save-error" role="alert">
            {error}
            <button
              onClick={() =>
                void load()
                  .then(() => setError(''))
                  .catch(() => {})
              }
            >
              Retry
            </button>
          </div>
        )}
        <div className="assistant-providers">
          {CONNECTOR_GROUPS.map((g) => {
            const saved = state?.groups.find((s) => s.id === g.id),
              linked =
                state?.links.filter((l) => l.provider === g.id).length || 0;
            return (
              <button
                key={g.id}
                className="assistant-provider"
                data-platform={g.platform}
                onClick={() => open(g.id)}
                disabled={!state}
              >
                <span className="assistant-provider-number">
                  {linked ? <Check size={17} /> : <Link2 size={17} />}
                </span>
                <strong>{g.name}</strong>
                <small>{g.summary}</small>
                <span className="assistant-provider-action">
                  {linked
                    ? 'Manage ' +
                      linked +
                      ' account' +
                      (linked === 1 ? '' : 's')
                    : saved?.authorized
                      ? 'Choose accounts'
                      : saved?.configured
                        ? 'Authorize account'
                        : 'Start first-time setup'}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="assistant-foot">
          <ShieldCheck size={15} />
          <span>
            Approval stays with you. App secrets and authorization tokens are
            encrypted in private storage.
          </span>
        </div>
        <p className="assistant-refresh-note">
          Opening or reloading the workspace checks the latest seven days.
          Automatic checks continue every five minutes while it is open and visible.
          Use Sync now to request the latest available reports. Updates pause when the app is closed.
        </p>
        <p className="assistant-refresh-note">
          Use the connection & import centre below for advertising accounts,
          existing tokens, Google service accounts, tracking setup and provider
          exports.
        </p>
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setClientSecret('');
            setError('');
          }
        }}
      >
        <DialogContent className="connection-wizard">
          <DialogHeader>
            <DialogTitle>{group?.name} connection</DialogTitle>
            <DialogDescription>
              First-time app setup, account authorization and real-data import.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="save-error" role="alert">
              {error}
            </div>
          )}
          <Tabs value={step} onValueChange={(v) => setStep(String(v))}>
            <TabsList className="page-tabs wizard-tabs">
              <TabsTrigger value="setup">1 · App setup</TabsTrigger>
              <TabsTrigger value="authorize" disabled={!configured?.configured}>
                2 · Authorize
              </TabsTrigger>
              <TabsTrigger value="accounts" disabled={!configured?.authorized}>
                3 · Accounts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="setup">
              <ol className="setup-steps">
                {group?.steps.map((text, i) => (
                  <li key={text}>
                    <span>{i + 1}</span>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
              <div className="wizard-links">
                <a
                  className="secondary"
                  href={group?.console}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open provider console <ArrowUpRight size={14} />
                </a>
                <a
                  className="text-link"
                  href={group?.guide}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official setup guide <ArrowUpRight size={14} />
                </a>
              </div>
              <label className="callback-label">
                Callback URL
                <div className="callback-copy">
                  <input
                    value={configured?.callback || ''}
                    readOnly
                    aria-label="OAuth callback URL"
                  />
                  <button
                    className="icon-button"
                    aria-label="Copy callback URL"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(configured?.callback || '')
                        .then(() => notify('Callback URL copied.'))
                        .catch(() =>
                          notify(
                            'Select and copy the callback URL from the field.',
                          ),
                        )
                    }
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </label>
              <form className="edit-form" onSubmit={saveApp}>
                <label>
                  {selected === 'tiktok'
                    ? 'Client key'
                    : selected === 'meta'
                      ? 'App ID'
                      : 'Client ID'}
                  <input
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    maxLength={500}
                    autoComplete="off"
                  />
                </label>
                <label>
                  {selected === 'meta' ? 'App Secret' : 'Client secret'}
                  <input
                    type="password"
                    required={!configured?.configured}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={
                      configured?.configured
                        ? 'Saved securely · leave blank to keep'
                        : 'Paste from the provider console'
                    }
                    maxLength={2000}
                    autoComplete="new-password"
                  />
                </label>
                {selected === 'meta' && (
                  <>
                    <label>
                      Login configuration ID
                      <input
                        required
                        value={configId}
                        onChange={(e) => setConfigId(e.target.value)}
                        placeholder="From Facebook Login for Business · Configurations"
                        pattern="[0-9]+"
                      />
                    </label>
                    <label>
                      Graph API version
                      <input
                        required
                        value={apiVersion}
                        onChange={(e) => setApiVersion(e.target.value)}
                        placeholder="Version shown in your Meta app"
                        pattern="v[0-9]{1,2}\.[0-9]{1,2}"
                      />
                    </label>
                  </>
                )}
                <button className="primary" disabled={!!busy || !state?.ready}>
                  <KeyRound size={15} />
                  {busy === 'save' ? 'Saving…' : 'Save app & continue'}
                </button>
                {!state?.ready && (
                  <p className="muted">
                    Secure storage is not ready. Contact the workspace
                    administrator.
                  </p>
                )}
              </form>
            </TabsContent>
            <TabsContent value="authorize">
              <div className="authorization-summary">
                <ShieldCheck size={32} />
                <h3>Approve access on {group?.name}</h3>
                <p>
                  Your password stays with the platform. Return here after
                  approval to choose which Ysabel Society accounts to import.
                </p>
                {selected === 'google' ? (
                  <>
                    <Picker
                      label="Google data to connect"
                      value={googleSource}
                      onChange={setGoogleSource}
                      options={[
                        'Website Analytics only',
                        'Business Profile only',
                        'Analytics and Business Profile',
                      ]}
                    />
                    <p>
                      {googleSource === 'Website Analytics only'
                        ? 'Read-only Analytics access. No permission to edit Analytics or manage Business Profile. Choose only the Ysabel Society property after sign-in.'
                        : 'Business Profile requires Google’s business management permission. Choose the Ysabel Society locations after sign-in.'}
                    </p>
                  </>
                ) : (
                  <p>{group?.capability}</p>
                )}
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void authorize()}
                >
                  {busy === 'authorize'
                    ? 'Opening authorization…'
                    : configured?.authorized
                      ? 'Authorize again'
                      : 'Continue with ' + group?.name}
                  <ArrowUpRight size={15} />
                </button>
                {configured?.authorized && (
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => void discover(selected!)}
                  >
                    Find my accounts <RefreshCw size={15} />
                  </button>
                )}
                <p className="muted">
                  If a provider blocks embedded sign-in, open this workspace in
                  your regular browser and continue there.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="accounts">
              <p className="wizard-capability">{group?.capability}</p>
              {group && group.sources.length > 1 && (
                <button
                  className="primary"
                  disabled={!!busy || !Object.values(choices).some(Boolean)}
                  onClick={() => void connectChosen()}
                >
                  {busy === 'all'
                    ? 'Connecting selected accounts…'
                    : 'Connect selected accounts together'}
                </button>
              )}
              <button
                className="secondary"
                onClick={() => void discover(selected!)}
                disabled={!!busy}
              >
                <RefreshCw size={15} />
                {busy === 'discover'
                  ? 'Finding accounts…'
                  : 'Find / refresh accounts'}
              </button>
              {warnings.map((w) => (
                <p className="connection-return" key={w}>
                  {w}
                </p>
              ))}
              {group?.sources.map((source) => {
                const options = resources.filter((r) => r.source === source),
                  linked = state?.links.find((l) => l.source === source);
                return (
                  <section className="account-choice" key={source}>
                    <h3>{SOURCE_CHANNELS[source]}</h3>
                    {linked && (
                      <p className="connected-label">
                        <Check size={15} />
                        Selected: {linked.label}
                      </p>
                    )}
                    {options.length ? (
                      <>
                        <div className="account-picker-label">
                          <span>Choose the Ysabel Society account</span>
                          <Picker
                            label={'Account for ' + SOURCE_CHANNELS[source]}
                            value={
                              options.find((r) => r.id === choices[source])
                                ? options.find((r) => r.id === choices[source])!
                                    .label +
                                  ' · ' +
                                  choices[source]
                                : 'Select an account'
                            }
                            options={[
                              'Select an account',
                              ...options.map((r) => r.label + ' · ' + r.id),
                            ]}
                            onChange={(value) =>
                              setChoices({
                                ...choices,
                                [source]:
                                  options.find(
                                    (r) => r.label + ' · ' + r.id === value,
                                  )?.id || '',
                              })
                            }
                          />
                        </div>
                        <button
                          className="primary"
                          disabled={!!busy || !choices[source]}
                          onClick={() => void connect(source)}
                        >
                          {busy === source
                            ? 'Connecting & importing…'
                            : 'Connect & import data'}
                        </button>
                      </>
                    ) : (
                      <p className="muted">
                        {busy === 'discover'
                          ? 'Discovering accounts…'
                          : 'Use Find accounts after authorization. If none appear, check account access and the provider’s API approval.'}
                      </p>
                    )}
                  </section>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
