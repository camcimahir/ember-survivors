/**
 * Character and creature sprites.
 *
 * Actors are drawn in a 3/4 top-down view facing the viewer, and flipped
 * horizontally at render time to face their movement direction. Animation is
 * done in code (squash/stretch, bob, lean) rather than with frames — that keeps
 * every creature to a single rasterised sprite while still feeling alive.
 */

import { makeSprite, SpriteSheet, type Sprite } from '../engine/sprites';
import cowboyHeroUrl from '../assets/cowboy-hero.png';
import {
  blobPath,
  dropShadow,
  eyes,
  fangs,
  flamePath,
  glow,
  leafPath,
  outlined,
  polyPath,
  roundRectPath,
  shaded,
  starPath,
  withAlpha,
  type Ctx,
} from './draw';
import { ENEMY, HERO, OUTLINE, type Ramp } from './style';

/**
 * The player portrait is an imported transparent PNG rather than procedural
 * art. It is loaded before the sprite cache is built, then copied once into
 * the same small offscreen canvas used by every other actor. That means the
 * source file is never decoded or scaled during gameplay.
 */
let cowboyHeroImage: HTMLImageElement | null = null;

export function preloadActorArt(): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      cowboyHeroImage = image;
      resolve();
    };
    // Retain the procedural hero as a safe fallback if an asset ever fails to
    // load (for example, a bad manual deployment).
    image.onerror = () => resolve();
    image.src = cowboyHeroUrl;
  });
}

/* ---------------------------------------------------------------- hero --- */

/** The survivor: a chibi figure in a long coat, seen from a high 3/4 angle. */
function drawHero(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const ow = s * 0.062;

  // --- legs / boots
  for (const side of [-1, 1]) {
    outlined(
      ctx,
      (c) => roundRectPath(c, cx + side * s * 0.13, s * 0.83, s * 0.15, s * 0.16, s * 0.06),
      HERO.boot,
      ow,
    );
  }

  // --- coat: a tapered body with flared hem
  const coatRamp: Ramp = {
    dark: HERO.coatDark,
    base: HERO.coat,
    light: HERO.coatLight,
    glow: HERO.coatLight,
  };
  shaded(
    ctx,
    s,
    (c) => {
      c.beginPath();
      c.moveTo(cx - s * 0.2, s * 0.44);
      c.quadraticCurveTo(cx - s * 0.29, s * 0.66, cx - s * 0.26, s * 0.82);
      c.quadraticCurveTo(cx, s * 0.9, cx + s * 0.26, s * 0.82);
      c.quadraticCurveTo(cx + s * 0.29, s * 0.66, cx + s * 0.2, s * 0.44);
      c.closePath();
    },
    coatRamp,
    { outline: ow, cx, cy: s * 0.6, radius: s * 0.26 },
  );

  // Coat opening: a darker V down the middle.
  ctx.save();
  ctx.fillStyle = HERO.coatDark;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.055, s * 0.46);
  ctx.lineTo(cx + s * 0.055, s * 0.46);
  ctx.lineTo(cx + s * 0.035, s * 0.84);
  ctx.lineTo(cx - s * 0.035, s * 0.84);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Shoulder strap
  ctx.save();
  ctx.strokeStyle = HERO.strap;
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.17, s * 0.47);
  ctx.lineTo(cx + s * 0.14, s * 0.66);
  ctx.stroke();
  ctx.restore();

  // --- head
  shaded(
    ctx,
    s,
    (c) => {
      c.beginPath();
      c.ellipse(cx, s * 0.32, s * 0.2, s * 0.185, 0, 0, Math.PI * 2);
      c.closePath();
    },
    { dark: HERO.skinShade, base: HERO.skin, light: '#fff0dc', glow: HERO.skin },
    { outline: ow, cx, cy: s * 0.32, radius: s * 0.2 },
  );

  // --- hair: a swept fringe sitting over the top half of the head
  shaded(
    ctx,
    s,
    (c) => {
      c.beginPath();
      c.moveTo(cx - s * 0.21, s * 0.33);
      c.quadraticCurveTo(cx - s * 0.24, s * 0.1, cx, s * 0.11);
      c.quadraticCurveTo(cx + s * 0.24, s * 0.1, cx + s * 0.21, s * 0.33);
      c.quadraticCurveTo(cx + s * 0.16, s * 0.22, cx + s * 0.04, s * 0.25);
      c.quadraticCurveTo(cx - s * 0.1, s * 0.28, cx - s * 0.21, s * 0.33);
      c.closePath();
    },
    { dark: HERO.hair, base: HERO.hair, light: HERO.hairLight, glow: HERO.hairLight },
    { outline: ow, cx, cy: s * 0.2, radius: s * 0.22, specular: 0.6 },
  );

  // --- face
  eyes(ctx, cx, s * 0.36, s * 0.082, s * 0.045, {
    outline: s * 0.022,
    pupil: '#2b2338',
  });

  // Mouth: a small confident smirk.
  ctx.save();
  ctx.strokeStyle = '#b5765a';
  ctx.lineWidth = s * 0.022;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, s * 0.4, s * 0.045, 0.35, Math.PI - 0.9);
  ctx.stroke();
  ctx.restore();

  // --- hands (drawn last so they sit over the coat, holding the gun)
  for (const side of [-1, 1]) {
    outlined(
      ctx,
      (c) => {
        c.beginPath();
        c.ellipse(cx + side * s * 0.22, s * 0.6, s * 0.062, s * 0.056, 0, 0, Math.PI * 2);
        c.closePath();
      },
      HERO.skin,
      ow * 0.85,
    );
  }
}

