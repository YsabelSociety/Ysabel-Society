export type DashboardDestination = {
  page: 'Performance' | 'Website' | 'Google Business';
  channel: string;
  metric: string;
};
export type DashboardJump = DashboardDestination & { id: number };
export type OpenDashboardData = (channel: string, metric: string) => void;

// Keep homepage links attached to their actual source and measurement.
export function dashboardDestination(channel: string, metric: string): DashboardDestination {
  return {
    page: channel === 'Website' ? 'Website' : channel === 'Google Business' ? 'Google Business' : 'Performance',
    channel,
    metric,
  };
}
