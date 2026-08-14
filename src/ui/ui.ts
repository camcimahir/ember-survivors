/**
 * DOM user interface.
 *
 * Gameplay is canvas; everything with text is DOM. That keeps typography crisp
 * at any device pixel ratio, gives us real layout for the card screen, and
 * costs nothing at runtime because the UI only re-renders when it changes.
 */

import { audio } from '../engine/audio';
import { formatShort, formatTime } from '../engine/math';
import { elementIcon, fusionIcon, passiveIcon, spriteToCanvas } from '../art/icons';
import { logoCanvas } from '../art/logo';
import { RARITY, type ElementKey } from '../art/style';
import { ELEMENT_WEAPONS } from '../game/content/elements';
import { FUSION_BY_ID } from '../game/content/fusions';
import { PASSIVE_BY_ID } from '../game/content/passives';
import { bossHealthFraction } from '../game/render';
import type { Card } from '../game/types';
import { banishCard, fusionHints, loadout, rollCards } from '../game/upgrades';
import type { World } from '../game/world';

const MAX_ELEMENT_SLOTS = 3;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** Resolves the icon canvas for a card. */
function cardIcon(card: Card, size: number): HTMLCanvasElement {
  if (card.kind === 'element') {
    return spriteToCanvas(elementIcon(card.elements[0]), size);
  }
  if (card.kind === 'fusion') {
    const f = FUSION_BY_ID.get(card.id);
    return spriteToCanvas(
      fusionIcon(f?.glyph ?? card.id, card.elements[0], card.elements[1]),
      size,
    );
  }
  const p = PASSIVE_BY_ID.get(card.id);
  return spriteToCanvas(passiveIcon(p?.icon ?? 'heart', p?.tint ?? '#4a5878'), size);
}

export class UI {
  private root: HTMLElement;

  private hud!: HTMLElement;
  private xpFill!: HTMLElement;
  private lvlLabel!: HTMLElement;
  private timerLabel!: HTMLElement;
  private waveLabel!: HTMLElement;
  private killsLabel!: HTMLElement;
  private chips!: HTMLElement;
  private toasts!: HTMLElement;
  private bossBar!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossName!: HTMLElement;

  private overlay: HTMLElement | null = null;

  /** Cached chip state so we only rebuild the chips when the build changes. */
  private chipSignature = '';