/** Draws the provided cowboy artwork into the cached player-sprite canvas. */
function drawCowboyHero(ctx: Ctx, s: number): void {
  if (cowboyHeroImage === null) {
    drawHero(ctx, s);
    return;
  }
  ctx.drawImage(cowboyHeroImage, 0, 0, s, s);
}

/** The gun, drawn pointing along +x so it can be rotated to the aim angle. */
function drawGun(ctx: Ctx, s: number): void {
  const cy = s / 2;
  const ow = s * 0.075;
  const body: Ramp = {
    dark: HERO.gunDark,
    base: HERO.gunBody,
    light: HERO.gunLight,
    glow: HERO.gunLight,
  };

  // Stock + receiver
  shaded(ctx, s, (c) => roundRectPath(c, s * 0.36, cy, s * 0.5, s * 0.26, s * 0.09), body, {
    outline: ow,
    cx: s * 0.36,
    cy,
    radius: s * 0.25,
  });
  // Barrel
  shaded(ctx, s, (c) => roundRectPath(c, s * 0.74, cy, s * 0.4, s * 0.15, s * 0.06), body, {
    outline: ow,
    cx: s * 0.74,
    cy,
    radius: s * 0.15,
  });
  // Muzzle ring
  outlined(
    ctx,
    (c) => roundRectPath(c, s * 0.92, cy, s * 0.1, s * 0.22, s * 0.045),
    HERO.gunDark,
    ow * 0.7,
  );
  // Energy cell — the one warm accent, matching the HUD gold.
  outlined(
    ctx,
    (c) => roundRectPath(c, s * 0.32, cy + s * 0.02, s * 0.16, s * 0.1, s * 0.035),
    HERO.gunAccent,
    ow * 0.6,
  );
}

/* -------------------------------------------------------------- enemies --- */

/**
 * Shared construction for the goo-family mobs: a wobbling blob body with eyes.
 * `variant` seeds the silhouette so each mob type has its own recognisable
 * outline while still clearly belonging to the same family.
 */
function gooBody(
  ctx: Ctx,
  s: number,
  ramp: Ramp,
  opts: {
    seed?: number;
    wobble?: number;
    radius?: number;
    cy?: number;
    angry?: number;
    eyeR?: number;
    eyeSpacing?: number;
    eyeY?: number;
    eyeGlow?: string;
  } = {},
): void {
  const cx = s / 2;
  const cy = opts.cy ?? s * 0.55;
  const r = opts.radius ?? s * 0.36;
  const ow = s * 0.075;

  dropShadow(ctx, cx, s * 0.93, r * 0.85, r * 0.24, 0.28);

  shaded(ctx, s, (c) => blobPath(c, cx, cy, r, opts.wobble ?? 0.1, opts.seed ?? 3, 9), ramp, {
    outline: ow,
    cx,
    cy,
    radius: r,
  });

  eyes(ctx, cx, opts.eyeY ?? cy - r * 0.12, opts.eyeSpacing ?? r * 0.42, opts.eyeR ?? r * 0.26, {
    angry: opts.angry ?? 0.8,
    outline: s * 0.026,
    glow: opts.eyeGlow,
  });
}

