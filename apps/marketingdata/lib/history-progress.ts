import type { DataCheck } from './reporting';
export type HistoryProgress = {
  source: string;
  phase: 'content' | 'reports' | 'done';
  cursor: string;
  floor: string;
  end: string;
  oldest: string | null;
  posts: number;
  days: number;
  batches: number;
  gaps: number;
  updatedAt: string;
  message: string;
  note?: string;
  error?: string;
  checks?: DataCheck[];
};
