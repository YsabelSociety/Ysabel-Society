// Sampled from the supplied white references; preserve the original artwork.
export const INTRO_LOGO_COLOR = '#1d3428';
export const INTRO_TEXT_COLOR = '#2d2c2c';
export const INTRO_BACKGROUND = [
  'radial-gradient(ellipse at 44% 32%, #ffffff 0%, #ffffffd9 32%, transparent 70%)',
  'radial-gradient(ellipse at 100% 8%, #e1e8e3 0%, transparent 60%)',
  'linear-gradient(150deg, #f8faf8, #eef1ee 62%, #dfe5e0)',
].join(', ');
export const INTRO_LIGHT_COLORS = {
  sky: 0xf4f5f2,
  ground: 0x8b9b90,
  key: 0xffffff,
  rim: 0xe7ebe7,
  fill: 0xf1f3ef,
};
export const INTRO_LOGO_MATERIAL = {
  color: INTRO_LOGO_COLOR,
  metalness: 0.32,
  roughness: 0.38,
  envMapIntensity: 0.65,
  clearcoat: 0.18,
  clearcoatRoughness: 0.38,
};
