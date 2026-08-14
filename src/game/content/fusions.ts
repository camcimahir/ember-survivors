/**
 * Fusion weapons.
 *
 * Every unordered pair of the six elements has a fusion — 15 in total. A fusion
 * becomes available once the player owns both parent elements and has each of
 * them at level 3 or higher, so fusing is something you build toward rather
 * than something that just happens.
 *
 * Fusions are their own weapons with their own upgrade track; they do not
 * replace their parents.
 */

import { TAU } from '../../engine/math';
import { rnd, rndAngle, rndRange } from '../../engine/rng';
import { audio } from '../../engine/audio';
import { BulletFlag, type ElementKey, type Enemy } from '../types';
import {
  pairKey,
  registerWeapon,
  ringAngles,
  scale,
  spreadAngles,
  type WeaponDef,
} from '../weapons';
import type { World } from '../world';

/** Level at which a base element unlocks its fusions. */
export const FUSION_REQ_LEVEL = 3;

function dmg(w: World, base: number, level: number, per = 0.3): number {
  return base * scale(level, per) * w.stats.damage;
}

interface FusionSpec extends WeaponDef {
  /** Glyph key in art/icons.ts. */
  glyph: string;
  /** Human-readable pair, e.g. "Ember + Volt". */
  pairLabel: string;
}

const FUSIONS: FusionSpec[] = [];

function fusion(spec: FusionSpec): FusionSpec {
  registerWeapon(spec);
  FUSIONS.push(spec);
  return spec;
}

/* --------------------------------------------------- fire + storm: plasma --- */

fusion({
  id: 'plasma',
  glyph: 'plasma',
  name: 'Plasma Storm',
  pairLabel: 'Ember + Volt',
  elements: ['fire', 'storm'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Superheated plasma that detonates and arcs to everything nearby.',
  desc: (l) =>
    l === 1
      ? 'Launch <em>plasma orbs</em> that explode and <em>chain lightning</em> to nearby foes.'
      : 'Plasma damage <em>+30%</em>, <em>+1 chain jump</em>.',
  cooldown: (l) => Math.max(0.55, 1.35 - l * 0.14),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const count = 1 + Math.floor(l / 3) + w.stats.extraProjectiles;
    for (const a of spreadAngles(p.aim, count, 0.42)) {
      w.shoot({
        x: p.x,
        y: p.y + 4,
        angle: a,
        speed: 400,
        damage: dmg(w, 16, l),
        element: 'fire',
        weapon: 'plasma',
        art: 'plasmaOrb',
        radius: 12,
        life: 1.7,
        flags: BulletFlag.Trail | BulletFlag.Homing,
        blast: 74,
        knock: 190,
        p1: 3.2,
      });
    }
    audio.play('shootHeavy', 0.8);
  },
  onExpire(w, b) {
    const l = w.getWeaponInstance('plasma')?.level ?? 1;
    // The blast is handled by the bullet; this adds the electrical half.
    w.chain(b.x, b.y, dmg(w, 12, l), 2 + l, 210 * w.stats.area, 'storm', 0.86);
  },
});

/* ---------------------------------------------------- fire + frost: steam --- */

fusion({
  id: 'steam',
  glyph: 'steam',
  name: 'Steam Burst',
  pairLabel: 'Ember + Rime',
  elements: ['fire', 'frost'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Flash-boiled water erupts in a scalding cloud that smothers the horde.',
  desc: (l) =>
    l === 1
      ? 'Erupt <em>scalding steam</em> around you: burns, then <em>soaks and chills</em> everything it touches.'
      : 'Steam damage <em>+30%</em> and radius <em>+15%</em>.',
  cooldown: (l) => Math.max(1.3, 2.8 - l * 0.28),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const r = 168 * (1 + (l - 1) * 0.15);
    w.explode(p.x, p.y, r, dmg(w, 24, l), 'fire', { knock: 260 });
    // Steam is the fire/water reaction: it burns and soaks at the same time,
    // which sets up storm and frost damage for the rest of the build.
    for (const e of w.enemiesInRadius(p.x, p.y, r * w.stats.area, 48)) {
      w.applyBurn(e, dmg(w, 11, l), 3 * w.stats.duration);
      w.applyWet(e, 4 * w.stats.duration);
      w.applyChill(e, 0.4, 2.4 * w.stats.duration);
    }
    for (let i = 0; i < 12; i++) {
      const a = rndAngle();
      const sp = rndRange(60, 200);
      w.addParticle('puff', p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.7, 22, 60, '#dff4ff', true, 0, 0.94);
    }
    audio.play('explode', 0.85);
  },
});

