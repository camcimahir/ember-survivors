import { damp } from './math';
import { rndRange } from './rng';

/**
 * Follow camera with trauma-based screen shake.
 *
 * Shake is stored as "trauma" (0..1) and rendered as trauma^2 so small hits are
 * subtle and big ones read hard. Trauma decays continuously, so overlapping
 * explosions stack instead of restarting the effect.
 */
export class Camera {
  x = 0;
  y = 0;
  /** Applied render offset including shake — what the renderer should use. */
  renderX = 0;
  renderY = 0;
  zoom = 1;

  private trauma = 0;
  private shakeT = 0;

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.renderX = x;
    this.renderY = y;
  }

  follow(tx: number, ty: number, dt: number, lead = 0.14): void {
    this.x = damp(this.x, tx, lead, dt);
    this.y = damp(this.y, ty, lead, dt);
  }

  /** Adds shake. `amount` 0..1; typical values: hit 0.12, boss slam 0.5. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number, maxOffset = 26): void {
    this.shakeT += dt;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      const s = this.trauma * this.trauma;
      this.renderX = this.x + rndRange(-1, 1) * maxOffset * s;
      this.renderY = this.y + rndRange(-1, 1) * maxOffset * s;
    } else {
      this.renderX = this.x;
      this.renderY = this.y;
    }
  }

  get traumaLevel(): number {
    return this.trauma;
  }
}
