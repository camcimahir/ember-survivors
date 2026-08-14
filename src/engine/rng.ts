/**
 * Deterministic PRNG (mulberry32). A seeded generator keeps procedural art
 * identical between runs — the same seed must always draw the same sprite.
 */
export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** In-place Fisher-Yates. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** Weighted pick. `weights[i]` corresponds to `arr[i]`; assumes sum > 0. */
  weighted<T>(arr: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (let i = 0; i < arr.length; i++) total += weights[i];
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
}

/** Shared gameplay RNG — reseeded each run so runs differ. */
export const rand = new Rng(Date.now() & 0xffffffff);

/** Convenience wrappers over the gameplay RNG. */
export const rnd = (): number => rand.next();
export const rndRange = (a: number, b: number): number => rand.range(a, b);
export const rndInt = (a: number, b: number): number => rand.int(a, b);
export const rndAngle = (): number => rand.next() * Math.PI * 2;