/* ------------------------------------------------ fire + verdant: wildfire --- */

fusion({
  id: 'wildfire',
  glyph: 'wildfire',
  name: 'Wildfire',
  pairLabel: 'Ember + Bloom',
  elements: ['fire', 'verdant'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Fire finds fuel in everything that grows — and it spreads.',
  desc: (l) =>
    l === 1
      ? 'Scatter <em>patches of burning ground</em>. Enemies that die while burning <em>spread the fire</em>.'
      : 'Wildfire damage <em>+30%</em> and <em>+1 patch</em>.',
  cooldown: (l) => Math.max(1.0, 2.2 - l * 0.24),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const patches = 2 + l;
    for (let i = 0; i < patches; i++) {
      const t = w.randomEnemyNear(p.x, p.y, 420);
      const a = rndAngle();
      const d = rndRange(60, 260);
      const x = t ? t.x + rndRange(-30, 30) : p.x + Math.cos(a) * d;
      const y = t ? t.y + rndRange(-30, 30) : p.y + Math.sin(a) * d;
      w.zone({
        x,
        y,
        radius: 62,
        life: 4.5,
        dps: dmg(w, 20, l),
        element: 'fire',
        weapon: 'wildfire',
        grow: true,
      });
    }
    audio.play('explode', 0.5);
  },
});

/* -------------------------------------------------- fire + steel: moltensaw --- */

fusion({
  id: 'moltensaw',
  glyph: 'moltensaw',
  name: 'Molten Saw',
  pairLabel: 'Ember + Edge',
  elements: ['fire', 'steel'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Blades heated white, dragging a wake of fire behind them.',
  desc: (l) =>
    l === 1
      ? '<em>Molten blades</em> orbit you, leaving <em>trails of fire</em> and igniting what they cut.'
      : 'Blade damage <em>+30%</em> and <em>+1 blade</em>.',
  cooldown: () => 999,
  update(w, inst, dt) {
    const l = inst.level;
    const count = 2 + l;
    const orbitR = 108 * w.stats.area;
    inst.s1 += dt * 2.3;

    const refs = inst.refs;
    let live = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].alive && refs[i].weapon === 'moltensaw') refs[live++] = refs[i];
    }
    refs.length = live;

    while (refs.length < count) {
      const b = w.shoot({
        x: w.player.x,
        y: w.player.y,
        angle: 0,
        speed: 0,
        damage: 0,
        element: 'fire',
        weapon: 'moltensaw',
        art: 'sawblade',
        radius: 19,
        life: 9999,
        pierce: -1,
        flags: BulletFlag.Spin,
        p2: 1,
      });
      if (!b) break;
      refs.push(b);
    }

    const damage = dmg(w, 15, l);
    const angles = ringAngles(refs.length, inst.s1);
    for (let i = 0; i < refs.length; i++) {
      const b = refs[i];
      b.life = 9999;
      b.damage = damage;
      b.knock = 130;
      b.x = w.player.x + Math.cos(angles[i]) * orbitR;
      b.y = w.player.y + Math.sin(angles[i]) * orbitR + 4;
      b.rot += dt * 17;
      b.radius = 19 * w.stats.area;
      // Fire wake: a light, frequently refreshed burn patch.
      if (rnd() < dt * 3.4) {
        w.zone({
          x: b.x,
          y: b.y,
          radius: 34,
          life: 1.5,
          dps: dmg(w, 9, l),
          element: 'fire',
          weapon: 'moltensaw',
        });
      }
    }
  },
  onHit(w, _b, enemyIndex) {
    const l = w.getWeaponInstance('moltensaw')?.level ?? 1;
    const e = w.enemies.items[enemyIndex];
    if (e?.alive) w.applyBurn(e, dmg(w, 10, l), 2.6 * w.stats.duration);
    audio.play('saw', 0.4);
  },
});

/* ------------------------------------------------- fire + void: supernova --- */

