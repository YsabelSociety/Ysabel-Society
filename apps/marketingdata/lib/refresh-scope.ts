import type { RefreshTask } from './refresh-types';
export const REFRESH_SCOPES = ['all','reports','social','inbox','mentions','gbp','ga4','instagram','facebook','tiktok'] as const;
export type RefreshScope = typeof REFRESH_SCOPES[number];
export function categoryScope(category: string): RefreshScope {
  if(category === 'Google Business') return 'gbp';
  if(category === 'Website') return 'ga4';
  if(category === 'Inbox') return 'inbox';
  if(category === 'Mentions') return 'mentions';
  if(category === 'Content Intelligence') return 'social';
  if(['Performance','Audience','Reports','Insights','Comparisons'].includes(category)) return 'reports';
  return 'all';
}
export function taskInScope(task: Pick<RefreshTask,'source'|'kind'>, scope:RefreshScope) {
  if(scope==='all') return true;
  if(scope==='reports') return task.kind==='reports';
  if(scope==='social') return task.kind==='reports' && ['instagram','facebook','tiktok'].includes(task.source);
  if(scope==='inbox') return ['message','profiles'].includes(task.kind);
  if(scope==='mentions') return task.kind==='mention';
  return task.source===scope;
}