/** Crawler — the basic swarm unit. Small, fast, harmless alone. */
function drawCrawler(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.56;
  const r = s * 0.33;

  // Little legs poking out from under the body.
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const x = cx + side * (r * 0.5 + i * r * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, cy + r * 0.5);
      ctx.lineTo(x + side * r * 0.18, s * 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();

  gooBody(ctx, s, ENEMY.goo, { seed: 11, radius: r, cy, angry: 0.7 });
  fangs(ctx, cx, cy + r * 0.42, r * 0.5, r * 0.16, 3);
}

/** Runner — leaner, faster, marked with a speed streak. */
function drawRunner(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.56;
  const r = s * 0.3;
  gooBody(ctx, s, ENEMY.gooAlt, {
    seed: 23,
    radius: r,
    cy,
    wobble: 0.16,
    angry: 0.95,
    eyeR: r * 0.22,
  });
  // Swept fin: reads as motion even when the sprite is still.
  ctx.save();
  ctx.fillStyle = ENEMY.gooAlt.light;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.1, cy - r * 0.95);
  ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 1.5, cx + r * 0.95, cy - r * 0.5);
  ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.75, cx - r * 0.1, cy - r * 0.95);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/** Brute — big, slow, armoured shoulders. */
function drawBrute(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.55;
  const r = s * 0.38;

  gooBody(ctx, s, ENEMY.brute, {
    seed: 41,
    radius: r,
    cy,
    wobble: 0.07,
    angry: 1,
    eyeR: r * 0.2,
    eyeSpacing: r * 0.38,
  });

  // Bony shoulder plates
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * r * 0.82, cy - r * 0.28);
    ctx.scale(side, 1);
    outlined(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(0, -r * 0.35);
        c.quadraticCurveTo(r * 0.45, -r * 0.3, r * 0.4, r * 0.25);
        c.quadraticCurveTo(r * 0.1, r * 0.42, -r * 0.1, r * 0.3);
        c.closePath();
      },
      '#e8d3ad',
      s * 0.055,
    );
    ctx.restore();
  }

  fangs(ctx, cx, cy + r * 0.4, r * 0.72, r * 0.22, 5);
}

/** Spitter — ranged mob with a bulbous acid sac. */
function drawSpitter(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.58;
  const r = s * 0.32;

  // Acid sac behind the body
  ctx.save();
  ctx.globalAlpha = 0.9;
  shaded(
    ctx,
    s,
    (c) => {
      c.beginPath();
      c.ellipse(cx, cy - r * 0.85, r * 0.55, r * 0.5, 0, 0, Math.PI * 2);
      c.closePath();
    },
    ENEMY.spitter,
    { outline: s * 0.06, cx, cy: cy - r * 0.85, radius: r * 0.55 },
  );
  ctx.restore();

  gooBody(ctx, s, ENEMY.spitter, { seed: 67, radius: r, cy, angry: 0.5, eyeR: r * 0.24 });

  // Puckered spitting mouth
  outlined(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(cx, cy + r * 0.45, r * 0.22, r * 0.16, 0, 0, Math.PI * 2);
      c.closePath();
    },
    '#2c3a10',
    s * 0.04,
  );
}

/** Dasher — telegraphs a charge attack with swept spines. */
function drawDasher(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.56;
  const r = s * 0.31;

  // Trailing spines
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const y = cy - r * 0.5 + i * r * 0.5;
    outlined(
      ctx,
      (c) => leafPath(c, cx - r * 0.6, y, -r * 0.75, r * 0.2),
      ENEMY.dasher.light,
      s * 0.045,
    );
  }
  ctx.restore();

  gooBody(ctx, s, ENEMY.dasher, {
    seed: 89,
    radius: r,
    cy,
    wobble: 0.06,
    angry: 1,
    eyeR: r * 0.2,
    eyeGlow: ENEMY.dasher.glow,
  });

  // Horn
  outlined(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(cx, cy - r * 1.5);
      c.lineTo(cx + r * 0.22, cy - r * 0.85);
      c.lineTo(cx - r * 0.22, cy - r * 0.85);
      c.closePath();
    },
    '#dff7f8',
    s * 0.05,
  );
}

