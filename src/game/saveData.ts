import { DEFAULT_REACTION_IDS } from './data/reactions';
import { localDateString, rollDailyTasks } from './dailyTasks';
import { EMPTY_CARE_STATS } from './personality';
import { INITIAL_VITALS } from './vitals';
import type {
  CareActionId,
  CurrentAction,
  DailyTaskId,
  DailyTasksState,
  Personality,
  PersonalityHistoryEntry,
  PetState,
  PetVitals,
  SaveData,
  SaveSettings,
} from './types';

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

export type RawSaveEnvelope = Partial<SaveData> & {
  windowPosition?: unknown;
};

export type SaveRecoverySource = 'primary' | 'backup' | 'initial';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vital(value: unknown, fallback: number): number {
  return Math.min(100, Math.max(0, Math.round(finiteNumber(value, fallback))));
}

function sanitizeVitals(raw: unknown, fallback: PetVitals): PetVitals {
  const data = isRecord(raw) ? raw : {};
  return {
    hunger: vital(data.hunger, fallback.hunger),
    mood: vital(data.mood, fallback.mood),
    sleepiness: vital(data.sleepiness, fallback.sleepiness),
    affection: vital(data.affection, fallback.affection),
  };
}

function sanitizeSettings(raw: unknown): SaveSettings {
  const data = isRecord(raw) ? raw : {};
  return {
    alwaysOnTop: typeof data.alwaysOnTop === 'boolean' ? data.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    volume: vital(data.volume, DEFAULT_SETTINGS.volume),
  };
}

function sanitizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
}

const PERSONALITIES: readonly Personality[] = [
  'normal',
  'sweet',
  'energetic',
  'relaxed',
  'moody',
  'sulky',
  'calm',
];

function sanitizePersonality(value: unknown, fallback: Personality): Personality {
  return typeof value === 'string' && PERSONALITIES.includes(value as Personality)
    ? (value as Personality)
    : fallback;
}

function sanitizeCurrentAction(value: unknown, fallback: CurrentAction): CurrentAction {
  return value === 'none' || value === 'sleeping' ? value : fallback;
}

const DAILY_TASK_IDS: readonly DailyTaskId[] = [
  'feed_once',
  'touch_once',
  'play_once',
  'rest_once',
  'together_30min',
  'good_mood_15min',
];

function sanitizeDailyTasks(raw: unknown, fallback: DailyTasksState): DailyTasksState {
  const data = isRecord(raw) ? raw : {};
  const rawTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const tasks = rawTasks
    .filter(isRecord)
    .filter((task): task is { id: DailyTaskId; completed: unknown } =>
      typeof task.id === 'string' && DAILY_TASK_IDS.includes(task.id as DailyTaskId),
    )
    .map((task) => ({ id: task.id, completed: task.completed === true }));

  return {
    date: typeof data.date === 'string' ? data.date : fallback.date,
    tasks: tasks.length > 0 ? tasks : fallback.tasks,
    togetherMsToday: Math.max(0, finiteNumber(data.togetherMsToday, fallback.togetherMsToday)),
    goodMoodStreakMs: Math.max(0, finiteNumber(data.goodMoodStreakMs, fallback.goodMoodStreakMs)),
  };
}

function sanitizeCareStats(raw: unknown, fallback: PetState['careStats']): PetState['careStats'] {
  const data = isRecord(raw) ? raw : {};
  return {
    feedCount: Math.max(0, Math.round(finiteNumber(data.feedCount, fallback.feedCount))),
    touchCount: Math.max(0, Math.round(finiteNumber(data.touchCount, fallback.touchCount))),
    playCount: Math.max(0, Math.round(finiteNumber(data.playCount, fallback.playCount))),
    restCount: Math.max(0, Math.round(finiteNumber(data.restCount, fallback.restCount))),
    neglectTimeMs: Math.max(0, finiteNumber(data.neglectTimeMs, fallback.neglectTimeMs)),
    activeTogetherTimeMs: Math.max(
      0,
      finiteNumber(data.activeTogetherTimeMs, fallback.activeTogetherTimeMs),
    ),
    lowHungerTimeMs: Math.max(0, finiteNumber(data.lowHungerTimeMs, fallback.lowHungerTimeMs)),
  };
}