fusion({
  id: 'supernova',
  glyph: 'supernova',
  name: 'Supernova',
  pairLabel: 'Ember + Rift',
  elements: ['fire', 'void'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'A star collapses, gathers the horde, and then stops being a star.',
  desc: (l) =>
    l === 1
      ? 'A collapsing star <em>drags enemies in</em>, then detonates in a <em>massive blast</em>.'
      : 'Supernova damage <em>+30%</em> and radius <em>+12%</em>.',
  cooldown: (l) => Math.max(3, 6.5 - l * 0.5),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const t = w.randomEnemyNear(p.x, p.y, 430);
    const x = t ? t.x : p.x + Math.cos(p.aim) * 190;
    const y = t ? t.y : p.y + Math.sin(p.aim) * 190;
    const r = 150 * (1 + (l - 1) * 0.12);

    // Collapse phase: a strong short pull that ends in the detonation.
    w.zone({
      x,
      y,
      radius: r,
      life: 1.25,
      dps: dmg(w, 10, l),
      element: 'void',
      weapon: 'supernova',
      pull: 900,
      collapse: dmg(w, 78, l),
    });
    w.addParticle('ring', x, y, 0, 0, 1.2, r * 2.2, 12, '#ffd0a0', true);
    audio.play('shootHeavy');
  },
});

/* ------------------------------------------ storm + frost: cryo conductor --- */

fusion({
  id: 'cryoconduct',
  glyph: 'cryoconduct',
  name: 'Cryo Conductor',
  pairLabel: 'Volt + Rime',
  elements: ['storm', 'frost'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Ice makes a fine wire. Freeze the horde, then run current through it.',
  desc: (l) =>
    l === 1
      ? '<em>Freezes</em> a cluster solid, then arcs a <em>supercharged chain</em> through the frozen — which conduct perfectly.'
      : 'Conductor damage <em>+30%</em> and <em>+2 chain jumps</em>.',
  cooldown: (l) => Math.max(1.2, 2.6 - l * 0.26),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const target = w.nearest(p.x, p.y, 480);
    if (!target) return;

    const r = 130 * w.stats.area;
    const group = w.enemiesInRadius(target.x, target.y, r, 30);
    for (const e of group) {
      w.applyFreeze(e, (0.9 + l * 0.14) * w.stats.duration);
      w.applyWet(e, 4 * w.stats.duration);
    }
    w.fxRing(target.x, target.y, r, '#c8f6ff', 0.4);
    audio.play('freeze');

    // Frozen targets are marked wet, so `chain` prefers them and the storm
    // damage bonus for wet/chilled applies to every hop.
    w.chain(p.x, p.y - 6, dmg(w, 22, l), 4 + l * 2, 230 * w.stats.area, 'storm', 0.92, target);
  },
});

/* ---------------------------------------- storm + verdant: lightning rod --- */

fusion({
  id: 'lightningrod',
  glyph: 'lightningrod',
  name: 'Lightning Rod',
  pairLabel: 'Volt + Bloom',
  elements: ['storm', 'verdant'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Living vines make excellent lightning rods. Briefly.',
  desc: (l) =>
    l === 1
      ? '<em>Roots</em> enemies with vines, then calls down <em>lightning strikes</em> on every rooted target.'
      : 'Strike damage <em>+30%</em> and <em>+1 target</em>.',
  cooldown: (l) => Math.max(1.1, 2.4 - l * 0.24),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const targets = w.enemiesInRadius(p.x, p.y, 420 * w.stats.area, 3 + l);
    if (targets.length === 0) return;

    for (const e of targets) {
      w.applyRoot(e, (1.1 + l * 0.16) * w.stats.duration);
      w.applyPoison(e, dmg(w, 8, l), 3 * w.stats.duration);
      // The strike comes from above: a bolt drawn from off-screen down to the
      // rooted target, then a small blast.
      w.fxBolt(e.x, e.y - 260, e.x, e.y, 'storm');
      w.damageEnemy(e, dmg(w, 26, l), 'storm', { knock: 40 });
      w.explode(e.x, e.y, 54, dmg(w, 10, l), 'storm', { knock: 60 });
    }
    audio.play('zap');
  },
});

/* ---------------------------------------------- storm + steel: railgun --- */