/** Bomber — round, lit fuse, about to go off. */
function drawBomber(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.58;
  const r = s * 0.33;

  gooBody(ctx, s, ENEMY.bomber, {
    seed: 101,
    radius: r,
    cy,
    wobble: 0.04,
    angry: 0.3,
    eyeR: r * 0.27,
  });

  // Fuse + spark
  ctx.save();
  ctx.strokeStyle = '#4a3a1a';
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.95);
  ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 1.45, cx + r * 0.12, cy - r * 1.75);
  ctx.stroke();
  ctx.restore();
  glow(ctx, cx + r * 0.12, cy - r * 1.78, r * 0.55, '#ffdf6a', 0.95);
  outlined(
    ctx,
    (c) => {
      c.beginPath();
      c.arc(cx + r * 0.12, cy - r * 1.78, r * 0.14, 0, Math.PI * 2);
      c.closePath();
    },
    '#fff3b0',
    s * 0.025,
  );

  // Danger stripes across the belly
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#3a2a08';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.35, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.save();
    ctx.translate(cx + i * r * 0.24, cy + r * 0.35);
    ctx.rotate(0.5);
    ctx.fillRect(-r * 0.05, -r * 0.4, r * 0.1, r * 0.8);
    ctx.restore();
  }
  ctx.restore();
}

/** Splitter — visibly segmented, breaks into two on death. */
function drawSplitter(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.56;
  const r = s * 0.35;

  gooBody(ctx, s, ENEMY.goo, {
    seed: 137,
    radius: r,
    cy,
    wobble: 0.05,
    angry: 0.6,
    eyeSpacing: r * 0.5,
    eyeR: r * 0.22,
  });

  // Split seam
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = s * 0.045;
  ctx.setLineDash([s * 0.05, s * 0.05]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 1.02);
  ctx.lineTo(cx, cy + r * 1.02);
  ctx.stroke();
  ctx.restore();
}

/** Wraith — semi-transparent, no legs, drifts through the field. */
function drawWraith(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.5;
  const r = s * 0.33;

  glow(ctx, cx, cy, r * 1.7, ENEMY.wraith.glow, 0.5);

  ctx.save();
  ctx.globalAlpha = 0.86;
  shaded(
    ctx,
    s,
    (c) => {
      // Hooded top with a ragged, wavy hem.
      c.beginPath();
      c.moveTo(cx - r, cy + r * 0.2);
      c.quadraticCurveTo(cx - r, cy - r * 1.15, cx, cy - r * 1.15);
      c.quadraticCurveTo(cx + r, cy - r * 1.15, cx + r, cy + r * 0.2);
      for (let i = 0; i < 4; i++) {
        const x0 = cx + r - (i * r * 2) / 4;
        const x1 = x0 - (r * 2) / 4;
        c.quadraticCurveTo((x0 + x1) / 2, cy + r * (i % 2 === 0 ? 1.25 : 0.75), x1, cy + r * 0.95);
      }
      c.closePath();
    },
    ENEMY.wraith,
    { outline: s * 0.06, cx, cy, radius: r },
  );
  ctx.restore();

  eyes(ctx, cx, cy - r * 0.3, r * 0.34, r * 0.2, {
    angry: 1,
    outline: s * 0.024,
    sclera: '#ffd9ff',
    pupil: '#3a1060',
    glow: ENEMY.wraith.glow,
  });
}

