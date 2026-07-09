import {
  RANDOM_EVENT_CHANCE_PER_MINUTE,
  RANDOM_EVENT_MIN_GAP_MS,
  RANDOM_EVENT_POOL,
} from './data/randomEvents';
import type { RandomEventDef } from './types';

/**
 * Called once per minute tick. Returns an event to play, or null.
 * Kept low-frequency: probability per minute plus a hard minimum gap.
 */
export function maybeRollRandomEvent(
  now: number,
  lastEventAt: number,
  rng: () => number = Math.random,
): RandomEventDef | null {
  if (now - lastEventAt < RANDOM_EVENT_MIN_GAP_MS) return null;
  if (rng() >= RANDOM_EVENT_CHANCE_PER_MINUTE) return null;
  return pickRandomEvent(rng);
}

export function pickRandomEvent(rng: () => number = Math.random): RandomEventDef {
  return RANDOM_EVENT_POOL[Math.floor(rng() * RANDOM_EVENT_POOL.length)];
}
