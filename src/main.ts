/**
 * Entry point: builds the engine pieces, wires the UI to the sim, and runs the
 * fixed-timestep loop.
 */

import './ui/styles.css';

import { audio } from './engine/audio';
import { Input } from './engine/input';
import { GameLoop } from './engine/loop';
import { setSpriteScale } from './engine/sprites';
import { actors, preloadActorArt } from './art/actors';
import { fx } from './art/fx';
import { Renderer } from './game/render';
import { World } from './game/world';
import { applyCard, resetBanished, rollCards } from './game/upgrades';
import { UI } from './ui/ui';

// Importing the content modules registers every weapon definition.
import './game/content/elements';
import './game/content/fusions';
import type { Card } from './game/types';
import type { ElementKey } from './art/style';
import { ELEMENT_WEAPONS } from './game/content/elements';
import { FUSION_BY_ID } from './game/content/fusions';
import type { MobKind } from './game/types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

// Cap the sprite raster scale: beyond 2x the memory cost outweighs the gain on
// phone-sized screens, and mid-range Android GPUs notice.
const dpr = Math.min(2, window.devicePixelRatio || 1);
setSpriteScale(dpr);

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const world = new World();
const ui = new UI(uiRoot);

/* ------------------------------------------------------------- lifecycle --- */

function resize(): void {
  renderer.resize(dpr);
  // The joystick lives in screen space, so it uses CSS pixels...
  input.resize(renderer.w, renderer.h);
  // ...but spawn margins are world-space. Feeding the sim CSS pixels here would
  // make enemies spawn inside the visible area whenever the camera is zoomed
  // out, so they would pop into existence on screen.
  world.viewW = renderer.worldW;
  world.viewH = renderer.worldH;
}

function startRun(): void {
  resetBanished();
  world.reset();
  world.phase = 'playing';
  audio.resetMusic();
  ui.hideOverlay();
  ui.setHudVisible(true);
  loop.resync();
  // The first level-up arrives quickly so the player picks an element early
  // rather than shooting nothing for thirty seconds.
  world.pendingLevels = 1;
}

function toMenu(): void {
  world.phase = 'menu';
  ui.setHudVisible(false);
  ui.showTitle();
}

function pause(): void {
  if (world.phase !== 'playing') return;
  world.phase = 'paused';
  input.release();
  ui.showPause(world);
}

function resume(): void {
  if (world.phase !== 'paused') return;
  world.phase = 'playing';
  ui.hideOverlay();
  loop.resync();
}

/** Shows the next pending level-up, or returns to play if none remain. */
function nextLevelScreen(): void {
  if (world.pendingLevels > 0) {
    world.phase = 'levelup';
    input.release();
    ui.showLevelUp(world);
  } else {
    world.phase = 'playing';
    ui.hideOverlay();
    loop.resync();
  }
}

/* ------------------------------------------------------------ ui wiring --- */

ui.onStart = () => startRun();
ui.onRestart = () => startRun();
ui.onQuit = () => toMenu();
ui.onResume = () => resume();
ui.onPause = () => pause();

ui.onPick = (card: Card) => {
  applyCard(world, card);
  world.pendingLevels = Math.max(0, world.pendingLevels - 1);
  nextLevelScreen();
};

world.onLevelUp = () => {
  audio.play('levelup');
  nextLevelScreen();
};

world.onDeath = () => {
  ui.setHudVisible(false);
  window.setTimeout(() => ui.showGameOver(world), 700);
};

world.onToast = (msg) => ui.toast(msg);
world.onWave = (n) => ui.waveCall(n);

/* ------------------------------------------------------------------ loop --- */

const loop = new GameLoop(
  (dt) => {
    if (world.phase !== 'playing') return;
    input.pollKeyboard();
    world.update(dt, input.x, input.y);
  },
  (alpha, frameDt) => {
    renderer.render(world, input, alpha);
    if (world.phase === 'playing') {
      ui.updateHud(world);
      // Music intensity tracks how dangerous things currently are. This runs on
      // real frame time, not the fixed step, or the loop would play at double
      // speed on a 120Hz panel.
      const intensity = Math.min(
        1,
        world.enemies.count / 90 + (world.bossActive ? 0.4 : 0) + world.time / 900,
      );
      audio.updateMusic(frameDt, intensity);
    }
  },
);

/* ---------------------------------------------------------------- events --- */

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 120));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (world.phase === 'playing') pause();
  } else {
    audio.resume();
    loop.resync();
  }
});

