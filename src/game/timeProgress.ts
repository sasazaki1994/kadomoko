import { applyCompletedTasks } from './actions';
import { createDailyJournalEntry } from './dailySummary';
import { BALANCE, THRESHOLDS } from './data/balance';
import { PERSONALITY_RULES } from './data/personalityRules';
import { completeTimeTasks, localDateString, rollDailyTasks } from './dailyTasks';
import { unlockHabitatItems } from './habitat';
import { deriveMemoryFlagsFromDay, mergeMemoryFlags } from './memory';
import { computeTendency, EMPTY_CARE_STATS, resolvePersonality } from './personality';
import { applyVitalDelta, clampVital } from './vitals';
import type { PetState, TimeProgressResult } from './types';

const PERSONALITY_HISTORY_LIMIT = 14;

export type TimeProgressOptions = {
  /** True for live ticks; false when catching up time the app was closed. */
  online: boolean;
  rng?: () => number;
};

/**
 * Advances the pet simulation from `pet.lastUpdatedAt` to `now`.
 * Decay is applied in whole 10-minute chunks; the remainder is carried
 * over in `pendingDecayMs` so vitals stay integers.
 */
export function progressTime(
  pet: PetState,
  now: number,
  options: TimeProgressOptions,
): TimeProgressResult {
  const rng = options.rng ?? Math.random;
  const elapsedRaw = now - pet.lastUpdatedAt;
  if (elapsedRaw <= 0) {
    return {
      pet: { ...pet, lastUpdatedAt: now },
      leveledUp: false,
      completedTaskIds: [],
      dayRolledOver: false,
    };
  }
  const elapsed = Math.min(elapsedRaw, BALANCE.time.maxOfflineProgressMs);

  let next: PetState = {
    ...pet,
    vitals: { ...pet.vitals },
    careStats: { ...pet.careStats },
    dailyTasks: { ...pet.dailyTasks },
    habitat: { ...pet.habitat, unlockedItemIds: [...pet.habitat.unlockedItemIds], placedItemIds: [...pet.habitat.placedItemIds] },
    memory: { flags: [...pet.memory.flags] },
    lastUpdatedAt: now,
  };

  if (options.online) {
    next.careStats.activeTogetherTimeMs += elapsed;
    next.dailyTasks.togetherMsToday += elapsed;
  }

  // Neglect time: overlap of [lastUpdatedAt, now] with the period after
  // `neglectAfterMs` has passed since the last care action.
  const neglectStart = next.lastCareAt + PERSONALITY_RULES.neglectAfterMs;
  const neglectOverlap = now - Math.max(neglectStart, pet.lastUpdatedAt);
  if (neglectOverlap > 0) {
    next.careStats.neglectTimeMs += Math.min(neglectOverlap, elapsed);
  }

  // Decay in 10-minute chunks.
  const D = BALANCE.decay;
  const tenMin = BALANCE.time.tenMinutesMs;
  next.pendingDecayMs = pet.pendingDecayMs + elapsed;
  while (next.pendingDecayMs >= tenMin) {
    next.pendingDecayMs -= tenMin;
    const sleeping =
      next.currentAction === 'sleeping' ||
      next.vitals.sleepiness >= THRESHOLDS.autoSleepSleepiness;
    if (sleeping) {
      next.currentAction = 'sleeping';
      next.vitals = applyVitalDelta(next.vitals, {
        sleepiness: D.sleepingSleepinessPer10Min,
        hunger: D.sleepingHungerPer10Min,
      });
      if (next.vitals.sleepiness <= 0) {
        next.currentAction = 'none';
      }
    } else {
      let moodDelta = D.moodPer10Min;
      if (next.vitals.hunger < THRESHOLDS.lowHunger) {
        moodDelta += D.lowHungerMoodPenaltyPer10Min;
      }
      if (next.vitals.sleepiness >= THRESHOLDS.sleepyState) {
        moodDelta += D.highSleepinessMoodPenaltyPer10Min;
      }
      next.vitals = applyVitalDelta(next.vitals, {
        hunger: D.hungerPer10Min,
        sleepiness: D.sleepinessPer10Min,
        mood: moodDelta,
      });
      if (next.vitals.sleepiness >= THRESHOLDS.autoSleepSleepiness) {
        next.currentAction = 'sleeping';
      }
    }
    if (next.vitals.hunger < THRESHOLDS.lowHunger) {
      next.careStats.lowHungerTimeMs += tenMin;
    }
  }

  // Good-mood accumulators (mood only changes on chunks/actions, so
  // evaluating once per progression is accurate enough).
  if (next.vitals.mood >= THRESHOLDS.happyMood) {
    next.highMoodMs += elapsed;
    next.dailyTasks.goodMoodStreakMs += elapsed;
    while (next.highMoodMs >= BALANCE.time.thirtyMinutesMs) {
      next.highMoodMs -= BALANCE.time.thirtyMinutesMs;
      next.vitals = { ...next.vitals, affection: clampVital(next.vitals.affection + 1) };
    }
  } else {
    next.highMoodMs = 0;
    next.dailyTasks.goodMoodStreakMs = 0;
  }

  // Time-based daily tasks.
  const timeTasks = completeTimeTasks(next.dailyTasks);
  next.dailyTasks = timeTasks.state;
  const taskGrant = applyCompletedTasks(next, timeTasks.completed);
  next = taskGrant.pet;

  // Day rollover: evaluate yesterday's tendency and reroll tasks.
  const today = localDateString(now);
  let dayRolledOver = false;
  if (next.dailyTasks.date !== today) {
    dayRolledOver = true;
    const memoryFlags = deriveMemoryFlagsFromDay(next, next.dailyTasks.date);
    const tendency = computeTendency(next.careStats, next.vitals.mood);
    const history = [
      ...next.personalityHistory,
      { date: next.dailyTasks.date, tendency },
    ].slice(-PERSONALITY_HISTORY_LIMIT);
    next = {
      ...next,
      personality: resolvePersonality(next.personality, history),
      personalityHistory: history,
      memory: { flags: mergeMemoryFlags(next.memory.flags, memoryFlags, today) },
      careStats: { ...EMPTY_CARE_STATS },
      dailyTasks: rollDailyTasks(today, rng),
      journalEntries: [...next.journalEntries, createDailyJournalEntry(next)].slice(-30),
    };
  }

  next = unlockHabitatItems(next);

  return {
    pet: next,
    leveledUp: taskGrant.leveledUp,
    newLevel: taskGrant.leveledUp ? next.level : undefined,
    completedTaskIds: timeTasks.completed,
    dayRolledOver,
  };
}
