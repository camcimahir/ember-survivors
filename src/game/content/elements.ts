/**
 * The six elemental base weapons.
 *
 * Each element owns one weapon and one signature status effect. The player may
 * hold at most three elements — that constraint is what makes the fusion system
 * (see fusions.ts) a real build decision rather than a checklist.
 */

import { rndRange } from '../../engine/rng';
import { audio } from '../../engine/audio';
import { BulletFlag } from '../types';
import { registerWeapon, ringAngles, scale, spreadAngles, type WeaponDef } from '../weapons';
import type { World } from '../world';

/** Damage helper: weapon base damage scaled by level and the player's stat. */
function dmg(w: World, base: number, level: number, per = 0.26): number {
  return base * scale(level, per) * w.stats.damage;
}

/* -------------------------------------------------------------- sidearm --- */

/**
 * The survivor's own gun. Every run starts with it, it never appears on a card,
 * and it costs no element slot — it only guarantees that the player is never
 * completely without a way to fight back. It scales with passives, not levels.
 */
export const SIDEARM: WeaponDef = registerWeapon({
  id: 'sidearm',
  name: 'Sidearm',
  elements: ['steel'],
  kind: 'basic',
  maxLevel: 1,
  flavor: 'Your service pistol. Never impressive, never empty.',
  desc: () => 'Fires steadily at the nearest enemy.',
  cooldown: () => 0.52,
  fire(w) {
    const p = w.player;
    const target = w.nearest(p.x, p.y, 520);
    if (!target) return;
    const a = Math.atan2(target.y - p.y, target.x - p.x);
    w.shoot({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22 + 4,
      angle: a,
      speed: 560,
      damage: 6 * w.stats.damage,
      element: 'steel',
      weapon: 'sidearm',
      art: 'boltSteel',
      radius: 6,
      life: 1.1,
      knock: 70,
    });
    w.muzzleFlash(a);
    audio.play('shoot', 0.55);
  },
});

/* ----------------------------------------------------------------- fire --- */

export const CINDER_BOLT: WeaponDef = registerWeapon({
  id: 'fire',
  name: 'Cinder Bolt',
  elements: ['fire'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'Hurls a bolt of living flame that bursts on impact.',
  desc: (l) => {
    if (l === 1) return 'Fire a <em>bursting fireball</em> at the nearest foe. Ignites for damage over time.';
    if (l === 3) return '<em>+1 fireball</em> and a wider burst.';
    if (l === 5) return '<em>+1 fireball</em>. Burn damage <em>+40%</em>.';
    if (l === 7) return 'Fireballs <em>pierce</em> one enemy before bursting.';
    return 'Fireball damage <em>+26%</em> and burst radius <em>+10%</em>.';
  },
  cooldown: (l) => Math.max(0.34, 0.86 - l * 0.055),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const count = 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0) + w.stats.extraProjectiles;
    const angles = spreadAngles(p.aim, count, count > 1 ? 0.3 + count * 0.05 : 0);
    for (const a of angles) {
      w.shoot({
        x: p.x + Math.cos(a) * 22,
        y: p.y + Math.sin(a) * 22 + 4,
        angle: a,
        speed: 430,
        damage: dmg(w, 7.5, l),
        element: 'fire',
        weapon: 'fire',
        art: 'fireball',
        radius: 9,
        life: 1.5,
        pierce: l >= 7 ? 1 : 0,
        flags: BulletFlag.Trail,
        blast: 42 * (1 + (l - 1) * 0.1) * (l >= 3 ? 1.15 : 1),
        knock: 130,
      });
    }
    w.muzzleFlash(p.aim);
    audio.play('shoot');
  },
  onHit(w, _b, enemyIndex) {
    const l = w.getWeaponInstance('fire')?.level ?? 1;
    const e = w.enemies.items[enemyIndex];
    if (!e?.alive) return;
    // The bullet's blast burns the group; this covers the direct hit so single
    // targets are not shortchanged.
    const burn = 9 * scale(l, 0.3) * w.stats.damage * (l >= 5 ? 1.4 : 1);
    w.applyBurn(e, burn, 2.4 * w.stats.duration);
  },
});

/* ---------------------------------------------------------------- storm --- */

export const ARC_COIL: WeaponDef = registerWeapon({
  id: 'storm',
  name: 'Arc Coil',
  elements: ['storm'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'A coil that discharges arcs of lightning between nearby foes.',
  desc: (l) => {
    if (l === 1) return 'Discharge <em>chain lightning</em> that leaps between enemies. Chance to <em>stun</em>.';
    if (l === 2) return '<em>+1 chain jump</em>.';
    if (l === 4) return '<em>+1 chain jump</em> and <em>+25% range</em>.';
    if (l === 6) return 'Fires <em>two arcs</em> per discharge.';
    if (l === 8) return '<em>+2 chain jumps</em>. Arcs no longer lose power.';
    return 'Arc damage <em>+26%</em>.';
  },
  cooldown: (l) => Math.max(0.4, 1.15 - l * 0.075),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const jumps = 2 + (l >= 2 ? 1 : 0) + (l >= 4 ? 1 : 0) + (l >= 8 ? 2 : 0);
    const range = (190 + (l >= 4 ? 48 : 0)) * w.stats.area;
    const arcs = l >= 6 ? 2 : 1;
    const falloff = l >= 8 ? 1 : 0.84;

    for (let i = 0; i < arcs; i++) {
      const target = i === 0 ? w.nearest(p.x, p.y, 520) : w.randomEnemyNear(p.x, p.y, 460);
      if (!target) break;
      w.chain(p.x, p.y - 6, dmg(w, 12, l), jumps, range, 'storm', falloff, target);
    }
  },
});

