export type RefreshTask = {
  source: string;
  kind: 'reports' | 'message' | 'mention' | 'review' | 'profiles';
  label: string;
  state: 'pending' | 'updated' | 'attention' | 'manual' | 'partial';
  pages: number;
  detail?: string;
};
export type RefreshJob = {
  id: string;
  origin: string;
  status: 'running' | 'complete' | 'partial';
  tasks: RefreshTask[];
  updatedAt: string;
  completed: number;
  current?: string;
  retryAfter?: number;
};
