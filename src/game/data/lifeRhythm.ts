import type { DayPeriod, RandomEventTag, Season } from '../types';

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

/** Event tags gently preferred while a season lasts. */
export const SEASON_EVENT_TAGS: Record<Season, readonly RandomEventTag[]> = {
  spring: ['curious', 'stretch', 'happy'],
  summer: ['playing', 'hop', 'happy'],
  autumn: ['calm', 'idle', 'peek'],
  winter: ['sleepy', 'sleeping', 'calm'],
};

/** Short seasonal murmurs mixed into ambient speech. */
export const SEASON_SPEECH: Record<Season, readonly string[]> = {
  spring: ['はるのにおい', 'ぽかぽか'],
  summer: ['まぶしい', 'ひかげがいい'],
  autumn: ['はっぱのおと', 'すこしひんやり'],
  winter: ['まるくなる', 'ぬくぬくしたい'],
};

/** Extra weight for events whose tags match the current season. */
export const SEASON_EVENT_BOOST = 0.4;
