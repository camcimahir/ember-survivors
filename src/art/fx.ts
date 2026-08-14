/**
 * Projectile and effect sprites.
 *
 * Projectiles are drawn pointing along +x and rotated to their heading. Energy
 * effects lean on additive blending at render time, so their sprites are drawn
 * bright on transparent rather than outlined like the actors.
 */

import { makeSprite, SpriteSheet, type Sprite } from '../engine/sprites';
import {
  blobPath,
  boltPath,
  flamePath,
  glow,
  leafPath,
  outlined,
  polyPath,
  roundRectPath,
  sawPath,
  shaded,
  shardPath,
  starPath,
  withAlpha,
  type Ctx,
} from './draw';
import { OUTLINE, PALETTE, type Ramp } from './style';

/* ---------------------------------------------------------- projectiles --- */

/** A comet-shaped energy bolt: bright head, tapering tail along -x. */
function energyBolt(ctx: Ctx, s: number, ramp: Ramp, tail = 0.55): void {
  const cy = s / 2;
  const headX = s * 0.68;
  const r = s * 0.22;

  glow(ctx, headX, cy, s * 0.46, ramp.glow, 0.85);

  ctx.save();
  const g = ctx.createLinearGradient(headX - s * tail, cy, headX, cy);
  g.addColorStop(0, withAlpha(ramp.base, 0));
  g.addColorStop(0.55, withAlpha(ramp.base, 0.75));
  g.addColorStop(1, ramp.light);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(headX - s * tail, cy);
  ctx.quadraticCurveTo(headX - s * tail * 0.4, cy - r * 0.85, headX, cy - r * 0.7);
  ctx.arc(headX, cy, r * 0.7, -Math.PI / 2, Math.PI / 2);
  ctx.quadraticCurveTo(headX - s * tail * 0.4, cy + r * 0.85, headX - s * tail, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(headX, cy, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFireball(ctx: Ctx, s: number): void {
  const cy = s / 2;
  glow(ctx, s * 0.6, cy, s * 0.5, PALETTE.fire.glow, 0.9);
  // Layered flames give the fireball a licking silhouette.
  ctx.save();
  ctx.translate(s * 0.6, cy);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = withAlpha(PALETTE.fire.dark, 0.9);
  flamePath(ctx, 0, 0, s * 0.5, s * 0.75);
  ctx.fill();
  ctx.fillStyle = PALETTE.fire.base;
  flamePath(ctx, 0, s * 0.04, s * 0.36, s * 0.58);
  ctx.fill();
  ctx.fillStyle = PALETTE.fire.light;
  flamePath(ctx, 0, s * 0.07, s * 0.2, s * 0.36);
  ctx.fill();
  ctx.fillStyle = '#fffbe8';
  flamePath(ctx, 0, s * 0.09, s * 0.1, s * 0.2);
  ctx.fill();
  ctx.restore();
}

function drawSpark(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.5, PALETTE.storm.glow, 0.9);
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = s * 0.11;
  ctx.lineCap = 'round';
  ctx.shadowColor = PALETTE.storm.glow;
  ctx.shadowBlur = s * 0.3;
  boltPath(ctx, s * 0.12, c, s * 0.88, c, 4, 0.13, 31);
  ctx.stroke();
  ctx.restore();
}

function drawIceShard(ctx: Ctx, s: number): void {
  const cy = s / 2;
  glow(ctx, s * 0.55, cy, s * 0.42, PALETTE.frost.glow, 0.7);
  ctx.save();
  ctx.translate(s * 0.55, cy);
  ctx.rotate(Math.PI / 2);
  shaded(ctx, s, (c) => shardPath(c, 0, 0, s * 0.36, s * 0.8), PALETTE.frost, {
    outline: s * 0.06,
    cx: 0,
    cy: 0,
    radius: s * 0.36,
  });
  ctx.restore();
}

function drawSpore(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.42, PALETTE.verdant.glow, 0.7);
  shaded(ctx, s, (x) => blobPath(x, c, c, s * 0.27, 0.16, 17, 7), PALETTE.verdant, {
    outline: s * 0.07,
    cx: c,
    cy: c,
    radius: s * 0.27,
  });
  // Little leaf, so it reads as botanical rather than as a generic ball.
  ctx.save();
  ctx.rotate(0);
  outlined(
    ctx,
    (x) => leafPath(x, c + s * 0.1, c - s * 0.16, s * 0.26, s * 0.12),
    PALETTE.verdant.light,
    s * 0.045,
  );
  ctx.restore();
}

function drawSawblade(ctx: Ctx, s: number): void {
  const c = s / 2;
  shaded(ctx, s, (x) => sawPath(x, c, c, s * 0.44, 9), PALETTE.steel, {
    outline: s * 0.06,
    cx: c,
    cy: c,
    radius: s * 0.44,
  });
  // Hub
  outlined(
    ctx,
    (x) => {
      x.beginPath();
      x.arc(c, c, s * 0.13, 0, Math.PI * 2);
      x.closePath();
    },
    '#5a6782',
    s * 0.05,
  );
  ctx.save();
  ctx.fillStyle = '#eef3fb';
  ctx.beginPath();
  ctx.arc(c, c, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVoidOrb(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.5, PALETTE.void.glow, 0.85);
  // Accretion ring
  ctx.save();
  ctx.strokeStyle = PALETTE.void.light;
  ctx.lineWidth = s * 0.07;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(c, c, s * 0.38, s * 0.16, -0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Event horizon: a true black core reads as "void" instantly.
  ctx.save();
  ctx.fillStyle = '#0a0616';
  ctx.beginPath();
  ctx.arc(c, c, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.void.base;
  ctx.lineWidth = s * 0.035;
  ctx.stroke();
  ctx.restore();
}

function drawPlasmaOrb(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.52, '#ffb0ff', 0.9);
  ctx.save();
  const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.34);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, '#ffd0a0');
  g.addColorStop(0.75, '#ff7a3c');
  g.addColorStop(1, withAlpha('#7cc4ff', 0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // Crackle
  ctx.strokeStyle = withAlpha('#c3ecff', 0.95);
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    boltPath(
      ctx,
      c + Math.cos(a) * s * 0.1,
      c + Math.sin(a) * s * 0.1,
      c + Math.cos(a) * s * 0.42,
      c + Math.sin(a) * s * 0.42,
      3,
      0.3,
      13 + i,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawChakram(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.46, PALETTE.frost.glow, 0.6);
  shaded(
    ctx,
    s,
    (x) => starPath(x, c, c, s * 0.45, s * 0.28, 6, 0, 0.15),
    { dark: '#2a7fa0', base: '#8fe4f5', light: '#eafcff', glow: '#7ce8ff' },
    { outline: s * 0.055, cx: c, cy: c, radius: s * 0.45 },
  );
  ctx.save();
  ctx.fillStyle = withAlpha('#0a2634', 0.55);
  ctx.beginPath();
  ctx.arc(c, c, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBrambleBlade(ctx: Ctx, s: number): void {
  const cy = s / 2;
  shaded(
    ctx,
    s,
    (x) => {
      x.beginPath();
      x.moveTo(s * 0.08, cy);
      x.quadraticCurveTo(s * 0.5, cy - s * 0.3, s * 0.94, cy - s * 0.04);
      x.quadraticCurveTo(s * 0.5, cy + s * 0.12, s * 0.08, cy);
      x.closePath();
    },
    PALETTE.verdant,
    { outline: s * 0.06, cx: s * 0.5, cy, radius: s * 0.4 },
  );
  // Thorns along the spine
  ctx.save();
  ctx.fillStyle = '#d8f5c0';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = s * 0.03;
  for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.18;
    const x = s * (0.08 + 0.86 * t);
    const y = cy - s * 0.16 * Math.sin(t * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, y);
    ctx.lineTo(x, y - s * 0.16);
    ctx.lineTo(x + s * 0.05, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawAcid(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.4, '#bde05a', 0.6);
  shaded(ctx, s, (x) => blobPath(x, c, c, s * 0.28, 0.2, 53, 7), PALETTE.verdant, {
    outline: s * 0.07,
    cx: c,
    cy: c,
    radius: s * 0.28,
  });
}

function drawRailSegment(ctx: Ctx, s: number): void {
  const cy = s / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, cy - s * 0.5, 0, cy + s * 0.5);
  g.addColorStop(0, withAlpha('#7cc4ff', 0));
  g.addColorStop(0.35, withAlpha('#7cc4ff', 0.7));
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(0.65, withAlpha('#7cc4ff', 0.7));
  g.addColorStop(1, withAlpha('#7cc4ff', 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();
}

/* --------------------------------------------------------------- blasts --- */

/** Expanding shock ring used by explosions and novas. */
function ringSprite(ctx: Ctx, s: number, color: string, thickness = 0.1): void {
  const c = s / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * thickness;
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.12;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = s * thickness * 2.2;
  ctx.stroke();
  ctx.restore();
}

/** Soft radial blast used as the core of an explosion. */
function blastSprite(ctx: Ctx, s: number, inner: string, outer: string): void {
  const c = s / 2;
  ctx.save();
  const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.5);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.22, inner);
  g.addColorStop(0.62, withAlpha(outer, 0.6));
  g.addColorStop(1, withAlpha(outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Soft blob used for smoke, steam and spore clouds. */
function puffSprite(ctx: Ctx, s: number, color: string): void {
  const c = s / 2;
  ctx.save();
  const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.5);
  g.addColorStop(0, withAlpha(color, 0.85));
  g.addColorStop(0.55, withAlpha(color, 0.4));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ground decal for persistent zones (fire pools, freeze fields). */
function zoneSprite(ctx: Ctx, s: number, ramp: Ramp): void {
  const c = s / 2;
  ctx.save();
  const g = ctx.createRadialGradient(c, c, s * 0.08, c, c, s * 0.5);
  g.addColorStop(0, withAlpha(ramp.light, 0.5));
  g.addColorStop(0.55, withAlpha(ramp.base, 0.32));
  g.addColorStop(0.9, withAlpha(ramp.dark, 0.22));
  g.addColorStop(1, withAlpha(ramp.dark, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(ramp.glow, 0.65);
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Muzzle flash: a short bright cone along +x. */
function muzzleSprite(ctx: Ctx, s: number): void {
  const cy = s / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, cy, s, cy);
  g.addColorStop(0, withAlpha('#ffd75c', 0.95));
  g.addColorStop(0.5, withAlpha('#ffa63c', 0.5));
  g.addColorStop(1, withAlpha('#ff6b2c', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, cy - s * 0.22);
  ctx.quadraticCurveTo(s * 0.7, cy - s * 0.3, s, cy);
  ctx.quadraticCurveTo(s * 0.7, cy + s * 0.3, 0, cy + s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A slash arc for melee-ish weapons (bramble cutter). */
function slashSprite(ctx: Ctx, s: number, color: string): void {
  const c = s / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.1;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.9 - i * 0.28;
    ctx.lineWidth = s * (0.14 - i * 0.035);
    ctx.beginPath();
    ctx.arc(c, c, s * (0.4 - i * 0.05), -0.85, 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- sheet --- */

export type FxKey =
  | 'fireball'
  | 'spark'
  | 'iceShard'
  | 'spore'
  | 'sawblade'
  | 'voidOrb'
  | 'plasmaOrb'
  | 'chakram'
  | 'brambleBlade'
  | 'acid'
  | 'rail'
  | 'boltFire'
  | 'boltStorm'
  | 'boltFrost'
  | 'boltVerdant'
  | 'boltSteel'
  | 'boltVoid'
  | 'blastFire'
  | 'blastStorm'
  | 'blastFrost'
  | 'blastVerdant'
  | 'blastSteel'
  | 'blastVoid'
  | 'ringFire'
  | 'ringStorm'
  | 'ringFrost'
  | 'ringVerdant'
  | 'ringSteel'
  | 'ringVoid'
  | 'ringWhite'
  | 'zoneFire'
  | 'zoneStorm'
  | 'zoneFrost'
  | 'zoneVerdant'
  | 'zoneSteel'
  | 'zoneVoid'
  | 'puffWhite'
  | 'puffSmoke'
  | 'puffSteam'
  | 'puffSpore'
  | 'muzzle'
  | 'slashVerdant'
  | 'slashSteel';

export const fx = new SpriteSheet<FxKey>({
  fireball: () => makeSprite(30, drawFireball, 6),
  spark: () => makeSprite(28, drawSpark, 6),
  iceShard: () => makeSprite(28, drawIceShard, 5),
  spore: () => makeSprite(26, drawSpore, 5),
  sawblade: () => makeSprite(40, drawSawblade, 4),
  voidOrb: () => makeSprite(34, drawVoidOrb, 6),
  plasmaOrb: () => makeSprite(34, drawPlasmaOrb, 6),
  chakram: () => makeSprite(38, drawChakram, 5),
  brambleBlade: () => makeSprite(38, drawBrambleBlade, 4),
  acid: () => makeSprite(24, drawAcid, 5),
  rail: () => makeSprite(24, drawRailSegment, 0),

  boltFire: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.fire), 5),
  boltStorm: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.storm), 5),
  boltFrost: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.frost), 5),
  boltVerdant: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.verdant), 5),
  boltSteel: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.steel), 5),
  boltVoid: () => makeSprite(26, (c, s) => energyBolt(c, s, PALETTE.void), 5),

  blastFire: () => makeSprite(96, (c, s) => blastSprite(c, s, '#ffc46b', PALETTE.fire.base)),
  blastStorm: () => makeSprite(96, (c, s) => blastSprite(c, s, '#c3ecff', PALETTE.storm.base)),
  blastFrost: () => makeSprite(96, (c, s) => blastSprite(c, s, '#c8f6ff', PALETTE.frost.base)),
  blastVerdant: () => makeSprite(96, (c, s) => blastSprite(c, s, '#a8f0b4', PALETTE.verdant.base)),
  blastSteel: () => makeSprite(96, (c, s) => blastSprite(c, s, '#eef3fb', PALETTE.steel.base)),
  blastVoid: () => makeSprite(96, (c, s) => blastSprite(c, s, '#d9b4ff', PALETTE.void.base)),

  ringFire: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.fire.light)),
  ringStorm: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.storm.light)),
  ringFrost: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.frost.light)),
  ringVerdant: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.verdant.light)),
  ringSteel: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.steel.light)),
  ringVoid: () => makeSprite(96, (c, s) => ringSprite(c, s, PALETTE.void.light)),
  ringWhite: () => makeSprite(96, (c, s) => ringSprite(c, s, '#ffffff', 0.06)),

  zoneFire: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.fire)),
  zoneStorm: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.storm)),
  zoneFrost: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.frost)),
  zoneVerdant: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.verdant)),
  zoneSteel: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.steel)),
  zoneVoid: () => makeSprite(128, (c, s) => zoneSprite(c, s, PALETTE.void)),

  puffWhite: () => makeSprite(48, (c, s) => puffSprite(c, s, '#ffffff')),
  puffSmoke: () => makeSprite(48, (c, s) => puffSprite(c, s, '#7a8399')),
  puffSteam: () => makeSprite(48, (c, s) => puffSprite(c, s, '#dff4ff')),
  puffSpore: () => makeSprite(48, (c, s) => puffSprite(c, s, '#8affa0')),

  muzzle: () => makeSprite(34, muzzleSprite, 2),
  slashVerdant: () => makeSprite(84, (c, s) => slashSprite(c, s, PALETTE.verdant.light)),
  slashSteel: () => makeSprite(84, (c, s) => slashSprite(c, s, PALETTE.steel.light)),
});

