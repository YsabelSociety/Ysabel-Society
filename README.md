# Ysabel Society — Digital Intelligence

A private hospitality intelligence workspace built with React 19, TypeScript, Vinext (Next.js-compatible), Tailwind, customized Base UI / shadcn controls and Recharts.

## Working experience

Seventeen sections for Ysabel Society; global date and comparison filters; command search; source definitions; content analytics and scores; observed posting-time heatmap; audience, website and Google views; comparisons; private media uploads; saved content edits; grid swapping and keyboard reorder; phone/desktop previews; monthly/weekly/timeline calendar; persistent annotations and report configurations; editorial PDF, CSV and PNG exports.

Private access is enforced by Sites. APIs verify server identity and same-origin writes. D1 queries are parameterized and owner-scoped; R2 objects are served only after ownership checks.

## Current release boundaries

This is a working preview and foundation, not a fully validated production analytics deployment.

- No actual business accounts or OAuth applications were supplied or connected.
- Google Analytics and Google Business server adapters are implemented, with token refresh, retry handling, historical upserts and manual sync logs. They have not been validated against real credentials.
- The connection assistant supports Google, Meta and TikTok app setup, OAuth authorization, account discovery and selection. Meta and TikTok supply current account statistics only. Daily social views, engagement histories, advertising and reservations remain future capabilities.
- The hosted preview uses D1 and R2. The normalized PostgreSQL/Supabase migration in database/supabase.sql is supplied for the next deployment stage. Supabase is not provisioned and is not currently the hosted system of record.
- Automatic refresh checks every 15 minutes while the workspace is open and visible, processing one due account per check and refreshing each account at most hourly. It pauses when closed. No external scheduler is active. Atomic source locks prevent overlapping refreshes. Google/TikTok grants refresh automatically; expired Meta authorization needs reapproval.
- Content scheduling is a saved plan, not automatic social publication. Verified platform IDs are required for publication matching.
- The phone preview is an original large-phone treatment, not an exact physical reproduction of a particular iPhone.
- The official logo was not provided. The wordmark is temporary typography. Demo images are licensed Unsplash photos unrelated to Ysabel venues or staff.
- Audience demographic snapshots and website source/page allocations are explicitly labeled fixtures. These details are suppressed for live-source reporting.
- Report configurations preserve dates for Ysabel Society; exports are regenerated from current records, not frozen snapshots.
- The workspace uses a pearl background and frosted silver surfaces inspired by the supplied reference. Each navigation tab and platform has distinct soft gradient colors. Hover and entry movement stays subtle; charts animate briefly and honor reduced-motion settings. There are no continuous ambient animation loops.
- The Admin panel is available from the top bar, the System navigation and directly at `/admin`. It includes a workspace dashboard, content uploads and editing, connection management, and saved workspace preferences. The same sign-in requirement and user-scoped data checks protect the admin route and its actions.
- Content, source records and historical labels are consolidated under Ysabel Society without dropping observations.
- WebMCP navigation/read tools are feature-detected. No supported validation context was available. Their browser runtime behavior has not been independently verified.
- Browser visual and interaction QA was not requested and was not performed. Calculation, route, export and build checks are recorded separately.

## Development

Use the supplied pnpm lockfile. Install with pnpm install. Initialize local D1 with:
pnpm exec wrangler d1 execute DB --local --config .openai/dev-storage.json --persist-to .wrangler/state --file drizzle/0000_organic_tiger_shark.sql
Then apply `drizzle/0001_connection_assistant.sql` using the same local database command. Start with pnpm dev. Local sign-in is provided by Sites.
pnpm exec tsc --noEmit checks types. pnpm build produces Worker and client assets.
pnpm db:generate creates schema deltas. Never rewrite applied migrations.

## First-time connection setup

Open `/connections`, also accessible through System navigation and the Admin panel. Choose Google, Instagram & Facebook, or TikTok, and follow the three steps: app setup, authorize, choose accounts.

