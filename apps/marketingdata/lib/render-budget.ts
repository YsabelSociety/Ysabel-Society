// Bound backing-buffer memory even on high-DPR phones and large displays.
export function canvasPixelRatio(width: number, height: number, dpr: number, touch = false) {
  const pixels = Math.max(1, width * height);
  return Math.min(Math.max(1, dpr || 1), touch ? 1.25 : 1.75,
    Math.sqrt((touch ? 900000 : 1800000) / pixels));
}

export function releaseRenderer(renderer: { dispose(): void; forceContextLoss(): void; domElement: { remove(): void } }) {
  // dispose() frees Three resources, but does not release the browser's WebGL context.
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}
