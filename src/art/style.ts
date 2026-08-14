/**
 * Art style tokens.
 *
 * Every sprite in the game is generated from the primitives in `draw.ts` using
 * these tokens. Centralising them is what keeps 40+ procedurally drawn sprites
 * looking like one cohesive cartoon set instead of a grab bag.
 *
 * The target look is chunky mobile-casual (Survivor.io / Archero family):
 *   - bold near-black outline, thickness proportional to sprite size
 *   - flat saturated base fill, one darker shade, one lighter top-light
 *   - a single soft specular blob toward the upper-left
 *   - big, simple, high-contrast eyes for readability at thumb size
 */

/** Outline colour. Near-black with a blue cast, never pure #000. */
export const OUTLINE = '#141527';
export const OUTLINE_SOFT = '#232640';

/** Outline width as a fraction of the sprite's edge length. */
export const OUTLINE_W = 0.075;

/** Direction the key light comes from (upper-left), in normalised units. */
export const LIGHT_X = -0.32;
export const LIGHT_Y = -0.42;

/** A three-stop ramp describing one material. */
export interface Ramp {
  dark: string;
  base: string;
  light: string;
  /** Emissive glow colour used for auras/trails. */
  glow: string;
}

export const ramp = (dark: string, base: string, light: string, glow: string): Ramp => ({
  dark,
  base,
  light,
  glow,
});

/* ------------------------------------------------------------ Elements --- */

export const PALETTE = {
  fire: ramp('#a32a12', '#ff6b2c', '#ffc46b', '#ff8f3c'),
  storm: ramp('#2a4fa8', '#4fa8ff', '#c3ecff', '#7cc4ff'),
  frost: ramp('#2a7fa0', '#54cfe8', '#c8f6ff', '#7ce8ff'),
  verdant: ramp('#1e7a3e', '#46c46a', '#a8f0b4', '#6ce08a'),
  steel: ramp('#5a6782', '#a8b6cc', '#eef3fb', '#cfd8e8'),
  void: ramp('#4a1d80', '#8a45d6', '#d9b4ff', '#b98cff'),
} as const;

export type ElementKey = keyof typeof PALETTE;

export const ELEMENT_KEYS: ElementKey[] = ['fire', 'storm', 'frost', 'verdant', 'steel', 'void'];

/* --------------------------------------------------------------- World --- */

export const WORLD = {
  /** Ground base and the two checker tints. */
  groundA: '#1b2a3d',
  groundB: '#1f3145',
  groundEdge: '#16222f',
  /** Scatter detail colours. */
  detail: '#263a50',
  detailWarm: '#2c3a48',
  vignette: '#05070d',
} as const;

/* ------------------------------------------------------------- Actors --- */

export const HERO = {
  skin: '#ffd0a4',
  skinShade: '#e0a878',
  hair: '#3a2c4a',
  hairLight: '#54406b',
  coat: '#3f7ad6',
  coatDark: '#2a54a0',
  coatLight: '#6ba6f5',
  strap: '#2e3550',
  gunBody: '#4b5570',
  gunDark: '#333b52',
  gunLight: '#7d89a8',
  gunAccent: '#ffc24a',
  boot: '#5a4633',
} as const;

export const ENEMY = {
  /** Shared "corrupted goo" body ramp all the basic mobs share. */
  goo: ramp('#5a1f4a', '#a02e6e', '#d95a94', '#ff77b0'),
  gooAlt: ramp('#28305a', '#4a5aa8', '#8a9ae0', '#a8b6ff'),
  brute: ramp('#5d2a1b', '#a8512e', '#e08a55', '#ff9c5c'),
  dasher: ramp('#0f4a4f', '#1e9aa0', '#5fd8dc', '#7cf0f4'),
  spitter: ramp('#3f5518', '#7aa32c', '#bde05a', '#d4f26e'),
  bomber: ramp('#5e3f0e', '#c2901e', '#ffd75c', '#ffe98a'),
  wraith: ramp('#2b1a4a', '#5c3aa0', '#a583e0', '#c9a8ff'),
  boss: ramp('#4a1020', '#9e2038', '#e05068', '#ff7088'),
  /** Eye colours: hostile mobs get an angry warm sclera. */
  eye: '#fff6e8',
  pupil: '#1a1424',
  eyeGlow: '#ff4a5c',
} as const;

/* --------------------------------------------------------------- Misc --- */

export const XP_GEM = ramp('#137a9e', '#38c6f0', '#b4f0ff', '#66e0ff');
export const HEAL = ramp('#7a1230', '#e03a5c', '#ff8ea4', '#ff5a78');
export const GOLD = ramp('#a86a12', '#ffc24a', '#ffeba8', '#ffd75c');

/** Rarity accent colours for upgrade cards. */
export const RARITY = {
  common: '#9fb0cc',
  rare: '#4fa8ff',
  epic: '#b98cff',
  fusion: '#ffcc55',
} as const;

export type Rarity = keyof typeof RARITY;