/* ---------------------------------------------------------------- frost --- */

export const RIME_NOVA: WeaponDef = registerWeapon({
  id: 'frost',
  name: 'Rime Nova',
  elements: ['frost'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'A pulse of glacial air that erupts outward from you.',
  desc: (l) => {
    if (l === 1) return 'Erupt a <em>ring of frost</em> around you. Chills enemies, slowing them.';
    if (l === 3) return 'Chilled enemies are also <em>soaked</em> — they take more shock damage.';
    if (l === 5) return 'The nova <em>freezes</em> enemies solid for a moment.';
    if (l === 7) return 'Leaves a lingering <em>frost field</em> behind.';
    return 'Nova damage <em>+26%</em> and radius <em>+12%</em>.';
  },
  cooldown: (l) => Math.max(1.1, 2.4 - l * 0.16),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const radius = 148 * (1 + (l - 1) * 0.12);
    w.nova(p.x, p.y, radius, dmg(w, 10, l), 'frost', { knock: 200 });
    w.fxRing(p.x, p.y, radius * w.stats.area, '#c8f6ff', 0.42);
    audio.play('freeze');

    const targets = w.enemiesInRadius(p.x, p.y, radius * w.stats.area, 40);
    for (const e of targets) {
      w.applyChill(e, 0.35 + l * 0.035, 2 * w.stats.duration);
      if (l >= 3) w.applyWet(e, 3 * w.stats.duration);
      if (l >= 5) w.applyFreeze(e, 0.5 * w.stats.duration);
    }
    if (l >= 7) {
      w.zone({
        x: p.x,
        y: p.y,
        radius: radius * 0.8,
        life: 2.6,
        dps: dmg(w, 5, l),
        element: 'frost',
        weapon: 'frost',
      });
    }
  },
});

/* -------------------------------------------------------------- verdant --- */

export const THORNSEED: WeaponDef = registerWeapon({
  id: 'verdant',
  name: 'Thornseed',
  elements: ['verdant'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'Seeking spores that root their prey and drink from it.',
  desc: (l) => {
    if (l === 1) return 'Launch <em>seeking spores</em> that poison on contact.';
    if (l === 2) return '<em>+1 spore</em>.';
    if (l === 4) return 'Spores <em>root</em> enemies in place briefly.';
    if (l === 6) return '<em>+1 spore</em>. Kills <em>heal you</em>.';
    if (l === 8) return 'Spores burst into a <em>toxic cloud</em>.';
    return 'Spore damage <em>+26%</em> and poison <em>+20%</em>.';
  },
  cooldown: (l) => Math.max(0.5, 1.35 - l * 0.09),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const count = 2 + (l >= 2 ? 1 : 0) + (l >= 6 ? 1 : 0) + w.stats.extraProjectiles;
    const angles = spreadAngles(p.aim, count, 0.85);
    for (const a of angles) {
      w.shoot({
        x: p.x,
        y: p.y + 4,
        angle: a + rndRange(-0.08, 0.08),
        speed: 300,
        damage: dmg(w, 9, l),
        element: 'verdant',
        weapon: 'verdant',
        art: 'spore',
        radius: 8,
        life: 2.3,
        pierce: 0,
        flags: BulletFlag.Homing | BulletFlag.Trail,
        spin: 5,
        blast: l >= 8 ? 46 : 0,
        knock: 60,
        p1: 5.4, // turn rate, rad/s
      });
    }
    audio.play('shoot', 0.7);
  },
  onHit(w, _b, enemyIndex) {
    const l = w.getWeaponInstance('verdant')?.level ?? 1;
    const e = w.enemies.items[enemyIndex];
    if (!e) return;
    if (l >= 6 && !e.alive) {
      w.healPlayer(1, false);
      return;
    }
    if (!e.alive) return;
    w.applyPoison(e, 10 * scale(l, 0.3) * w.stats.damage * (1 + (l - 1) * 0.2), 3 * w.stats.duration);
    if (l >= 4) w.applyRoot(e, 0.5 * w.stats.duration);
  },
});

/* ---------------------------------------------------------------- steel --- */

