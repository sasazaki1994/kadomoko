export const BALANCE = {
  vitals: {
    min: 0,
    max: 100,
    initial: {
      hunger: 70,
      mood: 70,
      sleepiness: 20,
      affection: 10,
    },
  },

  time: {
    updateIntervalMs: 60_000,
    tenMinutesMs: 10 * 60_000,
    thirtyMinutesMs: 30 * 60_000,
    maxOfflineProgressMs: 12 * 60 * 60_000,
  },

  decay: {
    hungerPer10Min: -3,
    moodPer10Min: -1,
    sleepinessPer10Min: 4,
    lowHungerMoodPenaltyPer10Min: -3,
    highSleepinessMoodPenaltyPer10Min: -2,
    sleepingSleepinessPer10Min: -12,
    sleepingHungerPer10Min: -1,
  },

  actions: {
    cooldownMs: 10_000,

    feed: {
      hunger: 30,
      mood: 5,
      affection: 1,
      exp: 5,
      overfullHunger: 5,
      overfullMood: -2,
    },

    touch: {
      mood: 15,
      affection: 2,
      exp: 4,
      sleepyMoodGain: 5,
      wakeMoodPenalty: -5,
    },

    play: {
      mood: 20,
      affection: 2,
      sleepiness: 15,
      hunger: -5,
      exp: 6,
    },

    rest: {
      exp: 3,
    },
  },

  levelRequirements: {
    1: 0,
    2: 50,
    3: 120,
    4: 220,
    5: 350,
  },
} as const;

/** Thresholds used across state derivation and time progression. */
export const THRESHOLDS = {
  lowHunger: 20,
  hungryState: 10,
  sulkingMood: 15,
  sleepyState: 80,
  happyMood: 80,
  overfullHunger: 90,
  touchSleepy: 90,
  playBlockedSleepiness: 85,
  playBlockedHunger: 10,
  restToNapSleepiness: 20,
  autoSleepSleepiness: 100,
  goodMoodTaskMood: 80,
} as const;

export const MAX_LEVEL = 5;