fusion({
  id: 'railgun',
  glyph: 'railgun',
  name: 'Railgun',
  pairLabel: 'Volt + Edge',
  elements: ['storm', 'steel'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'A slug of steel accelerated until the air apologises.',
  desc: (l) =>
    l === 1
      ? 'Fire a <em>piercing rail</em> that cuts through everything in a line.'
      : 'Rail damage <em>+30%</em> and <em>+20% width</em>.',
  cooldown: (l) => Math.max(0.9, 2.1 - l * 0.22),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const width = 20 * (1 + (l - 1) * 0.2);
    w.beam(p.x, p.y + 4, p.aim, 900, width, dmg(w, 42, l), 'steel', { knock: 240 });
    // A second pass in storm applies the shock status without double damage.
    for (const e of w.enemiesInRadius(p.x, p.y, 900, 40)) {
      const t = (e.x - p.x) * Math.cos(p.aim) + (e.y - p.y) * Math.sin(p.aim);
      if (t < 0) continue;
      const px = p.x + Math.cos(p.aim) * t;
      const py = p.y + Math.sin(p.aim) * t;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 < (width * w.stats.area + e.radius) ** 2) {
        w.applyShock(e, 0.4 * w.stats.duration);
      }
    }
    w.camera.shake(0.18);
    audio.play('shootHeavy');
  },
});

/* ------------------------------------------------ storm + void: tesla rift --- */

fusion({
  id: 'teslarift',
  glyph: 'teslarift',
  name: 'Tesla Rift',
  pairLabel: 'Volt + Rift',
  elements: ['storm', 'void'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'A hole in the world with a very bad temper.',
  desc: (l) =>
    l === 1
      ? 'Open a rift that <em>pulls enemies in</em> and <em>continuously electrocutes</em> everything caught inside.'
      : 'Rift damage <em>+30%</em> and lasts <em>+0.6s</em>.',
  cooldown: (l) => Math.max(2.2, 5 - l * 0.4),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const t = w.randomEnemyNear(p.x, p.y, 430);
    const x = t ? t.x : p.x + Math.cos(p.aim) * 170;
    const y = t ? t.y : p.y + Math.sin(p.aim) * 170;
    w.zone({
      x,
      y,
      radius: 118,
      life: 3.4 + l * 0.6,
      dps: dmg(w, 20, l),
      element: 'void',
      weapon: 'teslarift',
      pull: 420,
      grow: true,
    });
    audio.play('shootHeavy', 0.7);
  },
  update(w, inst, dt) {
    // Arc lightning out of every live rift belonging to this weapon. The rate
    // is deliberately low: the rift already ticks zone damage, and stacking a
    // fast chain on top of that made this the strongest fusion by 5x.
    const zs = w.zones.items;
    for (let i = 0; i < w.zones.count; i++) {
      const z = zs[i];
      if (!z.alive || z.weapon !== 'teslarift') continue;
      if (rnd() < dt * 2.2) {
        const l = inst.level;
        w.chain(z.x, z.y, dmg(w, 9, l), 1 + l, z.radius * 1.4, 'storm', 0.85);
      }
    }
  },
});

/* ---------------------------------------- frost + verdant: permafrost bloom --- */

fusion({
  id: 'permafrost',
  glyph: 'permafrost',
  name: 'Permafrost Bloom',
  pairLabel: 'Rime + Bloom',
  elements: ['frost', 'verdant'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Flowers of ice erupt from the ground and close like a trap.',
  desc: (l) =>
    l === 1
      ? '<em>Ice blossoms</em> erupt beneath enemies, <em>freezing</em> and impaling them.'
      : 'Bloom damage <em>+30%</em> and <em>+1 blossom</em>.',
  cooldown: (l) => Math.max(1.0, 2.3 - l * 0.24),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const blooms = 3 + l;
    for (let i = 0; i < blooms; i++) {
      const t = w.randomEnemyNear(p.x, p.y, 420);
      if (!t) break;
      const x = t.x;
      const y = t.y;
      w.explode(x, y, 66, dmg(w, 22, l), 'frost', { knock: 150 });
      for (const e of w.enemiesInRadius(x, y, 66 * w.stats.area, 12)) {
        w.applyFreeze(e, (0.7 + l * 0.12) * w.stats.duration);
        w.applyPoison(e, dmg(w, 7, l), 2.8 * w.stats.duration);
      }
      // Petals of ice thrown outward from the bloom.
      for (const a of ringAngles(5, rndAngle())) {
        w.addParticle(
          'shard', x, y, Math.cos(a) * 190, Math.sin(a) * 190,
          0.42, 11, 3, '#c8f6ff', false, rndRange(-8, 8), 0.9, 260,
        );
      }
    }
    audio.play('freeze', 0.9);
  },
});