export const BUZZSAW: WeaponDef = registerWeapon({
  id: 'steel',
  name: 'Buzzsaw',
  elements: ['steel'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'Spinning blades that orbit you and shred anything they touch.',
  desc: (l) => {
    if (l === 1) return '<em>Orbiting sawblades</em> shred enemies on contact. Shatters frozen foes.';
    if (l === 2) return '<em>+1 blade</em>.';
    if (l === 4) return '<em>+1 blade</em> and a wider orbit.';
    if (l === 6) return '<em>+1 blade</em>. Blades spin <em>faster</em>.';
    if (l === 8) return '<em>+2 blades</em> and <em>+30% orbit radius</em>.';
    return 'Blade damage <em>+26%</em>.';
  },
  cooldown: () => 999, // orbital: driven entirely by update()
  update(w, inst, dt) {
    const l = inst.level;
    const count =
      2 + (l >= 2 ? 1 : 0) + (l >= 4 ? 1 : 0) + (l >= 6 ? 1 : 0) + (l >= 8 ? 2 : 0);
    const orbitR = (74 + (l >= 4 ? 18 : 0)) * (l >= 8 ? 1.3 : 1) * w.stats.area;
    const spinRate = (1.9 + (l >= 6 ? 0.8 : 0)) / Math.max(0.5, w.stats.cooldown);

    inst.s1 += dt * spinRate;

    // Reuse live blades; top up any that were swept away.
    const refs = inst.refs;
    let live = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].alive && refs[i].weapon === 'steel') refs[live++] = refs[i];
    }
    refs.length = live;

    while (refs.length < count) {
      const b = w.shoot({
        x: w.player.x,
        y: w.player.y,
        angle: 0,
        speed: 0,
        damage: 0,
        element: 'steel',
        weapon: 'steel',
        art: 'sawblade',
        radius: 17,
        life: 9999,
        pierce: -1,
        flags: BulletFlag.Spin,
        p2: 1, // marks this bullet as orbital-controlled
      });
      if (!b) break;
      refs.push(b);
    }

    const damage = dmg(w, 11, l);
    const angles = ringAngles(refs.length, inst.s1);
    for (let i = 0; i < refs.length; i++) {
      const b = refs[i];
      b.life = 9999;
      b.damage = damage;
      b.knock = 150;
      b.x = w.player.x + Math.cos(angles[i]) * orbitR;
      b.y = w.player.y + Math.sin(angles[i]) * orbitR + 4;
      b.rot += dt * 15;
      b.radius = 17 * w.stats.area;
    }
  },
  onHit() {
    audio.play('saw', 0.4);
  },
});

/* ----------------------------------------------------------------- void --- */

export const SINGULARITY: WeaponDef = registerWeapon({
  id: 'void',
  name: 'Singularity',
  elements: ['void'],
  kind: 'base',
  maxLevel: 8,
  flavor: 'Tears a rift that drags the horde inward and unmakes it.',
  desc: (l) => {
    if (l === 1) return 'Open a <em>rift</em> that pulls enemies in and marks them for extra damage.';
    if (l === 3) return 'The rift <em>collapses</em> for burst damage when it closes.';
    if (l === 5) return '<em>+1 rift</em> per cast.';
    if (l === 7) return 'Rifts last <em>longer</em> and pull <em>much harder</em>.';
    return 'Rift damage <em>+26%</em> and radius <em>+10%</em>.';
  },
  cooldown: (l) => Math.max(2.4, 5.4 - l * 0.34),
  fire(w, inst) {
    const p = w.player;
    const l = inst.level;
    const casts = l >= 5 ? 2 : 1;
    for (let i = 0; i < casts; i++) {
      // Drop the rift on the densest nearby cluster, else ahead of the player.
      const target = i === 0 ? w.nearest(p.x, p.y, 460) : w.randomEnemyNear(p.x, p.y, 480);
      const x = target ? target.x : p.x + Math.cos(p.aim) * 150;
      const y = target ? target.y : p.y + Math.sin(p.aim) * 150;
      w.zone({
        x,
        y,
        radius: 96 * (1 + (l - 1) * 0.1),
        life: 3 * (l >= 7 ? 1.5 : 1),
        dps: dmg(w, 16, l),
        element: 'void',
        weapon: 'void',
        pull: 270 * (l >= 7 ? 1.8 : 1),
        grow: true,
        // From level 3 the rift implodes when it closes.
        collapse: l >= 3 ? dmg(w, 26, l) : 0,
      });
      w.addParticle('ring', x, y, 0, 0, 0.5, 20, 180, '#d9b4ff', true);
    }
    audio.play('shootHeavy', 0.7);
  },
});

export const ELEMENT_WEAPONS: Record<string, WeaponDef> = {
  fire: CINDER_BOLT,
  storm: ARC_COIL,
  frost: RIME_NOVA,
  verdant: THORNSEED,
  steel: BUZZSAW,
  void: SINGULARITY,
};

/** Short blurbs shown when an element is first offered. */
export const ELEMENT_INFO: Record<string, { title: string; status: string }> = {
  fire: { title: 'Ember', status: 'Burn' },
  storm: { title: 'Volt', status: 'Shock' },
  frost: { title: 'Rime', status: 'Chill' },
  verdant: { title: 'Bloom', status: 'Poison' },
  steel: { title: 'Edge', status: 'Shatter' },
  void: { title: 'Rift', status: 'Mark' },
};
