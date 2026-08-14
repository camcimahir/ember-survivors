/**
 * Sprite cache.
 *
 * All art in this game is *drawn in code* (see src/art/) rather than loaded
 * from image files. Re-running those vector draw calls every frame would be far
 * too slow, so each sprite is rasterised once into an offscreen canvas at
 * startup and blitted thereafter. That gives us:
 *   - resolution independence (we rasterise at the device pixel ratio),
 *   - zero binary assets in the repo,
 *   - one code path to restyle the whole game.
 */

export type DrawFn = (ctx: CanvasRenderingContext2D, size: number) => void;

/** A rasterised sprite. `size` is the logical (CSS-pixel) edge length. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  size: number;
  /** Half of `size`, precomputed — sprites are drawn centred. */
  half: number;
  scale: number;
}

let renderScale = 2;

/** Sets the rasterisation scale. Must be called before sprites are built. */
export function setSpriteScale(dpr: number): void {
  // Beyond 2x the memory cost outweighs the visual gain on phone-sized screens.
  renderScale = Math.min(2, Math.max(1, dpr));
}

export function getSpriteScale(): number {
  return renderScale;
}

/**
 * Rasterises `draw` into a `size` x `size` sprite. The draw function receives a
 * context already scaled so that (0,0)-(size,size) is the logical drawing area;
 * sprites are drawn from the top-left in that space.
 */
export function makeSprite(size: number, draw: DrawFn, padding = 0): Sprite {
  const logical = size + padding * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(logical * renderScale);
  c.height = Math.ceil(logical * renderScale);
  const ctx = c.getContext('2d')!;
  ctx.scale(renderScale, renderScale);
  ctx.translate(padding, padding);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, size);
  return { canvas: c, size: logical, half: logical / 2, scale: renderScale };
}

/**
 * Draws a cached sprite centred on (x, y) with optional rotation and scale.
 * This is the single hot blit path used by every entity renderer.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sp: Sprite,
  x: number,
  y: number,
  rot = 0,
  scale = 1,
  alpha = 1,
): void {
  if (alpha <= 0) return;
  const w = sp.size * scale;
  const h = sp.size * scale;

  // Fast path: no rotation, no transparency — a bare blit.
  if (rot === 0 && alpha === 1) {
    ctx.drawImage(sp.canvas, x - w / 2, y - h / 2, w, h);
    return;
  }

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (rot !== 0) {
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(sp.canvas, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(sp.canvas, x - w / 2, y - h / 2, w, h);
  }
  ctx.restore();
}

/**
 * Lazily-built named sprite registry. Building every sprite eagerly at boot
 * costs ~200ms on a slow phone, so sheets are built on first access instead.
 */
export class SpriteSheet<K extends string> {
  private readonly cache = new Map<K, Sprite>();
  private readonly builders: Record<K, () => Sprite>;

  constructor(builders: Record<K, () => Sprite>) {
    this.builders = builders;
  }

  get(key: K): Sprite {
    let s = this.cache.get(key);
    if (s === undefined) {
      s = this.builders[key]();
      this.cache.set(key, s);
    }
    return s;
  }

  /** Forces every sprite to build — used on the loading screen. */
  buildAll(): void {
    for (const k of Object.keys(this.builders) as K[]) this.get(k);
  }

  get keys(): K[] {
    return Object.keys(this.builders) as K[];
  }
}
