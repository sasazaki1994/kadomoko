import { localDateString } from './dailyTasks';
import { appendEpisodeEntries } from './episodes';
import { getDayPeriod } from './lifeRhythm';
import { DISCOVERY_BY_ID, DISCOVERY_DEFS, DISCOVERY_IDS } from './data/discoveries';
import type { AmbientFrequency, DiscoveryEntry, DiscoveryId, DiscoveryState, EpisodeEntry, PetState } from './types';

const MIN_ROLL_GAP_MS = 30 * 60_000;
const EXPIRE_MIN_MS = 10 * 60_000;
const EXPIRE_SPAN_MS = 20 * 60_000;
const MAX_RESOLVED_PER_DAY = 2;

const localDate = localDateString;

export function isDiscoveryId(value: unknown): value is DiscoveryId {
  return typeof value === 'string' && (DISCOVERY_IDS as readonly string[]).includes(value);
}

export function createEmptyDiscoveryState(now: number): DiscoveryState {
  return { active: null, resolvedToday: [], lastRolledAt: now };
}

export function sanitizeDiscoveryState(raw: unknown, now: number): DiscoveryState {
  const date = localDate(now);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return createEmptyDiscoveryState(now);
  const data = raw as Record<string, unknown>;
  const resolved = Array.isArray(data.resolvedToday)
    ? [...new Set(data.resolvedToday.filter(isDiscoveryId))].slice(0, MAX_RESOLVED_PER_DAY)
    : [];
  const activeRaw = data.active;
  let active: DiscoveryEntry | null = null;
  if (activeRaw && typeof activeRaw === 'object' && !Array.isArray(activeRaw)) {
    const a = activeRaw as Record<string, unknown>;
    if (isDiscoveryId(a.id) && typeof a.expiresAt === 'number' && Number.isFinite(a.expiresAt) && a.expiresAt > now) {
      const def = DISCOVERY_BY_ID[a.id];
      active = { id: a.id, date: typeof a.date === 'string' ? a.date : date, kind: def.kind, label: def.label, shortText: def.shortText, relatedEpisodeId: typeof a.relatedEpisodeId === 'string' ? a.relatedEpisodeId : def.episodeId, expiresAt: a.expiresAt };
    }
  }
  const lastRolledAt = typeof data.lastRolledAt === 'number' && Number.isFinite(data.lastRolledAt) ? data.lastRolledAt : now;
  // resolvedToday only lasts for the local day of the last roll; otherwise two
  // resolutions would block discoveries forever.
  return { active, resolvedToday: localDate(lastRolledAt) === date ? resolved : [], lastRolledAt };
}

function hasHintItem(pet: PetState): boolean {
  const anyPet = pet as PetState & { habitat?: { placedItemIds?: unknown }; memoryFlags?: unknown };
  const items = Array.isArray(anyPet.habitat?.placedItemIds) ? anyPet.habitat.placedItemIds : pet.unlockedPropIds;
  return items.some((id) => id === 'old_note' || id === 'glow_speck') || (Array.isArray(anyPet.memoryFlags) && anyPet.memoryFlags.some((x) => typeof x === 'string' && x.includes('calm')));
}

function rollChance(pet: PetState, now: number, frequency: AmbientFrequency): number {
  let chance = 0.16;
  const period = getDayPeriod(new Date(now));
  if (pet.vitals.mood >= 70) chance += 0.08;
  if (pet.vitals.affection >= 30) chance += 0.06;
  if (pet.careStats.activeTogetherTimeMs >= 20 * 60_000) chance += 0.05;
  if (pet.personality === 'calm' || pet.personality === 'moody') chance += 0.03;
  if (period === 'night' || period === 'lateNight') chance += 0.08;
  if (pet.currentAction === 'sleeping') chance *= 0.25;
  if (hasHintItem(pet)) chance += 0.04;
  if (frequency === 'quiet') chance *= 0.45;
  if (frequency === 'lively') chance *= 1.15;
  return Math.min(0.42, chance);
}

export function maybeRollDiscovery(pet: PetState, now: number, options: { force?: boolean; rng?: () => number; ambientFrequency?: AmbientFrequency } = {}): { pet: PetState; created: boolean } {
  const state = sanitizeDiscoveryState(pet.discovery, now);
  if (state.active && state.active.expiresAt <= now) return { pet: { ...pet, discovery: { ...state, active: null } }, created: false };
  if (state.active) return { pet: { ...pet, discovery: state }, created: false };
  const date = localDate(now);
  const todayResolved = pet.discovery?.resolvedToday?.filter((id) => state.resolvedToday.includes(id)) ?? state.resolvedToday;
  if (!options.force) {
    if (todayResolved.length >= MAX_RESOLVED_PER_DAY) return { pet: { ...pet, discovery: { ...state, resolvedToday: todayResolved } }, created: false };
    if (now - state.lastRolledAt < MIN_ROLL_GAP_MS) return { pet: { ...pet, discovery: state }, created: false };
    if ((options.rng ?? Math.random)() > rollChance(pet, now, options.ambientFrequency ?? 'normal')) return { pet: { ...pet, discovery: { ...state, lastRolledAt: now } }, created: false };
  }
  const pool = DISCOVERY_DEFS.filter((d) => !todayResolved.includes(d.id));
  const def = pool[Math.floor((options.rng ?? Math.random)() * pool.length)] ?? DISCOVERY_DEFS[0];
  const active: DiscoveryEntry = { id: def.id, date, kind: def.kind, label: def.label, shortText: def.shortText, relatedEpisodeId: def.episodeId, expiresAt: now + EXPIRE_MIN_MS + Math.floor((options.rng ?? Math.random)() * EXPIRE_SPAN_MS) };
  return { pet: { ...pet, discovery: { active, resolvedToday: todayResolved, lastRolledAt: now } }, created: true };
}

export function episodeFromDiscovery(discovery: DiscoveryEntry, now: number): EpisodeEntry | null {
  const def = DISCOVERY_BY_ID[discovery.id];
  if (!def.episodeId || !def.episodeText) return null;
  return { id: def.episodeId, date: localDate(now), title: discovery.shortText.slice(0, 24), text: def.episodeText, trigger: 'discovery', relatedMemoryFlagIds: [], relatedHabitatItemIds: [] };
}

export function resolveDiscovery(pet: PetState, discoveryId: DiscoveryId, now: number): { pet: PetState; episodeCreated: boolean } {
  const state = sanitizeDiscoveryState(pet.discovery, now);
  if (!state.active || state.active.id !== discoveryId) return { pet: { ...pet, discovery: state }, episodeCreated: false };
  const resolvedToday = [...new Set([...state.resolvedToday, discoveryId])].slice(0, MAX_RESOLVED_PER_DAY);
  const candidate = episodeFromDiscovery(state.active, now);
  const episodes = candidate ? appendEpisodeEntries(pet.episodes, [candidate]) : pet.episodes;
  return { pet: { ...pet, episodes, discovery: { active: null, resolvedToday, lastRolledAt: now } }, episodeCreated: episodes !== pet.episodes && episodes.length > pet.episodes.length };
}
