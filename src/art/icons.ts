/**
 * Upgrade-card icons.
 *
 * Each icon is a rounded badge tinted by its element(s) with a bold white-ish
 * glyph on top. Fusion icons blend the two parent element colours so the player
 * can read a fusion at a glance without the label.
 */

import { makeSprite, type Sprite } from '../engine/sprites';
import {
  boltPath,
  flamePath,
  leafPath,
  polyPath,
  roundRectPath,
  sawPath,
  shardPath,
  starPath,
  withAlpha,
  mix,
  type Ctx,
} from './draw';
import { iconBadge } from './fx';
import { PALETTE, type ElementKey } from './style';

const GLYPH = '#ffffff';
const GLYPH_SHADE = 'rgba(0,0,0,0.35)';

/** Strokes then fills a glyph so it always separates from the badge. */
function glyph(ctx: Ctx, s: number, path: (c: Ctx) => void, fill = GLYPH): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = GLYPH_SHADE;
  ctx.lineWidth = s * 0.11;
  path(ctx);
  ctx.stroke();
  ctx.fillStyle = fill;
  path(ctx);
  ctx.fill();
  ctx.restore();
}

/** Strokes a glyph as a line (bolts, arcs) with a dark halo behind it. */
function glyphLine(ctx: Ctx, s: number, path: (c: Ctx) => void, w: number, fill = GLYPH): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = GLYPH_SHADE;
  ctx.lineWidth = w + s * 0.07;
  path(ctx);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  path(ctx);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------- element glyphs --- */

const elementGlyph: Record<ElementKey, (ctx: Ctx, s: number) => void> = {
  fire: (ctx, s) => {
    glyph(ctx, s, (c) => flamePath(c, s / 2, s * 0.52, s * 0.42, s * 0.62));
    ctx.save();
    ctx.fillStyle = withAlpha(PALETTE.fire.light, 0.95);
    flamePath(ctx, s / 2, s * 0.58, s * 0.2, s * 0.34);
    ctx.fill();
    ctx.restore();
  },
  storm: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.58, s * 0.16);
      c.lineTo(s * 0.34, s * 0.5);
      c.lineTo(s * 0.5, s * 0.52);
      c.lineTo(s * 0.42, s * 0.86);
      c.lineTo(s * 0.68, s * 0.46);
      c.lineTo(s * 0.51, s * 0.44);
      c.closePath();
    });
  },
  frost: (ctx, s) => {
    // Six-armed snowflake with barbs.
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          c.moveTo(s / 2 - Math.cos(a) * s * 0.34, s / 2 - Math.sin(a) * s * 0.34);
          c.lineTo(s / 2 + Math.cos(a) * s * 0.34, s / 2 + Math.sin(a) * s * 0.34);
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const bx = s / 2 + Math.cos(a) * s * 0.2;
          const by = s / 2 + Math.sin(a) * s * 0.2;
          for (const d of [-0.5, 0.5]) {
            c.moveTo(bx, by);
            c.lineTo(bx + Math.cos(a + d) * s * 0.13, by + Math.sin(a + d) * s * 0.13);
          }
        }
      },
      s * 0.075,
    );
  },
  verdant: (ctx, s) => {
    ctx.save();
    ctx.translate(s * 0.5, s * 0.5);
    ctx.rotate(-Math.PI / 4);
    glyph(ctx, s, (c) => leafPath(c, -s * 0.3, 0, s * 0.62, s * 0.26));
    ctx.restore();
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.29, s * 0.71);
        c.lineTo(s * 0.68, s * 0.32);
      },
      s * 0.05,
      withAlpha(PALETTE.verdant.dark, 0.9),
    );
  },
  steel: (ctx, s) => {
    glyph(ctx, s, (c) => sawPath(c, s / 2, s / 2, s * 0.36, 8));
    ctx.save();
    ctx.fillStyle = GLYPH_SHADE;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  void: (ctx, s) => {
    ctx.save();
    ctx.strokeStyle = GLYPH;
    ctx.lineWidth = s * 0.075;
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.36, s * 0.15, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#150a26';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(PALETTE.void.light, 0.9);
    ctx.lineWidth = s * 0.04;
    ctx.stroke();
    ctx.restore();
  },
};

/* -------------------------------------------------------- fusion glyphs --- */

/**
 * Fusion glyphs. Each is a distinct silhouette rather than two stacked element
 * marks, so a fused weapon feels like its own thing.
 */
