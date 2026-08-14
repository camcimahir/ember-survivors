/**
 * Procedural drawing primitives — the "shape language" of the game's art.
 *
 * Everything visible is composed from these functions. They encode the style
 * rules from `style.ts` (bold outline, top-light, single specular) so that any
 * new sprite automatically matches the existing set.
 */

import { Rng } from '../engine/rng';
import { LIGHT_X, LIGHT_Y, OUTLINE, OUTLINE_W, type Ramp } from './style';

export type Ctx = CanvasRenderingContext2D;
export type PathFn = (ctx: Ctx) => void;

/* --------------------------------------------------------------- paths --- */

/**
 * An organic closed blob: a circle whose radius wobbles smoothly. Seeded so the
 * same creature always draws the same silhouette.
 */
export function blobPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  wobble = 0.14,
  seed = 1,
  points = 9,
): void {
  const rng = new Rng(seed);
  const radii: number[] = [];
  for (let i = 0; i < points; i++) radii.push(r * (1 + rng.range(-wobble, wobble)));

  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const i0 = (i - 1 + points) % points;
    const i1 = i % points;
    const a0 = ((i - 1) / points) * Math.PI * 2;
    const a1 = (i / points) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radii[i0];
    const y0 = cy + Math.sin(a0) * radii[i0];
    const x1 = cx + Math.cos(a1) * radii[i1];
    const y1 = cy + Math.sin(a1) * radii[i1];
    if (i === 0) {
      ctx.moveTo(x1, y1);
      continue;
    }
    // Quadratic through the midpoint keeps the outline smooth (no corners).
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const ca = (a0 + a1) / 2;
    const cr = ((radii[i0] + radii[i1]) / 2) * 1.06;
    ctx.quadraticCurveTo(cx + Math.cos(ca) * cr, cy + Math.sin(ca) * cr, mx, my);
    ctx.lineTo(x1, y1);
  }
  ctx.closePath();
}

/** A capsule / rounded rectangle centred on (cx, cy). */
export function roundRectPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Regular polygon with rounded corners. */
export function polyPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rot = 0,
  round = 0.18,
): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  roundedPolyFromPoints(ctx, pts, r * round);
}

/** Star with alternating outer/inner radii. */
export function starPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  points: number,
  rot = 0,
  round = 0.12,
): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  roundedPolyFromPoints(ctx, pts, rOuter * round);
}

/** Builds a closed path through `pts`, rounding each corner by `radius`. */
export function roundedPolyFromPoints(
  ctx: Ctx,
  pts: Array<[number, number]>,
  radius: number,
): void {
  const n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];

    const v1x = cur[0] - prev[0];
    const v1y = cur[1] - prev[1];
    const v2x = next[0] - cur[0];
    const v2y = next[1] - cur[1];
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);

    const ax = cur[0] - (v1x / l1) * r;
    const ay = cur[1] - (v1y / l1) * r;
    const bx = cur[0] + (v2x / l2) * r;
    const by = cur[1] + (v2y / l2) * r;

    if (i === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(cur[0], cur[1], bx, by);
  }
  ctx.closePath();
}

/** A teardrop / flame silhouette pointing up, centred on (cx, cy). */
export function flamePath(ctx: Ctx, cx: number, cy: number, w: number, h: number): void {
  const top = cy - h / 2;
  const bot = cy + h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + w * 0.55, top + h * 0.3, cx + w * 0.5, bot - h * 0.18, cx, bot);
  ctx.bezierCurveTo(cx - w * 0.5, bot - h * 0.18, cx - w * 0.55, top + h * 0.3, cx, top);
  ctx.closePath();
}

/** A pointed leaf along the +x axis, rooted at (cx, cy). */
export function leafPath(ctx: Ctx, cx: number, cy: number, len: number, width: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx + len * 0.4, cy - width, cx + len, cy);
  ctx.quadraticCurveTo(cx + len * 0.4, cy + width, cx, cy);
  ctx.closePath();
}

/** A jagged lightning bolt from (x0,y0) to (x1,y1) as a stroked path. */
export function boltPath(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  segments = 5,
  jitter = 0.22,
  seed = 7,
): void {
  const rng = new Rng(seed);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    // Taper the jitter toward both ends so the bolt still reads as a line.
    const amp = Math.sin(t * Math.PI) * jitter * len;
    const off = rng.range(-amp, amp);
    ctx.lineTo(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
  }
  ctx.lineTo(x1, y1);
}

/** Circular-saw silhouette: a disc with `teeth` swept cutouts. */
export function sawPath(ctx: Ctx, cx: number, cy: number, r: number, teeth = 8): void {
  const inner = r * 0.78;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.42) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.62) / teeth) * Math.PI * 2;
    pts.push([cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner]);
    pts.push([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
    pts.push([cx + Math.cos(a2) * inner, cy + Math.sin(a2) * inner]);
  }
  roundedPolyFromPoints(ctx, pts, r * 0.05);
}

/** Crystal shard pointing up. */
export function shardPath(ctx: Ctx, cx: number, cy: number, w: number, h: number): void {
  roundedPolyFromPoints(
    ctx,
    [
      [cx, cy - h / 2],
      [cx + w / 2, cy - h * 0.1],
      [cx + w * 0.3, cy + h / 2],
      [cx - w * 0.3, cy + h / 2],
      [cx - w / 2, cy - h * 0.1],
    ],
    w * 0.08,
  );
}

/* --------------------------------------------------------------- style --- */

