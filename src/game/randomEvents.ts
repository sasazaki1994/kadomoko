import {
  RANDOM_EVENT_CHANCE_PER_MINUTE,
  RANDOM_EVENT_MIN_GAP_MS,
  RANDOM_EVENT_POOL,
} from './data/randomEvents';
import { getLifeRhythmHints } from './lifeRhythm';
import type { EpisodeEntry, CurrentAction, DayPeriod, Personality, PetVitals, RandomEventDef, RandomEventTag } from './types';

export type RandomEventContext = {
  now: number;
  vitals: PetVitals;
  personality: Personality;
  affection: number;
  currentAction: CurrentAction;
  dayPeriod: DayPeriod;
  activeTogetherTimeMs: number;
  lastCareAt: number;
  episodes?: EpisodeEntry[];
};

function hasAny(event: RandomEventDef, tags: readonly RandomEventTag[]): boolean {
  return event.tags.some((tag) => tags.includes(tag));
}

export function getRandomEventWeight(event: RandomEventDef, context: RandomEventContext): number {
  let weight = event.baseWeight;
  const boost = (tags: RandomEventTag[], amount: number) => {
    if (hasAny(event, tags)) weight += amount;
  };

  if (context.personality === 'sweet') boost(['peek', 'affection', 'happy'], 1.1);
  if (context.personality === 'energetic') boost(['playing', 'hop', 'happy'], 1.5);
  if (context.personality === 'relaxed') boost(['calm', 'stretch', 'sleepy', 'sleeping'], 1.2);
  if (context.personality === 'moody') boost(['moody', 'curious', 'peek'], 1.1);
  if (context.personality === 'sulky' && (context.vitals.hunger < 20 || context.vitals.mood < 30)) boost(['hungry', 'moody'], 1.3);
  if (context.personality === 'calm') boost(['calm', 'idle'], 1.4);

  if (context.vitals.hunger < 20) boost(['hungry'], 1.8);
  if (context.vitals.mood >= 80) boost(['happy'], 1.1);
  if (context.vitals.sleepiness >= 80) boost(['sleepy', 'sleeping'], 1.8);
  if (context.affection >= 70) boost(['affection'], 1.2);

  if (context.dayPeriod === 'morning') boost(['stretch', 'curious', 'morning'], 0.8);
  if (context.dayPeriod === 'night' || context.dayPeriod === 'lateNight') boost(['sleepy', 'sleeping', 'night'], 0.9);

  const recentIds = new Set((context.episodes ?? []).slice(-8).map((episode) => episode.id));
  if (recentIds.has('found_old_note')) boost(['curious'], 0.35);
  if (recentIds.has('watched_glow_speck') && (context.dayPeriod === 'night' || context.dayPeriod === 'lateNight')) boost(['night', 'curious'], 0.35);
  if (recentIds.has('played_again')) boost(['playing', 'hop'], 0.35);
  if (recentIds.has('rested_well')) boost(['calm', 'sleepy', 'sleeping'], 0.35);

  return Math.max(0, weight);
}

export function pickWeightedRandomEvent(
  context: RandomEventContext,
  rng: () => number = Math.random,
  pool: readonly RandomEventDef[] = RANDOM_EVENT_POOL,
): RandomEventDef | null {
  const weighted = pool.map((event) => ({ event, weight: getRandomEventWeight(event, context) })).filter((x) => x.weight > 0);
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  if (total <= 0 || weighted.length === 0) return null;
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.event;
  }
  return weighted.at(-1)?.event ?? null;
}

/**
 * Called once per minute tick. Returns an event to play, or null.
 * Kept low-frequency: probability per minute plus a hard minimum gap.
 */
export function maybeRollRandomEvent(
  now: number,
  lastEventAt: number,
  context?: Omit<RandomEventContext, 'dayPeriod'> & { dayPeriod?: DayPeriod },
  rng: () => number = Math.random,
  frequencyMultiplier = 1,
): RandomEventDef | null {
  if (now - lastEventAt < RANDOM_EVENT_MIN_GAP_MS) return null;
  if (rng() >= RANDOM_EVENT_CHANCE_PER_MINUTE * frequencyMultiplier) return null;
  if (!context) return pickRandomEvent(rng);
  const hints = getLifeRhythmHints({
    now,
    vitals: context.vitals,
    personality: context.personality,
    currentAction: context.currentAction,
    activeTogetherTimeMs: context.activeTogetherTimeMs,
    lastCareAt: context.lastCareAt,
  });
  return pickWeightedRandomEvent({ ...context, dayPeriod: context.dayPeriod ?? hints.dayPeriod }, rng);
}

export function pickRandomEvent(rng: () => number = Math.random): RandomEventDef {
  return RANDOM_EVENT_POOL[Math.floor(rng() * RANDOM_EVENT_POOL.length)];
}
