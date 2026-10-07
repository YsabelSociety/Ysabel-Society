import { metricAvailable, type Daily, type Metric } from './analytics';
export const CHART_METRICS: Metric[] = ['views','reach','engagements','followers','users','actions'];
export function availableChartMetrics(rows:Daily[]) {
 return CHART_METRICS.filter(metric=>metricAvailable(rows,metric));
}
export function selectedChartMetric(rows:Daily[],requested:Metric,fixed?:Metric):Metric {
 return fixed ?? (metricAvailable(rows,requested)?requested:availableChartMetrics(rows)[0]??requested);
}
