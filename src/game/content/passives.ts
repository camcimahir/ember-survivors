/**
 * Passive stat upgrades.
 *
 * These fill out the card pool once the player's three element slots are locked
 * and their weapons are maxed, and give non-element builds something to scale.
 */

import type { PlayerStats } from '../types';

export interface PassiveDef {
  id: string;
  name: string;
  /** Glyph key in art/icons.ts. */
  icon: string;
  /** Badge tint. */
  tint: string;
  maxLevel: number;
  desc: string;
  /** Applied once per level owned. */
  apply: (s: PlayerStats) => void;
  /** Extra work on pick, e.g. healing when max HP increases. */
  onPick?: (s: PlayerStats) => number;
}

export const PASSIVES: PassiveDef[] = [
  {
    id: 'vitality',
    name: 'Vitality',
    icon: 'heart',
    tint: '#8a2440',
    maxLevel: 6,
    desc: '<em>+22</em> max health, and heal for the amount gained.',
    apply: (s) => {
      s.maxHp += 22;
    },
    onPick: () => 22,
  },
  {
    id: 'swift',
    name: 'Swiftness',
    icon: 'boot',
    tint: '#2a6a8a',
    maxLevel: 6,
    desc: '<em>+9%</em> movement speed.',
    apply: (s) => {
      s.moveSpeed *= 1.09;
    },
  },
  {
    id: 'might',
    name: 'Might',
    icon: 'sword',
    tint: '#8a3a20',
    maxLevel: 8,
    desc: '<em>+12%</em> damage with everything.',
    apply: (s) => {
      s.damage *= 1.12;
    },
  },
  {
    id: 'haste',
    name: 'Haste',
    icon: 'clock',
    tint: '#5a4a8a',
    maxLevel: 6,
    desc: '<em>-8%</em> weapon cooldown.',
    apply: (s) => {
      s.cooldown *= 0.92;
    },
  },
  {
    id: 'resonance',
    name: 'Resonance',
    icon: 'area',
    tint: '#2a5a8a',
    maxLevel: 6,
    desc: '<em>+12%</em> area of effect.',
    apply: (s) => {
      s.area *= 1.12;
    },
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    icon: 'shield',
    tint: '#3a4a6a',
    maxLevel: 6,
    desc: '<em>+3</em> armour: reduces every hit you take.',
    apply: (s) => {
      s.armor += 3;
    },
  },
  {
    id: 'lodestone',
    name: 'Lodestone',
    icon: 'magnet',
    tint: '#2a6a6a',
    maxLevel: 5,
    desc: '<em>+30%</em> pickup radius.',
    apply: (s) => {
      s.pickupRadius *= 1.3;
    },
  },
  {
    id: 'keen',
    name: 'Keen Eye',
    icon: 'crit',
    tint: '#8a6a20',
    maxLevel: 6,
    desc: '<em>+6%</em> critical strike chance.',
    apply: (s) => {
      s.critChance += 0.06;
    },
  },
  {
    id: 'brutal',
    name: 'Brutality',
    icon: 'crit',
    tint: '#8a2a2a',
    maxLevel: 5,
    desc: '<em>+35%</em> critical damage.',
    apply: (s) => {
      s.critMult += 0.35;
    },
  },
  {
    id: 'multishot',
    name: 'Split Shot',
    icon: 'multi',
    tint: '#6a4a8a',
    maxLevel: 3,
    desc: '<em>+1</em> projectile for weapons that fire them.',
    apply: (s) => {
      s.extraProjectiles += 1;
    },
  },
  {
    id: 'scholar',
    name: 'Scholar',
    icon: 'xp',
    tint: '#2a6a8a',
    maxLevel: 5,
    desc: '<em>+18%</em> experience gained.',
    apply: (s) => {
      s.xpGain *= 1.18;
    },
  },
  {
    id: 'fortune',
    name: 'Fortune',
    icon: 'luck',
    tint: '#2a7a4a',
    maxLevel: 4,
    desc: '<em>+12%</em> luck: better cards appear more often.',
    apply: (s) => {
      s.luck += 0.12;
    },
  },
  {
    id: 'regrowth',
    name: 'Regrowth',
    icon: 'regen',
    tint: '#2a7a4a',
    maxLevel: 5,
    desc: 'Regenerate <em>+0.7</em> health per second.',
    apply: (s) => {
      s.hpRegen += 0.7;
    },
  },
  {
    id: 'thorns',
    name: 'Spiked Hide',
    icon: 'thorns',
    tint: '#6a5a3a',
    maxLevel: 4,
    desc: 'Deal <em>10</em> damage to anything that touches you.',
    apply: (s) => {
      s.thorns += 10;
    },
  },
  {
    id: 'bloodpact',
    name: 'Blood Pact',
    icon: 'lifesteal',
    tint: '#7a2038',
    maxLevel: 4,
    desc: 'Kills restore <em>2</em> health, up to <em>3</em> health per second.',
    apply: (s) => {
      s.healOnKill += 2;
      s.healRate += 3;
    },
  },
  {
    id: 'lingering',
    name: 'Lingering',
    icon: 'clock',
    tint: '#4a6a4a',
    maxLevel: 5,
    desc: '<em>+18%</em> duration for burns, chills, zones and rifts.',
    apply: (s) => {
      s.duration *= 1.18;
    },
  },
  {
    id: 'velocity',
    name: 'Velocity',
    icon: 'dash',
    tint: '#4a5a8a',
    maxLevel: 4,
    desc: '<em>+18%</em> projectile speed.',
    apply: (s) => {
      s.projSpeed *= 1.18;
    },
  },
  {
    id: 'blink',
    name: 'Blink',
    icon: 'dash',
    tint: '#6a5a20',
    maxLevel: 3,
    desc: 'Automatically <em>dash</em> out of danger when surrounded. Shorter cooldown each level.',
    apply: (s) => {
      s.dashCd = s.dashCd === 0 ? 3.2 : Math.max(1.2, s.dashCd - 0.8);
    },
  },
  {
    id: 'secondwind',
    name: 'Second Wind',
    icon: 'revive',
    tint: '#8a6a20',
    maxLevel: 2,
    desc: 'Survive a fatal hit once, restoring <em>55%</em> health.',
    apply: (s) => {
      s.revives += 1;
    },
  },
];

export const PASSIVE_BY_ID = new Map<string, PassiveDef>();
for (const p of PASSIVES) PASSIVE_BY_ID.set(p.id, p);