const fusionGlyph: Record<string, (ctx: Ctx, s: number) => void> = {
  // fire + storm
  plasma: (ctx, s) => {
    glyph(ctx, s, (c) => flamePath(c, s / 2, s * 0.55, s * 0.4, s * 0.58));
    glyphLine(
      ctx,
      s,
      (c) => boltPath(c, s * 0.3, s * 0.18, s * 0.7, s * 0.82, 4, 0.16, 5),
      s * 0.075,
      PALETTE.storm.light,
    );
  },
  // fire + frost
  steam: (ctx, s) => {
    glyph(ctx, s, (c) => flamePath(c, s * 0.36, s * 0.62, s * 0.3, s * 0.44));
    glyph(ctx, s, (c) => shardPath(c, s * 0.66, s * 0.44, s * 0.26, s * 0.46), PALETTE.frost.light);
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.24, s * 0.28);
        c.quadraticCurveTo(s * 0.4, s * 0.16, s * 0.56, s * 0.24);
      },
      s * 0.06,
      withAlpha('#ffffff', 0.85),
    );
  },
  // fire + verdant
  wildfire: (ctx, s) => {
    ctx.save();
    ctx.translate(s * 0.5, s * 0.58);
    ctx.rotate(-Math.PI / 4);
    glyph(ctx, s, (c) => leafPath(c, -s * 0.26, 0, s * 0.5, s * 0.2), PALETTE.verdant.light);
    ctx.restore();
    glyph(ctx, s, (c) => flamePath(c, s * 0.5, s * 0.4, s * 0.34, s * 0.48));
  },
  // fire + steel
  moltensaw: (ctx, s) => {
    glyph(ctx, s, (c) => sawPath(c, s / 2, s / 2, s * 0.35, 8));
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, PALETTE.fire.base);
    g.addColorStop(0.6, PALETTE.fire.light);
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = GLYPH_SHADE;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // fire + void
  supernova: (ctx, s) => {
    glyph(ctx, s, (c) => starPath(c, s / 2, s / 2, s * 0.4, s * 0.14, 8, -Math.PI / 2, 0.1));
    ctx.save();
    ctx.fillStyle = '#150a26';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // storm + frost
  cryoconduct: (ctx, s) => {
    glyph(ctx, s, (c) => shardPath(c, s / 2, s * 0.52, s * 0.34, s * 0.66), PALETTE.frost.light);
    glyphLine(
      ctx,
      s,
      (c) => boltPath(c, s * 0.2, s * 0.3, s * 0.8, s * 0.66, 4, 0.14, 9),
      s * 0.07,
      '#ffffff',
    );
  },
  // storm + verdant
  lightningrod: (ctx, s) => {
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * 0.88);
        c.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.5, s * 0.16);
      },
      s * 0.085,
      PALETTE.verdant.light,
    );
    ctx.save();
    ctx.translate(s * 0.5, s * 0.56);
    ctx.rotate(0.5);
    glyph(ctx, s, (c) => leafPath(c, 0, 0, s * 0.3, s * 0.13), PALETTE.verdant.base);
    ctx.restore();
    glyphLine(
      ctx,
      s,
      (c) => boltPath(c, s * 0.22, s * 0.2, s * 0.5, s * 0.36, 3, 0.2, 3),
      s * 0.06,
      '#ffffff',
    );
  },
  // storm + steel
  railgun: (ctx, s) => {
    glyph(ctx, s, (c) => roundRectPath(c, s * 0.5, s * 0.5, s * 0.74, s * 0.2, s * 0.08));
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.16, s * 0.3);
        c.lineTo(s * 0.84, s * 0.3);
        c.moveTo(s * 0.16, s * 0.7);
        c.lineTo(s * 0.84, s * 0.7);
      },
      s * 0.055,
      PALETTE.storm.light,
    );
  },
  // storm + void
  teslarift: (ctx, s) => {
    ctx.save();
    ctx.strokeStyle = PALETTE.void.light;
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#150a26';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    glyphLine(
      ctx,
      s,
      (c) => {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - 0.5;
          boltPath(
            c,
            s / 2 + Math.cos(a) * s * 0.08,
            s / 2 + Math.sin(a) * s * 0.08,
            s / 2 + Math.cos(a) * s * 0.44,
            s / 2 + Math.sin(a) * s * 0.44,
            3,
            0.25,
            11 + i,
          );
        }
      },
      s * 0.055,
      '#ffffff',
    );
  },
  // frost + verdant
  permafrost: (ctx, s) => {
    // Flower of ice petals
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(s / 2 + Math.cos(a) * s * 0.2, s / 2 + Math.sin(a) * s * 0.2);
      ctx.rotate(a + Math.PI / 2);
      glyph(ctx, s, (c) => shardPath(c, 0, 0, s * 0.2, s * 0.34), PALETTE.frost.light);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = PALETTE.verdant.light;
    ctx.strokeStyle = GLYPH_SHADE;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  },
  // frost + steel
  glacier: (ctx, s) => {
    glyph(ctx, s, (c) => starPath(c, s / 2, s / 2, s * 0.38, s * 0.22, 6, 0, 0.14));
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, PALETTE.frost.base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = GLYPH_SHADE;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // frost + void
  abszero: (ctx, s) => {
    ctx.save();
    ctx.fillStyle = withAlpha(PALETTE.void.dark, 0.85);
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    elementGlyph.frost(ctx, s);
  },
  // verdant + steel
  bramble: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.14, s * 0.72);
      c.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.88, s * 0.44);
      c.quadraticCurveTo(s * 0.5, s * 0.34, s * 0.14, s * 0.86);
      c.closePath();
    }, PALETTE.verdant.light);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = GLYPH_SHADE;
    ctx.lineWidth = s * 0.04;
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.2;
      const x = s * (0.14 + 0.72 * t);
      const y = s * (0.72 - 0.42 * Math.sin(t * Math.PI));
      ctx.beginPath();
      ctx.moveTo(x - s * 0.05, y);
      ctx.lineTo(x + s * 0.02, y - s * 0.16);
      ctx.lineTo(x + s * 0.07, y - s * 0.01);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  },
  // verdant + void
  devourer: (ctx, s) => {
    ctx.save();
    ctx.fillStyle = '#150a26';
    ctx.strokeStyle = PALETTE.verdant.light;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Spores spiralling inward
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = s * 0.38;
      ctx.save();
      ctx.fillStyle = i % 2 === 0 ? PALETTE.verdant.light : PALETTE.void.light;
      ctx.strokeStyle = GLYPH_SHADE;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, s * 0.065, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  },
  // steel + void
  gravityblades: (ctx, s) => {
    ctx.save();
    ctx.fillStyle = '#150a26';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.void.light;
    ctx.lineWidth = s * 0.04;
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - 0.6;
      ctx.save();
      ctx.translate(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3);
      ctx.rotate(a);
      glyph(ctx, s, (c) => sawPath(c, 0, 0, s * 0.14, 6));
      ctx.restore();
    }
  },
};