// WebAudio needs a user gesture before it will make any sound on mobile.
input.onFirstGesture(() => {
  audio.unlock();
  audio.resume();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') {
    if (world.phase === 'playing') pause();
    else if (world.phase === 'paused') resume();
  }
});

/* ------------------------------------------------------------------ boot --- */

async function boot(): Promise<void> {
  // Imported art is copied into the regular offscreen sprite cache before the
  // game begins, keeping the runtime render path to lightweight canvas blits.
  await preloadActorArt();
  resize();
  // Build every sprite up front so the first wave never stutters mid-fight.
  actors.buildAll();
  fx.buildAll();
  toMenu();
  loop.start();
}

void boot();

/* ------------------------------------------------------------ debug hooks --- */

/**
 * Exposed for manual testing and for the automated checks in the browser.
 * Not referenced by gameplay code.
 */
interface DebugApi {
  world: World;
  input: Input;
  giveXp(n: number): void;
  levelUp(n?: number): void;
  addElement(el: ElementKey, level?: number): void;
  addFusion(id: string, level?: number): void;
  /** `entrance` routes through the spawn telegraph instead of placing instantly. */
  spawn(kind: MobKind, count?: number, elite?: boolean, entrance?: boolean): void;
  setTime(t: number): void;
  killAll(): void;
  godMode(on?: boolean): void;
  listWeapons(): string[];
  /** Rolls a hand of upgrade cards without showing the UI. */
  roll(n?: number): Card[];
  /** Applies a card directly, as if the player had picked it. */
  pick(card: Card): void;
  /** Advances the simulation by `frames` fixed steps. */
  step(frames: number, mx?: number, my?: number): void;
  /** Forces one render pass. Useful when rAF is throttled (hidden tab). */
  renderFrame(): void;
  /** Overrides camera zoom so it can be tuned by eye. <1 zooms out. */
  setZoom(z: number): void;
  /** Current zoom and the visible world size it produces. */
  viewInfo(): { zoom: number; worldW: number; worldH: number; cssW: number; cssH: number };
}

const debugApi: DebugApi = {
  world,
  input,
  giveXp(n) {
    world.xp += n;
    while (world.xp >= world.xpNeeded) {
      world.xp -= world.xpNeeded;
      world.level++;
      world.pendingLevels++;
      world.xpNeeded = World.xpForLevel(world.level);
    }
  },
  levelUp(n = 1) {
    world.pendingLevels += n;
    world.level += n;
  },
  addElement(elKey, level = 1) {
    const def = ELEMENT_WEAPONS[elKey];
    if (!def) return;
    for (let i = 0; i < level; i++) world.addWeapon(def);
    world.elementLevels.set(elKey, world.getWeaponInstance(def.id)?.level ?? 1);
  },
  addFusion(id, level = 1) {
    const f = FUSION_BY_ID.get(id);
    if (!f) return;
    for (let i = 0; i < level; i++) world.addWeapon(f);
  },
  spawn(kind, count = 1, elite = false, entrance = false) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = world.player.x + Math.cos(a) * 220;
      const y = world.player.y + Math.sin(a) * 220;
      if (entrance) world.queueSpawn(kind, x, y, elite);
      else world.spawnEnemy(kind, x, y, elite);
    }
  },
  setTime(t) {
    world.time = t;
  },
  killAll() {
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[i];
      if (e.alive) world.killEnemy(e);
    }
  },
  godMode(on = true) {
    world.god = on;
    world.player.hp = world.stats.maxHp;
  },
  listWeapons() {
    return world.weapons.map((w) => `${w.def.id}:${w.level}`);
  },
  roll(n = 3) {
    return rollCards(world, n);
  },
  pick(card) {
    applyCard(world, card);
  },
  step(frames, mx = 0, my = 0) {
    for (let i = 0; i < frames; i++) world.update(1 / 60, mx, my);
  },
  renderFrame() {
    renderer.render(world, input, 0);
    ui.updateHud(world);
  },
  setZoom(z) {
    renderer.setZoom(z);
    // Keep the sim's spawn margins in step with the new visible area.
    world.viewW = renderer.worldW;
    world.viewH = renderer.worldH;
  },
  viewInfo() {
    return {
      zoom: renderer.zoom,
      worldW: Math.round(renderer.worldW),
      worldH: Math.round(renderer.worldH),
      cssW: renderer.w,
      cssH: renderer.h,
    };
  },
};

(window as unknown as { __game: DebugApi }).__game = debugApi;
