import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { applyVitalDelta } from './vitals';
import type { FocusSessionDuration, FocusSessionState, PetState } from './types';

export const FOCUS_SESSION_DURATIONS = [10, 25] as const satisfies readonly FocusSessionDuration[];
export const FOCUS_SESSION_DAILY_REWARD_LIMIT = 3;

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

function safeDuration(value: unknown): FocusSessionDuration | null {
  return FOCUS_SESSION_DURATIONS.includes(value as FocusSessionDuration)
    ? value as FocusSessionDuration
    : null;
}

export function createEmptyFocusSessionState(now: number): FocusSessionState {
  return {
    date: localDateString(now),
    active: null,
    completedToday: 0,
    rewardedToday: 0,
  };
}

export function sanitizeFocusSessionState(raw: unknown, now: number): FocusSessionState {
  const data = isRecord(raw) ? raw : {};
  const today = localDateString(now);
  const sameDay = data.date === today;
  const activeData = isRecord(data.active) ? data.active : null;
  const durationMinutes = activeData ? safeDuration(activeData.durationMinutes) : null;
  const startedAt = activeData?.startedAt;
  const active = durationMinutes !== null
    && typeof startedAt === 'number'
    && Number.isFinite(startedAt)
    && startedAt >= 0
    ? {
        startedAt,
        endsAt: startedAt + durationMinutes * 60_000,
        durationMinutes,
      }
    : null;
  const completedToday = sameDay ? safeCount(data.completedToday, 99) : 0;
  return {
    date: today,
    active,
    completedToday,
    rewardedToday: sameDay
      ? Math.min(completedToday, safeCount(data.rewardedToday, FOCUS_SESSION_DAILY_REWARD_LIMIT))
      : 0,
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
      && left.active.durationMinutes === right.active.durationMinutes;
  return sameActive
    && left.date === right.date
    && left.completedToday === right.completedToday
    && left.rewardedToday === right.rewardedToday;
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
  const completedPet: PetState = {
    ...pet,
    focusSessions: {
      ...focusSessions,
      active: null,
      completedToday: Math.min(99, focusSessions.completedToday + 1),
      rewardedToday: focusSessions.rewardedToday + (rewarded ? 1 : 0),
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
