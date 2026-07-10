import { HABITAT_ITEM_IDS, HABITAT_ITEMS } from './data/habitatItems';
import type { HabitatItem, HabitatItemId, HabitatState, PetState } from './types';

const MAX_PLACED = 2;
const VALID = new Set<string>(HABITAT_ITEM_IDS);

function uniqueValid(ids: unknown): HabitatItemId[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is HabitatItemId => typeof id === 'string' && VALID.has(id)))];
}

export function createInitialHabitatState(): HabitatState {
  return { unlockedItemIds: ['soft_cloth'], placedItemIds: ['soft_cloth'], lastItemEventAt: 0 };
}

export function sanitizeHabitatState(raw: unknown, fallback: HabitatState = createInitialHabitatState()): HabitatState {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const unlocked = uniqueValid(data.unlockedItemIds);
  if (!unlocked.includes('soft_cloth')) unlocked.unshift('soft_cloth');
  const placed = uniqueValid(data.placedItemIds).filter((id) => unlocked.includes(id)).slice(0, MAX_PLACED);
  return {
    unlockedItemIds: unlocked,
    placedItemIds: placed.length > 0 ? placed : choosePlacedFromUnlocked(unlocked),
    lastItemEventAt: typeof data.lastItemEventAt === 'number' && Number.isFinite(data.lastItemEventAt) ? data.lastItemEventAt : fallback.lastItemEventAt,
  };
}

function choosePlacedFromUnlocked(unlocked: HabitatItemId[]): HabitatItemId[] {
  return unlocked.slice(0, MAX_PLACED);
}

export function getAvailableHabitatItems(pet: PetState): HabitatItem[] {
  return HABITAT_ITEMS.filter((item) => pet.habitat.unlockedItemIds.includes(item.id));
}

export function chooseDefaultPlacedItems(pet: PetState): HabitatItemId[] {
  const available = getAvailableHabitatItems(pet).map((item) => item.id);
  const preferred: HabitatItemId[] = [];
  if (pet.vitals.sleepiness >= 70 && available.includes('soft_cloth')) preferred.push('soft_cloth');
  if ((pet.personality === 'moody' || pet.personality === 'sulky') && available.includes('quiet_box')) preferred.push('quiet_box');
  if (pet.vitals.affection >= 50 && available.includes('round_trinket')) preferred.push('round_trinket');
  if (pet.level >= 5 && available.includes('glow_speck')) preferred.push('glow_speck');
  if (pet.vitals.mood >= 80 && available.includes('small_stone')) preferred.push('small_stone');
  if (available.includes('old_note')) preferred.push('old_note');
  preferred.push(...available);
  return [...new Set(preferred)].slice(0, MAX_PLACED);
}

export function unlockHabitatItems(pet: PetState): PetState {
  const unlocked = new Set(pet.habitat.unlockedItemIds);
  for (const item of HABITAT_ITEMS) {
    if (item.unlockLevel === undefined && item.unlockAffection === undefined) continue;
    if ((item.unlockLevel ?? 1) <= pet.level && (item.unlockAffection ?? 0) <= pet.vitals.affection) unlocked.add(item.id);
  }
  if (pet.personality === 'moody' || pet.personality === 'sulky' || pet.personalityHistory.some((h) => h.tendency === 'moody' || h.tendency === 'sulky')) unlocked.add('quiet_box');
  const habitat = sanitizeHabitatState({ ...pet.habitat, unlockedItemIds: [...unlocked] });
  return { ...pet, habitat: { ...habitat, placedItemIds: chooseDefaultPlacedItems({ ...pet, habitat }) } };
}
