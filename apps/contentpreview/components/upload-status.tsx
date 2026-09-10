import { Check, RotateCcw, Upload, X } from 'lucide-react';
import type { UploadTask } from '@/lib/media-transfer';

export function UploadBadge({ id, tasks }: { id: string; tasks: UploadTask[] }) {
  const task = tasks.find(item => item.id === id || item.assetId === id);
  const local = id.startsWith('local-');
  const phase = task?.phase || (local ? 'failed' : 'uploaded');
  const label = phase === 'uploaded' ? 'Uploaded' : phase === 'failed' ? 'Not uploaded' : phase === 'preparing' ? 'Preparing…' : 'Uploading…';
  return <span className={`media-upload-badge media-upload-badge--${phase}`} title={task?.error || (phase === 'uploaded' ? 'Upload saved on server' : label)}>{phase === 'uploaded' ? <Check size={12} /> : <Upload size={12} />}{label}</span>;
}

export default function UploadStatus({ tasks, onRetry, onDismiss }: { tasks: UploadTask[]; onRetry: (id: string) => void; onDismiss: () => void }) {
  if (!tasks.length) return null;
  const pending = tasks.filter(item => item.phase === 'preparing' || item.phase === 'uploading').length;
  const failed = tasks.filter(item => item.phase === 'failed').length;
  const complete = tasks.filter(item => item.phase === 'uploaded').length;
  return <aside className="media-upload-status" aria-label="Upload status"><header><strong role="status">{pending ? `Uploading · ${complete} of ${tasks.length} complete` : failed ? `${failed} upload${failed === 1 ? '' : 's'} need attention` : `All ${complete} uploads complete`}</strong>{!pending && <button onClick={onDismiss} aria-label="Dismiss upload summary"><X size={15} /></button>}</header><details open={failed > 0 || undefined}><summary>{pending ? 'Keep this page open until uploads finish.' : failed ? 'Failed files are not saved on the server.' : 'Saved on server — ready to place and publish.'}</summary><ul>{tasks.map(task => <li key={task.id}><span><strong>{task.name}</strong><small>{task.error || ({ preparing: 'Preparing file…', uploading: 'Uploading to server…', uploaded: 'Uploaded ✓', failed: 'Upload failed' })[task.phase]}</small></span>{task.phase === 'failed' && <button onClick={() => onRetry(task.id)}><RotateCcw size={13} />Retry</button>}</li>)}</ul></details></aside>;
}

export function UploadRetry({ id, tasks, onRetry }: { id: string; tasks: UploadTask[]; onRetry: (id: string) => void }) {
  const task = tasks.find(item => item.id === id);
  if (task?.phase !== 'failed') return null;
  return <div className="media-upload-retry" role="status"><p>{task.error || 'Upload was not completed.'}</p><button type="button" onClick={() => onRetry(id)}><RotateCcw size={14} />Retry upload</button></div>;
}