/* ------------------------------------------ frost + steel: glacier chakram --- */

fusion({
  id: 'glacier',
  glyph: 'glacier',
  name: 'Glacier Chakram',
  pairLabel: 'Rime + Edge',
  elements: ['frost', 'steel'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'A disc of blue ice that ricochets until there is nothing left to hit.',
  desc: (l) =>
    l === 1
      ? 'Hurl a <em>ricocheting ice disc</em>. Freezes on hit — and steel <em>shatters</em> frozen foes for double damage.'
      : 'Chakram damage <em>+30%</em> and <em>+1 ricochet</em>.',
  cooldown: (l) => Math.max(0.8, 1.9 - l * 0.2),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const bounces = 3 + l;
    const count = 1 + Math.floor(l / 3) + w.stats.extraProjectiles;
    for (const a of spreadAngles(p.aim, count, 0.35)) {
      w.shoot({
        x: p.x,
        y: p.y + 4,
        angle: a,
        speed: 480,
        damage: dmg(w, 20, l),
        element: 'frost',
        weapon: 'glacier',
        art: 'chakram',
        radius: 16,
        life: 3.2,
        // `pierce` keeps the disc alive through impacts; `bounces` limits the
        // number of times onHit is allowed to redirect it.
        pierce: bounces,
        flags: BulletFlag.Spin,
        spin: 15,
        knock: 130,
        bounces,
      });
    }
    audio.play('shoot', 0.9);
  },
  onHit(w, b, enemyIndex) {
    const l = w.getWeaponInstance('glacier')?.level ?? 1;
    const e = w.enemies.items[enemyIndex];
    if (e?.alive) w.applyFreeze(e, (0.5 + l * 0.1) * w.stats.duration);
    // Steel shatter is resolved in damageEnemy; here we only ricochet.
    if (b.bounces <= 0) {
      b.pierce = 0;
      return;
    }
    b.bounces--;
    const next = w.randomEnemyNear(b.x, b.y, 300);
    const speed = Math.hypot(b.vx, b.vy) || 480;
    const a = next && next !== e ? Math.atan2(next.y - b.y, next.x - b.x) : rndAngle();
    b.vx = Math.cos(a) * speed;
    b.vy = Math.sin(a) * speed;
    b.lastHit = -1;
    audio.play('shatter', 0.4);
  },
});

/* -------------------------------------------- frost + void: absolute zero --- */

fusion({
  id: 'abszero',
  glyph: 'abszero',
  name: 'Absolute Zero',
  pairLabel: 'Rime + Rift',
  elements: ['frost', 'void'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Heat is just motion. Take away the motion.',
  desc: (l) =>
    l === 1
      ? 'A growing field where <em>nothing moves</em>. Enemies frozen inside <em>shatter</em> when it collapses.'
      : 'Field damage <em>+30%</em> and radius <em>+15%</em>.',
  cooldown: (l) => Math.max(3, 7 - l * 0.6),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const r = 190 * (1 + (l - 1) * 0.15);
    w.zone({
      x: p.x,
      y: p.y,
      radius: r,
      life: 3.4,
      dps: dmg(w, 18, l),
      element: 'frost',
      weapon: 'abszero',
      grow: true,
      collapse: dmg(w, 60, l),
      attached: false,
    });
    audio.play('freeze');
  },
  update(w, inst, dt) {
    const l = inst.level;
    const zs = w.zones.items;
    for (let i = 0; i < w.zones.count; i++) {
      const z = zs[i];
      if (!z.alive || z.weapon !== 'abszero') continue;
      if (rnd() > dt * 8) continue;
      for (const e of w.enemiesInRadius(z.x, z.y, z.radius, 40)) {
        w.applyFreeze(e, 0.8 * w.stats.duration);
        w.applyMark(e, 0.15 + l * 0.05, 2 * w.stats.duration);
      }
    }
  },
});

/* ------------------------------------------ verdant + steel: bramble cutter --- */

