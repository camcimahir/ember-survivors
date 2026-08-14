/**
 * Renderer.
 *
 * Draws the world to a 2D canvas. All sprites are pre-rasterised (see
 * engine/sprites.ts), so this file is mostly transform + blit. Animation —
 * squash, bob, lean, flash — is applied here rather than baked into frames.
 */

import { clamp, TAU } from '../engine/math';
import { drawSprite, type Sprite } from '../engine/sprites';
import { actors } from '../art/actors';
import { fx, type FxKey } from '../art/fx';
import { getGroundPattern, PROP_CELL, propsForCell, type PropInstance } from '../art/env';
import { withAlpha } from '../art/draw';
import { PALETTE } from '../art/style';
import { BulletFlag, type Enemy } from './types';
import type { World } from './world';
import type { Input } from '../engine/input';

/** Sprite key per mob kind, resolved once. */
const MOB_ART = {
  crawler: 'crawler',
  runner: 'runner',
  brute: 'brute',
  spitter: 'spitter',
  dasher: 'dasher',
  bomber: 'bomber',
  splitter: 'splitter',
  wraith: 'wraith',
  shielded: 'shielded',
  boss: 'boss',
} as const;

/** Reused scratch array so prop gathering never allocates per frame. */
const propScratch: PropInstance[] = [];

/**
 * The hero is drawn slightly larger than its sprite box. A full-body figure
 * reads smaller than the blob mobs, which fill their frame edge to edge, so
 * without this the player gets visually lost in a crowd.
 */
const HERO_SCALE = 1.18;

/**
 * How many world units we aim to show across the screen's width.
 *
 * Zoom is derived from this rather than being a fixed scale, so a narrow phone
 * and a wide tablet see the same amount of the arena instead of the tablet
 * getting a free tactical advantage. Raise it to zoom out further.
 */
const DESIGN_VIEW_WIDTH = 540;

