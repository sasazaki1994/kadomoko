import { BALANCE, THRESHOLDS } from './data/balance';
import { LEVEL_REWARDS } from './data/levelRewards';
import { completeActionTask, taskDefById } from './dailyTasks';
import { gainExp } from './level';
import { applyVitalDelta } from './vitals';
import type {
  CareActionId,
  CareActionResult,
  DailyTaskId,
  PetState,
  PetVitals,
} from './types';

/** Adds exp to the pet and unlocks level rewards for every level gained. */
export function grantExp(
  pet: PetState,
  amount: number,
): { pet: PetState; leveledUp: boolean; newLevel: number } {
  if (amount === 0) return { pet, leveledUp: false, newLevel: pet.level };
  const result = gainExp(pet.exp, pet.level, amount);
  let next: PetState = { ...pet, exp: result.exp, level: result.level };
  if (result.leveledUp) {
    for (let lv = pet.level + 1; lv <= result.level; lv++) {
      next = applyLevelReward(next, lv);
    }
  }
  return { pet: next, leveledUp: result.leveledUp, newLevel: result.level };
}

function applyLevelReward(pet: PetState, level: number): PetState {
  const reward = LEVEL_REWARDS[level];
  if (!reward) return pet;
  switch (reward.type) {
    case 'reaction':
      return { ...pet, unlockedReactionIds: appendUnique(pet.unlockedReactionIds, reward.id) };
    case 'idleMotion':
      return { ...pet, unlockedIdleMotionIds: appendUnique(pet.unlockedIdleMotionIds, reward.id) };
    case 'speechPack':
      return { ...pet, unlockedSpeechPackIds: appendUnique(pet.unlockedSpeechPackIds, reward.id) };
    case 'prop':
      return { ...pet, unlockedPropIds: appendUnique(pet.unlockedPropIds, reward.id) };
    default: {
      const exhaustive: never = reward;
      return exhaustive;
    }
  }
}

function appendUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/** Completes matching daily tasks and grants their rewards. */
export function applyCompletedTasks(
  pet: PetState,
  completedIds: DailyTaskId[],
): { pet: PetState; leveledUp: boolean; newLevel: number } {
  let next = pet;
  let leveledUp = false;
  for (const id of completedIds) {
    const def = taskDefById(id);
    next = { ...next, vitals: applyVitalDelta(next.vitals, { affection: def.rewardAffection }) };
    const granted = grantExp(next, def.rewardExp);
    next = granted.pet;
    leveledUp = leveledUp || granted.leveledUp;
  }
  return { pet: next, leveledUp, newLevel: next.level };
}

export function isActionOnCooldown(pet: PetState, action: CareActionId, now: number): boolean {
  const last = pet.lastActionAt[action];
  return last !== undefined && now - last < BALANCE.actions.cooldownMs;
}

export function getCareActionBlockReason(
  pet: PetState,
  action: CareActionId,
  now: number,
): CareActionResult['blockReason'] {
  if (isActionOnCooldown(pet, action, now)) return 'cooldown';
  if (action === 'play' && pet.vitals.sleepiness >= THRESHOLDS.playBlockedSleepiness) {
    return 'tooSleepy';
  }
  if (action === 'play' && pet.vitals.hunger < THRESHOLDS.playBlockedHunger) {
    return 'tooHungry';
  }
  return undefined;
}

export function bubbleForBlockReason(reason: CareActionResult['blockReason']): string | undefined {
  switch (reason) {
    case 'cooldown':
      return 'ちょっと待って';
    case 'tooSleepy':
      return 'ちょっと眠い';
    case 'tooHungry':
      return 'おなかすいた';
    case undefined:
      return undefined;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

export function performCareAction(
  pet: PetState,
  action: CareActionId,
  now: number,
): CareActionResult {
  const blocked = (reason: CareActionResult['blockReason']): CareActionResult => ({
    pet,
    ok: false,
    blockReason: reason,
    leveledUp: false,
    completedTaskIds: [],
    bubble: bubbleForBlockReason(reason),
    tempState: 'reaction',
  });

  const blockReason = getCareActionBlockReason(pet, action, now);
  if (blockReason) return blocked(blockReason);

  let next: PetState = {
    ...pet,
    careStats: { ...pet.careStats },
    lastActionAt: { ...pet.lastActionAt },
  };
  let vitalDelta: Partial<PetVitals> = {};
  let exp = 0;
  let tempState: CareActionResult['tempState'];
  let bubble: string | undefined;

  const A = BALANCE.actions;
  switch (action) {
    case 'feed': {
      if (pet.vitals.hunger >= THRESHOLDS.overfullHunger) {
        vitalDelta = { hunger: A.feed.overfullHunger, mood: A.feed.overfullMood };
        bubble = '……';
      } else {
        vitalDelta = { hunger: A.feed.hunger, mood: A.feed.mood, affection: A.feed.affection };
        exp = A.feed.exp;
      }
      next.careStats.feedCount += 1;
      tempState = 'reaction';
      break;
    }
    case 'touch': {
      if (deriveIsSleeping(pet)) {
        next.currentAction = 'none';
        vitalDelta = { mood: A.touch.wakeMoodPenalty };
        bubble = '……';
      } else {
        const moodGain =
          pet.vitals.sleepiness >= THRESHOLDS.touchSleepy ? A.touch.sleepyMoodGain : A.touch.mood;
        vitalDelta = { mood: moodGain, affection: A.touch.affection };
        exp = A.touch.exp;
      }
      next.careStats.touchCount += 1;
      tempState = 'reaction';
      break;
    }
    case 'play': {
      vitalDelta = {
        mood: A.play.mood,
        affection: A.play.affection,
        sleepiness: A.play.sleepiness,
        hunger: A.play.hunger,
      };
      exp = A.play.exp;
      next.careStats.playCount += 1;
      tempState = 'playing';
      break;
    }
    case 'rest': {
      if (pet.vitals.sleepiness < THRESHOLDS.restToNapSleepiness) {
        tempState = 'resting';
        bubble = 'ひとやすみ';
      } else {
        next.currentAction = 'sleeping';
      }
      exp = A.rest.exp;
      next.careStats.restCount += 1;
      break;
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }

  next.vitals = applyVitalDelta(next.vitals, vitalDelta);
  next.lastActionAt[action] = now;
  next.lastCareAt = now;

  const taskResult = completeActionTask(next.dailyTasks, action);
  next.dailyTasks = taskResult.state;

  const expGrant = grantExp(next, exp);
  next = expGrant.pet;
  const taskGrant = applyCompletedTasks(next, taskResult.completed);
  next = taskGrant.pet;

  const leveledUp = expGrant.leveledUp || taskGrant.leveledUp;
  return {
    pet: next,
    ok: true,
    leveledUp,
    newLevel: leveledUp ? next.level : undefined,
    completedTaskIds: taskResult.completed,
    bubble,
    tempState,
  };
}

function deriveIsSleeping(pet: PetState): boolean {
  return (
    pet.currentAction === 'sleeping' || pet.vitals.sleepiness >= THRESHOLDS.autoSleepSleepiness
  );
}
