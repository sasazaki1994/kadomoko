import { DAY_PERIOD_TAGS, LIFE_RHYTHM_SPEECH, SEASON_EVENT_TAGS, SEASON_SPEECH } from './data/lifeRhythm';
import type { CurrentAction, DayPeriod, PetVitals, Personality, Season } from './types';

export type LifeRhythmContext = {
  now: number;
  vitals: PetVitals;
  personality: Personality;
  currentAction: CurrentAction;
  activeTogetherTimeMs: number;
  lastCareAt: number;
};

export type LifeRhythmHints = {
  dayPeriod: DayPeriod;
  season: Season;
  preferredEventTags: string[];
  speechCandidates: string[];
  sleepinessBias: number;
};

export function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 16) return 'daytime';
  if (hour >= 17 && hour <= 20) return 'evening';
  if (hour >= 21 && hour <= 23) return 'night';
  return 'lateNight';
}

/** Northern-hemisphere meteorological seasons from the local month. */
export function getSeason(date: Date): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function getLifeRhythmHints(context: LifeRhythmContext): LifeRhythmHints {
  const date = new Date(context.now);
  const dayPeriod = getDayPeriod(date);
  const season = getSeason(date);
  const preferredEventTags = [...DAY_PERIOD_TAGS[dayPeriod], ...SEASON_EVENT_TAGS[season]];
  let sleepinessBias = 0;

  if (dayPeriod === 'night') sleepinessBias = 0.15;
  if (dayPeriod === 'lateNight') sleepinessBias = context.vitals.sleepiness >= 80 ? 0.35 : 0.22;
  if (context.currentAction === 'sleeping') {
    preferredEventTags.push('sleeping');
    sleepinessBias += 0.1;
  }
  if (context.personality === 'relaxed' || context.personality === 'calm') {
    preferredEventTags.push('calm');
  }

  return {
    dayPeriod,
    season,
    preferredEventTags: Array.from(new Set(preferredEventTags)),
    speechCandidates: [...LIFE_RHYTHM_SPEECH[dayPeriod], ...SEASON_SPEECH[season]],
    sleepinessBias,
  };
}
