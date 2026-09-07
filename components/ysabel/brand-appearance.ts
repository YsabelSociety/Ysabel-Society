// Sampled from the supplied Ysabel references: evergreen background, soft silver mark.
export const INTRO_LOGO_COLOR = '#bdbdb9';
export const INTRO_BACKGROUND = [
  'radial-gradient(ellipse at 48% 36%, #294536 0%, #1d3428 40%, transparent 72%)',
  'radial-gradient(ellipse at 100% 5%, #243e30 0%, transparent 48%)',
  'linear-gradient(160deg, #1d3428, #14261d 87%)',
].join(', ');
export const INTRO_LIGHT_COLORS = {
  sky: 0xf4f5f2,
  ground: 0x1d3428,
  key: 0xffffff,
  rim: 0xe7ebe7,
  fill: 0xf1f3ef,
};
export const INTRO_LOGO_MATERIAL = {
  color: INTRO_LOGO_COLOR,
  metalness: 0.86,
  roughness: 0.27,
  envMapIntensity: 1.3,
  clearcoat: 0.25,
  clearcoatRoughness: 0.32,
};
