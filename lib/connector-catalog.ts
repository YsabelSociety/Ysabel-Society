export const CONNECTOR_GROUPS = [
  {
    id: 'google',
    name: 'Google',
    platform: 'Google Business',
    sources: ['ga4', 'gbp'],
    summary: 'Website analytics and Google Business Profile',
    console: 'https://console.cloud.google.com/apis/credentials',
    guide: 'https://developers.google.com/identity/protocols/oauth2/web-server',
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/business.manage',
    ],
    steps: [
      'Create a Google Cloud project. Enable Google Analytics Data API and Admin API, Business Profile Performance API, My Business Account Management API and Business Information API.',
      'Configure the Google Auth consent screen and create a Web application OAuth client. Add your account as a test user while the app is in testing.',
      'Add the callback URL below to Authorized redirect URIs. Copy the client ID and client secret into the secure form.',
      'Google Business Profile API access may require separate approval and quota. Authorize your Google account, then select the Analytics property and business location.',
    ],
    capability:
      'Daily website users, sessions and page views; Search, Maps and customer actions. Availability depends on enabled APIs and account permissions.',
  },
  {
    id: 'meta',
    name: 'Instagram & Facebook',
    platform: 'Instagram',
    sources: ['instagram', 'facebook'],
    summary:
      'Connect your Facebook Page and linked professional Instagram account',
    console: 'https://developers.facebook.com/apps/',
    guide:
      'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'business_management',
    ],
    steps: [
      'Create a Meta developer app for your business. Configure Facebook Login for Business and Instagram API with Facebook Login. Create a login configuration with a User access token.',
      'Link the Ysabel Society professional Instagram account to its Facebook Page. Use a Facebook user with access to both accounts.',
      'Add the callback URL below to Valid OAuth Redirect URIs. Save the App ID, App Secret, Login configuration ID and the supported Graph API version shown in your Meta app.',
      'In the login configuration request pages_show_list, pages_read_engagement and instagram_basic; include business_management for business-managed Pages. Add test users. Meta may require business verification and App Review before non-test accounts can authorize.',
    ],
    capability:
      'Current Page and Instagram follower snapshots. Daily social views and engagement history are not imported by this connection yet.',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    platform: 'TikTok',
    sources: ['tiktok'],
    summary: 'Connect your TikTok profile and account statistics',
    console: 'https://developers.tiktok.com/',
    guide: 'https://developers.tiktok.com/docs/en/login-kit-web',
    scopes: ['user.info.basic', 'user.info.stats'],
    steps: [
      'Create a TikTok developer app and add Login Kit and Display API.',
      'Set the platform to Web and register the callback URL below. Add user.info.basic and user.info.stats to the requested scopes.',
      'Save the Client key and Client secret from your TikTok app. Configure a sandbox target account to test, or submit the app for review.',
      'Authorize the Ysabel Society TikTok account. Current followers, likes and video count become available after authorization.',
    ],
    capability:
      'Current profile statistics. These are snapshots, not daily video views or a reconstructed history.',
  },
] as const;
export type ConnectorProvider = (typeof CONNECTOR_GROUPS)[number]['id'];
export function connectorGroup(value: unknown) {
  const group = CONNECTOR_GROUPS.find((g) => g.id === value);
  if (!group) throw new Error('INPUT:Choose Google, Meta or TikTok.');
  return group;
}
export const SOURCE_CHANNELS: Record<string, string> = {
  ga4: 'Website',
  gbp: 'Google Business',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};
