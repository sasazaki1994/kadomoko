import { createEmptyDreamState, sanitizeDreamState } from './dreams';
import { sanitizeEpisodeEntries } from './episodes';
import { createEmptySignalState, sanitizeSignalState } from './signals';
import { createEmptyTinyPlayState, sanitizeTinyPlayState } from './tinyPlays';
import { createEmptyQuietMomentState, sanitizeQuietMomentState } from './quietMoments';
import { createEmptyDiscoveryState, sanitizeDiscoveryState } from './discoveries';
import { DEFAULT_REACTION_IDS } from './data/reactions';
import { localDateString, rollDailyTasks } from './dailyTasks';
import { EMPTY_CARE_STATS } from './personality';
import { INITIAL_VITALS } from './vitals';
import { finiteNumber, isRecord } from './validation';
import type {
  CareActionId,
  CurrentAction,
  DailyJournalEntry,
  DailyTaskId,
  DailyTasksState,
  Personality,
  PersonalityHistoryEntry,
  PetState,
  PetVitals,
  SaveData,
  SaveSettings,
  StatusDisplayMode,
  AmbientFrequency,
  BubbleFrequency,
  ContextActionId,
  WeeklyReflection,
} from './types';

export const CURRENT_SAVE_VERSION = 8;

export const DEFAULT_SETTINGS: SaveSettings = {
  alwaysOnTop: false,
  volume: 50,
  statusDisplayMode: 'both',
  ambientFrequency: 'normal',
  bubbleFrequency: 'normal',
  reduceActivityWhenFullscreen: true,
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
    lastContextActionAt: {},
    pendingDecayMs: 0,
    highMoodMs: 0,
    lastRandomEventAt: now,
    journalEntries: [],
    episodes: [],
    weeklyReflections: [],
    discovery: createEmptyDiscoveryState(now),
    signals: createEmptySignalState(now),
    tinyPlay: createEmptyTinyPlayState(now),
    dreams: createEmptyDreamState(now),
    quietMoments: createEmptyQuietMomentState(now),
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

const STATUS_DISPLAY_MODES: readonly StatusDisplayMode[] = ['numbers', 'observation', 'both'];
const AMBIENT_FREQUENCIES: readonly AmbientFrequency[] = ['quiet', 'normal', 'lively'];
const BUBBLE_FREQUENCIES: readonly BubbleFrequency[] = ['off', 'quiet', 'normal'];

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeSettings(raw: unknown): SaveSettings {
  const data = isRecord(raw) ? raw : {};
  return {
    alwaysOnTop: typeof data.alwaysOnTop === 'boolean' ? data.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    volume: vital(data.volume, DEFAULT_SETTINGS.volume),
    statusDisplayMode: enumValue(data.statusDisplayMode, STATUS_DISPLAY_MODES, DEFAULT_SETTINGS.statusDisplayMode),
    ambientFrequency: enumValue(data.ambientFrequency, AMBIENT_FREQUENCIES, DEFAULT_SETTINGS.ambientFrequency),
    bubbleFrequency: enumValue(data.bubbleFrequency, BUBBLE_FREQUENCIES, DEFAULT_SETTINGS.bubbleFrequency),
    reduceActivityWhenFullscreen: typeof data.reduceActivityWhenFullscreen === 'boolean' ? data.reduceActivityWhenFullscreen : DEFAULT_SETTINGS.reduceActivityWhenFullscreen,
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

const CONTEXT_ACTION_IDS: readonly ContextActionId[] = ['give_space', 'wait_gently', 'look_together', 'stay_together', 'small_bite', 'tidy_habitat', 'inspect_edge', 'listen_dream'];

function sanitizeLastContextActionAt(raw: unknown): PetState['lastContextActionAt'] {
  if (!isRecord(raw)) return {};
  const result: Partial<Record<ContextActionId, number>> = {};
  for (const action of CONTEXT_ACTION_IDS) {
    if (typeof raw[action] === 'number' && Number.isFinite(raw[action])) result[action] = raw[action];
  }
  return result;
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

function sanitizeWeeklyReflections(raw: unknown): WeeklyReflection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((entry) => {
    if (typeof entry.weekStartDate !== 'string' || typeof entry.weekEndDate !== 'string' || typeof entry.summary !== 'string') return [];
    const tone = enumValue(entry.tone, ['calm', 'active', 'restful', 'mixed'] as const, 'mixed');
    const action = enumValue(entry.mostFrequentCareAction, ['feed', 'touch', 'play', 'rest'] as const, 'feed');
    return [{
      weekStartDate: entry.weekStartDate,
      weekEndDate: entry.weekEndDate,
      summary: entry.summary.slice(0, 60),
      dominantPersonality: sanitizePersonality(entry.dominantPersonality, 'normal'),
      completedTaskTotal: Math.max(0, Math.round(finiteNumber(entry.completedTaskTotal, 0))),
      mostFrequentCareAction: entry.mostFrequentCareAction === null ? null : action,
      tone,
    }];
  }).slice(-12);
}

function sanitizeJournalEntries(raw: unknown): DailyJournalEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((entry) => {
    if (typeof entry.date !== 'string' || !isRecord(entry.careCounts)) return [];
    const finalVitals = sanitizeVitals(entry.finalVitals, INITIAL_VITALS);
    return [{
      date: entry.date,
      careCounts: {
        feed: Math.max(0, Math.round(finiteNumber(entry.careCounts.feed, 0))),
        touch: Math.max(0, Math.round(finiteNumber(entry.careCounts.touch, 0))),
        play: Math.max(0, Math.round(finiteNumber(entry.careCounts.play, 0))),
        rest: Math.max(0, Math.round(finiteNumber(entry.careCounts.rest, 0))),
      },
      finalVitals,
      personality: sanitizePersonality(entry.personality, 'normal'),
      completedTaskCount: Math.max(0, Math.round(finiteNumber(entry.completedTaskCount, 0))),
      note: typeof entry.note === 'string' && entry.note.length <= 40 ? entry.note : 'ゆっくり過ごした',
    }];
  }).slice(-30);
}

/**
 * Fields added since each save version. Spread before the raw pet so real
 * data always wins; migration only fills in what a version could not have.
 */
function migrationDefaults(version: number): Record<string, unknown> {
  const now = Date.now();
  const defaults: Record<string, unknown> = {};
  if (version <= 1) Object.assign(defaults, { journalEntries: [] });
  if (version <= 2) Object.assign(defaults, { lastContextActionAt: {} });
  if (version <= 3) Object.assign(defaults, { episodes: [], weeklyReflections: [] });
  if (version <= 4) Object.assign(defaults, { discovery: createEmptyDiscoveryState(now) });
  if (version <= 5) Object.assign(defaults, { signals: createEmptySignalState(now), tinyPlay: createEmptyTinyPlayState(now) });
  if (version <= 6) Object.assign(defaults, { dreams: createEmptyDreamState(now) });
  if (version <= 7) Object.assign(defaults, { quietMoments: createEmptyQuietMomentState(now) });
  return defaults;
}

export function migrateSave(raw: unknown): unknown {
  if (!isRecord(raw)) return null;
  if (raw.version === CURRENT_SAVE_VERSION) return raw;
  if (typeof raw.version !== 'number' || raw.version < 1 || raw.version > CURRENT_SAVE_VERSION) return null;
  return {
    ...raw,
    version: CURRENT_SAVE_VERSION,
    pet: isRecord(raw.pet) ? { ...migrationDefaults(raw.version), ...raw.pet } : raw.pet,
  };
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
    lastContextActionAt: sanitizeLastContextActionAt(rawPet.lastContextActionAt),
    pendingDecayMs: Math.max(0, finiteNumber(rawPet.pendingDecayMs, fresh.pendingDecayMs)),
    highMoodMs: Math.max(0, finiteNumber(rawPet.highMoodMs, fresh.highMoodMs)),
    lastRandomEventAt: finiteNumber(rawPet.lastRandomEventAt, fresh.lastRandomEventAt),
    journalEntries: sanitizeJournalEntries(rawPet.journalEntries),
    episodes: sanitizeEpisodeEntries(rawPet.episodes),
    weeklyReflections: sanitizeWeeklyReflections(rawPet.weeklyReflections),
    discovery: sanitizeDiscoveryState(rawPet.discovery, now),
    signals: sanitizeSignalState(rawPet.signals, now),
    tinyPlay: sanitizeTinyPlayState(rawPet.tinyPlay, now),
    dreams: sanitizeDreamState(rawPet.dreams, now),
    quietMoments: sanitizeQuietMomentState(rawPet.quietMoments, now),
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
