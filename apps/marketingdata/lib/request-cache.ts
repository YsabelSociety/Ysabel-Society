/** Bounded, memory-only reads. No guest data is persisted across page sessions. */
export function createRequestCache<T>(maxEntries = 32, maxAge = 30000) {
  const values = new Map<string, { data: T; at: number; generation: number }>();
  const pending = new Map<string, { generation: number; promise: Promise<T> }>();
  let generation = 0;
  return {
    peek(key: string) { return values.get(key)?.data; },
    invalidate() { generation++; pending.clear(); },
    clear() { generation++; values.clear(); pending.clear(); },
    read(key: string, load: () => Promise<T>): Promise<T> {
      const saved = values.get(key);
      if (saved && saved.generation === generation && Date.now() - saved.at < maxAge)
        return Promise.resolve(saved.data);
      const running = pending.get(key);
      if (running?.generation === generation) return running.promise;
      const requestGeneration = generation;
      const promise = Promise.resolve().then(load).then(data => {
        if (requestGeneration === generation) {
          values.delete(key);
          values.set(key, { data, at: Date.now(), generation });
          while (values.size > maxEntries) values.delete(values.keys().next().value!);
        }
        return data;
      }).finally(() => { if (pending.get(key)?.promise === promise) pending.delete(key); });
      pending.set(key, { generation, promise });
      return promise;
    },
  };
}
