/**
 * Mob roster: stats, art binding and per-kind behaviour.
 *
 * Base stats are multiplied by a time-based difficulty curve in the spawner, so
 * the numbers here describe each mob's *role* (fast/tanky/ranged) rather than
 * its absolute power at any point in the run.
 */

import type { ActorKey } from '../../art/actors';
import type { MobKind } from '../types';

export interface MobDef {
  kind: MobKind;
  art: ActorKey;
  hp: number;
  speed: number;
  /** Contact damage per hit. */
  damage: number;
  radius: number;
  xp: number;
  /** Render scale applied to the base sprite. */
  scale: number;
  /** 0..0.9 fraction of knockback ignored. */
  knockResist: number;
  /** Fraction of incoming damage ignored. */
  armor: number;
  /** Earliest run-time (seconds) this mob may appear. */
  unlockAt: number;
  /** Relative spawn weight once unlocked. */
  weight: number;
  name: string;
}

export const MOBS: Record<MobKind, MobDef> = {
  crawler: {
    kind: 'crawler',
    art: 'crawler',
    name: 'Crawler',
    hp: 10,
    speed: 52,
    damage: 6,
    radius: 15,
    xp: 2,
    scale: 1,
    knockResist: 0,
    armor: 0,
    unlockAt: 0,
    weight: 100,
  },
  runner: {
    kind: 'runner',
    art: 'runner',
    name: 'Runner',
    hp: 8,
    speed: 96,
    damage: 5,
    radius: 13,
    xp: 2,
    scale: 0.92,
    knockResist: 0,
    armor: 0,
    unlockAt: 45,
    weight: 62,
  },
  spitter: {
    kind: 'spitter',
    art: 'spitter',
    name: 'Spitter',
    hp: 18,
    speed: 40,
    damage: 7,
    radius: 16,
    xp: 6,
    scale: 1,
    knockResist: 0.1,
    armor: 0,
    unlockAt: 90,
    weight: 34,
  },
  dasher: {
    kind: 'dasher',
    art: 'dasher',
    name: 'Dasher',
    hp: 16,
    speed: 62,
    damage: 11,
    radius: 15,
    xp: 6,
    scale: 1,
    knockResist: 0.2,
    armor: 0,
    unlockAt: 130,
    weight: 32,
  },
  bomber: {
    kind: 'bomber',
    art: 'bomber',
    name: 'Bomber',
    hp: 22,
    speed: 46,
    damage: 20,
    radius: 17,
    xp: 8,
    scale: 1,
    knockResist: 0.15,
    armor: 0,
    unlockAt: 170,
    weight: 26,
  },
  brute: {
    kind: 'brute',
    art: 'brute',
    name: 'Brute',
    hp: 70,
    speed: 34,
    damage: 16,
    radius: 25,
    xp: 16,
    scale: 1.05,
    knockResist: 0.65,
    armor: 0.1,
    unlockAt: 110,
    weight: 22,
  },
  splitter: {
    kind: 'splitter',
    art: 'splitter',
    name: 'Splitter',
    hp: 34,
    speed: 44,
    damage: 8,
    radius: 20,
    xp: 8,
    scale: 1,
    knockResist: 0.25,
    armor: 0,
    unlockAt: 210,
    weight: 24,
  },
  wraith: {
    kind: 'wraith',
    art: 'wraith',
    name: 'Wraith',
    hp: 26,
    speed: 78,
    damage: 12,
    radius: 15,
    xp: 10,
    scale: 1,
    knockResist: 0.4,
    armor: 0,
    unlockAt: 250,
    weight: 22,
  },
  shielded: {
    kind: 'shielded',
    art: 'shielded',
    name: 'Bulwark',
    hp: 55,
    speed: 42,
    damage: 12,
    radius: 18,
    xp: 12,
    scale: 1,
    knockResist: 0.5,
    // Blocks 55% of damage taken from the front; flanking removes it.
    armor: 0.55,
    unlockAt: 290,
    weight: 20,
  },
  boss: {
    kind: 'boss',
    art: 'boss',
    name: 'Warden',
    hp: 1400,
    speed: 40,
    damage: 26,
    radius: 46,
    xp: 240,
    scale: 1,
    knockResist: 0.95,
    armor: 0.12,
    unlockAt: 0,
    weight: 0,
  },
};

/** Boss display names, cycled as the run escalates. */
export const BOSS_NAMES = [
  'Warden of Ash',
  'The Gorging Maw',
  'Hollow Sovereign',
  'Rotcrown Tyrant',
  'The Last Hunger',
];

/** Mobs eligible to spawn at `t` seconds, with their weights. */
export function spawnTable(t: number): { kinds: MobKind[]; weights: number[] } {
  const kinds: MobKind[] = [];
  const weights: number[] = [];
  for (const k of Object.keys(MOBS) as MobKind[]) {
    const m = MOBS[k];
    if (m.weight <= 0 || t < m.unlockAt) continue;
    kinds.push(k);
    // Basic mobs slowly fall out of the mix so later waves feel different.
    let w = m.weight;
    if (k === 'crawler') w = Math.max(18, w - t * 0.22);
    if (k === 'runner') w = Math.max(20, w - t * 0.06);
    weights.push(w);
  }
  return { kinds, weights };
}
