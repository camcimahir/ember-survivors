import type { Poolable } from '../engine/pool';
import type { ElementKey } from '../art/style';

export type { ElementKey };

/* ------------------------------------------------------------- statuses --- */

/**
 * Status effects live inline on the enemy struct (rather than in a list) so the
 * hot update loop stays allocation-free and branch-predictable.
 */
export interface Statuses {
  /** Burn: damage over time. Stacks refresh duration and take the higher dps. */
  burnT: number;
  burnDps: number;
  /** Chill: movement slow, 0..0.85. */
  chillT: number;
  chillPower: number;
  /** Frozen: hard stop. Frozen enemies take bonus damage from shatter effects. */
  frozenT: number;
  /** Shock: brief stun + makes the target a better chain-lightning conductor. */
  shockT: number;
  /** Poison: damage over time that ignores armour. */
  poisonT: number;
  poisonDps: number;
  /** Root: cannot move, but can still act. */
  rootT: number;
  /** Void mark: amplifies all incoming damage. */
  markT: number;
  markPower: number;
  /** Wet: set by frost/water hits; amplifies shock and is consumed by fire. */
  wetT: number;
}

export function newStatuses(): Statuses {
  return {
    burnT: 0,
    burnDps: 0,
    chillT: 0,
    chillPower: 0,
    frozenT: 0,
    shockT: 0,
    poisonT: 0,
    poisonDps: 0,
    rootT: 0,
    markT: 0,
    markPower: 0,
    wetT: 0,
  };
}

export function clearStatuses(s: Statuses): void {
  s.burnT = 0;
  s.burnDps = 0;
  s.chillT = 0;
  s.chillPower = 0;
  s.frozenT = 0;
  s.shockT = 0;
  s.poisonT = 0;
  s.poisonDps = 0;
  s.rootT = 0;
  s.markT = 0;
  s.markPower = 0;
  s.wetT = 0;
}

/* -------------------------------------------------------------- enemies --- */

export type MobKind =
  | 'crawler'
  | 'runner'
  | 'brute'
  | 'spitter'
  | 'dasher'
  | 'bomber'
  | 'splitter'
  | 'wraith'
  | 'shielded'
  | 'boss';

export interface Enemy extends Poolable {
  kind: MobKind;
  /** Monotonic id. Pool slots are recycled, so this is what identifies an
   *  individual enemy to piercing projectiles that must not re-hit it. */
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Knockback velocity, decays fast and is applied on top of vx/vy. */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  xp: number;
  /** Damage multiplier taken from the front while shielded. */
  armor: number;
  elite: boolean;
  /** Facing: -1 left, 1 right. Drives the horizontal sprite flip. */
  face: number;
  /** Animation phase so a crowd doesn't pulse in lockstep. */
  phase: number;
  /** Flash timer set on hit; drives the white damage flash. */
  hitFlash: number;
  /** Per-kind behaviour timers. */
  t1: number;
  t2: number;
  /** Generic behaviour state machine slot (e.g. dasher wind-up stage). */
  state: number;
  st: Statuses;
  /** Splitter generation; 0 = original. Prevents infinite splitting. */
  gen: number;
  /** Scale multiplier applied to the sprite and hitbox. */
  scale: number;
  /** Set while the enemy is being pulled by a void effect. */
  pulled: number;
}

/* -------------------------------------------------------------- bullets --- */

/** Behaviour flags packed into one field; cheaper than a bag of booleans. */
export const enum BulletFlag {
  None = 0,
  Explode = 1 << 0,
  Homing = 1 << 1,
  Bounce = 1 << 2,
  Trail = 1 << 3,
  /** Leaves a damaging ground zone on expiry/impact. */
  Puddle = 1 << 4,
  /** Spins visually (saws, chakrams). */
  Spin = 1 << 5,
  /** Chains lightning on hit. */
  Chain = 1 << 6,
  /** Enemy-owned projectile: damages the player instead. */
  Hostile = 1 << 7,
  /** Grows over its lifetime. */
  Grow = 1 << 8,
  /** Pulls enemies toward it while travelling. */
  Pull = 1 << 9,
}