/* --------------------------------------------------------- passive icons --- */

const passiveGlyph: Record<string, (ctx: Ctx, s: number) => void> = {
  heart: (ctx, s) => {
    glyph(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * 0.82);
        c.bezierCurveTo(s * 0.06, s * 0.48, s * 0.24, s * 0.14, s * 0.5, s * 0.36);
        c.bezierCurveTo(s * 0.76, s * 0.14, s * 0.94, s * 0.48, s * 0.5, s * 0.82);
        c.closePath();
      },
      '#ff8ea4',
    );
  },
  boot: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.32, s * 0.16);
      c.lineTo(s * 0.52, s * 0.16);
      c.lineTo(s * 0.52, s * 0.56);
      c.lineTo(s * 0.86, s * 0.68);
      c.lineTo(s * 0.86, s * 0.84);
      c.lineTo(s * 0.32, s * 0.84);
      c.closePath();
    });
  },
  sword: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.1);
      c.lineTo(s * 0.62, s * 0.26);
      c.lineTo(s * 0.58, s * 0.66);
      c.lineTo(s * 0.42, s * 0.66);
      c.lineTo(s * 0.38, s * 0.26);
      c.closePath();
    });
    glyph(ctx, s, (c) => roundRectPath(c, s * 0.5, s * 0.72, s * 0.42, s * 0.1, s * 0.04), '#ffc24a');
    glyph(ctx, s, (c) => roundRectPath(c, s * 0.5, s * 0.86, s * 0.12, s * 0.2, s * 0.05), '#ffc24a');
  },
  clock: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
      c.closePath();
    });
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * 0.5);
        c.lineTo(s * 0.5, s * 0.28);
        c.moveTo(s * 0.5, s * 0.5);
        c.lineTo(s * 0.68, s * 0.58);
      },
      s * 0.06,
      '#2b3450',
    );
  },
  shield: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.12);
      c.lineTo(s * 0.84, s * 0.28);
      c.quadraticCurveTo(s * 0.84, s * 0.72, s * 0.5, s * 0.9);
      c.quadraticCurveTo(s * 0.16, s * 0.72, s * 0.16, s * 0.28);
      c.closePath();
    });
  },
  magnet: (ctx, s) => {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = GLYPH_SHADE;
    ctx.lineWidth = s * 0.34;
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.56, s * 0.24, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = '#ff6b7a';
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.56, s * 0.24, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s * 0.15, s * 0.56, s * 0.19, s * 0.18);
    ctx.fillRect(s * 0.66, s * 0.56, s * 0.19, s * 0.18);
    ctx.restore();
  },
  crit: (ctx, s) => {
    glyph(ctx, s, (c) => starPath(c, s / 2, s / 2, s * 0.4, s * 0.16, 4, -Math.PI / 2, 0.05));
  },
  area: (ctx, s) => {
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
      },
      s * 0.07,
    );
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.14, 0, Math.PI * 2);
      c.closePath();
    });
  },
  multi: (ctx, s) => {
    for (let i = 0; i < 3; i++) {
      const y = s * (0.26 + i * 0.24);
      glyph(ctx, s, (c) => {
        c.beginPath();
        c.moveTo(s * 0.2, y - s * 0.07);
        c.lineTo(s * 0.66, y - s * 0.07);
        c.lineTo(s * 0.8, y);
        c.lineTo(s * 0.66, y + s * 0.07);
        c.lineTo(s * 0.2, y + s * 0.07);
        c.closePath();
      });
    }
  },
  xp: (ctx, s) => {
    glyph(ctx, s, (c) => polyPath(c, s / 2, s / 2, s * 0.36, 6, Math.PI / 2, 0.1), '#b4f0ff');
  },
  luck: (ctx, s) => {
    // Four-leaf clover
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.save();
      ctx.translate(s / 2 + Math.cos(a) * s * 0.17, s / 2 + Math.sin(a) * s * 0.17);
      glyph(
        ctx,
        s,
        (c) => {
          c.beginPath();
          c.arc(0, 0, s * 0.17, 0, Math.PI * 2);
          c.closePath();
        },
        PALETTE.verdant.light,
      );
      ctx.restore();
    }
  },
  regen: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.42, s * 0.16);
      c.lineTo(s * 0.58, s * 0.16);
      c.lineTo(s * 0.58, s * 0.42);
      c.lineTo(s * 0.84, s * 0.42);
      c.lineTo(s * 0.84, s * 0.58);
      c.lineTo(s * 0.58, s * 0.58);
      c.lineTo(s * 0.58, s * 0.84);
      c.lineTo(s * 0.42, s * 0.84);
      c.lineTo(s * 0.42, s * 0.58);
      c.lineTo(s * 0.16, s * 0.58);
      c.lineTo(s * 0.16, s * 0.42);
      c.lineTo(s * 0.42, s * 0.42);
      c.closePath();
    }, '#8affa0');
  },
  thorns: (ctx, s) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(a);
      glyph(ctx, s, (c) => {
        c.beginPath();
        c.moveTo(-s * 0.08, -s * 0.16);
        c.lineTo(0, -s * 0.42);
        c.lineTo(s * 0.08, -s * 0.16);
        c.closePath();
      });
      ctx.restore();
    }
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.16, 0, Math.PI * 2);
      c.closePath();
    });
  },
  dash: (ctx, s) => {
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.24, s * 0.5);
      c.lineTo(s * 0.56, s * 0.18);
      c.lineTo(s * 0.56, s * 0.38);
      c.lineTo(s * 0.86, s * 0.38);
      c.lineTo(s * 0.54, s * 0.86);
      c.lineTo(s * 0.54, s * 0.62);
      c.lineTo(s * 0.24, s * 0.62);
      c.closePath();
    }, '#ffe08a');
  },
  revive: (ctx, s) => {
    glyphLine(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.arc(s / 2, s / 2, s * 0.32, 0.6, Math.PI * 1.9);
      },
      s * 0.09,
      '#ffe08a',
    );
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.78, s * 0.34);
      c.lineTo(s * 0.9, s * 0.66);
      c.lineTo(s * 0.62, s * 0.6);
      c.closePath();
    }, '#ffe08a');
  },
  lifesteal: (ctx, s) => {
    glyph(
      ctx,
      s,
      (c) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * 0.86);
        c.bezierCurveTo(s * 0.12, s * 0.5, s * 0.28, s * 0.16, s * 0.5, s * 0.36);
        c.bezierCurveTo(s * 0.72, s * 0.16, s * 0.88, s * 0.5, s * 0.5, s * 0.86);
        c.closePath();
      },
      '#ff8ea4',
    );
    glyph(ctx, s, (c) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.08);
      c.lineTo(s * 0.6, s * 0.3);
      c.lineTo(s * 0.4, s * 0.3);
      c.closePath();
    }, '#ffffff');
  },
};

