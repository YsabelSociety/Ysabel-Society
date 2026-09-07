import type { RefreshJob } from '@/lib/refresh-types';
import styles from './sync-details.module.css';
export function SyncDetails({
  job,
  schedule,
}: {
  job: RefreshJob | null;
  schedule: string | null;
}) {
  if (!job && !schedule) return null;
  return (
    <details className={styles.details}>
      <summary>
        Sync details{schedule ? ' · Daily automatic import' : ''}
      </summary>
      {schedule && (
        <p className="muted">
          {schedule} · Imports the latest data made available by each provider.
        </p>
      )}
      <div className={styles.grid}>
        {job?.tasks.map((task) => (
          <div key={task.source + task.kind} className={styles.item}>
            <strong>{task.label}</strong>
            <span className="pill">
              {
                {
                  pending: 'Importing',
                  updated: 'Updated',
                  attention: 'Needs access',
                  manual: 'Manual / paused',
                  partial: 'Partial',
                }[task.state]
              }
            </span>
            <p className="muted">{task.detail || 'Checking online data…'}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
