import { getDayPeriod, getSeason } from './lifeRhythm';
import { EPISODE_IDS, EPISODE_TEXT } from './data/episodes';
import type { EpisodeEntry, EpisodeId, EpisodeTrigger, PetState, Season } from './types';

const MAX_PER_DAY = 2;
export const MAX_EPISODE_ENTRIES = 60;
const MAX_TITLE = 24;
const MAX_TEXT = 80;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[a-z0-9_-]{1,48}$/i;

function localDate(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function entry(id: EpisodeId, trigger: EpisodeTrigger, now: number, relatedMemoryFlagIds: string[] = [], relatedHabitatItemIds: string[] = []): EpisodeEntry {
  return { id, date: localDate(now), ...EPISODE_TEXT[id], trigger, relatedMemoryFlagIds, relatedHabitatItemIds };
}

function hasProp(pet: PetState, id: string): boolean {
  return pet.unlockedPropIds.includes(id);
}

const SEASON_EPISODE_ID: Record<Season, EpisodeId> = {
  spring: 'felt_spring_air',
  summer: 'found_cool_shade',
  autumn: 'listened_to_quiet_leaves',
  winter: 'curled_up_warm',
};

export function createEpisodeCandidates(pet: PetState, trigger: EpisodeTrigger, now: number): EpisodeEntry[] {
  const candidates: EpisodeEntry[] = [];
  const period = getDayPeriod(new Date(now));
  const completed = new Set(pet.dailyTasks.tasks.filter((t) => t.completed).map((t) => t.id));
  const recentTendencies = pet.personalityHistory.slice(-3).map((x) => x.tendency);

  if (trigger === 'day_rollover' && pet.vitals.mood >= 60 && pet.vitals.hunger >= 40 && pet.vitals.mood >= 30) candidates.push(entry('first_quiet_day', trigger, now));
  if (pet.careStats.playCount >= 2 || recentTendencies.includes('energetic')) candidates.push(entry('played_again', trigger, now, ['played_yesterday']));
  if (pet.careStats.restCount >= 2 || (pet.vitals.sleepiness <= 45 && recentTendencies.includes('relaxed'))) candidates.push(entry('rested_well', trigger, now, ['rested_often']));
  if (hasProp(pet, 'old_note') && (trigger === 'random_event' || trigger === 'habitat_event' || pet.personality === 'moody')) candidates.push(entry('found_old_note', trigger, now, [], ['old_note']));
  if (hasProp(pet, 'glow_speck') && (period === 'night' || period === 'lateNight')) candidates.push(entry('watched_glow_speck', trigger, now, [], ['glow_speck']));
  if (pet.careStats.activeTogetherTimeMs >= 30 * 60_000 || completed.has('together_30min')) candidates.push(entry('stayed_together', trigger, now));
  if (pet.careStats.lowHungerTimeMs > 0 && pet.vitals.hunger >= 50) candidates.push(entry('recovered_from_hunger', trigger, now));
  if (period === 'morning' && pet.vitals.mood >= 60) candidates.push(entry('gentle_morning', trigger, now));
  if ((period === 'night' || period === 'lateNight') && pet.vitals.sleepiness >= 60) candidates.push(entry('sleepy_night', trigger, now));
  if (hasProp(pet, 'small_cloth') && pet.vitals.mood >= 60) candidates.push(entry('calm_corner', trigger, now, [], ['small_cloth']));
  // Seasonal note: only on quiet day rollovers, so seasons color the record
  // without competing with care-driven episodes.
  if (trigger === 'day_rollover' && pet.vitals.mood >= 50 && candidates.length < MAX_PER_DAY) {
    candidates.push(entry(SEASON_EPISODE_ID[getSeason(new Date(now))], trigger, now));
  }

  return candidates.slice(0, MAX_PER_DAY);
}

export function sanitizeEpisodeEntries(raw: unknown, maxEntries = MAX_EPISODE_ENTRIES): EpisodeEntry[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(EPISODE_IDS);
  return raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)).flatMap((x) => {
    if (typeof x.id !== 'string' || !allowed.has(x.id) || typeof x.date !== 'string' || !ISO_DATE.test(x.date)) return [];
    const cleanIds = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && SAFE_ID.test(s)).slice(0, 8) : [];
    return [{
      id: x.id as EpisodeId,
      date: x.date,
      title: (typeof x.title === 'string' ? x.title : EPISODE_TEXT[x.id as EpisodeId].title).slice(0, MAX_TITLE),
      text: (typeof x.text === 'string' ? x.text : EPISODE_TEXT[x.id as EpisodeId].text).slice(0, MAX_TEXT),
      trigger: typeof x.trigger === 'string' ? x.trigger as EpisodeEntry['trigger'] : 'day_rollover',
      relatedMemoryFlagIds: cleanIds(x.relatedMemoryFlagIds),
      relatedHabitatItemIds: cleanIds(x.relatedHabitatItemIds),
    }];
  }).slice(-maxEntries);
}

export function appendEpisodeEntries(existing: EpisodeEntry[], candidates: EpisodeEntry[], options: { maxEntries?: number } = {}): EpisodeEntry[] {
  const maxEntries = options.maxEntries ?? MAX_EPISODE_ENTRIES;
  const next = sanitizeEpisodeEntries(existing, maxEntries);
  const perDate = new Map<string, number>();
  for (const item of next) perDate.set(item.date, (perDate.get(item.date) ?? 0) + 1);
  for (const candidate of sanitizeEpisodeEntries(candidates, maxEntries)) {
    if ((perDate.get(candidate.date) ?? 0) >= MAX_PER_DAY) continue;
    if (next.some((item) => item.date === candidate.date && item.id === candidate.id)) continue;
    next.push(candidate);
    perDate.set(candidate.date, (perDate.get(candidate.date) ?? 0) + 1);
  }
  return next.slice(-maxEntries);
}
