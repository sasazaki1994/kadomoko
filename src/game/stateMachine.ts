import { THRESHOLDS } from './data/balance';
import type { CurrentAction, PetMachineState, PetVitals } from './types';

/**
 * Derives the persistent (non-temporary) machine state from vitals,
 * following the fixed priority order of the spec.
 */
export function deriveBaseState(vitals: PetVitals, currentAction: CurrentAction): PetMachineState {
  if (vitals.sleepiness >= THRESHOLDS.autoSleepSleepiness || currentAction === 'sleeping') {
    return 'sleeping';
  }
  if (vitals.hunger < THRESHOLDS.hungryState) return 'hungry';
  if (vitals.mood < THRESHOLDS.sulkingMood) return 'sulking';
  if (vitals.sleepiness >= THRESHOLDS.sleepyState) return 'sleepy';
  if (vitals.mood >= THRESHOLDS.happyMood) return 'happy';
  return 'idle';
}

const TEMP_STATES = ['playing', 'curious', 'reaction', 'levelUp', 'resting'] as const;
export type TempMachineState = (typeof TEMP_STATES)[number];

export function isTempState(state: PetMachineState): state is TempMachineState {
  return (TEMP_STATES as readonly string[]).includes(state);
}

export const TEMP_STATE_DURATION_MS: Record<TempMachineState, number> = {
  playing: 3_000,
  curious: 4_000,
  reaction: 1_500,
  levelUp: 3_000,
  resting: 5_000,
};
