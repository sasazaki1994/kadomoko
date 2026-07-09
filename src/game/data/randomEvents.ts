import type { RandomEventDef } from '../types';

export const RANDOM_EVENT_POOL: readonly RandomEventDef[] = [
  { id: 'gaze', state: 'curious', effect: 'gaze', durationMs: 3_000 },
  { id: 'hop', state: 'happy', effect: 'hop', durationMs: 2_000 },
  { id: 'doze', state: 'sleepy', effect: 'doze', durationMs: 4_000 },
  { id: 'peek', state: 'curious', effect: 'peek', durationMs: 4_000 },
  { id: 'mumble', state: 'idle', bubble: '……', durationMs: 3_000 },
  { id: 'found', state: 'curious', bubble: '？', durationMs: 3_000 },
  { id: 'curl', state: 'resting', effect: 'curl', durationMs: 4_000 },
  { id: 'stretch', state: 'idle', effect: 'stretch', durationMs: 2_500 },
] as const;

/** Checked once per minute tick. */
export const RANDOM_EVENT_CHANCE_PER_MINUTE = 0.12;
/** Never fire two events closer than this. */
export const RANDOM_EVENT_MIN_GAP_MS = 5 * 60_000;
