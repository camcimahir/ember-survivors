/**
 * The simulation.
 *
 * `World` owns every pool, the player, and the attack primitives that weapons
 * compose. It is deliberately framework-free: no rendering, no DOM. `render.ts`
 * draws it and `main.ts` drives it.
 */

import { Camera } from '../engine/camera';
import { clamp, dist2, formatShort, TAU } from '../engine/math';
import { Pool } from '../engine/pool';
import { rand, rnd, rndAngle, rndRange } from '../engine/rng';
import { SpatialHash } from '../engine/spatial';
import { ELEMENT_FX } from '../art/fx';
import { PALETTE } from '../art/style';
import { MOBS, spawnTable, BOSS_NAMES } from './content/mobs';
import { SIDEARM } from './content/elements';
import {
  BulletFlag,
  baseStats,
  clearStatuses,
  newStatuses,
  type Bullet,
  type ElementKey,
  type Enemy,
  type Particle,
  type Pickup,
  type Player,
  type PlayerStats,
  type MobKind,
  type Zone,
} from './types';
import { getWeapon, newInstance, type WeaponDef, type WeaponInstance } from './weapons';
import { audio } from '../engine/audio';

/* ------------------------------------------------------------ factories --- */

const mkEnemy = (): Enemy => ({
  alive: false,
  kind: 'crawler',
  uid: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  kx: 0,
  ky: 0,
  hp: 1,
  maxHp: 1,
  radius: 14,
  speed: 50,
  damage: 5,
  xp: 1,
  armor: 0,
  elite: false,
  face: 1,
  phase: 0,
  hitFlash: 0,
  t1: 0,
  t2: 0,
  state: 0,
  st: newStatuses(),
  gen: 0,
  scale: 1,
  pulled: 0,
});

const mkBullet = (): Bullet => ({
  alive: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  prevX: 0,
  prevY: 0,
  radius: 6,
  damage: 1,
  life: 1,
  maxLife: 1,
  pierce: 0,
  flags: 0,
  art: 'boltFire',
  element: 'fire',
  rot: 0,
  spin: 0,
  weapon: '',
  blast: 0,
  knock: 0,
  bounces: 0,
  p1: 0,
  p2: 0,
  lastHit: -1,
  hitCd: 0,
});

const mkPickup = (): Pickup => ({
  alive: false,
  kind: 'xp',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  value: 1,
  homing: false,
  phase: 0,
  life: 0,
});

const mkParticle = (): Particle => ({
  alive: false,
  shape: 'spark',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  size: 4,
  endSize: 0,
  rot: 0,
  spin: 0,
  color: '#fff',
  text: '',
  additive: false,
  drag: 0.9,
  gravity: 0,
});

const mkZone = (): Zone => ({
  alive: false,
  x: 0,
  y: 0,
  radius: 40,
  maxRadius: 40,
  life: 1,
  maxLife: 1,
  dps: 10,
  element: 'fire',
  weapon: '',
  pull: 0,
  tickT: 0,
  attached: false,
  art: 'zoneFire',
  p1: 0,
  knock: 0,
});

/* ---------------------------------------------------------------- world --- */

export type GamePhase = 'menu' | 'playing' | 'levelup' | 'paused' | 'dead' | 'victory';

export interface RunStats {
  kills: number;
  damageDealt: number;
  xpCollected: number;
  timeSurvived: number;
  level: number;
  wave: number;
  bossesKilled: number;
}

/** Options accepted by `World.shoot`. */
export interface ShootOpts {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  element: ElementKey;
  weapon: string;
  art: string;
  radius?: number;
  life?: number;
  pierce?: number;
  flags?: number;
  blast?: number;
  knock?: number;
  spin?: number;
  bounces?: number;
  p1?: number;
  p2?: number;
}

export interface DamageOpts {
  /** Skip the crit roll (DoT ticks, zone ticks). */
  noCrit?: boolean;
  /** Knockback impulse. */
  knock?: number;
  /** Direction of the hit, used for knockback and shield facing. */
  dirX?: number;
  dirY?: number;
  /** Suppresses the floating damage number (used for rapid DoT ticks). */
  silent?: boolean;
  /** Ignores armour entirely. */
  trueDamage?: boolean;
}

export class World {
  readonly enemies = new Pool<Enemy>(mkEnemy, 420, 160);
  readonly bullets = new Pool<Bullet>(mkBullet, 760, 200);
  readonly pickups = new Pool<Pickup>(mkPickup, 620, 200);
  readonly particles = new Pool<Particle>(mkParticle, 940, 260);
  readonly zones = new Pool<Zone>(mkZone, 72, 24);

  readonly camera = new Camera();
  private readonly grid = new SpatialHash(72);

