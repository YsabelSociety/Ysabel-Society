export type SourceStatus = {
  channel: string;
  status: string;
  lastSync: string | null;
};
export type WebsiteRealtime = {
  activeUsers: number | null;
  pageViews: number | null;
  events: number | null;
  observedAt: string;
};

export function websiteStatus(status?: SourceStatus, hasDailyData = false) {
  if (!status)
    return {
      title: 'Google Analytics is not connected',
      detail: 'Connect the Ysabel Society property to read website reports.',
    };
  if (status.status === 'Needs Attention')
    return {
      title: 'Google Analytics needs attention',
      detail: status.lastSync
        ? 'The latest refresh failed. Previously imported reports remain available. Open Connections to restore access and sync again.'
        : 'The connection is saved, but Google has not allowed a successful report import. Open Connections to authorize access and sync.',
    };
  if (!status.lastSync)
    return {
      title: 'Website reports have not been verified',
      detail:
        'Account setup alone does not confirm data access. Complete authorization and the first import in Connections.',
    };
  return {
    title: 'Connected to Google Analytics',
    detail: hasDailyData
      ? 'Reports were imported from your selected property. Today’s figures may change as Google processes visits.'
      : 'Google accepted the report request but returned no daily activity for these dates. Recent visits may appear in the separate 30-minute snapshot before daily reports are processed.',
  };
}

export function googleScopes(source: string | null) {
  if (source === 'gbp')
    return ['https://www.googleapis.com/auth/business.manage'];
  if (source === 'both')
    return [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/business.manage',
    ];
  return ['https://www.googleapis.com/auth/analytics.readonly'];
}
