/**
 * Environment art: the ground tile and the scattered props that give the
 * infinite arena a sense of place and of motion.
 *
 * The ground is one seamless tile turned into a CanvasPattern, which is by far
 * the cheapest way to fill an unbounded scrolling field.
 */

import { Rng } from '../engine/rng';
import { makeSprite, SpriteSheet, type Sprite } from '../engine/sprites';
import {
  blobPath,
  leafPath,
  outlined,
  roundedPolyFromPoints,
  roundRectPath,
  shaded,
  withAlpha,
  type Ctx,
} from './draw';
import { WORLD } from './style';

export const TILE = 128;

/** Seamless ground tile: dark flagstones with grout and speckle. */
function drawGroundTile(ctx: Ctx, s: number): void {
  ctx.fillStyle = WORLD.groundA;
  ctx.fillRect(0, 0, s, s);

  // Two-tone checker at half-tile resolution, very low contrast.
  ctx.fillStyle = WORLD.groundB;
  const h = s / 2;
  ctx.fillRect(0, 0, h, h);
  ctx.fillRect(h, h, h, h);

  // Grout lines. Drawn at the tile edges and centre so they tile seamlessly.
  ctx.strokeStyle = WORLD.groundEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(s, h);
  ctx.moveTo(h, 0);
  ctx.lineTo(h, s);
  ctx.moveTo(0, 0.5);
  ctx.lineTo(s, 0.5);
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, s);
  ctx.stroke();

  // Speckle. Seeded so the tile is identical every run.
  const rng = new Rng(20240);
  ctx.fillStyle = withAlpha('#ffffff', 0.028);
  for (let i = 0; i < 130; i++) {
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    const r = rng.range(0.6, 2.2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few darker pits for depth.
  ctx.fillStyle = withAlpha('#000000', 0.1);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    ctx.beginPath();
    ctx.ellipse(x, y, rng.range(2, 7), rng.range(1.5, 4), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

let groundPattern: CanvasPattern | null = null;

/** Builds (once) and returns the tiled ground pattern. */
export function getGroundPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (groundPattern) return groundPattern;
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext('2d')!;
  drawGroundTile(g, TILE);
  groundPattern = ctx.createPattern(c, 'repeat');
  return groundPattern;
}

/* ----------------------------------------------------------------- props --- */

function drawRock(ctx: Ctx, s: number): void {
  const c = s / 2;
  shaded(ctx, s, (x) => blobPath(x, c, c * 1.1, s * 0.3, 0.2, 5, 7), {
    dark: '#1c2836',
    base: '#324459',
    light: '#4d6480',
    glow: '#4d6480',
  }, { outline: s * 0.05, cx: c, cy: c, radius: s * 0.3, specular: 0.5 });
}

function drawGrass(ctx: Ctx, s: number): void {
  const c = s / 2;
  const rng = new Rng(88);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + rng.range(-0.7, 0.7);
    ctx.save();
    ctx.translate(c + rng.range(-s * 0.18, s * 0.18), s * 0.82);
    ctx.rotate(a);
    outlined(ctx, (x) => leafPath(x, 0, 0, s * rng.range(0.28, 0.44), s * 0.06), '#2f4a3a', s * 0.035);
    ctx.restore();
  }
}

function drawBones(ctx: Ctx, s: number): void {
  const c = s / 2;
  ctx.save();
  ctx.globalAlpha = 0.75;
  outlined(
    ctx,
    (x) => {
      x.beginPath();
      x.ellipse(c, c, s * 0.22, s * 0.16, 0.3, 0, Math.PI * 2);
      x.closePath();
    },
    '#c9cdb8',
    s * 0.04,
  );
  // Eye sockets so it reads as a skull, not a pebble.
  ctx.fillStyle = '#2a2f3a';
  ctx.beginPath();
  ctx.ellipse(c - s * 0.08, c - s * 0.02, s * 0.05, s * 0.045, 0, 0, Math.PI * 2);
  ctx.ellipse(c + s * 0.06, c + s * 0.01, s * 0.05, s * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShroom(ctx: Ctx, s: number): void {
  const c = s / 2;
  // Stem
  outlined(ctx, (x) => roundRectPath(x, c, c + s * 0.15, s * 0.1, s * 0.3, s * 0.04), '#d8d0c0', s * 0.035);
  // Cap
  shaded(
    ctx,
    s,
    (x) => {
      x.beginPath();
      x.moveTo(c - s * 0.2, c + s * 0.02);
      x.quadraticCurveTo(c, c - s * 0.3, c + s * 0.2, c + s * 0.02);
      x.closePath();
    },
    { dark: '#2a5a7a', base: '#4aa0c8', light: '#a8e8ff', glow: '#7ce8ff' },
    { outline: s * 0.04, cx: c, cy: c - s * 0.06, radius: s * 0.2 },
  );
}

function drawCrack(ctx: Ctx, s: number): void {
  const rng = new Rng(303);
  ctx.save();
  ctx.strokeStyle = withAlpha('#000000', 0.24);
  ctx.lineWidth = s * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let x = s * 0.1;
  let y = s * 0.5;
  ctx.moveTo(x, y);
  for (let i = 0; i < 6; i++) {
    x += s * 0.14;
    y += rng.range(-s * 0.12, s * 0.12);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSlab(ctx: Ctx, s: number): void {
  const c = s / 2;
  shaded(
    ctx,
    s,
    (x) =>
      roundedPolyFromPoints(
        x,
        [
          [c - s * 0.3, c - s * 0.18],
          [c + s * 0.26, c - s * 0.3],
          [c + s * 0.32, c + s * 0.2],
          [c - s * 0.24, c + s * 0.3],
        ],
        s * 0.05,
      ),
    { dark: '#1a2532', base: '#2a3a4c', light: '#3e5468', glow: '#3e5468' },
    { outline: s * 0.045, cx: c, cy: c, radius: s * 0.3, specular: 0.4 },
  );
}

export type PropKey = 'rock' | 'grass' | 'bones' | 'shroom' | 'crack' | 'slab';

export const props = new SpriteSheet<PropKey>({
  rock: () => makeSprite(56, drawRock, 3),
  grass: () => makeSprite(52, drawGrass, 3),
  bones: () => makeSprite(48, drawBones, 3),
  shroom: () => makeSprite(44, drawShroom, 3),
  crack: () => makeSprite(72, drawCrack, 2),
  slab: () => makeSprite(64, drawSlab, 3),
});

const PROP_KEYS: PropKey[] = ['rock', 'grass', 'bones', 'shroom', 'crack', 'slab'];
/** Relative frequency; cracks and slabs are common, mushrooms rare. */
const PROP_WEIGHTS = [22, 26, 10, 5, 24, 13];

/** Size of the cell used for deterministic prop placement. */
export const PROP_CELL = 260;

export interface PropInstance {
  sprite: Sprite;
  x: number;
  y: number;
  scale: number;
  rot: number;
  alpha: number;
}

/**
 * Deterministically returns the props for one world cell. Because placement is
 * derived from the cell coordinates, the arena looks hand-scattered but needs
 * no storage and is stable as the player walks back and forth.
 */
export function propsForCell(cx: number, cy: number, out: PropInstance[]): void {
  // Hash the cell coords into a seed. The primes keep neighbouring cells from
  // producing correlated layouts.
  const seed = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
  const rng = new Rng(seed || 1);
  const count = rng.int(0, 3);
  for (let i = 0; i < count; i++) {
    const key = rng.weighted(PROP_KEYS, PROP_WEIGHTS);
    out.push({
      sprite: props.get(key),
      x: cx * PROP_CELL + rng.range(0, PROP_CELL),
      y: cy * PROP_CELL + rng.range(0, PROP_CELL),
      scale: rng.range(0.7, 1.35),
      rot: key === 'grass' || key === 'shroom' ? 0 : rng.range(0, Math.PI * 2),
      alpha: rng.range(0.55, 0.95),
    });
  }
}