  player: Player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 100,
    face: 1,
    aim: 0,
    invuln: 0,
    phase: 0,
    hitFlash: 0,
    dashT: 0,
    dashCdT: 0,
    regenAcc: 0,
    alive: true,
  };

  stats: PlayerStats = baseStats();
  weapons: WeaponInstance[] = [];
  /** Element levels; only elements the player owns appear here. */
  elementLevels = new Map<ElementKey, number>();
  /** Passive upgrade levels, keyed by passive id. */
  passiveLevels = new Map<string, number>();
  /** Fusions the player has taken. */
  fusionIds = new Set<string>();

  phase: GamePhase = 'menu';
  time = 0;
  level = 1;
  xp = 0;
  xpNeeded = 5;
  /** Pending level-ups, so multiple levels in one frame all get a card screen. */
  pendingLevels = 0;

  wave = 1;
  waveTimer = 0;
  spawnAcc = 0;
  bossActive = false;
  bossRef: Enemy | null = null;
  bossName = BOSS_NAMES[0];
  nextBossAt = 120;
  private nextUid = 1;

  /** Viewport size in world units; spawns are placed just outside it. */
  viewW = 480;
  viewH = 900;

  run: RunStats = {
    kills: 0,
    damageDealt: 0,
    xpCollected: 0,
    timeSurvived: 0,
    level: 1,
    wave: 1,
    bossesKilled: 0,
  };

  /** Reroll/banish charges available on the level-up screen. */
  rerolls = 2;
  banishes = 1;

  /**
   * Called for every enemy death. Weapons register here for on-kill behaviour
   * (the Devourer's spreading infection); the UI does not use it.
   */
  readonly killHooks: Array<(e: Enemy) => void> = [];

  /** UI hooks, wired up by main.ts. */
  onLevelUp: (() => void) | null = null;
  onDeath: (() => void) | null = null;
  onToast: ((msg: string) => void) | null = null;
  onWave: ((n: number) => void) | null = null;

  /**
   * XP required to advance *from* `level`.
   *
   * Quadratic: the first handful of levels come fast so the player picks their
   * elements early, then the curve stretches so a full run lands somewhere
   * around level 35-45 rather than interrupting play every few seconds.
   */
  static xpForLevel(level: number): number {
    return Math.round(8 + level * 3 + level * level * 0.22);
  }

  /* ------------------------------------------------------------ lifecycle */

  reset(): void {
    this.enemies.clear();
    this.bullets.clear();
    this.pickups.clear();
    this.particles.clear();
    this.zones.clear();

    this.player.x = 0;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.aim = -Math.PI / 2;
    this.player.invuln = 0;
    this.player.phase = 0;
    this.player.hitFlash = 0;
    this.player.dashT = 0;
    this.player.dashCdT = 0;
    this.player.regenAcc = 0;
    this.player.alive = true;

    this.stats = baseStats();
    this.player.hp = this.stats.maxHp;
    this.weapons = [];
    this.elementLevels.clear();
    this.passiveLevels.clear();
    this.fusionIds.clear();

    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = World.xpForLevel(1);
    this.pendingLevels = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnAcc = 0;
    this.bossActive = false;
    this.bossRef = null;
    this.nextBossAt = 120;
    this.nextUid = 1;
    this.rerolls = 2;
    this.banishes = 1;
    this.killHooks.length = 0;

    this.run = {
      kills: 0,
      damageDealt: 0,
      xpCollected: 0,
      timeSurvived: 0,
      level: 1,
      wave: 1,
      bossesKilled: 0,
    };

    // The starting sidearm. Added directly rather than through a card so it
    // never consumes an element slot or an upgrade pick.
    this.addWeapon(SIDEARM);

    this.camera.snapTo(0, 0);
  }

  /* -------------------------------------------------------------- weapons */

  hasWeapon(id: string): boolean {
    return this.weapons.some((w) => w.def.id === id);
  }

  getWeaponInstance(id: string): WeaponInstance | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }

  addWeapon(def: WeaponDef): WeaponInstance {
    const existing = this.getWeaponInstance(def.id);
    if (existing) {
      existing.level = Math.min(def.maxLevel, existing.level + 1);
      return existing;
    }
    const inst = newInstance(def);
    this.weapons.push(inst);
    if (def.kind === 'base') this.elementLevels.set(def.elements[0], 1);
    else if (def.kind === 'fusion') this.fusionIds.add(def.id);
    return inst;
  }

  /** Elements the player owns, in acquisition order. */
  ownedElements(): ElementKey[] {
    return [...this.elementLevels.keys()];
  }

  /* --------------------------------------------------------------- update */

  update(dt: number, moveX: number, moveY: number): void {
    if (this.phase !== 'playing') return;

    this.time += dt;
    this.run.timeSurvived = this.time;

    this.updatePlayer(dt, moveX, moveY);
    this.rebuildGrid();
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateSpawning(dt);

    this.enemies.sweep();
    this.bullets.sweep();
    this.pickups.sweep();
    this.particles.sweep();
    this.zones.sweep();

    this.camera.follow(this.player.x, this.player.y, dt, 0.16);
    this.camera.update(dt);

    if (this.pendingLevels > 0 && this.phase === 'playing') {
      this.phase = 'levelup';
      this.onLevelUp?.();
    }
  }

  private rebuildGrid(): void {
    this.grid.clear();
    const es = this.enemies.items;
    for (let i = 0; i < this.enemies.count; i++) {
      this.grid.insert(i, es[i].x, es[i].y);
    }
  }

  /* --------------------------------------------------------------- player */

  private updatePlayer(dt: number, mx: number, my: number): void {
    const p = this.player;
    const s = this.stats;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.dashCdT > 0) p.dashCdT -= dt;

    // Dash: a short burst of speed with invulnerability, auto-triggered when
    // the player is boxed in. Keeps the game one-thumb without a second button.
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.invuln = Math.max(p.invuln, 0.08);
    } else if (s.dashCd > 0 && p.dashCdT <= 0 && (mx !== 0 || my !== 0)) {
      let close = 0;
      const near = this.grid.query(p.x, p.y, 74);
      for (const i of near) {
        const e = this.enemies.items[i];
        if (e.alive && dist2(e.x, e.y, p.x, p.y) < 74 * 74) close++;
      }
      if (close >= 4) {
        p.dashT = 0.16;
        p.dashCdT = s.dashCd;
        this.fxDash(p.x, p.y, Math.atan2(my, mx));
        audio.play('dash');
      }
    }

    const speed = s.moveSpeed * (p.dashT > 0 ? 3.4 : 1);
    p.vx = mx * speed;
    p.vy = my * speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (mx !== 0 || my !== 0) {
      p.phase += dt * 9;
      if (Math.abs(mx) > 0.08) p.face = mx > 0 ? 1 : -1;
    } else {
      // Settle the walk cycle back to neutral when idle.
      p.phase += dt * 2.2;
    }

    // Aim at the nearest enemy; fall back to the movement direction.
    const target = this.nearest(p.x, p.y, 720);
    if (target) {
      p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    } else if (mx !== 0 || my !== 0) {
      p.aim = Math.atan2(my, mx);
    }

    if (s.hpRegen > 0 && p.hp < s.maxHp) {
      p.regenAcc += s.hpRegen * dt;
      if (p.regenAcc >= 1) {
        const heal = Math.floor(p.regenAcc);
        p.regenAcc -= heal;
        this.healPlayer(heal, false);
      }
    }
  }

  healPlayer(amount: number, showText = true): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + amount);
    const gained = p.hp - before;
    if (gained > 0 && showText) {
      this.addText(p.x, p.y - 34, `+${Math.round(gained)}`, '#8affa0', 15);
    }
  }

  damagePlayer(amount: number): void {
    const p = this.player;
    if (p.invuln > 0 || !p.alive || this.phase !== 'playing') return;
    const dmg = Math.max(1, amount - this.stats.armor);
    p.hp -= dmg;
    p.invuln = this.stats.iframes;
    p.hitFlash = 0.22;
    this.camera.shake(0.3);
    audio.play('hurt');
    this.addText(p.x, p.y - 40, `-${Math.round(dmg)}`, '#ff6b7a', 17);

    for (let i = 0; i < 8; i++) {
      const a = rndAngle();
      this.addParticle('spark', p.x, p.y, Math.cos(a) * 150, Math.sin(a) * 150, 0.32, 5, 0, '#ff6b7a', true);
    }

    if (p.hp <= 0) {
      if (this.stats.revives > 0) {
        this.stats.revives--;
        p.hp = Math.round(this.stats.maxHp * 0.55);
        p.invuln = 2.4;
        this.nova(p.x, p.y, 320, 90, 'void', { knock: 620 });
        this.onToast?.('SECOND WIND');
        audio.play('levelup');
        return;
      }
      p.hp = 0;
      p.alive = false;
      this.phase = 'dead';
      this.camera.shake(0.9);
      audio.play('death');
      this.onDeath?.();
    }
  }

  /* -------------------------------------------------------------- weapons */

  private updateWeapons(dt: number): void {
    const cdMult = this.stats.cooldown;
    for (const inst of this.weapons) {
      inst.t += dt;
      if (inst.def.update) inst.def.update(this, inst, dt);
      if (!inst.def.fire) continue;
      inst.cd -= dt;
      if (inst.cd <= 0) {
        inst.def.fire(this, inst);
        const base = inst.def.cooldown(inst.level);
        // Cooldown reduction is capped so late-game builds stay readable.
        inst.cd += Math.max(0.05, base * Math.max(0.35, cdMult));
      }
    }
  }

  /* ------------------------------------------------------------- enemies */

  private updateEnemies(dt: number): void {
    const p = this.player;
    const es = this.enemies.items;
    const n = this.enemies.count;

    for (let i = 0; i < n; i++) {
      const e = es[i];
      if (!e.alive) continue;
      const st = e.st;

      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.phase += dt;

      /* --- statuses ------------------------------------------------------ */
      if (st.burnT > 0) {
        st.burnT -= dt;
        this.tickDot(e, st.burnDps * dt, 'fire');
        if (rnd() < dt * 9) {
          this.addParticle(
            'puff', e.x + rndRange(-8, 8), e.y - rndRange(0, 14),
            rndRange(-10, 10), -34, 0.4, 9, 2, PALETTE.fire.base, true,
          );
        }
      }
      if (st.poisonT > 0) {
        st.poisonT -= dt;
        this.tickDot(e, st.poisonDps * dt, 'verdant', true);
        if (rnd() < dt * 5) {
          this.addParticle(
            'puff', e.x + rndRange(-8, 8), e.y - rndRange(0, 10),
            rndRange(-8, 8), -22, 0.5, 8, 2, PALETTE.verdant.base, true,
          );
        }
      }
      if (st.chillT > 0) st.chillT -= dt;
      else st.chillPower = 0;
      if (st.frozenT > 0) st.frozenT -= dt;
      if (st.shockT > 0) st.shockT -= dt;
      if (st.rootT > 0) st.rootT -= dt;
      if (st.markT > 0) st.markT -= dt;
      else st.markPower = 0;
      if (st.wetT > 0) st.wetT -= dt;

      if (!e.alive) continue; // a DoT tick may have killed it

      /* --- movement ------------------------------------------------------ */
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;

      let slow = 1;
      if (st.chillT > 0) slow *= 1 - st.chillPower;
      if (st.frozenT > 0 || st.shockT > 0 || st.rootT > 0) slow = 0;

      const spd = e.speed * slow;
      e.face = ux > 0 ? 1 : -1;

      switch (e.kind) {
        case 'spitter': {
          // Keeps its distance and lobs acid.
          const want = 250;
          if (d > want + 30) {
            e.vx = ux * spd;
            e.vy = uy * spd;
          } else if (d < want - 60) {
            e.vx = -ux * spd * 0.8;
            e.vy = -uy * spd * 0.8;
          } else {
            e.vx *= 0.8;
            e.vy *= 0.8;
          }
          e.t1 -= dt;
          if (e.t1 <= 0 && d < 460 && slow > 0) {
            e.t1 = 2.3;
            this.enemyShot(e, Math.atan2(dy, dx));
          }
          break;
        }
        case 'dasher': {
          e.t1 -= dt;
          if (e.state === 0) {
            e.vx = ux * spd;
            e.vy = uy * spd;
            if (d < 300 && e.t1 <= 0) {
              e.state = 1;
              e.t1 = 0.55;
              e.t2 = Math.atan2(dy, dx);
            }
          } else if (e.state === 1) {
            // Wind-up: telegraphed so the charge is dodgeable.
            e.vx *= 0.72;
            e.vy *= 0.72;
            if (e.t1 <= 0) {
              e.state = 2;
              e.t1 = 0.42;
              audio.play('dash', 0.4);
            }
          } else if (e.state === 2) {
            const a = e.t2;
            e.vx = Math.cos(a) * e.speed * 5.2 * (slow > 0 ? 1 : 0);
            e.vy = Math.sin(a) * e.speed * 5.2 * (slow > 0 ? 1 : 0);
            if (e.t1 <= 0) {
              e.state = 0;
              e.t1 = 1.9;
            }
          }
          break;
        }
        case 'bomber': {
          if (e.state === 0) {
            e.vx = ux * spd;
            e.vy = uy * spd;
            if (d < 72) {
              e.state = 1;
              e.t1 = 0.75;
            }
          } else {
            e.t1 -= dt;
            e.vx *= 0.86;
            e.vy *= 0.86;
            if (e.t1 <= 0) {
              this.bomberDetonate(e);
              continue;
            }
          }
          break;
        }
        case 'wraith': {
          // Drifts in a lazy sine so it feels ghostly rather than laser-guided.
          const wob = Math.sin(e.phase * 2.6 + e.uid) * 0.5;
          e.vx = (ux * Math.cos(wob) - uy * Math.sin(wob)) * spd;
          e.vy = (ux * Math.sin(wob) + uy * Math.cos(wob)) * spd;
          break;
        }
        case 'boss': {
          e.t1 -= dt;
          if (e.state === 0) {
            e.vx = ux * spd;
            e.vy = uy * spd;
            if (e.t1 <= 0) {
              e.state = 1;
              e.t1 = 0.9;
            }
          } else if (e.state === 1) {
            e.vx *= 0.8;
            e.vy *= 0.8;
            if (e.t1 <= 0) {
              this.bossSlam(e);
              e.state = 0;
              e.t1 = rndRange(4.5, 6.5);
            }
          }
          break;
        }
        default: {
          e.vx = ux * spd;
          e.vy = uy * spd;
        }
      }

      /* --- separation ---------------------------------------------------- */
      // Wraiths phase through the crowd; everything else pushes apart so the
      // horde spreads into a readable ring instead of stacking into one pixel.
      if (e.kind !== 'wraith') {
        const near = this.grid.query(e.x, e.y, e.radius * 2.1);
        let sx = 0;
        let sy = 0;
        for (let k = 0; k < near.length; k++) {
          const j = near[k];
          if (j === i) continue;
          const o = es[j];
          if (!o.alive) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const minD = e.radius + o.radius;
          const d2 = ox * ox + oy * oy;
          if (d2 > minD * minD || d2 < 1e-4) continue;
          const dd = Math.sqrt(d2);
          const push = (minD - dd) / minD;
          sx += (ox / dd) * push;
          sy += (oy / dd) * push;
        }
        e.vx += sx * 190;
        e.vy += sy * 190;
      }

      /* --- integrate ----------------------------------------------------- */
      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      e.kx *= Math.pow(0.0012, dt);
      e.ky *= Math.pow(0.0012, dt);

      if (e.pulled > 0) e.pulled -= dt;

      /* --- contact damage ------------------------------------------------ */
      const touch = e.radius + 15;
      if (d < touch && p.alive) {
        this.damagePlayer(e.damage);
        // Bounce the attacker off so it cannot chain-hit through iframes.
        e.kx -= ux * 190;
        e.ky -= uy * 190;
        if (this.stats.thorns > 0) {
          this.damageEnemy(e, this.stats.thorns, 'steel', { noCrit: true, silent: true });
        }
        if (e.kind === 'bomber' && e.state === 0) {
          e.state = 1;
          e.t1 = 0.35;
        }
      }

      /* --- despawn far strays -------------------------------------------- */
      if (d > 2400) {
        e.alive = false;
      }
    }
  }

  /** DoT tick that never crits and does not spam damage numbers. */
  private tickDot(e: Enemy, amount: number, element: ElementKey, ignoreArmor = false): void {
    if (amount <= 0) return;
    this.damageEnemy(e, amount, element, {
      noCrit: true,
      silent: true,
      trueDamage: ignoreArmor,
    });
  }

  private enemyShot(e: Enemy, angle: number): void {
    const b = this.bullets.spawn();
    if (!b) return;
    b.x = e.x;
    b.y = e.y;
    b.prevX = b.x;
    b.prevY = b.y;
    const sp = 250;
    b.vx = Math.cos(angle) * sp;
    b.vy = Math.sin(angle) * sp;
    b.radius = 9;
    b.damage = e.damage;
    b.life = b.maxLife = 3;
    b.pierce = 0;
    b.flags = BulletFlag.Hostile | BulletFlag.Trail;
    b.art = 'acid';
    b.element = 'verdant';
    b.rot = angle;
    b.spin = 6;
    b.weapon = 'enemy';
    b.blast = 0;
    b.knock = 0;
    b.bounces = 0;
    b.p1 = 0;
    b.p2 = 0;
    b.lastHit = -1;
    b.hitCd = 0;
    audio.play('spit');
  }

  private bomberDetonate(e: Enemy): void {
    e.alive = false;
    const r = 96;
    this.fxExplosion(e.x, e.y, r, 'fire');
    this.camera.shake(0.25);
    audio.play('explode');
    if (dist2(e.x, e.y, this.player.x, this.player.y) < r * r) {
      this.damagePlayer(e.damage);
    }
    // Bombers also hurt their own side, which rewards kiting them into a pack.
    const near = this.grid.query(e.x, e.y, r);
    for (const i of near) {
      const o = this.enemies.items[i];
      if (!o.alive || o === e) continue;
      if (dist2(o.x, o.y, e.x, e.y) < r * r) {
        this.damageEnemy(o, e.damage * 1.5, 'fire', { noCrit: true, knock: 220, dirX: o.x - e.x, dirY: o.y - e.y });
      }
    }
    this.dropLoot(e);
  }

  private bossSlam(e: Enemy): void {
    audio.play('boom');
    this.camera.shake(0.55);
    // Shockwave: knocks the horde back, damages the player only.
    const r = 300;
    this.nova(e.x, e.y, r, 0, 'steel', { knock: 420, status: false });
    if (dist2(e.x, e.y, this.player.x, this.player.y) < r * r) {
      this.damagePlayer(e.damage);
    }
    this.fxRing(e.x, e.y, r, '#ff7088', 0.55);
    // Summon a small escort so the boss fight has adds to clear.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rnd();
      this.spawnEnemy('crawler', e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120, false);
    }
  }

  /* -------------------------------------------------------------- bullets */

  private updateBullets(dt: number): void {
    const bs = this.bullets.items;
    const p = this.player;

    for (let i = 0; i < this.bullets.count; i++) {
      const b = bs[i];
      if (!b.alive) continue;

      b.prevX = b.x;
      b.prevY = b.y;

      if (b.hitCd > 0) b.hitCd -= dt;

      // Orbitals are positioned by their weapon's update(), not by velocity.
      const orbital = (b.flags & BulletFlag.Spin) !== 0 && b.p2 === 1;
      if (!orbital) {
        if (b.flags & BulletFlag.Homing) {
          const t = this.nearest(b.x, b.y, 420);
          if (t) {
            const want = Math.atan2(t.y - b.y, t.x - b.x);
            const cur = Math.atan2(b.vy, b.vx);
            let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
            const turn = clamp(diff, -b.p1 * dt, b.p1 * dt);
            const a = cur + turn;
            const sp = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * sp;
            b.vy = Math.sin(a) * sp;
          }
        }
        if (b.flags & BulletFlag.Pull) {
          const near = this.grid.query(b.x, b.y, 150);
          for (const k of near) {
            const e = this.enemies.items[k];
            if (!e.alive) continue;
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 150) continue;
            const f = (1 - d / 150) * 300;
            e.kx += (dx / d) * f * dt;
            e.ky += (dy / d) * f * dt;
            e.pulled = 0.15;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.spin !== 0) b.rot += b.spin * dt;
        else if ((b.flags & BulletFlag.Spin) === 0) b.rot = Math.atan2(b.vy, b.vx);
      }

      if (b.flags & BulletFlag.Grow) b.radius += b.p1 * dt;

      if (b.flags & BulletFlag.Trail) {
        if (rnd() < dt * 42) {
          const col = PALETTE[b.element]?.base ?? '#fff';
          this.addParticle('puff', b.x, b.y, rndRange(-14, 14), rndRange(-14, 14), 0.28, b.radius * 0.9, 0, col, true);
        }
      }

      b.life -= dt;
      if (b.life <= 0) {
        this.expireBullet(b);
        continue;
      }

      /* --- collision --------------------------------------------------- */
      if (b.flags & BulletFlag.Hostile) {
        if (p.alive && dist2(b.x, b.y, p.x, p.y) < (b.radius + 15) ** 2) {
          this.damagePlayer(b.damage);
          this.expireBullet(b);
        }
        continue;
      }

      const near = this.grid.query(b.x, b.y, b.radius + 40);
      for (let k = 0; k < near.length; k++) {
        const e = this.enemies.items[near[k]];
        if (!e.alive) continue;
        const rr = b.radius + e.radius;
        if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;

        // Re-hit guards: orbitals throttle on time, projectiles on identity.
        if (orbital || (b.flags & BulletFlag.Spin) !== 0) {
          if (b.hitCd > 0) continue;
          b.hitCd = 0.16;
        } else if (b.lastHit === e.uid) {
          continue;
        }
        b.lastHit = e.uid;

        this.damageEnemy(e, b.damage, b.element, {
          knock: b.knock,
          dirX: b.vx,
          dirY: b.vy,
        });

        const def = b.weapon ? getWeapon(b.weapon) : undefined;
        def?.onHit?.(this, b, near[k]);

        if (b.pierce === 0) {
          this.expireBullet(b);
          break;
        }
        if (b.pierce > 0) b.pierce--;
      }
    }
  }

  private expireBullet(b: Bullet): void {
    if (!b.alive) return;
    b.alive = false;
    if (b.blast > 0) {
      this.explode(b.x, b.y, b.blast, b.damage * 0.85, b.element, { knock: b.knock });
    }
    const def = b.weapon ? getWeapon(b.weapon) : undefined;
    def?.onExpire?.(this, b);
    if ((b.flags & BulletFlag.Hostile) === 0 && b.blast <= 0) {
      const col = PALETTE[b.element]?.light ?? '#fff';
      for (let i = 0; i < 3; i++) {
        const a = rndAngle();
        this.addParticle('spark', b.x, b.y, Math.cos(a) * 90, Math.sin(a) * 90, 0.2, 4, 0, col, true);
      }
    }
  }

  /* ---------------------------------------------------------------- zones */

  private updateZones(dt: number): void {
    const zs = this.zones.items;
    for (let i = 0; i < this.zones.count; i++) {
      const z = zs[i];
      if (!z.alive) continue;
      z.life -= dt;
      if (z.life <= 0) {
        z.alive = false;
        // `p1` carries a detonation payload for zones that collapse on expiry
        // (the void rift). Doing it here keeps it on sim time, not wall time.
        if (z.p1 > 0) {
          this.explode(z.x, z.y, z.maxRadius * 1.15, z.p1, z.element, { knock: 90 });
        }
        continue;
      }
      if (z.attached) {
        z.x = this.player.x;
        z.y = this.player.y;
      }
      // Zones that grow ease outward rather than expanding linearly.
      if (z.radius < z.maxRadius) {
        z.radius = Math.min(z.maxRadius, z.radius + z.maxRadius * 2.6 * dt);
      }

      z.tickT -= dt;
      const doTick = z.tickT <= 0;
      if (doTick) z.tickT += 0.2;

      const near = this.grid.query(z.x, z.y, z.radius);
      for (const k of near) {
        const e = this.enemies.items[k];
        if (!e.alive) continue;
        const dx = e.x - z.x;
        const dy = e.y - z.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > z.radius + e.radius) continue;

        if (z.pull > 0) {
          const f = z.pull * (0.35 + 0.65 * (1 - d / z.radius));
          const resist = 1 - MOBS[e.kind].knockResist * 0.7;
          e.kx -= (dx / d) * f * dt * resist;
          e.ky -= (dy / d) * f * dt * resist;
          e.pulled = 0.15;
        }
        if (doTick && z.dps > 0) {
          this.damageEnemy(e, z.dps * 0.2, z.element, {
            noCrit: true,
            silent: true,
            knock: z.knock,
            dirX: dx,
            dirY: dy,
          });
        }
        if (doTick) this.applyZoneStatus(z, e);
      }
    }
  }

  /** Zones carry their element's signature status. */
  private applyZoneStatus(z: Zone, e: Enemy): void {
    const dur = this.stats.duration;
    switch (z.element) {
      case 'fire':
        this.applyBurn(e, z.dps * 0.5, 2 * dur);
        break;
      case 'frost':
        this.applyChill(e, 0.45, 1.4 * dur);
        break;
      case 'verdant':
        this.applyPoison(e, z.dps * 0.4, 2.4 * dur);
        break;
      case 'storm':
        if (rnd() < 0.16) this.applyShock(e, 0.22 * dur);
        break;
      case 'void':
        this.applyMark(e, 0.2, 1.6 * dur);
        break;
      default:
        break;
    }
  }

  /* -------------------------------------------------------------- pickups */

  private updatePickups(dt: number): void {
    const p = this.player;
    const ps = this.pickups.items;
    const grab = this.stats.pickupRadius;

    for (let i = 0; i < this.pickups.count; i++) {
      const k = ps[i];
      if (!k.alive) continue;
      k.life += dt;
      k.phase += dt * 3.4;

      // Initial scatter impulse decays, then the gem settles.
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.vx *= Math.pow(0.02, dt);
      k.vy *= Math.pow(0.02, dt);

      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d2 = dx * dx + dy * dy;

      if (!k.homing && d2 < grab * grab) k.homing = true;

      // Gems dropped far away would otherwise sit there forever and fill the
      // pool, starving later kills of loot. Old gems — and everything on the
      // field once it gets crowded — come to the player on their own.
      if (!k.homing && k.kind === 'xp') {
        if (k.life > 22 || this.pickups.count > this.pickups.capacity * 0.75) k.homing = true;
      }

      if (k.homing) {
        const d = Math.sqrt(d2) || 1;
        // Accelerating pull makes collection feel snappy and satisfying.
        const sp = 260 + (1 - Math.min(1, d / 320)) * 620;
        k.x += (dx / d) * sp * dt;
        k.y += (dy / d) * sp * dt;
        if (d < 22) this.collect(k);
      }
    }
  }

  private collect(k: Pickup): void {
    k.alive = false;
    switch (k.kind) {
      case 'xp': {
        const gain = k.value * this.stats.xpGain;
        this.xp += gain;
        this.run.xpCollected += gain;
        audio.play('gem');
        while (this.xp >= this.xpNeeded) {
          this.xp -= this.xpNeeded;
          this.level++;
          this.run.level = this.level;
          this.pendingLevels++;
          this.xpNeeded = World.xpForLevel(this.level);
        }
        break;
      }
      case 'heart':
        this.healPlayer(Math.round(this.stats.maxHp * 0.25));
        audio.play('heal');
        break;
      case 'magnet': {
        for (let i = 0; i < this.pickups.count; i++) {
          const o = this.pickups.items[i];
          if (o.alive && o.kind === 'xp') o.homing = true;
        }
        this.onToast?.('MAGNET');
        audio.play('powerup');
        break;
      }
      case 'bomb': {
        this.nova(this.player.x, this.player.y, 620, 220 * this.stats.damage, 'fire', { knock: 520 });
        this.camera.shake(0.6);
        this.onToast?.('SCREEN CLEAR');
        audio.play('boom');
        break;
      }
      case 'chest': {
        this.pendingLevels += 2;
        this.onToast?.('TREASURE!');
        audio.play('powerup');
        break;
      }
    }
  }

  /* ------------------------------------------------------------ particles */

  private updateParticles(dt: number): void {
    const ps = this.particles.items;
    for (let i = 0; i < this.particles.count; i++) {
      const q = ps[i];
      if (!q.alive) continue;
      q.life -= dt;
      if (q.life <= 0) {
        q.alive = false;
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += q.gravity * dt;
      const dr = Math.pow(q.drag, dt * 60);
      q.vx *= dr;
      q.vy *= dr;
      q.rot += q.spin * dt;
    }
  }

  /* ------------------------------------------------------------- spawning */

  private updateSpawning(dt: number): void {
    this.waveTimer += dt;
    // A "wave" is a 30s difficulty step; it drives the HUD and the mob table.
    const w = Math.floor(this.time / 30) + 1;
    if (w !== this.wave) {
      this.wave = w;
      this.run.wave = w;
      this.onWave?.(w);
      audio.play('wave');
    }

    if (!this.bossActive && this.time >= this.nextBossAt) {
      this.spawnBoss();
    }

    // Spawn rate ramps with time; capped so the pool never starves. The first
    // minute is deliberately gentle — the player starts with a single level-1
    // weapon and needs room to build before the horde becomes the threat.
    const rate = Math.min(16, 0.7 + this.time * 0.013 + this.wave * 0.18);
    this.spawnAcc += rate * dt;
    const budget = Math.min(this.enemies.free, 8);
    let spawned = 0;
    while (this.spawnAcc >= 1 && spawned < budget) {
      this.spawnAcc -= 1;
      spawned++;
      const { kinds, weights } = spawnTable(this.time);
      const kind = rand.weighted(kinds, weights);
      const [x, y] = this.offscreenPoint();
      const eliteChance = Math.min(0.14, this.time / 2600);
      this.spawnEnemy(kind, x, y, rnd() < eliteChance);
    }

    // Periodic pack: a tight ring of mobs, so pacing has peaks not just a drip.
    if (this.waveTimer > 30 && !this.bossActive) {
      this.waveTimer = 0;
      const count = Math.min(24, 5 + this.wave * 1.6);
      const a0 = rndAngle();
      const kind: MobKind = this.time > 200 && rnd() < 0.4 ? 'runner' : 'crawler';
      for (let i = 0; i < count; i++) {
        const a = a0 + (i / count) * TAU;
        const r = Math.max(this.viewW, this.viewH) * 0.72;
        this.spawnEnemy(kind, this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r, false);
      }
    }
  }

  /** A point just outside the visible rectangle, biased to the player's heading. */
  private offscreenPoint(): [number, number] {
    const marginX = this.viewW * 0.62 + 40;
    const marginY = this.viewH * 0.62 + 40;
    const a = rndAngle();
    return [
      this.player.x + Math.cos(a) * marginX,
      this.player.y + Math.sin(a) * marginY,
    ];
  }

  spawnEnemy(kind: MobKind, x: number, y: number, elite: boolean, gen = 0): Enemy | null {
    const e = this.enemies.spawn();
    if (!e) return null;
    const d = MOBS[kind];

    // Difficulty curve: HP grows faster than damage so the run stays survivable
    // while still demanding more DPS over time.
    const t = this.time;
    const hpMult = 1 + t * 0.009 + Math.pow(t / 60, 1.6) * 0.11;
    const dmgMult = 1 + t * 0.0026;

    e.kind = kind;
    e.uid = this.nextUid++;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.kx = 0;
    e.ky = 0;
    e.radius = d.radius * (gen > 0 ? 0.62 : 1);
    e.speed = d.speed * (gen > 0 ? 1.25 : 1) * rndRange(0.94, 1.08);
    e.damage = d.damage * dmgMult;
    e.xp = d.xp;
    e.armor = d.armor;
    e.elite = elite;
    e.face = 1;
    e.phase = rnd() * 6;
    e.hitFlash = 0;
    e.t1 = rndRange(0, 1.5);
    e.t2 = 0;
    e.state = 0;
    e.gen = gen;
    e.scale = d.scale * (gen > 0 ? 0.66 : 1);
    e.pulled = 0;
    clearStatuses(e.st);

    let hp = d.hp * hpMult * (gen > 0 ? 0.42 : 1);
    if (elite) {
      hp *= 4.2;
      e.damage *= 1.4;
      e.xp *= 5;
      e.scale *= 1.32;
      e.radius *= 1.28;
      e.speed *= 0.92;
    }
    if (kind === 'boss') {
      hp = d.hp * (1 + this.run.bossesKilled * 1.15) * (1 + t * 0.004);
      e.t1 = 3;
    }
    e.hp = e.maxHp = hp;
    return e;
  }

  private spawnBoss(): void {
    const [x, y] = this.offscreenPoint();
    const e = this.spawnEnemy('boss', x, y, false);
    if (!e) return;
    this.bossActive = true;
    this.bossRef = e;
    this.bossName = BOSS_NAMES[Math.min(BOSS_NAMES.length - 1, this.run.bossesKilled)];
    this.onToast?.(this.bossName.toUpperCase());
    audio.play('bossHorn');
    this.camera.shake(0.4);
  }

  /* --------------------------------------------------------------- damage */

  /**
   * The single entry point for all damage to enemies. Elemental cross-effects
   * (the passive half of the combination system) are resolved here so every
   * weapon benefits from them automatically.
   */
  damageEnemy(e: Enemy, amount: number, element: ElementKey, opts: DamageOpts = {}): void {
    if (!e.alive || amount <= 0) return;
    const st = e.st;
    let mult = 1;

    // Void mark amplifies everything.
    if (st.markT > 0) mult += st.markPower;

    // --- elemental interactions -----------------------------------------
    // Storm conducts through wet and chilled targets.
    if (element === 'storm' && (st.wetT > 0 || st.chillT > 0)) mult += 0.5;
    // Fire flashes off water for a burst, consuming the wet status.
    if (element === 'fire' && st.wetT > 0) {
      st.wetT = 0;
      mult += 0.35;
      this.fxPuff(e.x, e.y, '#dff4ff', 3);
    }
    // Steel shatters frozen targets.
    if (element === 'steel' && st.frozenT > 0) {
      mult += 1;
      this.fxShatter(e.x, e.y);
    }
    // Fire thaws, trading the freeze for extra damage.
    if (element === 'fire' && st.frozenT > 0) {
      st.frozenT *= 0.35;
      mult += 0.3;
    }
    // Verdant feeds on marked targets.
    if (element === 'verdant' && st.markT > 0) mult += 0.2;

    let dmg = amount * mult;

    // Armour: shielded mobs only block damage arriving from the front.
    if (!opts.trueDamage && e.armor > 0) {
      let blocked = e.armor;
      if (e.kind === 'shielded' && opts.dirX !== undefined && opts.dirY !== undefined) {
        const fx = this.player.x - e.x;
        const fy = this.player.y - e.y;
        const fl = Math.hypot(fx, fy) || 1;
        const dl = Math.hypot(opts.dirX, opts.dirY) || 1;
        // Positive dot = the hit came from the player's side, i.e. the shield.
        const dot = ((opts.dirX / dl) * fx + (opts.dirY / dl) * fy) / fl;
        if (dot < 0.35) blocked = 0;
      }
      dmg *= 1 - blocked;
    }

    let crit = false;
    if (!opts.noCrit && rnd() < this.stats.critChance) {
      crit = true;
      dmg *= this.stats.critMult;
    }

    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.hitFlash = 0.1;
    this.run.damageDealt += dmg;

    if (this.stats.lifesteal > 0) {
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + dmg * this.stats.lifesteal);
    }

    if (opts.knock && opts.knock > 0) {
      const dx = opts.dirX ?? e.x - this.player.x;
      const dy = opts.dirY ?? e.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const resist = 1 - MOBS[e.kind].knockResist;
      e.kx += (dx / d) * opts.knock * resist;
      e.ky += (dy / d) * opts.knock * resist;
    }

    if (!opts.silent) {
      this.addText(
        e.x + rndRange(-6, 6),
        e.y - e.radius - 6,
        formatShort(dmg),
        crit ? '#ffd75c' : '#ffffff',
        crit ? 20 : 14,
      );
    }

    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
    this.run.kills++;

    const isBoss = e.kind === 'boss';
    if (isBoss) {
      this.bossActive = false;
      this.bossRef = null;
      this.run.bossesKilled++;
      this.nextBossAt = this.time + 150;
      this.camera.shake(0.7);
      audio.play('boom');
      this.fxExplosion(e.x, e.y, 220, 'fire');
      this.onToast?.('BOSS DOWN');
    } else {
      audio.play('kill');
    }

    // Splitters break into two smaller copies, once.
    if (e.kind === 'splitter' && e.gen === 0) {
      for (let i = 0; i < 2; i++) {
        const a = rndAngle();
        const c = this.spawnEnemy('splitter', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, false, 1);
        if (c) {
          c.kx = Math.cos(a) * 220;
          c.ky = Math.sin(a) * 220;
        }
      }
    }

    for (let i = 0; i < this.killHooks.length; i++) this.killHooks[i](e);

    this.fxDeath(e);
    this.dropLoot(e);
  }

  private dropLoot(e: Enemy): void {
    const isBoss = e.kind === 'boss';
    const gems = isBoss ? 14 : e.elite ? 5 : 1;
    for (let i = 0; i < gems; i++) {
      const k = this.pickups.spawn();
      if (!k) break;
      k.kind = 'xp';
      k.x = e.x;
      k.y = e.y;
      const a = rndAngle();
      const sp = rndRange(40, 130);
      k.vx = Math.cos(a) * sp;
      k.vy = Math.sin(a) * sp;
      k.value = Math.max(1, Math.round(e.xp / gems)) || 1;
      k.homing = false;
      k.phase = rnd() * 6;
      k.life = 0;
    }

    // Consumables. Boss always drops a chest; everything else is a rare roll.
    const roll = rnd();
    let extra: Pickup['kind'] | null = null;
    if (isBoss) extra = 'chest';
    else if (roll < 0.006) extra = 'heart';
    else if (roll < 0.011) extra = 'magnet';
    else if (roll < 0.014) extra = 'bomb';

    if (extra) {
      const k = this.pickups.spawn();
      if (k) {
        k.kind = extra;
        k.x = e.x;
        k.y = e.y;
        k.vx = 0;
        k.vy = 0;
        k.value = 1;
        k.homing = false;
        k.phase = 0;
        k.life = 0;
      }
    }
  }

  /* ---------------------------------------------------------- statuses --- */

  applyBurn(e: Enemy, dps: number, dur: number): void {
    const st = e.st;
    st.burnDps = Math.max(st.burnDps, dps);
    st.burnT = Math.max(st.burnT, dur);
  }

  applyChill(e: Enemy, power: number, dur: number): void {
    const st = e.st;
    st.chillPower = Math.max(st.chillPower, Math.min(0.85, power));
    st.chillT = Math.max(st.chillT, dur);
    st.wetT = Math.max(st.wetT, dur);
  }

  applyFreeze(e: Enemy, dur: number): void {
    // Bosses resist hard crowd control, or the fight would be trivial.
    const d = e.kind === 'boss' ? dur * 0.28 : dur;
    e.st.frozenT = Math.max(e.st.frozenT, d);
    e.st.wetT = Math.max(e.st.wetT, d + 1);
  }

  applyShock(e: Enemy, dur: number): void {
    e.st.shockT = Math.max(e.st.shockT, e.kind === 'boss' ? dur * 0.3 : dur);
  }

  applyPoison(e: Enemy, dps: number, dur: number): void {
    e.st.poisonDps = Math.max(e.st.poisonDps, dps);
    e.st.poisonT = Math.max(e.st.poisonT, dur);
  }

  applyRoot(e: Enemy, dur: number): void {
    e.st.rootT = Math.max(e.st.rootT, e.kind === 'boss' ? dur * 0.3 : dur);
  }

  applyMark(e: Enemy, power: number, dur: number): void {
    e.st.markPower = Math.max(e.st.markPower, power);
    e.st.markT = Math.max(e.st.markT, dur);
  }

  applyWet(e: Enemy, dur: number): void {
    e.st.wetT = Math.max(e.st.wetT, dur);
  }

  /* ------------------------------------------------------- attack prims --- */

  /** Fires one projectile. Returns the bullet so callers can tweak it. */
  shoot(o: ShootOpts): Bullet | null {
    const b = this.bullets.spawn();
    if (!b) return null;
    b.x = o.x;
    b.y = o.y;
    b.prevX = o.x;
    b.prevY = o.y;
    const sp = o.speed * this.stats.projSpeed;
    b.vx = Math.cos(o.angle) * sp;
    b.vy = Math.sin(o.angle) * sp;
    b.radius = (o.radius ?? 7) * this.stats.area;
    b.damage = o.damage;
    b.life = b.maxLife = o.life ?? 1.6;
    b.pierce = o.pierce ?? 0;
    b.flags = o.flags ?? 0;
    b.art = o.art;
    b.element = o.element;
    b.rot = o.angle;
    b.spin = o.spin ?? 0;
    b.weapon = o.weapon;
    b.blast = (o.blast ?? 0) * this.stats.area;
    b.knock = o.knock ?? 0;
    b.bounces = o.bounces ?? 0;
    b.p1 = o.p1 ?? 0;
    b.p2 = o.p2 ?? 0;
    b.lastHit = -1;
    b.hitCd = 0;
    return b;
  }

  /** Damaging explosion with the standard blast visuals. */
  explode(
    x: number,
    y: number,
    radius: number,
    damage: number,
    element: ElementKey,
    opts: { knock?: number; status?: boolean } = {},
  ): void {
    const r = radius * this.stats.area;
    this.fxExplosion(x, y, r, element);
    this.camera.shake(Math.min(0.22, r / 1400));
    audio.play('explode', 0.5);

    const near = this.grid.query(x, y, r);
    for (const i of near) {
      const e = this.enemies.items[i];
      if (!e.alive) continue;
      const d2 = dist2(e.x, e.y, x, y);
      if (d2 > (r + e.radius) ** 2) continue;
      // Falloff keeps the centre of a blast meaningfully stronger.
      const falloff = 1 - 0.45 * Math.min(1, Math.sqrt(d2) / r);
      this.damageEnemy(e, damage * falloff, element, {
        knock: opts.knock ?? 180,
        dirX: e.x - x,
        dirY: e.y - y,
      });
      if (opts.status !== false) this.applyElementStatus(e, element, 1);
    }
  }

  /** Instant ring damage without the explosion visual weight. */
  nova(
    x: number,
    y: number,
    radius: number,
    damage: number,
    element: ElementKey,
    opts: { knock?: number; status?: boolean } = {},
  ): void {
    const r = radius * this.stats.area;
    const near = this.grid.query(x, y, r);
    for (const i of near) {
      const e = this.enemies.items[i];
      if (!e.alive) continue;
      if (dist2(e.x, e.y, x, y) > (r + e.radius) ** 2) continue;
      if (damage > 0) {
        this.damageEnemy(e, damage, element, {
          knock: opts.knock ?? 140,
          dirX: e.x - x,
          dirY: e.y - y,
        });
      }
      if (opts.status !== false) this.applyElementStatus(e, element, 1);
    }
  }

  /**
   * Chain lightning: hops between nearby enemies, losing damage each jump.
   * Shocked and wet targets conduct better, which is what makes storm pair
   * naturally with frost.
   */
  chain(
    startX: number,
    startY: number,
    damage: number,
    jumps: number,
    range: number,
    element: ElementKey = 'storm',
    falloff = 0.82,
    firstTarget?: Enemy,
  ): void {
    let x = startX;
    let y = startY;
    let dmg = damage;
    const hit = new Set<number>();
    let current: Enemy | null = firstTarget ?? this.nearest(x, y, range);

    for (let j = 0; j <= jumps && current; j++) {
      hit.add(current.uid);
      this.fxBolt(x, y, current.x, current.y, element);
      this.damageEnemy(current, dmg, element, { knock: 60, dirX: current.x - x, dirY: current.y - y });
      if (element === 'storm' && rnd() < 0.35) this.applyShock(current, 0.18 * this.stats.duration);
      x = current.x;
      y = current.y;
      dmg *= falloff;

      // Next hop: nearest unhit enemy, preferring conductive targets.
      let best: Enemy | null = null;
      let bestScore = Infinity;
      const near = this.grid.query(x, y, range);
      for (const i of near) {
        const e = this.enemies.items[i];
        if (!e.alive || hit.has(e.uid)) continue;
        const d2 = dist2(e.x, e.y, x, y);
        if (d2 > range * range) continue;
        const conductive = e.st.wetT > 0 || e.st.chillT > 0 || e.st.shockT > 0;
        const score = d2 * (conductive ? 0.45 : 1);
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
      current = best;
    }
    audio.play('zap', 0.5);
  }

  /** A straight piercing beam. Damages everything within `width` of the line. */
  beam(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    damage: number,
    element: ElementKey,
    opts: { knock?: number } = {},
  ): void {
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    const w = width * this.stats.area;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Sample the grid along the line rather than querying one huge radius.
    const steps = Math.ceil(length / 60);
    const seen = new Set<number>();
    for (let s = 0; s <= steps; s++) {
      const sx = x + dx * (length * (s / steps));
      const sy = y + dy * (length * (s / steps));
      const near = this.grid.query(sx, sy, 60 + w);
      for (const i of near) {
        const e = this.enemies.items[i];
        if (!e.alive || seen.has(e.uid)) continue;
        // Project onto the beam axis, then measure perpendicular distance.
        const t = (e.x - x) * dx + (e.y - y) * dy;
        if (t < 0 || t > length) continue;
        const px = x + dx * t;
        const py = y + dy * t;
        if (dist2(e.x, e.y, px, py) > (w + e.radius) ** 2) continue;
        seen.add(e.uid);
        this.damageEnemy(e, damage, element, { knock: opts.knock ?? 120, dirX: dx, dirY: dy });
        this.applyElementStatus(e, element, 1);
      }
    }
    this.fxBeam(x, y, ex, ey, w, element);
  }

  /** Creates a persistent ground effect. */
  zone(o: {
    x: number;
    y: number;
    radius: number;
    life: number;
    dps: number;
    element: ElementKey;
    weapon: string;
    pull?: number;
    attached?: boolean;
    knock?: number;
    grow?: boolean;
    /** Damage dealt in a blast when the zone expires. */
    collapse?: number;
  }): Zone | null {
    const z = this.zones.spawn();
    if (!z) return null;
    z.x = o.x;
    z.y = o.y;
    z.maxRadius = o.radius * this.stats.area;
    z.radius = o.grow ? z.maxRadius * 0.15 : z.maxRadius;
    z.life = z.maxLife = o.life * this.stats.duration;
    z.dps = o.dps;
    z.element = o.element;
    z.weapon = o.weapon;
    z.pull = o.pull ?? 0;
    z.tickT = 0;
    z.attached = o.attached ?? false;
    z.art = ELEMENT_FX[o.element]?.zone ?? 'zoneFire';
    z.p1 = o.collapse ?? 0;
    z.knock = o.knock ?? 0;
    return z;
  }

  /** Applies an element's signature status at `power` scale. */
  applyElementStatus(e: Enemy, element: ElementKey, power = 1): void {
    const d = this.stats.duration;
    switch (element) {
      case 'fire':
        this.applyBurn(e, 8 * power * this.stats.damage, 2.2 * d);
        break;
      case 'frost':
        this.applyChill(e, 0.35 * power, 1.8 * d);
        break;
      case 'storm':
        if (rnd() < 0.28 * power) this.applyShock(e, 0.22 * d);
        break;
      case 'verdant':
        this.applyPoison(e, 7 * power * this.stats.damage, 2.6 * d);
        break;
      case 'void':
        this.applyMark(e, 0.18 * power, 2.4 * d);
        break;
      case 'steel':
        // Steel has no lingering status; it trades that for raw damage.
        break;
    }
  }

  /* -------------------------------------------------------------- queries */

  /** Nearest living enemy within `maxDist`, or null. */
  nearest(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    // Widen the search in rings so we usually only touch a few cells.
    for (const r of [140, 340, maxDist]) {
      if (r > maxDist) break;
      const near = this.grid.query(x, y, r);
      for (const i of near) {
        const e = this.enemies.items[i];
        if (!e.alive) continue;
        const d2 = dist2(e.x, e.y, x, y);
        if (d2 < bestD) {
          bestD = d2;
          best = e;
        }
      }
      if (best) return best;
    }
    return best;
  }

  /** Up to `max` living enemies within `radius`, nearest first. */
  enemiesInRadius(x: number, y: number, radius: number, max = 32): Enemy[] {
    const out: Enemy[] = [];
    const near = this.grid.query(x, y, radius);
    for (const i of near) {
      const e = this.enemies.items[i];
      if (!e.alive) continue;
      if (dist2(e.x, e.y, x, y) > radius * radius) continue;
      out.push(e);
      if (out.length >= max) break;
    }
    return out;
  }

  /** A random living enemy on screen, used by weapons that strike at range. */
  randomEnemyNear(x: number, y: number, radius: number): Enemy | null {
    const list = this.enemiesInRadius(x, y, radius, 24);
    if (list.length === 0) return null;
    return rand.pick(list);
  }

  /* ------------------------------------------------------------------ fx --- */

  addParticle(
    shape: Particle['shape'],
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    endSize: number,
    color: string,
    additive = false,
    spin = 0,
    drag = 0.9,
    gravity = 0,
  ): void {
    const q = this.particles.spawn();
    if (!q) return;
    q.shape = shape;
    q.x = x;
    q.y = y;
    q.vx = vx;
    q.vy = vy;
    q.life = q.maxLife = life;
    q.size = size;
    q.endSize = endSize;
    q.rot = shape === 'spark' ? Math.atan2(vy, vx) : rndAngle();
    q.spin = spin;
    q.color = color;
    q.text = '';
    q.additive = additive;
    q.drag = drag;
    q.gravity = gravity;
  }

  addText(x: number, y: number, text: string, color: string, size: number): void {
    const q = this.particles.spawn();
    if (!q) return;
    q.shape = 'text';
    q.x = x;
    q.y = y;
    q.vx = rndRange(-16, 16);
    q.vy = -74;
    q.life = q.maxLife = 0.62;
    q.size = size;
    q.endSize = size;
    q.rot = 0;
    q.spin = 0;
    q.color = color;
    q.text = text;
    q.additive = false;
    q.drag = 0.92;
    q.gravity = 130;
  }

  fxExplosion(x: number, y: number, r: number, element: ElementKey): void {
    const p = PALETTE[element] ?? PALETTE.fire;
    this.addParticle('ring', x, y, 0, 0, 0.32, r * 0.5, r * 2.1, p.light, true);
    this.addParticle('puff', x, y, 0, 0, 0.4, r * 1.5, r * 0.4, p.base, true);
    for (let i = 0; i < 10; i++) {
      const a = rndAngle();
      const sp = rndRange(90, 260);
      this.addParticle('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rndRange(0.22, 0.42), 6, 0, p.light, true);
    }
    for (let i = 0; i < 4; i++) {
      const a = rndAngle();
      this.addParticle('puff', x, y, Math.cos(a) * 44, Math.sin(a) * 44, 0.6, r * 0.5, r * 0.9, '#7a8399', false, 0, 0.93);
    }
  }

  fxRing(x: number, y: number, r: number, color: string, life = 0.4): void {
    this.addParticle('ring', x, y, 0, 0, life, r * 0.3, r * 2, color, true);
  }

  fxPuff(x: number, y: number, color: string, n = 4): void {
    for (let i = 0; i < n; i++) {
      const a = rndAngle();
      this.addParticle('puff', x, y, Math.cos(a) * 55, Math.sin(a) * 55, 0.42, 12, 26, color, true);
    }
  }

  fxShatter(x: number, y: number): void {
    for (let i = 0; i < 7; i++) {
      const a = rndAngle();
      const sp = rndRange(120, 300);
      this.addParticle('shard', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.42, 9, 3, PALETTE.frost.light, false, rndRange(-9, 9), 0.9, 200);
    }
    audio.play('shatter', 0.5);
  }

  fxBolt(x0: number, y0: number, x1: number, y1: number, element: ElementKey): void {
    const q = this.particles.spawn();
    if (!q) return;
    const p = PALETTE[element] ?? PALETTE.storm;
    q.shape = 'bolt';
    q.x = x0;
    q.y = y0;
    // Bolts encode their endpoint in the velocity slots; they do not move.
    q.vx = x1;
    q.vy = y1;
    q.life = q.maxLife = 0.16;
    q.size = 4;
    q.endSize = 1;
    q.rot = 0;
    q.spin = 0;
    q.color = p.light;
    q.text = '';
    q.additive = true;
    q.drag = 1;
    q.gravity = 0;
  }

  fxBeam(x0: number, y0: number, x1: number, y1: number, w: number, element: ElementKey): void {
    const q = this.particles.spawn();
    if (!q) return;
    const p = PALETTE[element] ?? PALETTE.storm;
    q.shape = 'bolt';
    q.x = x0;
    q.y = y0;
    q.vx = x1;
    q.vy = y1;
    q.life = q.maxLife = 0.22;
    q.size = w * 2;
    q.endSize = 1;
    q.rot = 1; // marks this as a solid beam rather than a jagged bolt
    q.spin = 0;
    q.color = p.light;
    q.text = '';
    q.additive = true;
    q.drag = 1;
    q.gravity = 0;
  }

  fxDash(x: number, y: number, angle: number): void {
    for (let i = 0; i < 8; i++) {
      const a = angle + Math.PI + rndRange(-0.5, 0.5);
      this.addParticle('spark', x, y, Math.cos(a) * rndRange(80, 220), Math.sin(a) * rndRange(80, 220), 0.26, 5, 0, '#c3ecff', true);
    }
  }

  private fxDeath(e: Enemy): void {
    const isBoss = e.kind === 'boss';
    const n = isBoss ? 22 : e.elite ? 12 : 6;
    const col = e.elite ? '#ffd75c' : '#ff77b0';
    for (let i = 0; i < n; i++) {
      const a = rndAngle();
      const sp = rndRange(60, isBoss ? 380 : 190);
      this.addParticle('spark', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, rndRange(0.24, 0.5), 5, 0, col, true);
    }
    this.addParticle('puff', e.x, e.y, 0, -20, 0.36, e.radius * 1.1, e.radius * 2.2, '#ffffff', true);
  }

  /* -------------------------------------------------------------- helpers */

  /** Muzzle-flash + recoil feedback at the player's gun. */
  muzzleFlash(angle: number): void {
    const p = this.player;
    const gx = p.x + Math.cos(angle) * 26;
    const gy = p.y + Math.sin(angle) * 26 + 4;
    this.addParticle('spark', gx, gy, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.09, 16, 4, '#ffd75c', true);
  }
}

