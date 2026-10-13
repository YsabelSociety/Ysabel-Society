/** Map a screen-space drag to cover-crop coordinates without changing the source. */
export function dragCropPosition(start: number, delta: number, viewport: number, rendered: number, zoom: number) {
  const overflow = rendered * zoom / 100 - viewport;
  if (overflow < 1) return start;
  return Math.max(0, Math.min(100, start - delta / overflow * 100));
}

export function coverSize(width: number, height: number, naturalWidth: number, naturalHeight: number) {
  const factor = Math.max(width / naturalWidth, height / naturalHeight);
  return { width: naturalWidth * factor, height: naturalHeight * factor };
}
