/**
 * Procedural audio.
 *
 * Every sound is synthesised at runtime from oscillators and noise bursts — the
 * same reasoning as the art: no binary assets, tiny bundle, and each effect is
 * a handful of tunable numbers rather than an opaque file.
 *
 * WebAudio on mobile requires a user gesture before it will produce sound, so
 * `unlock()` is wired to the first touch/keypress.
 */

type SfxName =
  | 'shoot'
  | 'shootHeavy'
  | 'zap'
  | 'explode'
  | 'boom'
  | 'kill'
  | 'gem'
  | 'hurt'
  | 'levelup'
  | 'dash'
  | 'wave'
  | 'bossHorn'
  | 'heal'
  | 'powerup'
  | 'spit'
  | 'shatter'
  | 'saw'
  | 'freeze'
  | 'click'
  | 'death';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private unlocked = false;

  muted = false;
  musicOn = true;

  /** Rate limiting: many effects fire on the same frame in a bullet-hell. */
  private lastPlayed = new Map<string, number>();

  private musicTimer = 0;
  private musicStep = 0;

  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.3;
      this.musicBus.connect(this.master);

      // One second of white noise, reused by every percussive effect.
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.unlocked = true;
    } catch {
      // Audio is a nice-to-have; a failure here must never break the game.
      this.unlocked = false;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  /* ------------------------------------------------------------ synthesis */

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number, q = 1, delay = 0, sweepTo?: number): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo !== undefined) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    }
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /* ---------------------------------------------------------------- play */

  play(name: SfxName, volume = 1): void {
    if (!this.unlocked || this.muted || !this.ctx) return;

    // Throttle: identical effects within a few ms would just clip the mix.
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    const minGap = THROTTLE[name] ?? 0.03;
    if (now - last < minGap) return;
    this.lastPlayed.set(name, now);

    const v = volume;
    switch (name) {
      case 'shoot':
        this.tone(680, 0.08, 'square', 0.09 * v, 240);
        this.noise(0.05, 0.05 * v, 2600, 1);
        break;
      case 'shootHeavy':
        this.tone(220, 0.16, 'sawtooth', 0.12 * v, 70);
        this.noise(0.12, 0.09 * v, 1200, 0.8);
        break;
      case 'zap':
        this.tone(1500, 0.1, 'square', 0.07 * v, 420);
        this.noise(0.09, 0.07 * v, 5200, 3, 0, 1800);
        break;
      case 'explode':
        this.noise(0.34, 0.24 * v, 900, 0.6, 0, 90);
        this.tone(140, 0.3, 'sine', 0.16 * v, 42);
        break;
      case 'boom':
        this.noise(0.7, 0.34 * v, 620, 0.5, 0, 50);
        this.tone(96, 0.6, 'sine', 0.28 * v, 28);
        this.tone(190, 0.34, 'triangle', 0.12 * v, 50);
        break;
      case 'kill':
        this.tone(420, 0.07, 'triangle', 0.05 * v, 180);
        this.noise(0.06, 0.04 * v, 1800, 1.4);
        break;
      case 'gem':
        this.tone(920, 0.07, 'sine', 0.05 * v, 1320);
        break;
      case 'hurt':
        this.tone(180, 0.2, 'sawtooth', 0.16 * v, 62);
        this.noise(0.14, 0.11 * v, 700, 0.8);
        break;
      case 'levelup':
        // Rising major arpeggio.
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.13 * v, undefined, i * 0.07));
        break;
      case 'dash':
        this.noise(0.16, 0.09 * v, 900, 0.7, 0, 3400);
        break;
      case 'wave':
        [392, 523].forEach((f, i) => this.tone(f, 0.3, 'square', 0.08 * v, undefined, i * 0.11));
        break;
      case 'bossHorn':
        this.tone(88, 1.1, 'sawtooth', 0.2 * v, 70);
        this.tone(132, 1.0, 'square', 0.09 * v, 106, 0.06);
        this.noise(0.9, 0.07 * v, 240, 0.5);
        break;
      case 'heal':
        [523, 784].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.11 * v, undefined, i * 0.08));
        break;
      case 'powerup':
        [440, 587, 880].forEach((f, i) => this.tone(f, 0.22, 'square', 0.09 * v, undefined, i * 0.055));
        break;
      case 'spit':
        this.tone(300, 0.12, 'sawtooth', 0.06 * v, 120);
        break;
      case 'shatter':
        this.noise(0.22, 0.11 * v, 6000, 2.2, 0, 2200);
        this.tone(1800, 0.14, 'triangle', 0.05 * v, 700);
        break;
      case 'saw':
        this.tone(140, 0.09, 'sawtooth', 0.05 * v, 190);
        break;
      case 'freeze':
        this.tone(1400, 0.28, 'sine', 0.08 * v, 420);
        this.noise(0.24, 0.05 * v, 3800, 2.4, 0, 900);
        break;
      case 'click':
        this.tone(760, 0.05, 'square', 0.09 * v, 520);
        break;
      case 'death':
        this.tone(300, 1.1, 'sawtooth', 0.2 * v, 44);
        this.noise(0.9, 0.14 * v, 500, 0.5, 0, 60);
        break;
    }
  }

  /* --------------------------------------------------------------- music */

  /**
   * A minimal generative loop: a pulsing bass note plus a sparse arpeggio in
   * A minor. It exists to fill the silence without competing with the SFX.
   */
  updateMusic(dt: number, intensity: number): void {
    if (!this.unlocked || this.muted || !this.musicOn || !this.ctx || !this.musicBus) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;

    const stepDur = 0.34 - Math.min(0.1, intensity * 0.05);
    this.musicTimer = stepDur;
    const step = this.musicStep++ % 16;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const playNote = (freq: number, dur: number, type: OscillatorType, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 900 + intensity * 500;
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.musicBus!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    // Bass on the downbeats.
    const bassLine = [55, 55, 65.4, 65.4, 49, 49, 58.3, 58.3];
    if (step % 2 === 0) {
      playNote(bassLine[(step / 2) % bassLine.length], stepDur * 1.9, 'triangle', 0.3);
    }
    // Sparse arpeggio that thickens as the run gets more intense.
    const arp = [440, 523.3, 659.3, 523.3, 587.3, 659.3, 784, 659.3];
    if (step % 4 === 1 || (intensity > 0.4 && step % 2 === 1)) {
      playNote(arp[step % arp.length], stepDur * 1.1, 'square', 0.055);
    }
    if (intensity > 0.7 && step % 8 === 4) {
      playNote(arp[(step + 3) % arp.length] * 2, stepDur * 0.7, 'sine', 0.04);
    }
  }

  resetMusic(): void {
    this.musicStep = 0;
    this.musicTimer = 0;
  }
}

/** Minimum seconds between repeats of the same effect. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  shoot: 0.055,
  kill: 0.045,
  gem: 0.05,
  zap: 0.06,
  explode: 0.06,
  saw: 0.09,
  spit: 0.08,
  shatter: 0.08,
};

export const audio = new AudioEngine();
