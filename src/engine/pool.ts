/**
 * Fixed-capacity object pool with a swap-remove active list.
 *
 * Every hot entity type (bullets, enemies, particles, pickups) lives in one of
 * these so the sim never allocates during a run — GC pauses are the main source
 * of stutter on mid-range Android devices.
 */
export interface Poolable {
  alive: boolean;
}

export class Pool<T extends Poolable> {
  /** Dense array; indices [0, count) are alive. Iterate this directly. */
  readonly items: T[] = [];
  count = 0;

  private readonly factory: () => T;
  private readonly cap: number;

  constructor(factory: () => T, capacity: number, prealloc = capacity) {
    this.factory = factory;
    this.cap = capacity;
    for (let i = 0; i < prealloc; i++) {
      const it = factory();
      it.alive = false;
      this.items.push(it);
    }
  }

  /**
   * Returns a slot from the pool, or `null` when full. Callers must fully
   * reinitialise every field of the returned object: it is recycled memory,
   * not a fresh instance.
   */
  spawn(): T | null {
    if (this.count >= this.cap) return null;
    if (this.count >= this.items.length) this.items.push(this.factory());
    const it = this.items[this.count++];
    it.alive = true;
    return it;
  }

  /**
   * Compacts dead entries. Call once per frame after updating. Uses swap-remove
   * so order is not stable — nothing in the game depends on entity order.
   */
  sweep(): void {
    let i = 0;
    while (i < this.count) {
      const it = this.items[i];
      if (it.alive) {
        i++;
        continue;
      }
      const last = this.count - 1;
      this.items[i] = this.items[last];
      this.items[last] = it;
      this.count--;
    }
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) this.items[i].alive = false;
    this.count = 0;
  }

  get free(): number {
    return this.cap - this.count;
  }

  get capacity(): number {
    return this.cap;
  }
}
