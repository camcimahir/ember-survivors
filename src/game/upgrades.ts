/**
 * The level-up card system.
 *
 * Rules that define the build:
 *   - The player may hold at most THREE elements. Once three are chosen, no new
 *     element cards ever appear again — every later pick refines that identity.
 *   - Each owned element levels 1..8.
 *   - A fusion unlocks when BOTH parent elements are owned and each is at level
 *     3 or higher. Fusions are separate weapons with their own 1..5 track.
 *   - Passives fill the remainder of the pool and are always available.
 *
 * `rollCards` guarantees three distinct offers, falling back to a heal when the
 * player has genuinely exhausted everything.
 */

import { rand } from '../engine/rng';
import { ELEMENT_KEYS, type ElementKey } from '../art/style';
import { ELEMENT_INFO, ELEMENT_WEAPONS } from './content/elements';
import { FUSION_BY_PAIR, FUSION_REQ_LEVEL } from './content/fusions';
import { PASSIVE_BY_ID, PASSIVES } from './content/passives';
import { baseStats, type Card } from './types';
import { pairKey } from './weapons';
import type { World } from './world';

export const MAX_ELEMENTS = 3;

/** Ids the player has banished this run; they never appear again. */
export const banished = new Set<string>();

export function resetBanished(): void {
  banished.clear();
}

interface Candidate {
  card: Card;
  weight: number;
}

/* --------------------------------------------------------------- rolling --- */

function elementCandidates(w: World, out: Candidate[]): void {
  const owned = w.ownedElements();
  const canTakeNew = owned.length < MAX_ELEMENTS;

  for (const el of ELEMENT_KEYS) {
    const def = ELEMENT_WEAPONS[el];
    if (!def) continue;
    const inst = w.getWeaponInstance(def.id);

    if (!inst) {
      // A brand-new element — only while a slot remains.
      if (!canTakeNew) continue;
      if (banished.has(def.id)) continue;
      out.push({
        card: {
          id: def.id,
          kind: 'element',
          name: def.name,
          desc: def.desc(1),
          level: 1,
          maxLevel: def.maxLevel,
          elements: [el],
          rarity: 'epic',
          kindLabel: `NEW ELEMENT · ${ELEMENT_INFO[el]?.title ?? ''}`,
        },
        // New elements are pushed hard early; the choice matters most then.
        weight: 46 + (MAX_ELEMENTS - owned.length) * 14,
      });
      continue;
    }

    if (inst.level >= def.maxLevel) continue;
    if (banished.has(def.id)) continue;
    const next = inst.level + 1;
    out.push({
      card: {
        id: def.id,
        kind: 'element',
        name: def.name,
        desc: def.desc(next),
        level: next,
        maxLevel: def.maxLevel,
        elements: [el],
        rarity: 'rare',
        kindLabel: `${ELEMENT_INFO[el]?.title ?? 'ELEMENT'} · LV ${next}`,
      },
      weight: 34,
    });
  }
}

function fusionCandidates(w: World, out: Candidate[]): void {
  const owned = w.ownedElements();
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      const a = owned[i];
      const b = owned[j];
      const la = w.getWeaponInstance(ELEMENT_WEAPONS[a].id)?.level ?? 0;
      const lb = w.getWeaponInstance(ELEMENT_WEAPONS[b].id)?.level ?? 0;
      if (la < FUSION_REQ_LEVEL || lb < FUSION_REQ_LEVEL) continue;

      const f = FUSION_BY_PAIR.get(pairKey(a, b));
      if (!f || banished.has(f.id)) continue;

      const inst = w.getWeaponInstance(f.id);
      const isNew = !inst;
      const next = (inst?.level ?? 0) + 1;
      if (next > f.maxLevel) continue;

      out.push({
        card: {
          id: f.id,
          kind: 'fusion',
          name: f.name,
          desc: isNew ? f.desc(1) : f.desc(next),
          level: next,
          maxLevel: f.maxLevel,
          elements: f.elements as ElementKey[],
          rarity: 'fusion',
          kindLabel: isNew ? `FUSION · ${f.pairLabel}` : `FUSION · LV ${next}`,
        },
        // A first-time fusion is the most exciting card in the game.
        weight: isNew ? 78 : 30,
      });
    }
  }
}

function passiveCandidates(w: World, out: Candidate[]): void {
  for (const p of PASSIVES) {
    if (banished.has(p.id)) continue;
    const lvl = w.passiveLevels.get(p.id) ?? 0;
    if (lvl >= p.maxLevel) continue;
    out.push({
      card: {
        id: p.id,
        kind: 'passive',
        name: p.name,
        desc: p.desc,
        level: lvl + 1,
        maxLevel: p.maxLevel,
        elements: [],
        rarity: lvl >= 2 ? 'rare' : 'common',
        kindLabel: lvl === 0 ? 'PASSIVE' : `PASSIVE · LV ${lvl + 1}`,
      },
      weight: 24,
    });
  }
}

/** Rolls `count` distinct upgrade offers. */
export function rollCards(w: World, count = 3): Card[] {
  const pool: Candidate[] = [];
  elementCandidates(w, pool);
  fusionCandidates(w, pool);
  passiveCandidates(w, pool);

  // Luck biases the roll toward the rarer, build-defining cards.
  const luck = w.stats.luck;
  for (const c of pool) {
    if (c.card.rarity === 'fusion') c.weight *= 1 + luck * 1.6;
    else if (c.card.rarity === 'epic') c.weight *= 1 + luck * 1.1;
    else if (c.card.rarity === 'common') c.weight *= Math.max(0.35, 1 - luck * 0.5);
  }

  const picked: Card[] = [];
  const remaining = [...pool];
  while (picked.length < count && remaining.length > 0) {
    const weights = remaining.map((c) => c.weight);
    const chosen = rand.weighted(remaining, weights);
    picked.push(chosen.card);
    const idx = remaining.indexOf(chosen);
    remaining.splice(idx, 1);
    // Never offer two cards for the same thing in one hand.
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].card.id === chosen.card.id) remaining.splice(i, 1);
    }
  }

  // Everything is maxed: offer a heal so the screen is never empty.
  while (picked.length < count) {
    picked.push({
      id: `heal_${picked.length}`,
      kind: 'passive',
      name: 'Field Rations',
      desc: 'Restore <em>35%</em> of your maximum health.',
      level: 1,
      maxLevel: 1,
      elements: [],
      rarity: 'common',
      kindLabel: 'RECOVERY',
    });
  }

  return picked;
}

