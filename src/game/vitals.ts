import { BALANCE } from './data/balance';
import type { PetVitals } from './types';

export const INITIAL_VITALS: PetVitals = { ...BALANCE.vitals.initial };

export function clampVital(value: number): number {
  return Math.min(BALANCE.vitals.max, Math.max(BALANCE.vitals.min, Math.round(value)));
}

export function applyVitalDelta(vitals: PetVitals, delta: Partial<PetVitals>): PetVitals {
  return {
    hunger: clampVital(vitals.hunger + (delta.hunger ?? 0)),
    mood: clampVital(vitals.mood + (delta.mood ?? 0)),
    sleepiness: clampVital(vitals.sleepiness + (delta.sleepiness ?? 0)),
    affection: clampVital(vitals.affection + (delta.affection ?? 0)),
  };
}
