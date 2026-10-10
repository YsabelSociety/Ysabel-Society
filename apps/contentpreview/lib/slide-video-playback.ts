export type SlideVideoPlayback = 'manual' | 'active' | 'inactive';

export const currentGridVideo = (root: ParentNode | null) => root?.querySelector<HTMLVideoElement>('video[data-grid-video]:not([data-slide-playback="inactive"])') || null;

// Only a slide the viewer has navigated to starts automatically. Gallery and
// initial grid previews remain still; retained neighbour slides stay paused.
export function bindSlideVideoPlayback(video: HTMLVideoElement, state: SlideVideoPlayback, page: Document = document) {
  const pause = () => video.pause();
  if (state !== 'active') {
    if (state === 'inactive') pause();
    return pause;
  }

  // Muted inline playback is supported without a second tap on mobile browsers.
  video.muted = true;
  video.playsInline = true;
  let resumeWhenVisible = page.hidden;
  const play = () => {
    if (page.hidden) return;
    // The promise waits for buffered data. Browser restrictions or switching
    // slides may reject it; manual playback controls remain available.
    void video.play().catch(() => undefined);
  };
  const visibilityChanged = () => {
    if (page.hidden) { resumeWhenVisible = !video.paused; pause(); }
    else if (resumeWhenVisible) { resumeWhenVisible = false; play(); }
  };
  page.addEventListener('visibilitychange', visibilityChanged);
  play();
  return () => {
    page.removeEventListener('visibilitychange', visibilityChanged);
    pause();
  };
}