/* --------------------------------------------------------------- sheets --- */

const ICON_SIZE = 64;
const cache = new Map<string, Sprite>();

/** Icon for a base element. */
export function elementIcon(el: ElementKey): Sprite {
  const key = `el:${el}`;
  let sp = cache.get(key);
  if (sp) return sp;
  const p = PALETTE[el];
  sp = makeSprite(ICON_SIZE, (ctx, s) => {
    iconBadge(ctx, s, p.base, p.dark);
    elementGlyph[el](ctx, s);
  });
  cache.set(key, sp);
  return sp;
}

/**
 * Icon for a fusion. The badge blends both parent colours so the pairing is
 * readable, and the glyph is unique to the fusion.
 */
export function fusionIcon(glyphKey: string, a: ElementKey, b: ElementKey): Sprite {
  const key = `fu:${glyphKey}`;
  let sp = cache.get(key);
  if (sp) return sp;
  const pa = PALETTE[a];
  const pb = PALETTE[b];
  const fn = fusionGlyph[glyphKey];
  sp = makeSprite(ICON_SIZE, (ctx, s) => {
    iconBadge(ctx, s, pa.base, pb.dark);
    // Diagonal wash of the second element so both parents read on the badge.
    ctx.save();
    roundRectPath(ctx, s / 2, s / 2, s * 0.94, s * 0.94, s * 0.26);
    ctx.clip();
    const g = ctx.createLinearGradient(0, s, s, 0);
    g.addColorStop(0, withAlpha(pb.base, 0));
    g.addColorStop(1, withAlpha(pb.light, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();

    if (fn) fn(ctx, s);
    else {
      // Fallback: overlap the two element glyphs.
      ctx.save();
      ctx.translate(-s * 0.1, 0);
      ctx.scale(0.75, 0.75);
      elementGlyph[a](ctx, s);
      ctx.restore();
      ctx.save();
      ctx.translate(s * 0.28, s * 0.2);
      ctx.scale(0.75, 0.75);
      elementGlyph[b](ctx, s);
      ctx.restore();
    }

    // Fusion badges get a gold rim to separate them from element cards.
    ctx.save();
    ctx.strokeStyle = withAlpha('#ffcc55', 0.9);
    ctx.lineWidth = s * 0.05;
    roundRectPath(ctx, s / 2, s / 2, s * 0.9, s * 0.9, s * 0.24);
    ctx.stroke();
    ctx.restore();
  });
  cache.set(key, sp);
  return sp;
}

/** Icon for a passive stat upgrade. */
export function passiveIcon(glyphKey: string, tint = '#4a5878'): Sprite {
  const key = `pa:${glyphKey}:${tint}`;
  let sp = cache.get(key);
  if (sp) return sp;
  const fn = passiveGlyph[glyphKey] ?? passiveGlyph.sword;
  sp = makeSprite(ICON_SIZE, (ctx, s) => {
    iconBadge(ctx, s, tint, mix(tint, '#0b1020', 0.6));
    fn(ctx, s);
  });
  cache.set(key, sp);
  return sp;
}

/** Renders any sprite into a DOM canvas for use inside the card UI. */
export function spriteToCanvas(sp: Sprite, cssSize: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(cssSize * dpr);
  c.height = Math.round(cssSize * dpr);
  c.style.width = `${cssSize}px`;
  c.style.height = `${cssSize}px`;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(sp.canvas, 0, 0, c.width, c.height);
  return c;
}

export const FUSION_GLYPH_KEYS = Object.keys(fusionGlyph);
