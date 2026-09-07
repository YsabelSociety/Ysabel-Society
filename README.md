# Ysabel Society — Digital Intelligence

Private analytics, content planning and reporting for Ysabel Society. The silver and translucent interface uses distinct platform gradients, rounded metric panels and restrained motion.

## Connection methods

Open `/connections`. The guided assistant configures Google, Meta and TikTok developer apps, signs in on the provider, discovers accessible accounts and imports selected sources. `/connections?connect=meta` opens Meta setup directly. Meta's Page and linked Instagram account can be selected and connected together.

The connection & import centre covers all eight configured sources: Instagram, Facebook, TikTok, Google Analytics 4, Google Business Profile, Meta Ads, Google Ads and TikTok Ads. It provides first-time guides, official console links, encrypted direct-token setup, Google service-account JSON setup for GA4/Ads, Meta permission diagnostics, explicit tracking-event configuration, historical import windows and CSV imports with column mapping and preview.

Personal passwords are entered only on the provider's sign-in page. Existing tokens do not remove a provider's app registration or approval requirements. The app cannot grant itself permissions, create missing website events, bypass account eligibility or recover history that the platform no longer exposes.

## Implemented imports

- Instagram: current followers, daily account views/reach/interactions/profile activity where returned, accessible content published in the requested window, lifetime content performance and permitted demographic snapshots. Individual unavailable metrics remain blank. Profile visits are distinct from website visits. Watch-time fields retain milliseconds.
- Facebook: current followers; supported Page views, media viewers, interactions and follows; accessible published posts and their lifetime metrics; available audience geography. Current media viewers are not relabelled as legacy reach.
- TikTok: current followers, likes/video count and accessible videos with lifetime views, likes, comments and shares. Standard Display API does not provide daily account traffic, retention or demographic reporting; the CSV path can import available Studio exports.
- GA4: daily active/new users, sessions, engaged sessions, page views, key events and engagement seconds; source/medium, acquisition channel, page, event, device, country/city and new/returning reports. An exact-period report provides GA4's deduplicated active users. Menu views and reservation click/confirmation events require explicit names of existing tracking.
- Google Business: Search/Maps visibility, website/call/direction actions, menu interactions, Reserve with Google bookings and food orders where supported; monthly search terms with privacy thresholds retained separately from exact counts.
- Advertising: Meta, Google and TikTok campaign reports remain separate from organic metrics. Monetary values keep the account currency. Platform attribution and conversion configuration apply.

Every import records per-report success, empty responses or failure. An authorized account is not a promise of complete reporting. Provider permissions, API versions, history retention, content types and privacy thresholds govern coverage. Date filters on posts select publication dates; their counters remain lifetime observations. Current follower observations never reconstruct earlier follower history. Sample posts and imported analytics are kept separate. Reports and exports read imported observations once a source is configured; blanks are not converted into zero.

## Automation and limits

After account selection, refresh is enabled by default. Reloading or selecting Sync now imports all enabled online connections, independently of the selected dashboard channel or period; saved historical observations remain. While visible, the dashboard checks every five minutes. Reports reconcile the latest seven days and current provider snapshots. Messages and mentions use bounded resumable batches, up to 20 pages per task per run; older history may need continuation. Google/TikTok OAuth grants renew when supported; Google service accounts issue fresh tokens. Manual tokens and Meta grants can require reauthorization. Durable owner-scoped jobs and account locks prevent overlapping imports; disabled and disconnected accounts are not revived.

The existing YsabelSociety/Ysabel-Society GitHub repository runs .github/workflows/marketingdata-daily-sync.yml daily at 02:17 UTC and supports manual workflow dispatch. It calls the Sites Worker directly using MARKETING_SYNC_SECRET, stored as an encrypted repository secret and a Sites runtime secret. This key can only read refresh metadata and start/advance owner-scoped import jobs; it cannot read private reports/messages or edit connection settings. Runtime MARKETING_OWNER_ID fixes the target; callers cannot select another owner. Daily jobs respect paused automatic connections and continue after individual provider failures. File sources still require another export, and pending API permissions remain unavailable. The schedule imports the latest provider-available data; it does not make delayed statistics real-time.

