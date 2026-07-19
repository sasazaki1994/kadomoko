import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { applyVitalDelta } from './vitals';
import type {
  FocusSession,
  FocusSessionDailyCount,
  FocusSessionDuration,
  FocusSessionState,
  PetState,
} from './types';

export const FOCUS_SESSION_DURATIONS = [10, 25] as const satisfies readonly FocusSessionDuration[];
export const FOCUS_SESSION_DAILY_REWARD_LIMIT = 3;
const FOCUS_SESSION_CLOCK_CHECKPOINT_MS = 60_000;
const FOCUS_SESSION_DAILY_HISTORY_LIMIT = 366;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type FocusSessionProgressResult = {
  pet: PetState;
  completed: boolean;
  rewarded: boolean;
  leveledUp: boolean;
  newLevel?: number;
  bubble?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeCount(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

function safeTime(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null;
}

function safeDuration(value: unknown): FocusSessionDuration | null {
  return FOCUS_SESSION_DURATIONS.includes(value as FocusSessionDuration)
    ? value as FocusSessionDuration
    : null;
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (
    year === undefined
    || month === undefined
    || day === undefined
    || year < 1970
    || month < 1
    || month > 12
    || day < 1
  ) {
    return false;
  }
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeDailyCount(
  date: string,
  completedValue: unknown,
  rewardedValue: unknown,
): FocusSessionDailyCount {
  const completed = safeCount(completedValue, 99);
  return {
    date,
    completed,
    rewarded: Math.min(
      completed,
      safeCount(rewardedValue, FOCUS_SESSION_DAILY_REWARD_LIMIT),
    ),
  };
}

function sanitizeDailyCounts(
  data: Record<string, unknown>,
  today: string,
): FocusSessionDailyCount[] {
  const byDate = new Map<string, FocusSessionDailyCount>();
  const add = (entry: FocusSessionDailyCount) => {
    const current = byDate.get(entry.date);
    byDate.set(entry.date, current
      ? {
          date: entry.date,
          completed: Math.max(current.completed, entry.completed),
          rewarded: Math.max(current.rewarded, entry.rewarded),
        }
      : entry);
  };

  if (Array.isArray(data.recentDailyCounts)) {
    for (const rawEntry of data.recentDailyCounts) {
      if (!isRecord(rawEntry) || !isLocalDate(rawEntry.date)) {
        continue;
      }
      add(normalizeDailyCount(rawEntry.date, rawEntry.completed, rawEntry.rewarded));
    }
  }

  if (isLocalDate(data.date)) {
    add(normalizeDailyCount(data.date, data.completedToday, data.rewardedToday));
  }
  if (!byDate.has(today)) add(normalizeDailyCount(today, 0, 0));

  const sorted = [...byDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-FOCUS_SESSION_DAILY_HISTORY_LIMIT);
  if (sorted.some((entry) => entry.date === today)) return sorted;
  return [
    ...sorted.slice(-(FOCUS_SESSION_DAILY_HISTORY_LIMIT - 1)),
    normalizeDailyCount(today, 0, 0),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

function sanitizeActiveSession(raw: unknown, now: number): FocusSession | null {
  if (!isRecord(raw)) return null;
  const durationMinutes = safeDuration(raw.durationMinutes);
  const rawStartedAt = safeTime(raw.startedAt);
  if (durationMinutes === null || rawStartedAt === null) return null;

  const durationMs = durationMinutes * 60_000;
  const rawEndsAt = safeTime(raw.endsAt);
  let startedAt = rawStartedAt;
  let endsAt = rawEndsAt !== null && rawEndsAt - rawStartedAt === durationMs
    ? rawEndsAt
    : rawStartedAt + durationMs;
  if (!Number.isSafeInteger(endsAt)) return null;

  const rawLastObservedAt = safeTime(raw.lastObservedAt);
  let lastObservedAt = rawLastObservedAt !== null
    && rawLastObservedAt >= startedAt
    && rawLastObservedAt <= endsAt
    ? rawLastObservedAt
    : startedAt;
  if (now < lastObservedAt) {
    // A backwards clock adjustment must not lengthen or instantly complete the
    // session. Move the whole deadline window while preserving remaining time.
    const adjustment = now - lastObservedAt;
    startedAt += adjustment;
    endsAt += adjustment;
    lastObservedAt = now;
  } else if (
    now < endsAt
    && now - lastObservedAt >= FOCUS_SESSION_CLOCK_CHECKPOINT_MS
  ) {
    // Persist at most once per minute so a later rollback has a recent anchor
    // without turning the one-second display tick into one-second disk writes.
    lastObservedAt = now;
  }

  if (
    !Number.isSafeInteger(startedAt)
    || startedAt < 0
    || !Number.isSafeInteger(endsAt)
    || endsAt < startedAt
  ) {
    return null;
  }
  return { startedAt, endsAt, durationMinutes, lastObservedAt };
}

export function createEmptyFocusSessionState(now: number): FocusSessionState {
  const date = localDateString(now);
  return {
    date,
    active: null,
    completedToday: 0,
    rewardedToday: 0,
    recentDailyCounts: [{ date, completed: 0, rewarded: 0 }],
  };
}

export function sanitizeFocusSessionState(raw: unknown, now: number): FocusSessionState {
  const data = isRecord(raw) ? raw : {};
  const today = localDateString(now);
  const recentDailyCounts = sanitizeDailyCounts(data, today);
  const todayCount = recentDailyCounts.find((entry) => entry.date === today)
    ?? normalizeDailyCount(today, 0, 0);
  return {
    date: today,
    active: sanitizeActiveSession(data.active, now),
    completedToday: todayCount.completed,
    rewardedToday: todayCount.rewarded,
    recentDailyCounts,
  };
}

export function startFocusSession(
  pet: PetState,
  durationMinutes: FocusSessionDuration,
  now: number,
): { pet: PetState; started: boolean } {
  const focusSessions = sanitizeFocusSessionState(pet.focusSessions, now);
  if (focusSessions.active) return { pet, started: false };
  return {
    started: true,
    pet: {
      ...pet,
      focusSessions: {
        ...focusSessions,
        active: {
          startedAt: now,
          endsAt: now + durationMinutes * 60_000,
          durationMinutes,
          lastObservedAt: now,
        },
      },
    },
  };
}

export function cancelFocusSession(pet: PetState, now: number): PetState {
  const focusSessions = sanitizeFocusSessionState(pet.focusSessions, now);
  if (!focusSessions.active) return pet;
  return { ...pet, focusSessions: { ...focusSessions, active: null } };
}

function sameFocusSessionState(left: FocusSessionState, right: FocusSessionState): boolean {
  const sameActive = left.active === null && right.active === null
    || left.active !== null
      && right.active !== null
      && left.active.startedAt === right.active.startedAt
      && left.active.endsAt === right.active.endsAt
      && left.active.durationMinutes === right.active.durationMinutes
      && left.active.lastObservedAt === right.active.lastObservedAt;
  const sameDailyCounts = left.recentDailyCounts.length === right.recentDailyCounts.length
    && left.recentDailyCounts.every((entry, index) => {
      const other = right.recentDailyCounts[index];
      return other !== undefined
        && entry.date === other.date
        && entry.completed === other.completed
        && entry.rewarded === other.rewarded;
    });
  return sameActive
    && sameDailyCounts
    && left.date === right.date
    && left.completedToday === right.completedToday
    && left.rewardedToday === right.rewardedToday;
}

export function focusSessionRemainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1_000));
}

export function progressFocusSession(pet: PetState, now: number): FocusSessionProgressResult {
  const focusSessions = sanitizeFocusSessionState(pet.focusSessions, now);
  if (!focusSessions.active || now < focusSessions.active.endsAt) {
    return {
      pet: sameFocusSessionState(focusSessions, pet.focusSessions) ? pet : { ...pet, focusSessions },
      completed: false,
      rewarded: false,
      leveledUp: false,
    };
  }

  const rewarded = focusSessions.rewardedToday < FOCUS_SESSION_DAILY_REWARD_LIMIT;
  const completedToday = Math.min(99, focusSessions.completedToday + 1);
  const rewardedToday = focusSessions.rewardedToday + (rewarded ? 1 : 0);
  const recentDailyCounts = focusSessions.recentDailyCounts.map((entry) => entry.date === focusSessions.date
    ? {
        date: entry.date,
        completed: completedToday,
        rewarded: rewardedToday,
      }
    : entry);
  const completedPet: PetState = {
    ...pet,
    focusSessions: {
      ...focusSessions,
      active: null,
      completedToday,
      rewardedToday,
      recentDailyCounts,
    },
  };
  if (!rewarded) {
    return {
      pet: completedPet,
      completed: true,
      rewarded: false,
      leveledUp: false,
      bubble: 'ひと区切り。おつかれさま',
    };
  }

  const settled = {
    ...completedPet,
    vitals: applyVitalDelta(completedPet.vitals, { mood: 3, affection: 1 }),
  };
  const exp = grantExp(settled, 3);
  return {
    pet: exp.pet,
    completed: true,
    rewarded: true,
    leveledUp: exp.leveledUp,
    newLevel: exp.leveledUp ? exp.pet.level : undefined,
    bubble: 'ひと区切り。いっしょにできた',
  };
}
