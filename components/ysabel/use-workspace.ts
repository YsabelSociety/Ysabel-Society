'use client';
import { useEffect, useState, useCallback } from 'react';
import { POSTS, UNITS, type Post } from '@/lib/analytics';
export type Note = { id: string; date: string; text: string; unit: string };
export type SavedReport = {
  id: string;
  title: string;
  start: string;
  end: string;
  unit: string;
  createdAt: string;
  mode: string;
};
export function useWorkspace() {
  const [posts, setPosts] = useState<Post[]>(POSTS),
    [annotations, setAnnotations] = useState<Note[]>([]),
    [reports, setReports] = useState<SavedReport[]>([]),
    [settings, setSettings] = useState({
      workspace: 'Ysabel Society',
      timezone: 'Europe/Tirane',
      units: UNITS,
    }),
    [user, setUser] = useState({ name: 'Ysabel Society', email: '' }),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const notify = useCallback((text: string) => setNotice(text), []);
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/marketingdata/api/state', {
        signal: AbortSignal.timeout(30000),
      });
      const data: any = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPosts(data.posts);
      setAnnotations(data.annotations);
      setReports(data.reports);
      setSettings(data.settings);
      setUser(data.user);
      setReady(true);
      setError('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not open the saved workspace.',
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function mutate(body: any) {
    setBusy(true);
    try {
      const r = await fetch('/marketingdata/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: any = await r.json();
      if (!r.ok) throw new Error(data.error);
      setError('');
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save.';
      setError(message);
      notify(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const save = async (post: Post) => {
    const data = await mutate({ op: 'savePost', post });
    setPosts((ps) =>
      ps.some((p) => p.id === post.id)
        ? ps.map((p) => (p.id === post.id ? data.post : p))
        : [...ps, data.post],
    );
    notify('Content saved to your workspace.');
    return data.post as Post;
  };
  const remove = async (id: string) => {
    await mutate({ op: 'deletePost', id });
    setPosts((ps) => ps.filter((p) => p.id !== id));
    notify('Content removed.');
  };
  const reorder = async (ids: string[]) => {
    await mutate({ op: 'reorder', ids });
    setPosts((ps) =>
      ids.map((id, i) => ({ ...ps.find((p) => p.id === id)!, position: i })),
    );
    notify('Grid order saved.');
  };
  const duplicate = async (post: Post) =>
    save({
      ...post,
      id: crypto.randomUUID(),
      title: post.title + ' — copy',
      status: 'Draft',
      scheduled: '',
      views: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
      followers: 0,
      visits: 0,
      score: 0,
    });
  const annotate = async (date: string, text: string, unit: string) => {
    const data = await mutate({ op: 'annotation', date, text, unit });
    setAnnotations((ps) => [...ps, data.annotation]);
    notify('Timeline annotation saved.');
  };
  const saveReport = async (report: Partial<SavedReport>) => {
    const data = await mutate({ op: 'saveReport', ...report });
    setReports((ps) => [data.report, ...ps]);
    notify('Report saved.');
    return data.report;
  };
  const saveSettings = async (value: typeof settings) => {
    const data = await mutate({ op: 'settings', settings: value });
    setSettings(data.settings);
    notify('Workspace settings saved.');
  };
  return {
    posts,
    annotations,
    reports,
    settings,
    user,
    ready,
    error,
    notice,
    busy,
    load,
    notify,
    save,
    remove,
    reorder,
    duplicate,
    annotate,
    saveReport,
    saveSettings,
  };
}
export type WorkspaceData = ReturnType<typeof useWorkspace>;
