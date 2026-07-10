import type { RandomEventDef } from '../types';

export const RANDOM_EVENT_POOL: readonly RandomEventDef[] = [
  { id: 'gaze', state: 'curious', effect: 'gaze', durationMs: 3_000, tags: ['idle', 'peek', 'curious'], baseWeight: 1 },
  { id: 'hop', state: 'happy', effect: 'hop', durationMs: 2_000, tags: ['happy', 'playing', 'hop'], baseWeight: 1 },
  { id: 'doze', state: 'sleepy', effect: 'doze', bubble: 'ちょっと眠い', durationMs: 4_000, tags: ['sleepy', 'night'], baseWeight: 1 },
  { id: 'peek', state: 'curious', effect: 'peek', durationMs: 4_000, tags: ['peek', 'curious', 'moody'], baseWeight: 1 },
  { id: 'mumble', state: 'idle', bubble: '……', durationMs: 3_000, tags: ['idle', 'calm'], baseWeight: 1 },
  { id: 'found', state: 'curious', bubble: '？', durationMs: 3_000, tags: ['curious', 'morning'], baseWeight: 1 },
  { id: 'curl', state: 'resting', effect: 'curl', bubble: 'ひとやすみ', durationMs: 4_000, tags: ['calm', 'sleepy', 'sleeping'], baseWeight: 1 },
  { id: 'stretch', state: 'idle', effect: 'stretch', durationMs: 2_500, tags: ['stretch', 'morning', 'calm'], baseWeight: 1 },
  { id: 'hungry-look', state: 'hungry', effect: 'gaze', bubble: 'おなかすいた', durationMs: 3_000, tags: ['hungry'], baseWeight: 0.8 },
  { id: 'warm-look', state: 'happy', effect: 'peek', bubble: 'いい感じ', durationMs: 3_000, tags: ['affection', 'happy', 'peek'], baseWeight: 0.8 },
] as const;

/** Checked once per minute tick. */
export const RANDOM_EVENT_CHANCE_PER_MINUTE = 0.12;
/** Never fire two events closer than this. */
export const RANDOM_EVENT_MIN_GAP_MS = 5 * 60_000;