- Google: create a Cloud project, enable the Analytics Data/Admin and Business Profile APIs, configure a Web OAuth client and consent screen, register the exact callback URL, and enter the client ID/secret. Account discovery lists available Analytics properties and business locations. Business Profile requires approved API access and quota.
- Meta: configure Facebook Login for Business and Instagram API with Facebook Login, create a User access token login configuration, add the callback URL and requested permissions, and enter App ID, App Secret, login configuration ID and Graph API version. Select the Ysabel Society Page and linked professional Instagram account.
- TikTok: add Login Kit and Display API to a developer app, register the Web callback, request user.info.basic and user.info.stats, and enter Client key/secret. Sandbox or production app approval is required before authorization.

The user approves provider access in the same browser where this workspace is signed in. The app cannot create provider developer accounts or bypass App Review. Embedded login may require continuing in a normal browser.

Runtime configuration: `CONNECTOR_ENCRYPTION_KEY` is a secret containing 32 random bytes encoded as Base64; `CONNECTOR_SITE_URL` is the exact public origin. Production and local keys are separate. Do not overwrite the production encryption key while stored grants exist; rotation needs an explicit re-encryption migration. Neither value belongs in `.openai/hosting.json`. Provider app secrets and tokens are encrypted with AES-GCM in owner-scoped D1 storage and never returned to the browser. Client IDs, account names and callback URLs are visible by design.

OAuth uses expiring single-use hashed state, an HttpOnly nonce cookie, same-user checks and Google PKCE. Provider refresh tokens are encrypted. Account selection is restricted to discovered resources. Disconnect disables ingestion and retains historical observations; revoke the app grant separately in the provider account to withdraw consent. Changing provider app credentials requires disconnecting its selected accounts first.

GA4 imports the last 30 complete days of active users, sessions, engaged sessions and page views. Business Profile imports Search/Maps impressions and website/call/direction actions. Each refresh reconciles that window; account/date keys prevent duplication. Replacing an account keeps its historical records isolated. Meta imports current followers and post/Page-like counts; TikTok imports current followers, total likes and video count. Social snapshots are shown in Connections and are not converted into daily histories. Missing daily metrics display as unavailable and stay blank in CSV exports. As soon as a successful account sync exists, analytical pages use only connected observations.

Legacy environment-based Google setup remains supported: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GA4_PROPERTY_ID`, `GBP_LOCATION_ID`. Prefer the guided workflow for a new installation. Legacy Meta/TikTok environment adapters do not enable daily analytics.

For Supabase, apply database/supabase.sql to a new project, map platform identities to organization members, and keep the service-role key on the server. The private connection table expects application-encrypted tokens with an externally held versioned key. No secrets are supplied.

## Measurement

Demo observations span January 2024 to 5 September 2026. Reach is a sum of daily platform reach, not unique people. Website users sum daily active users, not unique visitors over the entire period. Community uses the latest snapshot. TikTok reach and unsupported measures remain unavailable. Reservation clicks are not reservations. Per-post metrics are lifetime samples and should not be directly reconciled with daily account totals.

The score compares to a fixed 12-post published demo baseline:
35% views + 30% engagement rate + 15% saves + 20% shares.
Each component is min(100, value / baseline * 60). Underlying metrics remain visible.

## Source references

GA4: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
GBP: https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
TikTok: https://developers.tiktok.com/docs/en/display-api-get-started
Meta: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/
Photo sources and credits: public/media/credits.json

The source is stored in the private Sites repository. Private publishing does not grant access to other people.

## Validation of this update

- TypeScript and production Worker/client build checks passed.
- `node tests/connectors.cjs` (Node 24) tests the real connector modules with in-memory SQLite and stubbed provider responses: encryption and owner isolation, state/nonce/PKCE, expiration and replay, private account discovery, snapshot-only social data, Google upserts, missing-metric exports, selection restrictions, concurrent sync/disconnect and refresh token rotation.
- Authenticated local HTTP checks passed for Connections/Admin, secure-storage readiness, callback URLs, origin rejection, missing setup and failed OAuth returns.
- Focused lint checks pass for the new connection files. Repository-wide lint still reports existing template/application issues; it is not claimed clean.
- No business accounts have been connected. Real-provider login, approvals and live responses remain unverified until the owner completes setup. Browser visual/interaction QA was not performed.