/** Zoom is clamped so extreme viewports stay sane. */
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.25;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** Viewport size in CSS pixels. */
  w = 0;
  h = 0;
  /** World-units-to-CSS-pixels scale. Below 1 means zoomed out. */
  zoom = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  /** Visible world size in world units — what the sim needs for spawn margins. */
  get worldW(): number {
    return this.w / this.zoom;
  }

  get worldH(): number {
    return this.h / this.zoom;
  }

  resize(dpr: number): void {
    this.dpr = dpr;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.zoom = clamp(w / DESIGN_VIEW_WIDTH, MIN_ZOOM, MAX_ZOOM);
  }

  /** Overrides the derived zoom. Used by the debug API for tuning by eye. */
  setZoom(z: number): void {
    this.zoom = clamp(z, 0.25, 3);
  }

  /* ------------------------------------------------------------------ draw */

  render(world: World, input: Input, alpha: number): void {
    const ctx = this.ctx;
    const cam = world.camera;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const camX = cam.renderX;
    const camY = cam.renderY;

    ctx.save();
    // World transform: put the camera at the screen centre, then scale about
    // that centre. Everything drawn until the matching restore() is in world
    // space; the HUD, vignette and joystick are drawn after it in screen space.
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-camX, -camY);

    this.drawGround(ctx, camX, camY);
    this.drawProps(ctx, camX, camY);
    this.drawZones(ctx, world);
    this.drawPickups(ctx, world);
    this.drawEnemies(ctx, world);
    this.drawPlayer(ctx, world, alpha);
    this.drawBullets(ctx, world);
    this.drawParticles(ctx, world);

    ctx.restore();

    this.drawVignette(ctx, world);
    this.drawJoystick(ctx, input);
  }

  /* ---------------------------------------------------------------- ground */

  private drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    // This fill also serves as the frame clear (the context is alpha:false and
    // nothing else covers the screen), so it must span the whole viewport with
    // a margin to spare — any gap would smear the previous frame.
    const halfW = this.worldW / 2 + 4;
    const halfH = this.worldH / 2 + 4;
    const pattern = getGroundPattern(ctx);
    ctx.save();
    ctx.fillStyle = pattern ?? '#1b2a3d';
    ctx.fillRect(camX - halfW, camY - halfH, halfW * 2, halfH * 2);
    ctx.restore();
  }

  private drawProps(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    propScratch.length = 0;
    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;
    const c0x = Math.floor((camX - halfW) / PROP_CELL);
    const c1x = Math.floor((camX + halfW) / PROP_CELL);
    const c0y = Math.floor((camY - halfH) / PROP_CELL);
    const c1y = Math.floor((camY + halfH) / PROP_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) propsForCell(cx, cy, propScratch);
    }
    for (const p of propScratch) {
      drawSprite(ctx, p.sprite, p.x, p.y, p.rot, p.scale, p.alpha);
    }
  }

  /* ----------------------------------------------------------------- zones */

  private drawZones(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const zs = world.zones.items;
    for (let i = 0; i < world.zones.count; i++) {
      const z = zs[i];
      if (!z.alive) continue;
      const sp = fx.get(z.art as FxKey);
      // Fade out over the last 25% of the zone's life.
      const fade = clamp(z.life / (z.maxLife * 0.25), 0, 1);
      const pulse = 1 + Math.sin(z.life * 7) * 0.03;
      drawSprite(ctx, sp, z.x, z.y, 0, ((z.radius * 2) / sp.size) * pulse, 0.85 * fade);
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------- pickups */

  private drawPickups(ctx: CanvasRenderingContext2D, world: World): void {
    const ps = world.pickups.items;
    for (let i = 0; i < world.pickups.count; i++) {
      const k = ps[i];
      if (!k.alive) continue;
      const bob = Math.sin(k.phase) * 2.5;
      let sprite: Sprite;
      switch (k.kind) {
        case 'xp':
          sprite = actors.get(k.value >= 8 ? 'xpLarge' : k.value >= 3 ? 'xpMed' : 'xpSmall');
          break;
        case 'heart':
          sprite = actors.get('heart');
          break;
        case 'magnet':
          sprite = actors.get('magnet');
          break;
        case 'bomb':
          sprite = actors.get('bombPickup');
          break;
        default:
          sprite = actors.get('heart');
      }
      const s = k.kind === 'chest' ? 1.5 : 1;
      // Fresh drops pop in with a quick scale-up.
      const pop = k.life < 0.2 ? 0.5 + (k.life / 0.2) * 0.5 : 1;
      drawSprite(ctx, sprite, k.x, k.y + bob, 0, s * pop);
    }
  }

  /* --------------------------------------------------------------- enemies */

  private drawEnemies(ctx: CanvasRenderingContext2D, world: World): void {
    const es = world.enemies.items;
    for (let i = 0; i < world.enemies.count; i++) {
      const e = es[i];
      if (!e.alive) continue;

      const sprite = actors.get(MOB_ART[e.kind]);
      const moving = Math.abs(e.vx) + Math.abs(e.vy) > 8;

      // Squash/stretch bob: the whole crowd feels alive from one sine.
      const bob = moving ? Math.sin(e.phase * 9) : Math.sin(e.phase * 2.4) * 0.35;
      let sx = e.scale * (1 + bob * 0.06);
      let sy = e.scale * (1 - bob * 0.06);

      // Dashers visibly crouch during wind-up, which is the tell.
      if (e.kind === 'dasher' && e.state === 1) {
        sx *= 1.18;
        sy *= 0.82;
      }
      // Bombers inflate before detonating.
      if (e.kind === 'bomber' && e.state === 1) {
        const t = 1 + (0.75 - e.t1) * 0.7;
        sx *= t;
        sy *= t;
      }

      const st = e.st;

      if (e.elite) {
        const aura = actors.get('eliteAura');
        drawSprite(ctx, aura, e.x, e.y, world.time * 1.2, (e.radius * 2.9) / aura.size, 0.75);
      }

      ctx.save();
      ctx.translate(e.x, e.y);
      // Horizontal flip to face the player. Scale is applied via the transform
      // so the sprite blit itself stays a plain drawImage.
      ctx.scale(e.face * sx, sy);

      // Status tints, layered by priority: frozen reads over everything.
      if (st.frozenT > 0) ctx.filter = 'brightness(1.15) saturate(0.4) hue-rotate(160deg)';
      else if (e.hitFlash > 0) ctx.filter = 'brightness(2.6) saturate(0.3)';
      else if (st.burnT > 0) ctx.filter = 'brightness(1.2) sepia(0.35) saturate(1.5) hue-rotate(-18deg)';
      else if (st.poisonT > 0) ctx.filter = 'brightness(1.05) hue-rotate(58deg) saturate(1.3)';
      else if (st.markT > 0) ctx.filter = 'brightness(1.05) hue-rotate(-40deg) saturate(1.25)';

      drawSprite(ctx, sprite, 0, 0, 0, 1);
      ctx.restore();

      // Frozen shell
      if (st.frozenT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = PALETTE.frost.light;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 1.35, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // Shock arcs
      if (st.shockT > 0) {
        ctx.save();
        ctx.strokeStyle = PALETTE.storm.light;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        for (let k = 0; k < 2; k++) {
          const a = world.time * 30 + k * 2 + e.uid;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius);
          ctx.lineTo(e.x + Math.cos(a + 1.4) * e.radius * 1.5, e.y + Math.sin(a + 1.4) * e.radius * 1.5);
          ctx.stroke();
        }
        ctx.restore();
      }
      // Root vines
      if (st.rootT > 0) {
        ctx.save();
        ctx.strokeStyle = PALETTE.verdant.base;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + e.uid;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * e.radius * 1.2, e.y + e.radius * 0.6);
          ctx.quadraticCurveTo(e.x + Math.cos(a) * e.radius * 0.5, e.y, e.x, e.y - e.radius * 0.3);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Health bar: only for things that survive more than a couple of hits.
      const showBar = e.kind === 'boss' || e.elite || (e.maxHp > 60 && e.hp < e.maxHp);
      if (showBar && e.kind !== 'boss') {
        const bw = e.radius * 2.1;
        // Kept at a constant on-screen thickness; a 4px bar would thin out to
        // near-invisible once the camera is pulled back.
        const bh = 4 / this.zoom;
        const by = e.y - e.radius * (e.kind === 'brute' ? 1.5 : 1.7) - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - bw / 2, by, bw, bh);
        ctx.fillStyle = e.elite ? '#ffcc55' : '#ff5566';
        ctx.fillRect(e.x - bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
      }
    }
  }

  /* ---------------------------------------------------------------- player */

  private drawPlayer(ctx: CanvasRenderingContext2D, world: World, _alpha: number): void {
    const p = world.player;
    if (!p.alive) return;

    const hero = actors.get('hero');
    const gun = actors.get('gun');
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > 6;
    const bob = moving ? Math.sin(p.phase) : Math.sin(p.phase * 0.6) * 0.3;
    const lean = moving ? Math.sin(p.phase) * 0.045 : 0;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 30, 23, 8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Invulnerability blink after a hit.
    const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 ? 0.42 : 1;

    // Gun, drawn behind the body when aiming upward so it doesn't cover the face.
    const aimUp = Math.sin(p.aim) < -0.25;
    const gx = p.x + Math.cos(p.aim) * 15;
    const gy = p.y + Math.sin(p.aim) * 10 + 6;
    const drawGun = (): void => {
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(p.aim);
      // Flip the gun sprite vertically when aiming left so it isn't upside down.
      if (Math.cos(p.aim) < 0) ctx.scale(1, -1);
      ctx.globalAlpha = blink;
      const gs = gun.size * HERO_SCALE;
      ctx.drawImage(gun.canvas, -gs / 2, -gs / 2, gs, gs);
      ctx.restore();
    };

    if (aimUp) drawGun();

    ctx.save();
    ctx.translate(p.x, p.y + bob * 1.6);
    ctx.rotate(lean);
    ctx.scale(p.face, 1);
    if (p.hitFlash > 0) ctx.filter = 'brightness(2.4) saturate(0.4)';
    ctx.globalAlpha = blink;
    const hs = hero.size * HERO_SCALE;
    ctx.drawImage(hero.canvas, -hs / 2, -hs / 2, hs, hs);
    ctx.restore();

    if (!aimUp) drawGun();

    // Dash streak
    if (p.dashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.dashT / 0.16;
      ctx.fillStyle = PALETTE.storm.glow;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 34, 22, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* --------------------------------------------------------------- bullets */

  private drawBullets(ctx: CanvasRenderingContext2D, world: World): void {
    const bs = world.bullets.items;
    for (let i = 0; i < world.bullets.count; i++) {
      const b = bs[i];
      if (!b.alive) continue;
      const sp = fx.get(b.art as FxKey);
      const scale = (b.radius * 2.6) / sp.size;
      const additive = (b.flags & BulletFlag.Hostile) === 0 && b.art !== 'sawblade' && b.art !== 'chakram';

      if (additive) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawSprite(ctx, sp, b.x, b.y, b.rot, scale);
        ctx.restore();
      } else {
        drawSprite(ctx, sp, b.x, b.y, b.rot, scale);
      }
    }
  }

  /* ------------------------------------------------------------- particles */

  private drawParticles(ctx: CanvasRenderingContext2D, world: World): void {
    const ps = world.particles.items;

    // Two passes so we only toggle the composite mode twice per frame.
    for (let pass = 0; pass < 2; pass++) {
      const additive = pass === 1;
      ctx.save();
      if (additive) ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < world.particles.count; i++) {
        const q = ps[i];
        if (!q.alive || q.additive !== additive) continue;
        const t = 1 - q.life / q.maxLife;
        const size = q.size + (q.endSize - q.size) * t;
        const fade = q.shape === 'text' ? clamp(q.life / (q.maxLife * 0.4), 0, 1) : q.life / q.maxLife;

        switch (q.shape) {
          case 'spark': {
            ctx.globalAlpha = fade;
            ctx.strokeStyle = q.color;
            ctx.lineWidth = Math.max(1, size * 0.5);
            ctx.lineCap = 'round';
            const len = Math.min(18, Math.hypot(q.vx, q.vy) * 0.035);
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x - Math.cos(q.rot) * len, q.y - Math.sin(q.rot) * len);
            ctx.stroke();
            break;
          }
          case 'puff': {
            ctx.globalAlpha = fade * 0.85;
            ctx.save();
            // A tinted radial fill is cheaper than blitting and re-tinting a
            // cached puff sprite, and it lets every element keep its own hue.
            ctx.translate(q.x, q.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, size));
            g.addColorStop(0, withAlpha(q.color, 0.75));
            g.addColorStop(0.6, withAlpha(q.color, 0.25));
            g.addColorStop(1, withAlpha(q.color, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, size), 0, TAU);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'ring': {
            ctx.globalAlpha = fade * 0.9;
            ctx.strokeStyle = q.color;
            ctx.lineWidth = Math.max(1.5, 8 * fade);
            ctx.beginPath();
            ctx.arc(q.x, q.y, Math.max(1, size), 0, TAU);
            ctx.stroke();
            break;
          }
          case 'shard': {
            ctx.globalAlpha = fade;
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(q.rot);
            ctx.fillStyle = q.color;
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.45, size * 0.6);
            ctx.lineTo(-size * 0.45, size * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'slash': {
            ctx.globalAlpha = fade;
            const spr = fx.get('slashVerdant');
            drawSprite(ctx, spr, q.x, q.y, q.rot, (size * 2) / spr.size, fade);
            break;
          }
          case 'bolt': {
            // vx/vy carry the endpoint; rot===1 marks a solid beam.
            ctx.globalAlpha = fade;
            ctx.strokeStyle = q.color;
            ctx.lineCap = 'round';
            if (q.rot === 1) {
              ctx.lineWidth = size * fade;
              ctx.beginPath();
              ctx.moveTo(q.x, q.y);
              ctx.lineTo(q.vx, q.vy);
              ctx.stroke();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = Math.max(1, size * 0.35 * fade);
              ctx.stroke();
            } else {
              ctx.lineWidth = 3.2;
              this.strokeJaggedLine(ctx, q.x, q.y, q.vx, q.vy, 5);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.4;
              this.strokeJaggedLine(ctx, q.x, q.y, q.vx, q.vy, 5);
            }
            break;
          }
          case 'text': {
            // Divided by zoom so damage numbers keep a constant on-screen size
            // however far the camera is pulled back — they are UI, not scenery.
            ctx.globalAlpha = fade;
            const px = size / this.zoom;
            ctx.font = `bold ${px}px "Trebuchet MS", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3.5 / this.zoom;
            ctx.strokeStyle = 'rgba(10,12,20,0.85)';
            ctx.strokeText(q.text, q.x, q.y);
            ctx.fillStyle = q.color;
            ctx.fillText(q.text, q.x, q.y);
            break;
          }
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Draws a lightning-style polyline between two points. */
  private strokeJaggedLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    segments: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      // Deterministic jitter from a cheap hash keeps bolts stable per frame.
      const h = Math.sin(i * 12.9898 + x0 * 0.01 + y0 * 0.017) * 43758.5453;
      const j = (h - Math.floor(h) - 0.5) * len * 0.16 * Math.sin(t * Math.PI);
      ctx.lineTo(x0 + dx * t + nx * j, y0 + dy * t + ny * j);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  /* --------------------------------------------------------------- overlay */

  private drawVignette(ctx: CanvasRenderingContext2D, world: World): void {
    const p = world.player;
    const hurt = clamp(1 - p.hp / (world.stats.maxHp * 0.35), 0, 1);
    if (hurt <= 0.01) return;
    ctx.save();
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      Math.min(this.w, this.h) * 0.28,
      this.w / 2,
      this.h / 2,
      Math.max(this.w, this.h) * 0.72,
    );
    g.addColorStop(0, 'rgba(180,20,40,0)');
    // Pulses faster as health drops — a readable "you are about to die" signal.
    const pulse = 0.22 + Math.sin(world.time * (4 + hurt * 6)) * 0.08;
    g.addColorStop(1, `rgba(180,20,40,${(0.3 + pulse) * hurt})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  private drawJoystick(ctx: CanvasRenderingContext2D, input: Input): void {
    if (!input.active) return;
    const r = input.stickRadius;
    ctx.save();
    ctx.globalAlpha = 0.34;

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#cfe0ff';
    ctx.beginPath();
    ctx.arc(input.originX, input.originY, r, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = '#0d1424';
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(input.originX, input.originY, r, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath();
    ctx.arc(input.knobX, input.knobY, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8fa8cc';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

/** Bosses need their own big bar; the HUD owns it, this just exposes the data. */
export function bossHealthFraction(e: Enemy | null): number {
  if (!e || !e.alive) return 0;
  return clamp(e.hp / e.maxHp, 0, 1);
}