/** Shielded — carries a front plate that blocks damage from the front. */
function drawShielded(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.55;
  const r = s * 0.32;

  gooBody(ctx, s, ENEMY.gooAlt, { seed: 199, radius: r, cy, angry: 0.85, eyeR: r * 0.22 });

  // Riveted shield plate
  ctx.save();
  ctx.translate(cx, cy + r * 0.55);
  shaded(
    ctx,
    s,
    (c) => roundRectPath(c, 0, 0, r * 1.9, r * 0.7, r * 0.22),
    { dark: '#4a5570', base: '#93a2bd', light: '#e2eaf7', glow: '#cfd8e8' },
    { outline: s * 0.06, cx: 0, cy: 0, radius: r * 0.9 },
  );
  ctx.fillStyle = '#5d6a86';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * r * 0.38, 0, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Boss — a hulking warden with a crown of horns and a glowing core. */
function drawBoss(ctx: Ctx, s: number): void {
  const cx = s / 2;
  const cy = s * 0.55;
  const r = s * 0.34;

  dropShadow(ctx, cx, s * 0.94, r * 1.1, r * 0.3, 0.34);

  // Horn crown behind the body
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.92 + (i / 6) * Math.PI * 0.84;
    const hx = cx + Math.cos(a) * r * 0.95;
    const hy = cy + Math.sin(a) * r * 0.95;
    const len = r * (i === 3 ? 0.75 : 0.5);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a + Math.PI / 2);
    outlined(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(0, -len);
        c.lineTo(r * 0.15, r * 0.1);
        c.lineTo(-r * 0.15, r * 0.1);
        c.closePath();
      },
      '#f0e2c4',
      s * 0.04,
    );
    ctx.restore();
  }
  ctx.restore();

  // Body
  shaded(ctx, s, (c) => blobPath(c, cx, cy, r, 0.07, 251, 11), ENEMY.boss, {
    outline: s * 0.07,
    cx,
    cy,
    radius: r,
  });

  // Armour band
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, cx, cy, r, 0.07, 251, 11);
  ctx.clip();
  shaded(
    ctx,
    s,
    (c) => roundRectPath(c, cx, cy + r * 0.62, r * 2.2, r * 0.42, r * 0.14),
    { dark: '#3a1520', base: '#6d2434', light: '#a8455a', glow: '#e05068' },
    { outline: s * 0.05, cx, cy: cy + r * 0.62, radius: r },
  );
  ctx.restore();

  // Glowing core
  glow(ctx, cx, cy + r * 0.15, r * 0.9, ENEMY.boss.glow, 0.85);
  outlined(
    ctx,
    (c) => starPath(c, cx, cy + r * 0.15, r * 0.3, r * 0.14, 6, -Math.PI / 2, 0.2),
    '#ffd0d8',
    s * 0.035,
  );

  eyes(ctx, cx, cy - r * 0.42, r * 0.44, r * 0.2, {
    angry: 1,
    outline: s * 0.028,
    sclera: '#fff0d6',
    pupil: '#2a0810',
    glow: ENEMY.boss.glow,
  });
}

/** Elite aura ring, composited under elite variants of any mob. */
function drawEliteAura(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.48, '#ffcc55', 0.5);
  ctx.save();
  ctx.strokeStyle = withAlpha('#ffcc55', 0.85);
  ctx.lineWidth = s * 0.035;
  ctx.setLineDash([s * 0.09, s * 0.07]);
  ctx.beginPath();
  ctx.arc(c, c, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------------- pickups --- */

function drawXpGem(ctx: Ctx, s: number, ramp: Ramp): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.5, ramp.glow, 0.7);
  shaded(ctx, s, (x) => polyPath(x, c, c, s * 0.3, 6, Math.PI / 2, 0.1), ramp, {
    outline: s * 0.08,
    cx: c,
    cy: c,
    radius: s * 0.3,
  });
  // Facet line
  ctx.save();
  ctx.strokeStyle = withAlpha('#ffffff', 0.55);
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.moveTo(c - s * 0.12, c - s * 0.02);
  ctx.lineTo(c, c - s * 0.24);
  ctx.lineTo(c + s * 0.12, c - s * 0.02);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.45, '#ff5a78', 0.6);
  shaded(
    ctx,
    s,
    (x) => {
      x.beginPath();
      x.moveTo(c, c + s * 0.26);
      x.bezierCurveTo(c - s * 0.42, c - s * 0.02, c - s * 0.22, c - s * 0.32, c, c - s * 0.12);
      x.bezierCurveTo(c + s * 0.22, c - s * 0.32, c + s * 0.42, c - s * 0.02, c, c + s * 0.26);
      x.closePath();
    },
    { dark: '#7a1230', base: '#e03a5c', light: '#ff8ea4', glow: '#ff5a78' },
    { outline: s * 0.08, cx: c, cy: c, radius: s * 0.3 },
  );
}

function drawMagnet(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.45, '#66e0ff', 0.6);
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = s * 0.32;
  ctx.beginPath();
  ctx.arc(c, c + s * 0.06, s * 0.22, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = '#e8425c';
  ctx.lineWidth = s * 0.2;
  ctx.beginPath();
  ctx.arc(c, c + s * 0.06, s * 0.22, Math.PI, 0);
  ctx.stroke();
  // Poles
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(c - s * 0.32, c + s * 0.06, s * 0.2, s * 0.2);
  ctx.fillRect(c + s * 0.12, c + s * 0.06, s * 0.2, s * 0.2);
  ctx.fillStyle = '#dfe8f5';
  ctx.fillRect(c - s * 0.29, c + s * 0.06, s * 0.14, s * 0.15);
  ctx.fillRect(c + s * 0.15, c + s * 0.06, s * 0.14, s * 0.15);
  ctx.restore();
}