export interface Bullet extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  /** Remaining pierces; -1 means infinite. */
  pierce: number;
  flags: number;
  /** Visual key into the FX sheet. */
  art: string;
  element: ElementKey;
  rot: number;
  spin: number;
  /** Source weapon id — used to route on-hit behaviour. */
  weapon: string;
  /** Radius of the explosion produced on death, 0 for none. */
  blast: number;
  /** Knockback impulse applied on hit. */
  knock: number;
  /** Bounces remaining for Bounce bullets. */
  bounces: number;
  /** Generic tuning slot used by individual weapons. */
  p1: number;
  p2: number;
  /** Last enemy index hit, so a piercing shot doesn't multi-hit the same body. */
  lastHit: number;
  /** Cooldown before this bullet may damage again (piercing/orbital re-hit). */
  hitCd: number;
}

/* -------------------------------------------------------------- pickups --- */

export type PickupKind = 'xp' | 'heart' | 'magnet' | 'bomb' | 'chest';

export interface Pickup extends Poolable {
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  /** Set once the magnet grabs it; it then flies to the player. */
  homing: boolean;
  phase: number;
  life: number;
}

/* ------------------------------------------------------------ particles --- */

export type ParticleShape = 'spark' | 'puff' | 'ring' | 'shard' | 'text' | 'bolt' | 'slash';

export interface Particle extends Poolable {
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  rot: number;
  spin: number;
  color: string;
  /** Damage-number text, only used by the 'text' shape. */
  text: string;
  /** Additive blending for energy effects. */
  additive: boolean;
  drag: number;
  gravity: number;
}

/* ---------------------------------------------------------------- zones --- */

/** A persistent area effect: fire pools, void rifts, freeze fields. */
export interface Zone extends Poolable {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  dps: number;
  element: ElementKey;
  weapon: string;
  /** Inward pull strength in px/s applied to enemies inside. */
  pull: number;
  /** Ticks damage on this interval. */
  tickT: number;
  /** Follows the player when true (auras). */
  attached: boolean;
  art: string;
  /** Generic tuning slot. */
  p1: number;
  knock: number;
}

/* --------------------------------------------------------------- player --- */

export interface PlayerStats {
  maxHp: number;
  hpRegen: number;
  /** Percentage multiplier on all outgoing damage. 1.0 = base. */
  damage: number;
  /** Multiplier on all weapon cooldowns; lower is faster. */
  cooldown: number;
  /** Multiplier on projectile/AoE size. */
  area: number;
  /** Multiplier on projectile speed. */
  projSpeed: number;
  /** Multiplier on effect durations (burn, chill, zones). */
  duration: number;
  moveSpeed: number;
  pickupRadius: number;
  /** Flat damage reduction applied before HP loss. */
  armor: number;
  critChance: number;
  critMult: number;
  /** Extra projectiles added to multi-shot weapons. */
  extraProjectiles: number;
  /** XP gain multiplier. */
  xpGain: number;
  /** Chance for a level-up card to reroll into a higher rarity. */
  luck: number;
  /** Seconds of invulnerability after taking a hit. */
  iframes: number;
  /** Percentage of damage dealt returned as HP. */
  lifesteal: number;
  /** Contact damage dealt to enemies that touch the player. */
  thorns: number;
  /** Number of times death is prevented. */
  revives: number;
  /** Dash cooldown in seconds; 0 disables the dash. */
  dashCd: number;
}

export function baseStats(): PlayerStats {
  return {
    maxHp: 120,
    hpRegen: 0,
    damage: 1,
    cooldown: 1,
    area: 1,
    projSpeed: 1,
    duration: 1,
    moveSpeed: 176,
    pickupRadius: 62,
    armor: 0,
    critChance: 0.05,
    critMult: 2,
    extraProjectiles: 0,
    xpGain: 1,
    luck: 0,
    iframes: 0.75,
    lifesteal: 0,
    thorns: 0,
    revives: 0,
    dashCd: 0,
  };
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  face: number;
  /** Aim angle in radians; auto-targeted at the nearest threat. */
  aim: number;
  invuln: number;
  /** Walk-cycle phase driving the bob and lean. */
  phase: number;
  hitFlash: number;
  dashT: number;
  dashCdT: number;
  regenAcc: number;
  alive: boolean;
}

/* --------------------------------------------------------------- upgrades --- */

export type CardKind = 'element' | 'fusion' | 'passive';

export interface Card {
  id: string;
  kind: CardKind;
  name: string;
  desc: string;
  /** Level this pick would take the item to. */
  level: number;
  maxLevel: number;
  elements: ElementKey[];
  rarity: 'common' | 'rare' | 'epic' | 'fusion';
  /** Label shown above the name, e.g. "NEW ELEMENT" or "FUSION". */
  kindLabel: string;
}
