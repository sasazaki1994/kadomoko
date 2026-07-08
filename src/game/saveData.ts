import { DEFAULT_REACTION_IDS } from './data/reactions';
import { localDateString, rollDailyTasks } from './dailyTasks';
import { EMPTY_CARE_STATS } from './personality';
import { INITIAL_VITALS } from './vitals';
import type { PetState, SaveData, SaveSettings } from './types';

export const CURRENT_SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: SaveSettings = {
  alwaysOnTop: false,
  volume: 50,
};

export function createInitialPetState(now: number): PetState {
  return {
    vitals: { ...INITIAL_VITALS },
    exp: 0,
    level: 1,
    currentAction: 'none',
    careStats: { ...EMPTY_CARE_STATS },
    personality: 'normal',
    personalityHistory: [],
    unlockedReactionIds: [...DEFAULT_REACTION_IDS],
    unlockedIdleMotionIds: [],
    unlockedSpeechPackIds: [],
    unlockedPropIds: [],
    dailyTasks: rollDailyTasks(localDateString(now)),
    lastUpdatedAt: now,
    lastCareAt: now,
    lastActionAt: {},
    pendingDecayMs: 0,
    highMoodMs: 0,
    lastRandomEventAt: now,
  };
}

export function createInitialSave(now: number): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    pet: createInitialPetState(now),
    settings: { ...DEFAULT_SETTINGS },
    lastLaunchedAt: now,
  };
}

/**
 * Validates loaded data. Unknown versions or malformed data fall back to a
 * fresh save so the app never crashes on corrupted storage.
 */
export function sanitizeSave(raw: unknown, now: number): SaveData {
  if (!raw || typeof raw !== 'object') return createInitialSave(now);
  const data = raw as Partial<SaveData>;
  if (data.version !== CURRENT_SAVE_VERSION || !data.pet) return createInitialSave(now);

  const fresh = createInitialPetState(now);
  const pet: PetState = {
    ...fresh,
    ...data.pet,
    vitals: { ...fresh.vitals, ...data.pet.vitals },
    careStats: { ...fresh.careStats, ...data.pet.careStats },
    dailyTasks: { ...fresh.dailyTasks, ...data.pet.dailyTasks },
    lastActionAt: { ...data.pet.lastActionAt },
  };
  return {
    version: CURRENT_SAVE_VERSION,
    pet,
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    lastLaunchedAt: typeof data.lastLaunchedAt === 'number' ? data.lastLaunchedAt : now,
  };
}
