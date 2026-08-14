/**
 * Fixed-timestep game loop.
 *
 * The sim always advances in exact 1/60s steps so that physics, damage ticks
 * and spawn pacing are identical regardless of display refresh rate (60Hz,
 * 90Hz and 120Hz Android panels are all common). Rendering happens once per
 * animation frame with an interpolation alpha.
 */
export type StepFn = (dt: number) => void;
export type RenderFn = (alpha: number, frameDt: number) => void;

const STEP = 1 / 60;
/** Never simulate more than this many steps in one frame; prevents the
 *  "spiral of death" after the tab is backgrounded. */
const MAX_STEPS = 5;

export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly step: StepFn,
    private readonly render: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /** Discards accumulated time — call after unpausing so the sim doesn't
   *  fast-forward through the time spent in a menu. */
  resync(): void {
    this.last = performance.now();
    this.accumulator = 0;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let frameDt = (now - this.last) / 1000;
    this.last = now;
    // Clamp pathological deltas (device sleep, GC hitch, debugger pause).
    if (frameDt > 0.25) frameDt = 0.25;
    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.step(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.render(this.accumulator / STEP, frameDt);
  };
}

export const FIXED_STEP = STEP;