function drawBombPickup(ctx: Ctx, s: number): void {
  const c = s / 2;
  glow(ctx, c, c, s * 0.45, '#ff8f3c', 0.6);
  shaded(
    ctx,
    s,
    (x) => {
      x.beginPath();
      x.arc(c, c + s * 0.05, s * 0.27, 0, Math.PI * 2);
      x.closePath();
    },
    { dark: '#1a1c2a', base: '#3a3f55', light: '#6d7690', glow: '#8892aa' },
    { outline: s * 0.075, cx: c, cy: c + s * 0.05, radius: s * 0.27 },
  );
  ctx.save();
  ctx.strokeStyle = '#4a3a1a';
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c + s * 0.08, c - s * 0.18);
  ctx.quadraticCurveTo(c + s * 0.28, c - s * 0.3, c + s * 0.2, c - s * 0.4);
  ctx.stroke();
  ctx.restore();
  outlined(
    ctx,
    (x) => flamePath(x, c + s * 0.2, c - s * 0.46, s * 0.13, s * 0.18),
    '#ffd75c',
    s * 0.025,
  );
}

/* ---------------------------------------------------------------- sheets --- */

export type ActorKey =
  | 'hero'
  | 'gun'
  | 'crawler'
  | 'runner'
  | 'brute'
  | 'spitter'
  | 'dasher'
  | 'bomber'
  | 'splitter'
  | 'wraith'
  | 'shielded'
  | 'boss'
  | 'eliteAura'
  | 'xpSmall'
  | 'xpMed'
  | 'xpLarge'
  | 'heart'
  | 'magnet'
  | 'bombPickup';

/** Base sprite sizes, in world units. Render code scales from these. */
const S = {
  hero: 72,
  gun: 44,
  small: 48,
  medium: 58,
  large: 72,
  boss: 132,
  pickup: 28,
};

export const actors = new SpriteSheet<ActorKey>({
  hero: () => makeSprite(S.hero, drawCowboyHero, 3),
  gun: () => makeSprite(S.gun, drawGun, 3),
  crawler: () => makeSprite(S.small, drawCrawler, 3),
  runner: () => makeSprite(S.small, drawRunner, 4),
  brute: () => makeSprite(S.large, drawBrute, 5),
  spitter: () => makeSprite(S.medium, drawSpitter, 5),
  dasher: () => makeSprite(S.medium, drawDasher, 5),
  bomber: () => makeSprite(S.medium, drawBomber, 6),
  splitter: () => makeSprite(S.medium, drawSplitter, 3),
  wraith: () => makeSprite(S.medium, drawWraith, 8),
  shielded: () => makeSprite(S.medium, drawShielded, 4),
  boss: () => makeSprite(S.boss, drawBoss, 8),
  eliteAura: () => makeSprite(96, drawEliteAura, 6),
  xpSmall: () => makeSprite(S.pickup, (c, s) => drawXpGem(c, s, XP_RAMPS.small), 6),
  xpMed: () => makeSprite(S.pickup * 1.2, (c, s) => drawXpGem(c, s, XP_RAMPS.med), 6),
  xpLarge: () => makeSprite(S.pickup * 1.45, (c, s) => drawXpGem(c, s, XP_RAMPS.large), 7),
  heart: () => makeSprite(34, drawHeart, 6),
  magnet: () => makeSprite(34, drawMagnet, 6),
  bombPickup: () => makeSprite(34, drawBombPickup, 6),
});

/** XP gems get hotter colours as they get more valuable — instant readability. */
const XP_RAMPS: Record<'small' | 'med' | 'large', Ramp> = {
  small: { dark: '#137a9e', base: '#38c6f0', light: '#b4f0ff', glow: '#66e0ff' },
  med: { dark: '#2a6a2e', base: '#5ad46a', light: '#c2ffc8', glow: '#8affa0' },
  large: { dark: '#8a4a10', base: '#ffb43c', light: '#ffe9b0', glow: '#ffd75c' },
};

/** Convenience accessor used throughout the renderer. */
export function actorSprite(key: ActorKey): Sprite {
  return actors.get(key);
}