function sanitizeLastActionAt(raw: unknown): PetState['lastActionAt'] {
  if (!isRecord(raw)) return {};
  const result: Partial<Record<CareActionId, number>> = {};
  for (const action of ['feed', 'touch', 'play', 'rest'] as const) {
    if (typeof raw[action] === 'number' && Number.isFinite(raw[action])) {
      result[action] = raw[action];
    }
  }
  return result;
}

function sanitizePersonalityHistory(raw: unknown): PersonalityHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((entry) => {
    if (typeof entry.date !== 'string') return [];
    return [{ date: entry.date, tendency: sanitizePersonality(entry.tendency, 'normal') }];
  });
}

/**
 * Placeholder for future save migrations. v0.1 only has version 1, so unknown
 * versions are rejected here and callers may try a backup before creating a
 * fresh save.
 */
export function migrateSave(raw: unknown): unknown {
  if (!isRecord(raw)) return null;
  if (raw.version === CURRENT_SAVE_VERSION) return raw;
  return null;
}

function sanitizeCurrentVersionSave(raw: unknown, now: number): SaveData | null {
  if (!isRecord(raw)) return null;
  const migrated = migrateSave(raw);
  if (!isRecord(migrated) || !isRecord(migrated.pet)) return null;

  const fresh = createInitialPetState(now);
  const rawPet = migrated.pet;
  const pet: PetState = {
    ...fresh,
    vitals: sanitizeVitals(rawPet.vitals, fresh.vitals),
    exp: Math.max(0, Math.round(finiteNumber(rawPet.exp, fresh.exp))),
    level: Math.min(5, Math.max(1, Math.round(finiteNumber(rawPet.level, fresh.level)))),
    currentAction: sanitizeCurrentAction(rawPet.currentAction, fresh.currentAction),
    careStats: sanitizeCareStats(rawPet.careStats, fresh.careStats),
    personality: sanitizePersonality(rawPet.personality, fresh.personality),
    personalityHistory: sanitizePersonalityHistory(rawPet.personalityHistory),
    unlockedReactionIds: sanitizeStringArray(rawPet.unlockedReactionIds, fresh.unlockedReactionIds),
    unlockedIdleMotionIds: sanitizeStringArray(
      rawPet.unlockedIdleMotionIds,
      fresh.unlockedIdleMotionIds,
    ),
    unlockedSpeechPackIds: sanitizeStringArray(
      rawPet.unlockedSpeechPackIds,
      fresh.unlockedSpeechPackIds,
    ),
    unlockedPropIds: sanitizeStringArray(rawPet.unlockedPropIds, fresh.unlockedPropIds),
    dailyTasks: sanitizeDailyTasks(rawPet.dailyTasks, fresh.dailyTasks),
    lastUpdatedAt: finiteNumber(rawPet.lastUpdatedAt, fresh.lastUpdatedAt),
    lastCareAt: finiteNumber(rawPet.lastCareAt, fresh.lastCareAt),
    lastActionAt: sanitizeLastActionAt(rawPet.lastActionAt),
    pendingDecayMs: Math.max(0, finiteNumber(rawPet.pendingDecayMs, fresh.pendingDecayMs)),
    highMoodMs: Math.max(0, finiteNumber(rawPet.highMoodMs, fresh.highMoodMs)),
    lastRandomEventAt: finiteNumber(rawPet.lastRandomEventAt, fresh.lastRandomEventAt),
  };
  return {
    version: CURRENT_SAVE_VERSION,
    pet,
    settings: sanitizeSettings(migrated.settings),
    lastLaunchedAt: finiteNumber(migrated.lastLaunchedAt, now),
  };
}

/**
 * Validates loaded data. Unknown versions or malformed data fall back to a
 * fresh save so direct callers and tests never crash on corrupted storage.
 */
export function sanitizeSave(raw: unknown, now: number): SaveData {
  return sanitizeCurrentVersionSave(raw, now) ?? createInitialSave(now);
}

/**
 * Loads the primary save when possible, then a backup, and only then creates
 * initial data. This keeps unknown or malformed primary data from discarding a
 * recoverable backup.
 */
export function recoverSave(
  primary: unknown,
  backup: unknown,
  now: number,
): { save: SaveData; source: SaveRecoverySource } {
  const primarySave = sanitizeCurrentVersionSave(primary, now);
  if (primarySave) return { save: primarySave, source: 'primary' };

  const backupSave = sanitizeCurrentVersionSave(backup, now);
  if (backupSave) return { save: backupSave, source: 'backup' };

  return { save: createInitialSave(now), source: 'initial' };
}
