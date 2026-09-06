/** The supplied painting is one rigid plate. No inferred depth or object masks. */
export const LOGIN_SCENE = {
  artwork: '/contentpreview-app/login-landscape.webp',
  fallbackArtwork: '/contentpreview-app/login-landscape-original.png',
  image: { width: 1280, height: 929 },
  mobileBreakpoint: 700,
  desktop: { focalX: 0.53, focalY: 0.58, travelPx: 22, driftPx: 5, pixelRatio: 1.5, fps: 40 },
  mobile: { focalX: 0.66, focalY: 0.55, travelPx: 9, driftPx: 2.5, pixelRatio: 1, fps: 30 },
  overscanPx: 34,
  followSeconds: 0.65,
  focusStrength: 0.18,
  driftRadiansPerSecond: 0.13,
  idleZoom: 0.007,
  entry: { durationMs: 620, scale: 1.018 },
  // Enable local effects only after accurate masks and restored plates are supplied.
  assets: { layers: [], depthMap: null, waterMask: null, leafMask: null, atmosphereMask: null },
  effects: { waterStrength: 0, leafStrength: 0, particleCount: 0, particleOpacity: 0 },
} as const;

export function paintingLayout(width: number, height: number) {
  const settings = width <= LOGIN_SCENE.mobileBreakpoint ? LOGIN_SCENE.mobile : LOGIN_SCENE.desktop;
  const pad = LOGIN_SCENE.overscanPx;
  const scale = Math.max((width + pad * 2) / LOGIN_SCENE.image.width, (height + pad * 2) / LOGIN_SCENE.image.height);
  const imageWidth = LOGIN_SCENE.image.width * scale;
  const imageHeight = LOGIN_SCENE.image.height * scale;
  return { settings, width: imageWidth, height: imageHeight,
    left: -pad + (width + pad * 2 - imageWidth) * settings.focalX,
    top: -pad + (height + pad * 2 - imageHeight) * settings.focalY };
}
