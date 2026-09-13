import { CONNECTOR_GROUPS } from './connector-catalog';

// Product connections are independent even when Google uses a shared OAuth client.
const google = CONNECTOR_GROUPS.find((g) => g.id === 'google')!;
export const CONNECTION_VIEWS = [
  {
    ...google,
    id: 'ga4',
    provider: 'google',
    name: 'Google Analytics',
    platform: 'Website',
    sources: ['ga4'],
    summary: 'Website visits and behaviour · ysabelsociety.com',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    guide:
      'https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries',
    steps: [
      'Use the Ysabel Society Analytics Google Cloud project. Enable Google Analytics Data API and Admin API.',
      'Use the existing Web application OAuth client, or create one and add the callback URL below. The website can also use its existing read-only service account.',
      'Authorize read-only Analytics access. Select the Ysabel Society GA4 property, 552874533, for ysabelsociety.com.',
    ],
    capability:
      'Website users, sessions, page views, traffic sources, pages and live visitors for ysabelsociety.com. Google Maps and customer reviews have their own Google Business connection.',
  },
  {
    ...google,
    id: 'gbp',
    provider: 'google',
    name: 'Google Business Profile',
    sources: ['gbp'],
    summary: 'Google Maps, Search, customer actions and reviews',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    guide: 'https://developers.google.com/my-business/content/prereqs',
    steps: [
      'Use the Google account that owns or manages the verified Ysabel Society location on Google Maps.',
      'Request Business Profile API access for the Google Cloud project. A quota of zero means Google has not approved access yet. Enabling an API alone does not grant access.',
      'Enable My Business Account Management, Business Information, Business Profile Performance and Google My Business API (reviews). Use the existing Google OAuth client and callback below.',
      'Authorize Business Profile access, then select only the Ysabel Society location. The app imports Search, Maps and customer actions; the Google Business page separately imports every available page of reviews.',
    ],
    capability:
      'The Ysabel Society business location on Google Maps: discovery, calls, directions, website clicks and customer reviews. Requires Google Business Profile API approval and access to the location.',
  },
  ...CONNECTOR_GROUPS.filter((g) => g.id !== 'google').map((g) => ({
    ...g,
    provider: g.id,
  })),
];
export function connectionView(id: string) {
  return CONNECTION_VIEWS.find((g) => g.id === (id === 'google' ? 'ga4' : id));
}
