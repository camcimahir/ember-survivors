/**
 * Weapon framework.
 *
 * Every weapon in the game — the 6 elemental base weapons and all 15 fusions —
 * is one `WeaponDef`. Behaviour is expressed by composing a small set of attack
 * primitives that live on `World` (projectiles, chains, novas, zones, orbitals,
 * beams), so adding a weapon is a data change rather than a new system.
 */

import type { Bullet, ElementKey } from './types';
import type { World } from './world';

/** Runtime state for one owned weapon. */
export interface WeaponInstance {
  def: WeaponDef;
  level: number;
  /** Seconds until the next activation. */
  cd: number;
  /** Total seconds this weapon has been owned; drives orbit phase etc. */
  t: number;
  /** Scratch state slots for weapon-specific bookkeeping. */
  s1: number;
  s2: number;
  /** Live orbital projectiles owned by this weapon, if any. */
  refs: Bullet[];
}

export interface WeaponDef {
  id: string;
  name: string;
  /** One element for base weapons, two for fusions. */
  elements: ElementKey[];
  /**
   * `basic` is the starting sidearm: always owned, never offered as a card, and
   * it does not occupy an element slot. It exists so a run can never dead-end
   * with no way to deal damage.
   */
  kind: 'base' | 'fusion' | 'basic';
  maxLevel: number;
  /** Flavour text shown when the weapon is first offered. */
  flavor: string;
  /**
   * Description of what taking the weapon *to* `level` does. Level 1 describes
   * the weapon itself; levels above that describe the increment.
   */
  desc: (level: number) => string;
  /** Base cooldown in seconds at the given level, before player stat scaling. */
  cooldown: (level: number) => number;
  /** Called when the cooldown elapses. */
  fire?: (w: World, inst: WeaponInstance) => void;
  /** Called every sim step; used by orbitals and persistent auras. */
  update?: (w: World, inst: WeaponInstance, dt: number) => void;
  /** Called when one of this weapon's bullets hits an enemy. */
  onHit?: (w: World, b: Bullet, enemyIndex: number) => void;
  /** Called when one of this weapon's bullets expires or impacts. */
  onExpire?: (w: World, b: Bullet) => void;
}

export function newInstance(def: WeaponDef): WeaponInstance {
  return { def, level: 1, cd: 0.35, t: 0, s1: 0, s2: 0, refs: [] };
}

/* ------------------------------------------------------------- helpers --- */

/**
 * Evenly spreads `count` projectiles across `arcRadians`, centred on `aim`.
 * A single projectile fires exactly on `aim`.
 */
export function spreadAngles(aim: number, count: number, arcRadians: number): number[] {
  const out: number[] = [];
  if (count <= 1) {
    out.push(aim);
    return out;
  }
  const step = arcRadians / (count - 1);
  const start = aim - arcRadians / 2;
  for (let i = 0; i < count; i++) out.push(start + step * i);
  return out;
}

/** Ring of `count` evenly spaced angles, offset by `phase`. */
export function ringAngles(count: number, phase = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(phase + (i / count) * Math.PI * 2);
  return out;
}

/**
 * Level scaling curve used by most weapons: returns a multiplier that grows
 * from 1.0 at level 1. Keeps damage growth predictable across 21 weapons.
 */
export function scale(level: number, perLevel = 0.22): number {
  return 1 + (level - 1) * perLevel;
}

/** Prunes dead orbital references and reports how many are still live. */
export function pruneRefs(inst: WeaponInstance): number {
  const refs = inst.refs;
  let n = 0;
  for (let i = 0; i < refs.length; i++) {
    const b = refs[i];
    if (b.alive && b.weapon === inst.def.id) refs[n++] = b;
  }
  refs.length = n;
  return n;
}

/* -------------------------------------------------------------- registry --- */

const registry = new Map<string, WeaponDef>();

export function registerWeapon(def: WeaponDef): WeaponDef {
  registry.set(def.id, def);
  return def;
}

export function getWeapon(id: string): WeaponDef | undefined {
  return registry.get(id);
}

export function allWeapons(): WeaponDef[] {
  return [...registry.values()];
}

/** Sorted pair key used to look up the fusion for two elements. */
export function pairKey(a: ElementKey, b: ElementKey): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}