Maintenance: GitHub schedules can be delayed, and schedules in public repositories can be disabled after 60 days without repository activity. Check the workflow's enabled state and run history when maintaining this deployment; the private dashboard shows per-source import results. Rotate MARKETING_SYNC_SECRET in both stores together and redeploy the Site to apply runtime changes. The worker itself has no native cron trigger; scheduling is executed by GitHub Actions. No managed data connector is used.

The login keeps the original logo unchanged and covers the initial dashboard with a reduced-motion-aware olive/silver reveal. The dashboard becomes available after its initial data load (or a surfaced loading error); provider refreshes continue independently. Only an ephemeral animation marker uses sessionStorage, never application data.

Manual API history windows are at most 32 days and remain subject to the provider's retention. Meta and TikTok scans stop at 1,000 accessible content objects and report that limit. GA4 detailed reports retain at most 2,000 rows per request and mark truncated tables; import a narrower period for more detail. Google search terms currently retain the first 100 terms per month. Dashboard queries retain at most 5,000 posts and 120 stored report windows. A serialized report or record larger than 1.5 MB is rejected before data writes; use a shorter period or smaller file. These bounds are not a claim to retrieve every provider statistic.

## Data and security

Sites private access, server-verified identity, same-origin writes, owner-scoped prepared D1 queries and owner-checked R2 access are preserved. App secrets, tokens and Google private keys use AES-GCM encryption. Runtime secrets are `CONNECTOR_ENCRYPTION_KEY` (32 random bytes, Base64) and `CONNECTOR_SITE_URL`. Do not replace an existing production encryption key without re-encrypting stored credentials. Local and production keys differ. No credentials belong in Git or the hosting manifest.

OAuth uses hashed, expiring, single-use state, an HttpOnly nonce cookie, same-owner validation and Google PKCE. Secrets are never included in connection status or reports. Imported original metric values are retained for provenance. Files are capped at 3 MB, 10,000 rows and 80 columns; date/number validation, duplicate handling and explicit column mapping protect the reporting layer.

D1 migration 0002 adds source_posts and source_reports; applied migrations 0000 and 0001 remain unchanged. Local verification fixtures are disconnected and are never packaged into production.

## Verification

`node tests/connectors.cjs`: vault isolation/tamper protection, OAuth cookies/state/PKCE/replay/expiry, private discovery, follower observations, Google upserts, metric availability, account selection, sync locks, disconnect races and refresh-token rotation.

`node tests/reporting.cjs`: Meta daily/lifetime separation, missing vs zero, profile vs website visits, permission failures, Facebook date boundaries and media viewers, TikTok counter semantics, GA4 dimensions/events, Google privacy thresholds, Ads currency scaling and CSV validation.

Authenticated local API checks exercise the setup route, private write protection, CSV-to-dashboard and CSV-to-content flows, idempotence and disconnect isolation. TypeScript and the production build are required before publication. Provider responses in automated tests are fixtures; live account validation requires the user's provider authorization. Existing WebMCP tools remain present; no supported WebMCP test context has been verified. Browser visual testing was not requested.

## Source documentation

- Meta Instagram API: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Instagram insights and limitations: https://www.postman.com/meta/instagram/folder/23987686-f659d7d1-d74c-44e4-9192-9b1e8694c511
- Facebook Page insights: https://developers.facebook.com/docs/pages-api/insights/
- TikTok video fields: https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object
- TikTok Business SDK: https://github.com/tiktok/tiktok-business-api-sdk
- GA4 reporting schema: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- Google Business metrics: https://developers.google.com/my-business/reference/performance/rest/v1/DailyMetric
- Google service accounts: https://developers.google.com/identity/protocols/oauth2/service-account
- Google Ads reporting: https://developers.google.com/google-ads/api/rest/common/search

## Development

Use the existing pnpm lockfile. Apply migrations 0000, 0001 and 0002 to the local D1 database, then run `pnpm dev`. `pnpm exec tsc --noEmit` checks types; `pnpm build` emits the Worker and client assets. Generate schema changes with `pnpm db:generate` and never rewrite applied migrations. Hosting metadata remains in `.openai/hosting.json`.
