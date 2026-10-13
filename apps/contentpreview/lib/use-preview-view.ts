import { useCallback, useEffect, useState } from 'react';
import { allowedPreviewView, defaultPreviewView, MOBILE_PREVIEW_QUERY, type PreviewView } from './preview-view';

export function usePreviewView() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_PREVIEW_QUERY).matches);
  const [requested, setRequested] = useState<PreviewView>(() => defaultPreviewView(mobile));
  useEffect(() => {
    const query = window.matchMedia(MOBILE_PREVIEW_QUERY);
    const sync = () => { setMobile(query.matches); setRequested(defaultPreviewView(query.matches)); };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  const setView = useCallback((view: PreviewView) => setRequested(allowedPreviewView(view, mobile)), [mobile]);
  return { view: allowedPreviewView(requested, mobile), setView, mobile };
}
