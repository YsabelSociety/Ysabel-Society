export const PROVIDER_CONFIG = [
  {
    id: 'instagram',
    name: 'Instagram',
    channel: 'Instagram',
    kind: 'Organic',
    required: ['META_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'META_API_VERSION'],
    permissions:
      'instagram_basic, instagram_manage_insights, pages_read_engagement',
    documentation:
      'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    channel: 'Facebook',
    kind: 'Organic',
    required: ['META_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID', 'META_API_VERSION'],
    permissions: 'pages_read_engagement, pages_read_user_content, read_insights',
    documentation: 'https://developers.facebook.com/docs/pages-api/insights/',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    channel: 'TikTok',
    kind: 'Organic',
    required: [
      'TIKTOK_ACCESS_TOKEN',
      'TIKTOK_CLIENT_KEY',
      'TIKTOK_CLIENT_SECRET',
    ],
    permissions: 'user.info.basic, user.info.stats, video.list',
    documentation:
      'https://developers.tiktok.com/docs/en/display-api-get-started',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    channel: 'Website',
    kind: 'Website',
    required: [
      'GA4_PROPERTY_ID',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
    ],
    permissions: 'analytics.readonly',
    documentation:
      'https://developers.google.com/analytics/devguides/reporting/data/v1/basics',
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    channel: 'Google Business',
    kind: 'Discovery',
    required: [
      'GBP_LOCATION_ID',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
    ],
    permissions: 'business.manage',
    documentation:
      'https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries',
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    channel: 'Meta Ads',
    kind: 'Advertising',
    required: [],
    permissions: 'ads_read',
    documentation: 'https://developers.facebook.com/docs/marketing-api/',
  },
  {
    id: 'tiktok-ads',
    name: 'TikTok Ads',
    channel: 'TikTok Ads',
    kind: 'Advertising',
    required: [],
    permissions: 'Business authorization',
    documentation: 'https://business-api.tiktok.com/portal/docs',
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    channel: 'Google Ads',
    kind: 'Advertising',
    required: [],
    permissions: 'adwords, approved developer token',
    documentation: 'https://developers.google.com/google-ads/api/docs/start',
  },
];
