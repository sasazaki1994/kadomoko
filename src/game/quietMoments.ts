import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { applyVitalDelta } from './vitals';
import type { PetState, QuietMomentState } from './types';

export const QUIET_MOMENT_DURATION_MS = 24_000;
export const QUIET_MOMENT_COOLDOWN_MS = 20 * 60_000;
export const QUIET_MOMENT_DAILY_REWARD_LIMIT = 3;

export type QuietMomentRewardStatus = {
  eligible: boolean;
  completedToday: number;
  remainingToday: number;
  remainingCooldownMs: number;
};

export type QuietMomentResult = {
  pet: PetState;
  rewarded: boolean;
  leveledUp: boolean;
  newLevel?: number;
  bubble: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(QUIET_MOMENT_DAILY_REWARD_LIMIT, Math.max(0, Math.round(value)));
}

function safeTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createEmptyQuietMomentState(now: number): QuietMomentState {
  return { date: localDateString(now), completedToday: 0, lastCompletedAt: 0 };
}

export function sanitizeQuietMomentState(raw: unknown, now: number): QuietMomentState {
  const data = isRecord(raw) ? raw : {};
  const today = localDateString(now);
  return {
    date: today,
    completedToday: data.date === today ? safeCount(data.completedToday) : 0,
    lastCompletedAt: safeTime(data.lastCompletedAt),
  };
}

export function getQuietMomentRewardStatus(pet: PetState, now: number): QuietMomentRewardStatus {
  const state = sanitizeQuietMomentState(pet.quietMoments, now);
  const elapsed = Math.max(0, now - state.lastCompletedAt);
  const remainingCooldownMs = state.lastCompletedAt === 0
    ? 0
    : Math.max(0, QUIET_MOMENT_COOLDOWN_MS - elapsed);
  const remainingToday = Math.max(0, QUIET_MOMENT_DAILY_REWARD_LIMIT - state.completedToday);
  return {
    eligible: remainingToday > 0 && remainingCooldownMs === 0,
    completedToday: state.completedToday,
    remainingToday,
    remainingCooldownMs,
  };
}

export function completeQuietMoment(pet: PetState, now: number): QuietMomentResult {
  const status = getQuietMomentRewardStatus(pet, now);
  if (!status.eligible) {
    return {
      pet,
      rewarded: false,
      leveledUp: false,
      bubble: 'ふう……いい時間',
    };
  }

  const quietMoments = sanitizeQuietMomentState(pet.quietMoments, now);
  const settled: PetState = {
    ...pet,
    vitals: applyVitalDelta(pet.vitals, { mood: 4, affection: 1 }),
    lastCareAt: now,
    quietMoments: {
      date: localDateString(now),
      completedToday: quietMoments.completedToday + 1,
      lastCompletedAt: now,
    },
  };
  const exp = grantExp(settled, 2);
  return {
    pet: exp.pet,
    rewarded: true,
    leveledUp: exp.leveledUp,
    newLevel: exp.leveledUp ? exp.pet.level : undefined,
    bubble: 'いっしょに、すっきり',
  };
}
