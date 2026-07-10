import type { DayPeriod } from '../types';

export const DAY_PERIOD_TAGS: Record<DayPeriod, readonly string[]> = {
  morning: ['morning', 'stretch', 'curious'],
  daytime: ['idle', 'peek'],
  evening: ['calm', 'idle'],
  night: ['night', 'sleepy', 'calm'],
  lateNight: ['night', 'sleepy', 'sleeping'],
};

export const LIFE_RHYTHM_SPEECH: Record<DayPeriod, readonly string[]> = {
  morning: ['おはよう', 'のびる', '？'],
  daytime: ['ここにいる', 'いい感じ', '……'],
  evening: ['ひとやすみ', 'ここにいる'],
  night: ['ちょっと眠い', 'ひとやすみ'],
  lateNight: ['……', 'ひとやすみ', 'ちょっと眠い'],
};
