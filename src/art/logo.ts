/**
 * Title logo, drawn to a canvas so it gets the same chunky treatment as the
 * rest of the art: deep drop shadow, gold gradient fill, heavy dark outline,
 * and a couple of ember sparks.
 */

import { flamePath, withAlpha, type Ctx } from './draw';
import { PALETTE } from './style';

const W = 720;
const H = 260;

function drawWord(
  ctx: Ctx,
  text: string,
  cx: number,
  cy: number,
  size: number,
  letterSpacing: number,
): void {
  ctx.font = `900 ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Manual letter spacing: canvas letterSpacing is not universally supported.
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
  let x = cx - total / 2;

  const paint = (fn: (c: string, px: number) => void): void => {
    let cur = x;
    for (let i = 0; i < chars.length; i++) {
      fn(chars[i], cur + widths[i] / 2);
      cur += widths[i] + letterSpacing;
    }
  };

  // Drop shadow slab
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  paint((c, px) => ctx.fillText(c, px, cy + size * 0.09));

  // Heavy outline
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141527';
  ctx.lineWidth = size * 0.2;
  paint((c, px) => ctx.strokeText(c, px, cy));

  // Gold gradient face
  const g = ctx.createLinearGradient(0, cy - size * 0.6, 0, cy + size * 0.6);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.42, '#ffc94a');
  g.addColorStop(0.62, '#f59a26');
  g.addColorStop(1, '#c96a18');
  ctx.fillStyle = g;
  paint((c, px) => ctx.fillText(c, px, cy));

  // Top sheen
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cy - size * 0.62, W, size * 0.42);
  ctx.clip();
  ctx.fillStyle = withAlpha('#ffffff', 0.34);
  paint((c, px) => ctx.fillText(c, px, cy));
  ctx.restore();
}

function drawLogo(ctx: Ctx): void {
  // Ember glow behind the title.
  const g = ctx.createRadialGradient(W / 2, H * 0.46, 10, W / 2, H * 0.46, W * 0.44);
  g.addColorStop(0, withAlpha(PALETTE.fire.base, 0.4));
  g.addColorStop(0.55, withAlpha(PALETTE.fire.dark, 0.16));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  drawWord(ctx, 'EMBER', W / 2, H * 0.34, 96, 6);
  drawWord(ctx, 'SURVIVORS', W / 2, H * 0.72, 66, 8);

  // Two little flames flanking the lower word.
  for (const side of [-1, 1]) {
    const fx0 = W / 2 + side * 268;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = PALETTE.fire.dark;
    flamePath(ctx, fx0, H * 0.72, 34, 62);
    ctx.fill();
    ctx.fillStyle = PALETTE.fire.base;
    flamePath(ctx, fx0, H * 0.735, 24, 46);
    ctx.fill();
    ctx.fillStyle = PALETTE.fire.light;
    flamePath(ctx, fx0, H * 0.75, 13, 26);
    ctx.fill();
    ctx.restore();
  }
}

let cached: HTMLCanvasElement | null = null;

/** Returns the title logo canvas, built once. */
export function logoCanvas(): HTMLCanvasElement {
  if (cached) return cached;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  c.style.width = '100%';
  c.style.height = 'auto';
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawLogo(ctx);
  cached = c;
  return c;
}
