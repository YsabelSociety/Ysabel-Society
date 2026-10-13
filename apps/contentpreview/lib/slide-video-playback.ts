export type SlideVideoPlayback = 'manual' | 'active' | 'inactive';

export const currentGridVideo = (root: ParentNode | null) => root?.querySelector<HTMLVideoElement>('video[data-grid-video]:not([data-slide-playback="inactive"])') || null;

export function pauseOtherPreviewVideos(video: HTMLVideoElement) {
  video.ownerDocument?.querySelectorAll<HTMLVideoElement>('video[data-grid-video]').forEach(other => {
    if (other !== video && !other.paused) other.pause();
  });
}

export function enableVideoSound(video: HTMLVideoElement) {
  video.muted = false;
  if (video.volume === 0) video.volume = 1;
  video.playsInline = true;
}

export function playVideoWithSound(video: HTMLVideoElement) {
  enableVideoSound(video);
  pauseOtherPreviewVideos(video);
  return video.play();
}

// Only a slide the viewer has navigated to starts automatically. Gallery and
// initial grid previews remain still; retained neighbour slides stay paused.
export function bindSlideVideoPlayback(video: HTMLVideoElement, state: SlideVideoPlayback, page: Document = document, onBlocked: () => void = () => {}) {
  const pause = () => video.pause();
  if (state !== 'active') {
    if (state === 'inactive') pause();
    return pause;
  }

  // Try audible playback. Never silently fall back to muted autoplay.
  enableVideoSound(video);
  let disposed = false;
  let resumeWhenVisible = page.hidden;
  const play = () => {
    if (page.hidden) return;
    // The promise waits for buffered data. Browser restrictions or switching
    // slides may reject it; manual playback controls remain available.
    void video.play().catch((error: unknown) => {
      if (!disposed && !page.hidden && (error as { name?: string })?.name === 'NotAllowedError') onBlocked();
    });
  };
  const visibilityChanged = () => {
    if (page.hidden) { resumeWhenVisible = !video.paused; pause(); }
    else if (resumeWhenVisible) { resumeWhenVisible = false; play(); }
  };
  page.addEventListener('visibilitychange', visibilityChanged);
  play();
  return () => {
    disposed = true;
    page.removeEventListener('visibilitychange', visibilityChanged);
    pause();
  };
}
