/** In-memory handoff only: never bypass session validation or cache private data on disk. */
export function createWorkspaceLoader<T extends { boards: unknown[] }>(request: typeof fetch = fetch) {
  const pending = new Map<string, Promise<T>>();
  let prepared: { token: string; promise: Promise<T> } | null = null;
  const read = (token: string) => {
    const existing = pending.get(token);
    if (existing) return existing;
    const headers = new Headers();
    if (token) headers.set('authorization', `Bearer ${token}`);
    const promise = request('/contentpreview/api/workspace', { cache: 'no-store', credentials: 'same-origin', headers }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? 'SESSION_EXPIRED' : 'CONNECTION_FAILED');
      const data = await response.json() as T;
      if (!Array.isArray(data.boards)) throw new Error('INVALID_WORKSPACE');
      return data;
    });
    pending.set(token, promise);
    const release = () => { if (pending.get(token) === promise) pending.delete(token); };
    void promise.then(release, release);
    return promise;
  };
  return {
    prime(token: string) {
      if (prepared?.token === token) return prepared.promise;
      const promise = read(token);
      prepared = { token, promise };
      void promise.catch(() => { if (prepared?.promise === promise) prepared = null; });
      return promise;
    },
    load(token: string) {
      if (prepared?.token === token) {
        const promise = prepared.promise;
        prepared = null;
        return promise;
      }
      return read(token);
    },
    clear() { prepared = null; pending.clear(); },
  };
}