/** Maps an element to its themed blast/ring/zone sprite keys. */
export const ELEMENT_FX: Record<
  string,
  { bolt: FxKey; blast: FxKey; ring: FxKey; zone: FxKey }
> = {
  fire: { bolt: 'boltFire', blast: 'blastFire', ring: 'ringFire', zone: 'zoneFire' },
  storm: { bolt: 'boltStorm', blast: 'blastStorm', ring: 'ringStorm', zone: 'zoneStorm' },
  frost: { bolt: 'boltFrost', blast: 'blastFrost', ring: 'ringFrost', zone: 'zoneFrost' },
  verdant: {
    bolt: 'boltVerdant',
    blast: 'blastVerdant',
    ring: 'ringVerdant',
    zone: 'zoneVerdant',
  },
  steel: { bolt: 'boltSteel', blast: 'blastSteel', ring: 'ringSteel', zone: 'zoneSteel' },
  void: { bolt: 'boltVoid', blast: 'blastVoid', ring: 'ringVoid', zone: 'zoneVoid' },
};

export function fxSprite(key: FxKey): Sprite {
  return fx.get(key);
}

/* ---------------------------------------------------------------- misc --- */

/** Rounded badge backdrop shared by every icon. Exported for the icon sheet. */
export function iconBadge(ctx: Ctx, s: number, a: string, b: string): void {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  roundRectPath(ctx, s / 2, s / 2, s * 0.94, s * 0.94, s * 0.26);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#ffffff', 0.22);
  ctx.lineWidth = s * 0.035;
  ctx.stroke();
  ctx.restore();
}

/** Small hexagonal plate used behind fusion glyphs. */
export function iconPlate(ctx: Ctx, s: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = color;
  polyPath(ctx, s / 2, s / 2, s * 0.4, 6, Math.PI / 6, 0.2);
  ctx.fill();
  ctx.restore();
}
