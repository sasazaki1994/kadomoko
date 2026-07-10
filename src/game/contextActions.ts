import { grantExp } from './actions';
import { resolveDiscovery } from './discoveries';
import { listenToDream } from './dreams';
import { CONTEXT_ACTIONS, CONTEXT_ACTION_BY_ID } from './data/contextActions';
import { deriveBaseState } from './stateMachine';
import { applyVitalDelta } from './vitals';
import type { ContextActionDef, ContextActionId, ContextActionResult, PetState, PetVitals } from './types';

const BUBBLES: Record<ContextActionId, readonly string[]> = {
  give_space: ['ひとやすみ', '……'],
  wait_gently: ['……', 'またあとで'],
  look_together: ['？', 'いい感じ'],
  stay_together: ['ここにいる', 'いい感じ'],
  small_bite: ['少しだけ', 'もぐ'],
  tidy_habitat: ['いい感じ', 'すっきり'],
  inspect_edge: ['？', 'いい感じ', 'ここにある'],
  listen_dream: ['……', 'ゆめ'],
};

function machineState(pet: PetState) {
  return deriveBaseState(pet.vitals, pet.currentAction);
}

function placedHabitatItemIds(pet: PetState): string[] {
  // A dedicated habitat system does not exist yet; fall back to unlocked props
  // (same data source as discoveries.ts) so these actions stay reachable.
  const maybe = pet as PetState & { habitat?: { placedItemIds?: unknown }; placedItemIds?: unknown };
  const ids = Array.isArray(maybe.habitat?.placedItemIds) ? maybe.habitat?.placedItemIds : maybe.placedItemIds;
  if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === 'string');
  return pet.unlockedPropIds;
}

function hasPlacedHabitatItems(pet: PetState): boolean {
  return placedHabitatItemIds(pet).length > 0;
}

function hasCuriousHabitatItem(pet: PetState): boolean {
  return placedHabitatItemIds(pet).some((id) => id === 'old_note' || id === 'glow_speck');
}

function hasCuriousMemory(pet: PetState): boolean {
  const flags = (pet as PetState & { memoryFlags?: unknown }).memoryFlags;
  return Array.isArray(flags) && flags.some((flag) => typeof flag === 'string' && (flag.includes('curious') || flag.includes('long_time_together')));
}

function isConditionMet(pet: PetState, actionId: ContextActionId): boolean {
  const state = machineState(pet);
  switch (actionId) {
    case 'give_space':
      return pet.vitals.sleepiness >= 80 || pet.currentAction === 'sleeping';
    case 'wait_gently':
      return pet.vitals.mood < 20 || state === 'sulking';
    case 'look_together':
      return state === 'curious' || hasCuriousHabitatItem(pet) || hasCuriousMemory(pet);
    case 'stay_together':
      return pet.vitals.mood >= 80 || pet.vitals.affection >= 50 || pet.personality === 'calm' || pet.personality === 'sweet';
    case 'small_bite':
      return pet.vitals.hunger < 30 && pet.vitals.hunger < 90;
    case 'tidy_habitat':
      return hasPlacedHabitatItems(pet);
    case 'inspect_edge':
      return pet.currentAction !== 'sleeping' && Boolean(pet.discovery?.active);
    case 'listen_dream':
      return pet.currentAction !== 'sleeping' && Boolean(pet.dreams?.pending);
    default: {
      const exhaustive: never = actionId;
      return exhaustive;
    }
  }
}

function isOnCooldown(pet: PetState, def: ContextActionDef, now: number): boolean {
  const last = pet.lastContextActionAt[def.id];
  return last !== undefined && now - last < def.cooldownMs;
}

export function getAvailableContextAction(pet: PetState, now: number): ContextActionDef | null {
  const candidates = CONTEXT_ACTIONS.filter((def) => isConditionMet(pet, def.id) && !isOnCooldown(pet, def, now));
  return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function deltaFor(actionId: ContextActionId): Partial<PetVitals> {
  switch (actionId) {
    case 'give_space': return { sleepiness: -3, mood: 3, affection: 1 };
    case 'wait_gently': return { mood: 8, affection: 1 };
    case 'look_together': return { mood: 5, affection: 1 };
    case 'stay_together': return { mood: 3, affection: 2 };
    case 'small_bite': return { hunger: 12, mood: 2, affection: 1 };
    case 'tidy_habitat': return { mood: 4, affection: 1 };
    case 'inspect_edge': return { mood: 4, affection: 1 };
    // listenToDream applies its own vitals/exp/episode; no generic delta here.
    case 'listen_dream': return {};
    default: { const exhaustive: never = actionId; return exhaustive; }
  }
}

export function performContextAction(pet: PetState, actionId: ContextActionId, now: number): ContextActionResult {
  const def = CONTEXT_ACTION_BY_ID[actionId];
  if (!def || !isConditionMet(pet, actionId) || isOnCooldown(pet, def, now)) {
    return { pet, ok: false, actionId, leveledUp: false, bubble: 'ちょっと待って', tempState: 'reaction' };
  }
  if (actionId === 'listen_dream') {
    const listened = listenToDream(pet, now);
    if (!listened.ok) {
      return { pet: listened.pet, ok: false, actionId, leveledUp: false, bubble: 'ちょっと待って', tempState: 'reaction' };
    }
    const next: PetState = {
      ...listened.pet,
      lastContextActionAt: { ...listened.pet.lastContextActionAt, [actionId]: now },
      lastCareAt: now,
    };
    return {
      pet: next,
      ok: true,
      actionId,
      leveledUp: listened.leveledUp,
      newLevel: listened.newLevel,
      bubble: listened.bubble,
      tempState: 'curious',
    };
  }
  let next: PetState = {
    ...pet,
    lastContextActionAt: { ...pet.lastContextActionAt, [actionId]: now },
    lastCareAt: now,
  };
  next.vitals = applyVitalDelta(next.vitals, deltaFor(actionId));
  if (actionId === 'inspect_edge' && pet.discovery?.active) {
    next = resolveDiscovery(next, pet.discovery.active.id, now).pet;
  }
  const expGrant = grantExp(next, 2);
  next = expGrant.pet;
  const pool = BUBBLES[actionId];
  return {
    pet: next,
    ok: true,
    actionId,
    leveledUp: expGrant.leveledUp,
    newLevel: expGrant.leveledUp ? next.level : undefined,
    bubble: pool[Math.floor(Math.random() * pool.length)],
    tempState: actionId === 'small_bite' || actionId === 'inspect_edge' ? 'reaction' : machineState(next),
  };
}