  onStart: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  onPick: ((card: Card) => void) | null = null;
  onPause: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.buildHud();
  }

  /* -------------------------------------------------------------- HUD --- */

  private buildHud(): void {
    this.hud = el('div');
    this.hud.id = 'hud';

    const top = el('div', 'hud-top');
    const track = el('div', 'xp-track');
    this.xpFill = el('div', 'xp-fill');
    track.appendChild(this.xpFill);

    const row = el('div', 'hud-row');
    this.lvlLabel = el('span', 'hud-lvl', 'LV 1');
    this.timerLabel = el('span', 'hud-timer', '0:00');
    this.waveLabel = el('span', 'hud-wave', 'WAVE 1');
    row.append(this.lvlLabel, this.timerLabel, this.waveLabel);

    const row2 = el('div', 'hud-row');
    this.killsLabel = el('span', 'hud-kills', '0 kills');
    row2.append(this.killsLabel);

    top.append(track, row, row2);
    this.hud.appendChild(top);

    this.chips = el('div', 'chips');
    this.hud.appendChild(this.chips);

    const pause = el('button', '', '❚❚');
    pause.id = 'pause-btn';
    pause.addEventListener('click', () => {
      audio.play('click');
      this.onPause?.();
    });
    this.hud.appendChild(pause);

    this.toasts = el('div');
    this.toasts.id = 'toasts';

    this.bossBar = el('div');
    this.bossBar.id = 'bossbar';
    this.bossName = el('div', 'name', 'WARDEN');
    const btrack = el('div', 'track');
    this.bossFill = el('div', 'fill');
    btrack.appendChild(this.bossFill);
    this.bossBar.append(this.bossName, btrack);
    this.bossBar.style.display = 'none';

    this.root.append(this.hud, this.toasts, this.bossBar);
  }

  setHudVisible(v: boolean): void {
    this.hud.style.display = v ? '' : 'none';
    if (!v) this.bossBar.style.display = 'none';
  }

  /** Called every frame; cheap string/style writes only. */
  updateHud(w: World): void {
    const pct = Math.min(100, (w.xp / w.xpNeeded) * 100);
    this.xpFill.style.width = `${pct}%`;
    this.lvlLabel.textContent = `LV ${w.level}`;
    this.timerLabel.textContent = formatTime(w.time);
    this.waveLabel.textContent = `WAVE ${w.wave}`;
    this.killsLabel.textContent = `${formatShort(w.run.kills)} kills`;

    if (w.bossActive && w.bossRef) {
      this.bossBar.style.display = '';
      this.bossName.textContent = w.bossName.toUpperCase();
      this.bossFill.style.width = `${bossHealthFraction(w.bossRef) * 100}%`;
    } else {
      this.bossBar.style.display = 'none';
    }

    this.updateChips(w);
  }

  private updateChips(w: World): void {
    const owned = w.ownedElements();
    const sig =
      owned.map((e) => `${e}${w.getWeaponInstance(ELEMENT_WEAPONS[e].id)?.level ?? 0}`).join(',') +
      '|' +
      [...w.fusionIds].join(',');
    if (sig === this.chipSignature) return;
    this.chipSignature = sig;

    this.chips.innerHTML = '';
    for (let i = 0; i < MAX_ELEMENT_SLOTS; i++) {
      const key = owned[i] as ElementKey | undefined;
      const chip = el('div', key ? 'chip' : 'chip empty');
      if (key) {
        chip.appendChild(spriteToCanvas(elementIcon(key), 30));
        const lvl = w.getWeaponInstance(ELEMENT_WEAPONS[key].id)?.level ?? 1;
        chip.appendChild(el('span', 'lvl', String(lvl)));
      }
      this.chips.appendChild(chip);
    }
    // Fusion chips follow the element slots.
    for (const id of w.fusionIds) {
      const f = FUSION_BY_ID.get(id);
      if (!f) continue;
      const chip = el('div', 'chip');
      chip.style.borderColor = RARITY.fusion;
      chip.appendChild(
        spriteToCanvas(fusionIcon(f.glyph, f.elements[0] as ElementKey, f.elements[1] as ElementKey), 30),
      );
      const lvl = w.getWeaponInstance(id)?.level ?? 1;
      chip.appendChild(el('span', 'lvl', String(lvl)));
      this.chips.appendChild(chip);
    }
  }

  /* ------------------------------------------------------------ toasts --- */

  toast(msg: string): void {
    const t = el('div', 'toast', msg);
    this.toasts.appendChild(t);
    window.setTimeout(() => t.remove(), 2200);
  }

  waveCall(n: number): void {
    const t = el('div', 'wave-call', `WAVE ${n}`);
    this.root.appendChild(t);
    window.setTimeout(() => t.remove(), 2100);
  }

  /* ---------------------------------------------------------- overlays --- */

  private clearOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private showOverlay(id: string): HTMLElement {
    this.clearOverlay();
    const o = el('div', 'overlay');
    o.id = id;
    this.overlay = o;
    this.root.appendChild(o);
    return o;
  }

  hideOverlay(): void {
    this.clearOverlay();
  }

  /** Title screen. */
  showTitle(): void {
    const o = this.showOverlay('title');
    const logo = logoCanvas();
    logo.className = 'title-logo';
    o.appendChild(logo);
    o.appendChild(el('div', 'tagline', 'Survive. Fuse. Endure.'));

    const play = el('button', 'btn', 'Play');
    play.addEventListener('click', () => {
      audio.play('click');
      this.onStart?.();
    });
    o.appendChild(play);

    const row = el('div', 'btn-row');
    const how = el('button', 'btn secondary', 'How to Play');
    how.addEventListener('click', () => {
      audio.play('click');
      this.showHowTo();
    });
    const sound = el('button', 'btn secondary', audio.muted ? 'Sound: Off' : 'Sound: On');
    sound.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      sound.textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
      audio.play('click');
    });
    row.append(how, sound);
    o.appendChild(row);
  }

  private showHowTo(): void {
    const o = this.showOverlay('howto');
    o.appendChild(el('h2', '', 'How to Play'));
    o.appendChild(
      el(
        'div',
        'sub',
        'Drag anywhere to move — a stick appears under your thumb. You fire automatically at the nearest enemy.',
      ),
    );

    const list = el('div', 'loadout');
    const items: Array<[string, string, string]> = [
      ['xp', 'Collect XP', 'Enemies drop gems. Gems level you up and level-ups give you cards.'],
      ['multi', 'Three Elements', 'You may hold at most THREE elements. Choose them carefully — the rest of the run is built on them.'],
      ['crit', 'Fuse Them', 'Get any two of your elements to level 3 and their FUSION card appears — a brand-new weapon combining both.'],
      ['shield', 'Stay Alive', 'Waves get harder every 30 seconds, and a boss arrives every couple of minutes.'],
    ];
    for (const [icon, name, desc] of items) {
      const item = el('div', 'loadout-item');
      item.appendChild(spriteToCanvas(passiveIcon(icon, '#3a4a6a'), 34));
      const body = el('div');
      body.appendChild(el('div', 'li-name', name));
      body.appendChild(el('div', 'li-desc', desc));
      item.appendChild(body);
      list.appendChild(item);
    }
    o.appendChild(list);

    const back = el('button', 'btn', 'Back');
    back.addEventListener('click', () => {
      audio.play('click');
      this.showTitle();
    });
    o.appendChild(back);
  }

  /** Level-up card selection. Returns nothing; picks come back via onPick. */
  showLevelUp(w: World): void {
    const o = this.showOverlay('levelup');
    let cards = rollCards(w, 3);

    const banner = el('div', 'lvl-banner', 'LEVEL UP');
    const title = el('div', 'lvl-title', `Level ${w.level}`);
    const hint = el('div', 'lvl-hint', '');
    o.append(banner, title, hint);

    const list = el('div', 'cards');
    o.appendChild(list);

    const tools = el('div', 'card-tools');
    const rerollBtn = el('button', 'tool-btn');
    const banishBtn = el('button', 'tool-btn');
    tools.append(rerollBtn, banishBtn);
    o.appendChild(tools);

    let banishMode = false;

    const refreshHints = (): void => {
      const hints = fusionHints(w);
      const slots = MAX_ELEMENT_SLOTS - w.ownedElements().length;
      if (banishMode) {
        hint.innerHTML = '<b>Tap a card to banish it for this run.</b>';
      } else if (slots > 0) {
        hint.textContent = `${slots} element slot${slots > 1 ? 's' : ''} remaining`;
      } else if (hints.length > 0) {
        hint.textContent = hints[0];
      } else {
        hint.textContent = '';
      }
    };

    const refreshTools = (): void => {
      rerollBtn.innerHTML = `↻ Reroll <span class="count">${w.rerolls}</span>`;
      banishBtn.innerHTML = `✕ Banish <span class="count">${w.banishes}</span>`;
      rerollBtn.disabled = w.rerolls <= 0;
      banishBtn.disabled = w.banishes <= 0;
      banishBtn.style.borderColor = banishMode ? '#ff5566' : '';
    };

    const renderCards = (): void => {
      list.innerHTML = '';
      for (const card of cards) {
        list.appendChild(this.buildCard(card, () => {
          if (banishMode) {
            if (banishCard(w, card)) {
              audio.play('click');
              banishMode = false;
              cards = rollCards(w, 3);
              renderCards();
              refreshTools();
              refreshHints();
            }
            return;
          }
          audio.play('levelup');
          this.onPick?.(card);
        }));
      }
    };

    rerollBtn.addEventListener('click', () => {
      if (w.rerolls <= 0) return;
      w.rerolls--;
      cards = rollCards(w, 3);
      audio.play('click');
      renderCards();
      refreshTools();
    });

    banishBtn.addEventListener('click', () => {
      if (w.banishes <= 0) return;
      banishMode = !banishMode;
      audio.play('click');
      refreshTools();
      refreshHints();
    });

    renderCards();
    refreshTools();
    refreshHints();
  }

  private buildCard(card: Card, onClick: () => void): HTMLElement {
    const c = el('div', card.kind === 'fusion' ? 'card fusion' : 'card');
    c.style.setProperty('--accent', RARITY[card.rarity]);

    if (card.kind === 'fusion') c.appendChild(el('div', 'fusion-flare'));

    const icon = el('div', 'card-icon');
    icon.appendChild(cardIcon(card, 44));
    c.appendChild(icon);

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-kind', card.kindLabel));

    const name = el('div', 'card-name');
    name.appendChild(document.createTextNode(card.name));
    if (card.maxLevel > 1) {
      name.appendChild(el('span', 'card-tier', `${card.level}/${card.maxLevel}`));
    }
    body.appendChild(name);

    body.appendChild(el('div', 'card-desc', card.desc));
    c.appendChild(body);

    c.addEventListener('click', onClick);
    return c;
  }

  /** Pause menu, including the current build. */
  showPause(w: World): void {
    const o = this.showOverlay('pause');
    o.appendChild(el('h2', '', 'Paused'));
    o.appendChild(el('div', 'sub', `${formatTime(w.time)} survived · Wave ${w.wave} · Level ${w.level}`));
    o.appendChild(this.buildLoadout(w));

    const resume = el('button', 'btn', 'Resume');
    resume.addEventListener('click', () => {
      audio.play('click');
      this.onResume?.();
    });
    o.appendChild(resume);

    const row = el('div', 'btn-row');
    const sound = el('button', 'btn secondary', audio.muted ? 'Sound: Off' : 'Sound: On');
    sound.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      sound.textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
    });
    const quit = el('button', 'btn secondary', 'Quit Run');
    quit.addEventListener('click', () => {
      audio.play('click');
      this.onQuit?.();
    });
    row.append(sound, quit);
    o.appendChild(row);
  }

  private buildLoadout(w: World): HTMLElement {
    const list = el('div', 'loadout');
    const entries = loadout(w);
    if (entries.length === 0) {
      list.appendChild(el('div', 'loadout-item', '<div class="li-desc">No upgrades yet.</div>'));
      return list;
    }
    for (const e of entries) {
      const item = el('div', 'loadout-item');
      let canvas: HTMLCanvasElement;
      if (e.kind === 'element') canvas = spriteToCanvas(elementIcon(e.elements[0]), 34);
      else if (e.kind === 'fusion') {
        canvas = spriteToCanvas(fusionIcon(e.iconKey, e.elements[0], e.elements[1]), 34);
      } else canvas = spriteToCanvas(passiveIcon(e.iconKey), 34);
      item.appendChild(canvas);

      const body = el('div');
      body.appendChild(el('div', 'li-name', e.name));
      body.appendChild(el('div', 'li-desc', e.desc));
      item.appendChild(body);
      item.appendChild(el('div', 'li-lvl', `Lv ${e.level}/${e.maxLevel}`));
      list.appendChild(item);
    }
    return list;
  }

  /** Game over summary. */
  showGameOver(w: World): void {
    const o = this.showOverlay('gameover');
    o.appendChild(el('h2', '', 'You Fell'));
    o.appendChild(el('div', 'sub', `The horde overwhelmed you on wave ${w.wave}.`));

    const stats = el('div', 'stats');
    const rows: Array<[string, string]> = [
      ['Survived', formatTime(w.run.timeSurvived)],
      ['Level', String(w.run.level)],
      ['Kills', formatShort(w.run.kills)],
      ['Damage', formatShort(w.run.damageDealt)],
      ['Wave', String(w.run.wave)],
      ['Bosses', String(w.run.bossesKilled)],
    ];
    for (const [k, v] of rows) {
      const s = el('div', 'stat');
      s.appendChild(el('span', '', k));
      s.appendChild(el('b', '', v));
      stats.appendChild(s);
    }
    o.appendChild(stats);
    o.appendChild(this.buildLoadout(w));

    const again = el('button', 'btn', 'Play Again');
    again.addEventListener('click', () => {
      audio.play('click');
      this.onRestart?.();
    });
    o.appendChild(again);

    const row = el('div', 'btn-row');
    const menu = el('button', 'btn secondary', 'Main Menu');
    menu.addEventListener('click', () => {
      audio.play('click');
      this.onQuit?.();
    });
    row.append(menu);
    o.appendChild(row);
  }
}
