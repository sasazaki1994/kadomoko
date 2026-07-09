import { PERSONALITY_RULES } from './data/personalityRules';
import type { CareStats, Personality, PersonalityHistoryEntry } from './types';

/**
 * Evaluates the day's care tendency.
 * `moodAtEvaluation` is the mood when the day rolls over (used for 'calm').
 */
export function computeTendency(stats: CareStats, moodAtEvaluation: number): Personality {
  const R = PERSONALITY_RULES;

  if (stats.neglectTimeMs >= R.moodyNeglectMs) return 'moody';
  if (stats.lowHungerTimeMs >= R.sulkyLowHungerMs) return 'sulky';
  if (stats.activeTogetherTimeMs >= R.calmTogetherMs && moodAtEvaluation >= R.calmMoodMin) {
    return 'calm';
  }

  const counts: Array<{ tendency: Personality; count: number }> = [
    { tendency: 'sweet', count: stats.touchCount },
    { tendency: 'energetic', count: stats.playCount },
    { tendency: 'relaxed', count: stats.restCount },
    { tendency: 'normal', count: stats.feedCount },
  ];
  counts.sort((a, b) => b.count - a.count);
  const [top, second] = counts;
  if (
    top.tendency !== 'normal' &&
    top.count >= R.dominantMinCount &&
    top.count >= second.count * R.dominanceRatio
  ) {
    return top.tendency;
  }
  return 'normal';
}

/**
 * Returns the new personality after appending today's tendency to the history.
 * The personality changes only when the same tendency repeats for
 * `streakDaysToChange` consecutive days.
 */
export function resolvePersonality(
  current: Personality,
  history: PersonalityHistoryEntry[],
): Personality {
  const streak = PERSONALITY_RULES.streakDaysToChange;
  if (history.length < streak) return current;
  const recent = history.slice(-streak);
  const first = recent[0].tendency;
  if (recent.every((e) => e.tendency === first) && first !== current) {
    return first;
  }
  return current;
}

export const EMPTY_CARE_STATS: CareStats = {
  feedCount: 0,
  touchCount: 0,
  playCount: 0,
  restCount: 0,
  neglectTimeMs: 0,
  activeTogetherTimeMs: 0,
  lowHungerTimeMs: 0,
};
