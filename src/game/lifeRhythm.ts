import { DAY_PERIOD_TAGS, LIFE_RHYTHM_SPEECH } from './data/lifeRhythm';
import type { CurrentAction, DayPeriod, PetVitals, Personality } from './types';

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

export function getLifeRhythmHints(context: LifeRhythmContext): LifeRhythmHints {
  const dayPeriod = getDayPeriod(new Date(context.now));
  const preferredEventTags = [...DAY_PERIOD_TAGS[dayPeriod]];
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
    preferredEventTags: Array.from(new Set(preferredEventTags)),
    speechCandidates: [...LIFE_RHYTHM_SPEECH[dayPeriod]],
    sleepinessBias,
  };
}