export interface ShadeOpts {
  /** Outline width, in sprite units. Defaults to size * OUTLINE_W. */
  outline?: number;
  outlineColor?: string;
  /** 0 disables the specular highlight. */
  specular?: number;
  /** Radius hint used to place the gradient; defaults to size/2. */
  radius?: number;
  /** Centre used to place the gradient; defaults to sprite centre. */
  cx?: number;
  cy?: number;
  /** Skip the outline entirely (for inner details). */
  noOutline?: boolean;
  /** Flat fill with no gradient. */
  flat?: boolean;
}

/**
 * The core styling routine: strokes a bold outline behind `path`, fills it with
 * a top-lit gradient built from `ramp`, then lays a soft specular over it.
 *
 * `size` is the sprite's logical edge length and drives outline thickness, which
 * is what keeps small and large sprites visually consistent.
 */
export function shaded(
  ctx: Ctx,
  size: number,
  path: PathFn,
  ramp: Ramp,
  opts: ShadeOpts = {},
): void {
  const cx = opts.cx ?? size / 2;
  const cy = opts.cy ?? size / 2;
  const r = opts.radius ?? size / 2;
  const ow = opts.outline ?? size * OUTLINE_W;

  if (!opts.noOutline) {
    ctx.save();
    ctx.strokeStyle = opts.outlineColor ?? OUTLINE;
    ctx.lineWidth = ow;
    ctx.lineJoin = 'round';
    path(ctx);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (opts.flat) {
    ctx.fillStyle = ramp.base;
  } else {
    const g = ctx.createRadialGradient(
      cx + LIGHT_X * r,
      cy + LIGHT_Y * r,
      r * 0.08,
      cx,
      cy,
      r * 1.25,
    );
    g.addColorStop(0, ramp.light);
    g.addColorStop(0.42, ramp.base);
    g.addColorStop(1, ramp.dark);
    ctx.fillStyle = g;
  }
  path(ctx);
  ctx.fill();
  ctx.restore();

  const spec = opts.specular ?? 1;
  if (spec > 0) {
    ctx.save();
    path(ctx);
    ctx.clip();
    const sx = cx + LIGHT_X * r * 1.15;
    const sy = cy + LIGHT_Y * r * 1.15;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.78);
    sg.addColorStop(0, `rgba(255,255,255,${0.5 * spec})`);
    sg.addColorStop(0.5, `rgba(255,255,255,${0.12 * spec})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
    ctx.restore();
  }
}

/** Fills a path with a flat colour and the standard outline. */
export function outlined(
  ctx: Ctx,
  path: PathFn,
  fill: string,
  outlineWidth: number,
  outlineColor = OUTLINE,
): void {
  ctx.save();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.lineJoin = 'round';
  path(ctx);
  ctx.stroke();
  ctx.fillStyle = fill;
  path(ctx);
  ctx.fill();
  ctx.restore();
}

/* --------------------------------------------------------------- parts --- */

/**
 * A pair of cartoon eyes. `angry` tilts the lids inward, which is the single
 * cheapest way to make a friendly blob read as an enemy.
 */
export function eyes(
  ctx: Ctx,
  cx: number,
  cy: number,
  spacing: number,
  r: number,
  opts: {
    angry?: number;
    pupil?: string;
    sclera?: string;
    look?: [number, number];
    outline?: number;
    glow?: string;
  } = {},
): void {
  const sclera = opts.sclera ?? '#fff6e8';
  const pupil = opts.pupil ?? '#1a1424';
  const lx = (opts.look?.[0] ?? 0) * r * 0.32;
  const ly = (opts.look?.[1] ?? 0) * r * 0.32;
  const ow = opts.outline ?? r * 0.28;

  for (const s of [-1, 1]) {
    const ex = cx + s * spacing;

    if (opts.glow) {
      ctx.save();
      ctx.fillStyle = opts.glow;
      ctx.globalAlpha = 0.5;
      ctx.filter = `blur(${r * 0.5}px)`;
      ctx.beginPath();
      ctx.ellipse(ex, cy, r * 1.5, r * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sclera
    ctx.save();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = ow;
    ctx.beginPath();
    ctx.ellipse(ex, cy, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = sclera;
    ctx.fill();

    // Pupil
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.ellipse(ex + lx, cy + ly, r * 0.44, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Catchlight — sells the glossy cartoon look.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(ex + lx - r * 0.16, cy + ly - r * 0.22, r * 0.14, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Angry brow: a wedge clipped over the top-inner edge of the eye.
    const angry = opts.angry ?? 0;
    if (angry > 0) {
      ctx.save();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      const inner = ex - s * r * 1.15;
      const outer = ex + s * r * 1.15;
      ctx.moveTo(inner, cy - r * (1.5 - angry * 0.85));
      ctx.lineTo(outer, cy - r * 1.55);
      ctx.lineTo(outer, cy - r * 2.1);
      ctx.lineTo(inner, cy - r * 2.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

/** A simple toothy grin arc. */
export function fangs(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  count = 4,
  color = '#fff6e8',
): void {
  ctx.save();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.quadraticCurveTo(cx, cy + h * 1.5, cx + w / 2, cy);
  ctx.closePath();
  ctx.fill();

  ctx.clip();
  ctx.fillStyle = color;
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const x = cx - w / 2 + step * i;
    ctx.beginPath();
    ctx.moveTo(x, cy - h);
    ctx.lineTo(x + step, cy - h);
    ctx.lineTo(x + step / 2, cy + h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Soft radial glow, used for auras, muzzle flashes and pickups. */
export function glow(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  strength = 0.55,
): void {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, withAlpha(color, strength));
  g.addColorStop(0.45, withAlpha(color, strength * 0.35));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Ground shadow ellipse under an actor. */
export function dropShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.3): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* --------------------------------------------------------------- color --- */

/** Converts `#rrggbb` to `rgba()` with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Linearly mixes two hex colours; returns `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
