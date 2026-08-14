import { clamp } from './math';

/**
 * Touch/mouse input reduced to a single analog vector.
 *
 * Control scheme (Survivor.io style): one floating virtual stick. The stick
 * anchors wherever the first touch lands and follows the finger, so the player
 * never has to look for a fixed pad. Aiming and firing are automatic, which is
 * what makes the genre one-thumb playable.
 *
 * WASD/arrows are also handled so the game is testable on desktop.
 */
export class Input {
  /** Normalised movement vector; magnitude 0..1. */
  x = 0;
  y = 0;
  active = false;

  /** Stick visuals, in CSS pixels, for the renderer. */
  originX = 0;
  originY = 0;
  knobX = 0;
  knobY = 0;

  /** Radius the knob can travel from the anchor, in CSS pixels. */
  private radius = 62;
  private pointerId: number | null = null;
  private readonly keys = new Set<string>();
  private readonly el: HTMLElement;
  /** Set on the first real user gesture — used to unlock WebAudio. */
  private gestureHandlers: Array<() => void> = [];

  constructor(el: HTMLElement) {
    this.el = el;
    this.attach();
  }

  /** Registers a one-shot callback fired on the first user gesture. */
  onFirstGesture(fn: () => void): void {
    this.gestureHandlers.push(fn);
  }

  private fireGesture(): void {
    if (this.gestureHandlers.length === 0) return;
    const hs = this.gestureHandlers;
    this.gestureHandlers = [];
    for (const h of hs) h();
  }

  /** Scales the stick to the viewport so it feels the same on tablets. */
  resize(w: number, h: number): void {
    this.radius = clamp(Math.min(w, h) * 0.17, 46, 84);
  }

  private attach(): void {
    const down = (e: PointerEvent) => {
      this.fireGesture();
      // Ignore extra fingers while a stick is already engaged.
      if (this.pointerId !== null) return;
      // Only claim touches that started on the canvas, not on UI panels.
      if (e.target !== this.el) return;
      this.pointerId = e.pointerId;
      this.active = true;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.knobX = e.clientX;
      this.knobY = e.clientY;
      this.x = 0;
      this.y = 0;
      // Capture keeps the stick tracking if the finger slides off the canvas.
      // It throws if the pointer was already released between the event being
      // queued and this handler running, which must not break the stick.
      try {
        this.el.setPointerCapture?.(e.pointerId);
      } catch {
        /* non-fatal: we still track the pointer via the window listeners */
      }
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const len = Math.hypot(dx, dy);
      if (len > this.radius) {
        // Drag the anchor along so the stick never "runs out" of travel.
        const over = len - this.radius;
        this.originX += (dx / len) * over;
        this.originY += (dy / len) * over;
        dx = (dx / len) * this.radius;
        dy = (dy / len) * this.radius;
      }
      this.knobX = this.originX + dx;
      this.knobY = this.originY + dy;
      // Small dead zone stops jitter from turning into drift.
      const mag = Math.hypot(dx, dy) / this.radius;
      if (mag < 0.14) {
        this.x = 0;
        this.y = 0;
      } else {
        const norm = Math.min(1, (mag - 0.14) / (1 - 0.14));
        const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy));
        this.x = dx * inv * norm;
        this.y = dy * inv * norm;
      }
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.active = false;
      this.x = 0;
      this.y = 0;
    };

    this.el.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });

    window.addEventListener('keydown', (e) => {
      this.fireGesture();
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointerId = null;
      this.active = false;
      this.x = 0;
      this.y = 0;
    });

    // Block the browser gestures that would otherwise fight the game.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  /** Folds keyboard state into the analog vector. Call once per sim step. */
  pollKeyboard(): void {
    if (this.pointerId !== null) return;
    let kx = 0;
    let ky = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) kx -= 1;
    if (k.has('d') || k.has('arrowright')) kx += 1;
    if (k.has('w') || k.has('arrowup')) ky -= 1;
    if (k.has('s') || k.has('arrowdown')) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const inv = 1 / Math.hypot(kx, ky);
      this.x = kx * inv;
      this.y = ky * inv;
      this.active = false; // no on-screen stick for keyboard play
    } else if (this.pointerId === null) {
      this.x = 0;
      this.y = 0;
    }
  }

  get stickRadius(): number {
    return this.radius;
  }

  /** Drops any in-flight touch, e.g. when a menu opens. */
  release(): void {
    this.pointerId = null;
    this.active = false;
    this.x = 0;
    this.y = 0;
  }
}
