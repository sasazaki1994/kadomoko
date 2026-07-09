/** Tuning values for daily personality-tendency evaluation. */
export const PERSONALITY_RULES = {
  /** Time since the last care action before "neglect" starts accumulating. */
  neglectAfterMs: 3 * 60 * 60_000,
  /** Daily neglect time at/above which the tendency is 'moody'. */
  moodyNeglectMs: 6 * 60 * 60_000,
  /** Daily low-hunger (<20) time at/above which the tendency is 'sulky'. */
  sulkyLowHungerMs: 2 * 60 * 60_000,
  /** Daily together time at/above which 'calm' becomes possible. */
  calmTogetherMs: 3 * 60 * 60_000,
  /** Mood at day end must be at/above this for 'calm'. */
  calmMoodMin: 70,
  /** A care-count must reach this to count as a dominant tendency. */
  dominantMinCount: 3,
  /** Dominant count must exceed the runner-up by this ratio. */
  dominanceRatio: 1.5,
  /** Same tendency must repeat this many days to change personality. */
  streakDaysToChange: 2,
} as const;