fusion({
  id: 'bramble',
  glyph: 'bramble',
  name: 'Bramble Cutter',
  pairLabel: 'Bloom + Edge',
  elements: ['verdant', 'steel'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'A whip of thorned steel that takes a little life back with every cut.',
  desc: (l) =>
    l === 1
      ? 'Sweep a <em>wide thorned arc</em> in front of you. Cuts <em>heal you</em>.'
      : 'Cutter damage <em>+30%</em> and <em>+15% arc</em>.',
  cooldown: (l) => Math.max(0.45, 1.05 - l * 0.12),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const reach = 140 * (1 + (l - 1) * 0.15) * w.stats.area;
    const halfArc = 1.05;
    let hits = 0;

    for (const e of w.enemiesInRadius(p.x, p.y, reach, 40)) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      let d = ((a - p.aim + Math.PI * 3) % TAU) - Math.PI;
      if (Math.abs(d) > halfArc) continue;
      w.damageEnemy(e, dmg(w, 26, l), 'steel', {
        knock: 240,
        dirX: e.x - p.x,
        dirY: e.y - p.y,
      });
      if (e.alive) w.applyPoison(e, dmg(w, 9, l), 2.6 * w.stats.duration);
      hits++;
    }
    if (hits > 0) w.healPlayer(Math.min(3, hits) * (0.4 + l * 0.15), false);

    // Slash visual: a fan of blades sweeping the arc.
    for (let i = 0; i < 5; i++) {
      const a = p.aim - halfArc + (i / 4) * halfArc * 2;
      w.addParticle(
        'slash', p.x + Math.cos(a) * reach * 0.55, p.y + Math.sin(a) * reach * 0.55,
        0, 0, 0.22, reach * 0.5, reach * 0.75, '#a8f0b4', true, 0, 1,
      );
    }
    audio.play('saw', 0.8);
  },
});

/* ---------------------------------------------- verdant + void: devourer --- */

fusion({
  id: 'devourer',
  glyph: 'devourer',
  name: 'Devourer',
  pairLabel: 'Bloom + Rift',
  elements: ['verdant', 'void'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Something hungry grows in the wound and passes itself along.',
  desc: (l) =>
    l === 1
      ? 'Infect enemies with <em>devouring spores</em> that drain life to you and <em>spread on death</em>.'
      : 'Devourer damage <em>+30%</em> and <em>+1 initial infection</em>.',
  cooldown: (l) => Math.max(0.9, 2.0 - l * 0.2),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const count = 2 + l;
    for (let i = 0; i < count; i++) {
      const t = w.randomEnemyNear(p.x, p.y, 440);
      if (!t || infected.has(t.uid)) continue;
      infect(w, t, l);
    }
    audio.play('shoot', 0.6);
  },
  update(w, inst, dt) {
    // Register the spread-on-death hook once, the first time this weapon runs.
    if (inst.s1 === 0) {
      inst.s1 = 1;
      // Enemy uids restart each run, so clear any ids left over from the last.
      infected.clear();
      w.killHooks.push((e) => {
        if (!infected.has(e.uid)) return;
        infected.delete(e.uid);
        const l = w.getWeaponInstance('devourer')?.level ?? 1;
        w.explode(e.x, e.y, 70, dmg(w, 14, l), 'verdant', { knock: 40 });
        // Jump to up to two fresh hosts nearby.
        let spread = 0;
        for (const o of w.enemiesInRadius(e.x, e.y, 150 * w.stats.area, 10)) {
          if (spread >= 2) break;
          if (infected.has(o.uid)) continue;
          infect(w, o, l);
          spread++;
        }
      });
    }

    // Drain: infected hosts feed the player a trickle of life.
    inst.s2 -= dt;
    if (inst.s2 > 0) return;
    inst.s2 = 0.5;
    if (infected.size === 0) return;

    const l = inst.level;
    let alive = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      if (!e.alive || !infected.has(e.uid)) continue;
      alive++;
      w.damageEnemy(e, dmg(w, 9, l), 'verdant', { noCrit: true, silent: true, trueDamage: true });
      w.addParticle('puff', e.x, e.y, rndRange(-20, 20), -40, 0.4, 9, 2, '#b98cff', true);
    }
    if (alive > 0) w.healPlayer(Math.min(2, alive * 0.25), false);

    // The set only grows if we never prune; drop ids that are no longer live.
    if (infected.size > 60) infected.clear();
  },
});

/** Uids of currently infected enemies. Module-scoped: only Devourer uses it. */
const infected = new Set<number>();

function infect(w: World, e: Enemy, level: number): void {
  infected.add(e.uid);
  w.applyPoison(e, dmg(w, 12, level), 6 * w.stats.duration);
  w.applyMark(e, 0.2 + level * 0.05, 6 * w.stats.duration);
  w.addParticle('ring', e.x, e.y, 0, 0, 0.35, 8, 46, '#b98cff', true);
}

