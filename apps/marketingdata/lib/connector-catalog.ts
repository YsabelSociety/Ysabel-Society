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
      'Google Business Profile API access may require separate approval and quota. Enable the My Business API for reviews of your verified location. Authorize your Google account, then select the Analytics property and business location.',
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
      'pages_read_user_content',
      'instagram_basic',
      'instagram_manage_insights',
      'read_insights',
    ],
    steps: [
      'Create a Meta developer app for your business. Configure Facebook Login for Business and Instagram API with Facebook Login. Create a login configuration with a User access token.',
      'Link the Ysabel Society professional Instagram account to its Facebook Page. Use a Facebook user with access to both accounts.',
      'Add the callback URL below to Valid OAuth Redirect URIs. Save the App ID, App Secret, Login configuration ID and the supported Graph API version shown in your Meta app.',
      'Request pages_show_list, pages_read_engagement, pages_read_user_content, instagram_basic, instagram_manage_insights and read_insights in the login configuration. This connection lists Pages directly and does not request broad business-portfolio management. Reactions and comments require pages_read_user_content. Add your Facebook account to the app and grant access to the Page. Business verification or App Review may be required for other accounts. Advertising requires ads_read and separate ad-account access.',
      'For the Inbox, add the Messenger use case and pages_messaging, instagram_manage_messages and pages_manage_metadata to the login configuration, then authorize again. Customer conversations may require Advanced Access and App Review. Use Inbox → Access & import to check coverage. These permissions are additional to analytics access.',
    ],
    capability:
      'Imports supported daily account insights, published content and its lifetime performance, current follower counts and permitted audience breakdowns. Every report is checked separately. Unavailable metrics are identified after import; access and history limits still apply.',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    platform: 'TikTok',
    sources: ['tiktok'],
    summary: 'Connect your TikTok profile and account statistics',
    console: 'https://developers.tiktok.com/',
    guide: 'https://developers.tiktok.com/docs/en/login-kit-web',
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    steps: [
      'Create a TikTok developer app and add Login Kit and Display API.',
      'Set the platform to Web and register the callback URL below. Add user.info.basic, user.info.stats and video.list to the requested scopes.',
      'Save the Client key and Client secret from your TikTok app. Configure a sandbox target account to test, or submit the app for review.',
      'Authorize the Ysabel Society TikTok account. Current followers, likes and video count become available after authorization.',
    ],
    capability:
      'Current profile statistics and each accessible published video’s lifetime views, likes, comments and shares. Daily traffic, retention and demographic analytics require a TikTok Studio export or separately approved Business API access.',
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
  'meta-ads': 'Meta Ads',
  'google-ads': 'Google Ads',
  'tiktok-ads': 'TikTok Ads',
};