/* --------------------------------------------------------------- applying --- */

/**
 * Rebuilds `world.stats` from the base values plus every owned passive.
 *
 * Recomputing from scratch (rather than mutating in place) keeps multiplicative
 * passives exact no matter what order they were picked in.
 */
export function recomputeStats(w: World): void {
  const oldMax = w.stats.maxHp;
  const s = baseStats();
  for (const [id, lvl] of w.passiveLevels) {
    const def = PASSIVE_BY_ID.get(id);
    if (!def) continue;
    for (let i = 0; i < lvl; i++) def.apply(s);
  }
  w.stats = s;
  // Gaining max HP should feel like a heal, not a dilution of your health bar.
  if (s.maxHp > oldMax) w.player.hp += s.maxHp - oldMax;
  w.player.hp = Math.min(w.player.hp, s.maxHp);
}

/** Applies a chosen card to the run. */
export function applyCard(w: World, card: Card): void {
  if (card.id.startsWith('heal_')) {
    w.healPlayer(Math.round(w.stats.maxHp * 0.35));
    return;
  }

  switch (card.kind) {
    case 'element': {
      const def = ELEMENT_WEAPONS[card.elements[0]];
      if (!def) return;
      const inst = w.addWeapon(def);
      w.elementLevels.set(card.elements[0], inst.level);
      break;
    }
    case 'fusion': {
      const f = FUSION_BY_PAIR.get(pairKey(card.elements[0], card.elements[1]));
      if (!f) return;
      w.addWeapon(f);
      break;
    }
    case 'passive': {
      const p = PASSIVE_BY_ID.get(card.id);
      if (!p) return;
      w.passiveLevels.set(card.id, (w.passiveLevels.get(card.id) ?? 0) + 1);
      recomputeStats(w);
      break;
    }
  }
}

/** Banishes a card id for the rest of the run. Returns false if unavailable. */
export function banishCard(w: World, card: Card): boolean {
  if (w.banishes <= 0) return false;
  if (card.id.startsWith('heal_')) return false;
  w.banishes--;
  banished.add(card.id);
  return true;
}

/* ---------------------------------------------------------------- summary --- */

export interface LoadoutEntry {
  name: string;
  desc: string;
  level: number;
  maxLevel: number;
  kind: 'element' | 'fusion' | 'passive';
  elements: ElementKey[];
  /** Icon lookup hints. */
  iconKey: string;
}

/** The player's current build, for the pause and game-over screens. */
export function loadout(w: World): LoadoutEntry[] {
  const out: LoadoutEntry[] = [];
  for (const inst of w.weapons) {
    const d = inst.def;
    // The sidearm is shown with a plain weapon icon: it is not an element and
    // must not be rendered with an element or fusion badge.
    const kind = d.kind === 'base' ? 'element' : d.kind === 'fusion' ? 'fusion' : 'passive';
    out.push({
      name: d.name,
      desc: d.flavor,
      level: inst.level,
      maxLevel: d.maxLevel,
      kind,
      elements: d.elements as ElementKey[],
      iconKey:
        d.kind === 'base'
          ? d.elements[0]
          : d.kind === 'fusion'
            ? ((d as { glyph?: string }).glyph ?? d.id)
            : 'sword',
    });
  }
  for (const [id, lvl] of w.passiveLevels) {
    const p = PASSIVE_BY_ID.get(id);
    if (!p) continue;
    out.push({
      name: p.name,
      desc: p.desc.replace(/<\/?em>/g, ''),
      level: lvl,
      maxLevel: p.maxLevel,
      kind: 'passive',
      elements: [],
      iconKey: p.icon,
    });
  }
  return out;
}

/**
 * Fusions the player could still unlock with their current elements, used to
 * show progress hints on the level-up screen.
 */
export function fusionHints(w: World): string[] {
  const owned = w.ownedElements();
  const hints: string[] = [];
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      const a = owned[i];
      const b = owned[j];
      const f = FUSION_BY_PAIR.get(pairKey(a, b));
      if (!f || w.hasWeapon(f.id)) continue;
      const la = w.getWeaponInstance(ELEMENT_WEAPONS[a].id)?.level ?? 0;
      const lb = w.getWeaponInstance(ELEMENT_WEAPONS[b].id)?.level ?? 0;
      if (la >= FUSION_REQ_LEVEL && lb >= FUSION_REQ_LEVEL) continue;
      const need: string[] = [];
      if (la < FUSION_REQ_LEVEL) need.push(`${ELEMENT_WEAPONS[a].name} Lv${FUSION_REQ_LEVEL}`);
      if (lb < FUSION_REQ_LEVEL) need.push(`${ELEMENT_WEAPONS[b].name} Lv${FUSION_REQ_LEVEL}`);
      hints.push(`${f.name}: needs ${need.join(' + ')}`);
    }
  }
  return hints;
}

/** True when the player still has an empty element slot. */
export function canTakeNewElement(w: World): boolean {
  return w.ownedElements().length < MAX_ELEMENTS;
}

