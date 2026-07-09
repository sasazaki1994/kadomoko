import type { PetMachineState } from '../types';

/** Short, abstract messages only. No long sentences. */
export const SPEECH_BY_STATE: Partial<Record<PetMachineState, readonly string[]>> = {
  idle: ['……', '？', 'ここにいる'],
  happy: ['いい感じ', '……！'],
  hungry: ['おなかすいた'],
  sleepy: ['ちょっと眠い'],
  sleeping: ['……zzz'],
  sulking: ['……'],
  resting: ['ひとやすみ'],
};

export const SPEECH_FAREWELL = 'またあとで';

/** Extra messages unlocked at Lv4 (speech pack 'extra'). */
export const SPEECH_PACK_EXTRA: readonly string[] = ['ふふ', 'ぽかぽか', 'きょうもいる'];

/** Minimum gap between bubbles so they stay unobtrusive. */
export const SPEECH_MIN_INTERVAL_MS = 8_000;
export const SPEECH_DISPLAY_MS = 3_000;
