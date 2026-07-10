import type { DayPeriod, HabitatItemId, MemoryFlag, PetVitals, Personality, RandomEventDef } from './types';

export type HabitatEventContext = { vitals: PetVitals; personality: Personality; dayPeriod?: DayPeriod; placedItemIds: readonly HabitatItemId[]; memoryFlags: readonly MemoryFlag[]; affection: number; level?: number };
const ev = (id: string, tags: RandomEventDef['tags'], bubble: string, baseWeight = 0.35): RandomEventDef => ({ id, state: tags.includes('playing') ? 'playing' : tags.includes('affection') || tags.includes('happy') ? 'happy' : tags.includes('sleepy') ? 'resting' : 'curious', effect: tags.includes('hop') ? 'hop' : tags.includes('sleepy') ? 'curl' : tags.includes('night') ? 'gaze' : 'peek', bubble, durationMs: 3_000, tags, baseWeight });
export function getHabitatEventCandidates(c: HabitatEventContext): RandomEventDef[] {
  const out: RandomEventDef[] = [];
  const has = (id: HabitatItemId) => c.placedItemIds.includes(id);
  const levelBoost = (c.level ?? 1) >= 5 ? 0.25 : 0;
  if (has('soft_cloth') && c.vitals.sleepiness >= 70) out.push(ev('habitat-soft-cloth-curl', ['sleepy','calm'], 'ひとやすみ', 0.45 + levelBoost));
  if (has('small_stone') && c.vitals.mood >= 75) out.push(ev('habitat-small-stone-hop', ['playing','hop','happy'], 'いい感じ', 0.35 + levelBoost));
  if (has('quiet_box') && (c.personality === 'moody' || c.personality === 'sulky' || c.vitals.mood < 35)) out.push(ev('habitat-quiet-box-peek', ['moody','peek','calm'], '……', 0.35 + levelBoost));
  if (has('glow_speck') && (c.dayPeriod === 'night' || c.dayPeriod === 'lateNight')) out.push(ev('habitat-glow-speck-gaze', ['curious','night'], '？', 0.45 + levelBoost));
  if (has('old_note') && (c.personality === 'moody' || c.personality === 'energetic')) out.push(ev('habitat-old-note-question', ['curious'], '？', 0.3 + levelBoost));
  if (has('round_trinket') && c.affection >= 50) out.push(ev('habitat-round-trinket-near', ['affection','happy'], 'ここにいる', 0.35 + levelBoost));
  return out;
}
export function getMemoryEventWeightBoost(event: RandomEventDef, flags: readonly MemoryFlag[] = []): number {
  let boost = 0; const tags = event.tags;
  const has = (id: string) => flags.find((f) => f.id === id)?.strength ?? 0;
  if (has('played_yesterday') && tags.some((t) => ['playing','hop'].includes(t))) boost += 0.25 * has('played_yesterday');
  if (has('rested_often') && tags.some((t) => ['sleepy','sleeping','stretch','calm'].includes(t))) boost += 0.2 * has('rested_often');
  if (has('touched_often') && tags.includes('affection')) boost += 0.25 * has('touched_often');
  if (has('good_mood_day') && tags.includes('happy')) boost += 0.2 * has('good_mood_day');
  if (has('long_time_together') && tags.some((t) => ['calm','affection'].includes(t))) boost += 0.2 * has('long_time_together');
  if (has('low_hunger_recovered') && tags.includes('hungry')) boost += 0.15 * has('low_hunger_recovered');
  return boost;
}
