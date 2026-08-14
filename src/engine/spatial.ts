/**
 * Uniform spatial hash for broad-phase collision.
 *
 * With several hundred enemies on screen, naive O(n*m) bullet/enemy checks
 * dominate the frame. The grid is rebuilt each frame from scratch (cheap: it is
 * just integer bucketing) and queried with a radius.
 *
 * Buckets store *indices* into a caller-owned array, so no per-frame allocation.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private readonly invCell: number;
  private readonly buckets = new Map<number, number[]>();
  /** Reused scratch buffer for query results. */
  private readonly result: number[] = [];

  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
  }

  clear(): void {
    // Keep the arrays allocated; just reset their length.
    for (const arr of this.buckets.values()) arr.length = 0;
  }

  private key(cx: number, cy: number): number {
    // Pack two 16-bit signed cell coords into one number.
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  insert(index: number, x: number, y: number): void {
    const cx = Math.floor(x * this.invCell);
    const cy = Math.floor(y * this.invCell);
    const k = this.key(cx, cy);
    let arr = this.buckets.get(k);
    if (arr === undefined) {
      arr = [];
      this.buckets.set(k, arr);
    }
    arr.push(index);
  }

  /**
   * Returns indices of entries within the square neighbourhood covering
   * `radius`. The returned array is reused between calls — copy it if you need
   * to hold on to the results.
   */
  query(x: number, y: number, radius: number): number[] {
    const res = this.result;
    res.length = 0;
    const minX = Math.floor((x - radius) * this.invCell);
    const maxX = Math.floor((x + radius) * this.invCell);
    const minY = Math.floor((y - radius) * this.invCell);
    const maxY = Math.floor((y + radius) * this.invCell);
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const arr = this.buckets.get(this.key(cx, cy));
        if (arr === undefined) continue;
        for (let i = 0; i < arr.length; i++) res.push(arr[i]);
      }
    }
    return res;
  }

  /** Cell size, exposed so callers can reason about query cost. */
  get cell(): number {
    return this.cellSize;
  }
}
