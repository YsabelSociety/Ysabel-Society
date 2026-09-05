# Ysabel Society — Digital Intelligence

A private hospitality intelligence workspace built with React 19, TypeScript, Vinext (Next.js-compatible), Tailwind, customized Base UI / shadcn controls and Recharts.

## Working experience
Sixteen sections; global date, business and comparison filters; command search; source definitions; content analytics and scores; observed posting-time heatmap; audience, website and Google views; comparisons; private media uploads; saved content edits; grid swapping and keyboard reorder; phone/desktop previews; monthly/weekly/timeline calendar; persistent annotations and report configurations; editorial PDF, CSV and PNG exports.

Private access is enforced by Sites. APIs verify server identity and same-origin writes. D1 queries are parameterized and owner-scoped; R2 objects are served only after ownership checks.

## Current release boundaries
This is a working preview and foundation, not a fully validated production analytics deployment.
- No actual business accounts or OAuth applications were supplied or connected.
- Google Analytics and Google Business server adapters are implemented, with token refresh, retry handling, historical upserts and manual sync logs. They have not been validated against real credentials.
- Meta and TikTok adapter interfaces deliberately reject synchronization until approved metrics and permissions are implemented and tested. Advertising and reservations are future schema capabilities.
- The hosted preview uses D1 and R2. The normalized PostgreSQL/Supabase migration in database/supabase.sql is supplied for the next deployment stage. Supabase is not provisioned and is not currently the hosted system of record.
- No external scheduler is active. Production needs scheduled orchestration, concurrency locking and incremental cursor management.
- Content scheduling is a saved plan, not automatic social publication. Verified platform IDs are required for publication matching.
- The phone preview is an original large-phone treatment, not an exact physical reproduction of a particular iPhone.
- The official logo was not provided. The wordmark is temporary typography. Demo images are licensed Unsplash photos unrelated to Ysabel venues or staff.
- Audience demographic snapshots and website source/page allocations are explicitly labeled fixtures. These details are suppressed for live-source reporting.
- Report configurations preserve dates for Ysabel Society; exports are regenerated from current records, not frozen snapshots.
- The workspace uses a silver, translucent interface with a distinct restrained gradient for each of its 16 sections. Content, source records and historical labels are consolidated under Ysabel Society without dropping observations.
- WebMCP navigation/read tools are feature-detected. No supported validation context was available. Their browser runtime behavior has not been independently verified.
- Browser visual and interaction QA was not requested and was not performed. Calculation, route, export and build checks are recorded separately.

## Development
Use the supplied pnpm lockfile. Install with pnpm install. Initialize local D1 with:
pnpm exec wrangler d1 execute DB --local --config .openai/dev-storage.json --persist-to .wrangler/state --file drizzle/0000_organic_tiger_shark.sql
Start with pnpm dev. Local sign-in is provided by Sites.
pnpm exec tsc --noEmit checks types. pnpm build produces Worker and client assets.
pnpm db:generate creates schema deltas. Never rewrite applied migrations.

## Live Google configuration
Set runtime values securely on the host:
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GA4_PROPERTY_ID and GBP_LOCATION_ID. All source records belong to Ysabel Society.

The Google application needs analytics.readonly and/or business.manage grants, API enablement and access to the property/location. No credentials are accepted by the frontend. The Connection page reports missing setup. Supported configured adapters can sync the last 30 complete days.

GA4 imports daily active users, sessions, engaged sessions and page views. GBP imports Search/Maps impressions and website/call/direction actions. Account/date keys prevent duplication. Raw responses remain available server-side. Analytics switches to connected source snapshots without inserting sample rows alongside live observations.

Meta setup names are META_ACCESS_TOKEN, META_API_VERSION, INSTAGRAM_ACCOUNT_ID and FACEBOOK_PAGE_ID. TikTok setup names are TIKTOK_ACCESS_TOKEN, TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET. Supplying these does not activate unvalidated adapters.

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