/* ------------------------------------------- steel + void: gravity blades --- */

fusion({
  id: 'gravityblades',
  glyph: 'gravityblades',
  name: 'Gravity Blades',
  pairLabel: 'Edge + Rift',
  elements: ['steel', 'void'],
  kind: 'fusion',
  maxLevel: 5,
  flavor: 'Blades locked in orbit around a hole that drags the horde onto them.',
  desc: (l) =>
    l === 1
      ? 'A roaming <em>singularity</em> drags enemies into a ring of <em>orbiting blades</em>.'
      : 'Blade damage <em>+30%</em> and <em>+1 blade</em>.',
  cooldown: () => 999,
  update(w, inst, dt) {
    const l = inst.level;
    const count = 3 + l;
    inst.s1 += dt * 3.1;

    // The core hunts the nearest crowd and eases toward it, so the blade ring
    // sweeps across the field instead of teleporting between targets.
    const t = w.nearest(w.player.x, w.player.y, 340);
    const wantX = t ? t.x : w.player.x + Math.cos(w.player.aim) * 130;
    const wantY = t ? t.y : w.player.y + Math.sin(w.player.aim) * 130;
    if (inst.s2 === 0) {
      coreState.x = wantX;
      coreState.y = wantY;
      inst.s2 = 1;
    }
    const ease = Math.min(1, dt * 3.4);
    coreState.x += (wantX - coreState.x) * ease;
    coreState.y += (wantY - coreState.y) * ease;
    const coreX = coreState.x;
    const coreY = coreState.y;

    const refs = inst.refs;
    let live = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].alive && refs[i].weapon === 'gravityblades') refs[live++] = refs[i];
    }
    refs.length = live;

    while (refs.length < count) {
      const b = w.shoot({
        x: coreX,
        y: coreY,
        angle: 0,
        speed: 0,
        damage: 0,
        element: 'steel',
        weapon: 'gravityblades',
        art: 'sawblade',
        radius: 16,
        life: 9999,
        pierce: -1,
        flags: BulletFlag.Spin,
        p2: 1,
      });
      if (!b) break;
      refs.push(b);
    }

    const orbitR = 78 * w.stats.area;
    const damage = dmg(w, 17, l);
    const angles = ringAngles(refs.length, inst.s1);
    for (let i = 0; i < refs.length; i++) {
      const b = refs[i];
      b.life = 9999;
      b.damage = damage;
      b.knock = 60;
      b.x = coreX + Math.cos(angles[i]) * orbitR;
      b.y = coreY + Math.sin(angles[i]) * orbitR;
      b.rot += dt * 16;
      b.radius = 16 * w.stats.area;
    }

    // Pull everything toward the core.
    for (const e of w.enemiesInRadius(coreX, coreY, orbitR * 2.6, 40)) {
      const dx = coreX - e.x;
      const dy = coreY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.kx += (dx / d) * 240 * dt;
      e.ky += (dy / d) * 240 * dt;
      e.pulled = 0.15;
    }
    if (rnd() < dt * 12) {
      w.addParticle('puff', coreX, coreY, 0, 0, 0.4, 40, 6, '#b98cff', true);
    }
  },
  onHit(w, _b, enemyIndex) {
    const l = w.getWeaponInstance('gravityblades')?.level ?? 1;
    const e = w.enemies.items[enemyIndex];
    if (e?.alive) w.applyMark(e, 0.12 + l * 0.04, 2.4 * w.stats.duration);
    audio.play('saw', 0.35);
  },
});

/** Eased position of the Gravity Blades core. Only that weapon reads it. */
const coreState = { x: 0, y: 0 };

/* ---------------------------------------------------------------- lookup --- */

/** All fusion definitions. */
export const FUSION_LIST: FusionSpec[] = FUSIONS;

/** Fusion by element pair, e.g. `FUSION_BY_PAIR.get('fire+storm')`. */
export const FUSION_BY_PAIR = new Map<string, FusionSpec>();
for (const f of FUSIONS) {
  FUSION_BY_PAIR.set(pairKey(f.elements[0] as ElementKey, f.elements[1] as ElementKey), f);
}

/** Fusion by id. */
export const FUSION_BY_ID = new Map<string, FusionSpec>();
for (const f of FUSIONS) FUSION_BY_ID.set(f.id, f);
