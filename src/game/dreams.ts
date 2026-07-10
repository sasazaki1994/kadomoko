import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { DREAM_THEME_BY_ID, DREAM_THEME_IDS } from './data/dreams';
import { appendEpisodeEntries } from './episodes';
import { getDayPeriod, getSeason } from './lifeRhythm';
import { applyVitalDelta } from './vitals';
import type {
  AmbientFrequency,
  DreamFragment,
  DreamState,
  DreamThemeDef,
  DreamThemeId,
  EpisodeEntry,
  PendingDream,
  PetState,
} from './types';

const BREW_CHANCE = { quiet: 0.06, normal: 0.14, lively: 0.18 } as const;
/** Gap between dreams so they stay rare and unhurried. */
const MIN_DREAM_GAP_MS = 2 * 60 * 60_000;
const MAX_DREAMS_PER_DAY = 2;
/** How long a surfaced fragment lingers before fading quietly. */
const PENDING_MIN_MS = 15 * 60_000;
const PENDING_SPAN_MS = 15 * 60_000;
export const MAX_DREAM_FRAGMENTS = 12;
const MAX_FRAGMENT_TEXT = 60;

const date = localDateString;

function rec(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function isDreamThemeId(value: unknown): value is DreamThemeId {
  return typeof value === 'string' && (DREAM_THEME_IDS as readonly string[]).includes(value);
}

function toFragment(pending: PendingDream): DreamFragment {
  return { themeId: pending.themeId, date: pending.date, mood: pending.mood, text: pending.text, listened: pending.listened };
}

export function createEmptyDreamState(now: number): DreamState {
  return { brewing: null, pending: null, fragments: [], lastDreamAt: 0, date: date(now), countToday: 0 };
}

function sanitizeFragment(raw: unknown): DreamFragment | null {
  if (!rec(raw) || !isDreamThemeId(raw.themeId)) return null;
  const def = DREAM_THEME_BY_ID[raw.themeId];
  return {
    themeId: raw.themeId,
    date: typeof raw.date === 'string' ? raw.date : '',
    mood: raw.mood === 'warm' || raw.mood === 'quiet' || raw.mood === 'curious' ? raw.mood : def.mood,
    text: (typeof raw.text === 'string' ? raw.text : def.fragmentText).slice(0, MAX_FRAGMENT_TEXT),
    listened: raw.listened === true,
  };
}

export function sanitizeDreamState(raw: unknown, now: number): DreamState {
  const today = date(now);
  if (!rec(raw)) return createEmptyDreamState(now);

  let brewing: DreamState['brewing'] = null;
  if (rec(raw.brewing) && isDreamThemeId(raw.brewing.themeId)) {
    brewing = { themeId: raw.brewing.themeId, startedAt: num(raw.brewing.startedAt, now) };
  }

  const fragments = (Array.isArray(raw.fragments) ? raw.fragments : []).flatMap((f) => {
    const fragment = sanitizeFragment(f);
    return fragment && fragment.date !== '' ? [fragment] : [];
  });

  // An expired pending fades quietly into the record as an unlistened trace
  // instead of disappearing; no penalty, no message.
  let pending: DreamState['pending'] = null;
  if (rec(raw.pending)) {
    const fragment = sanitizeFragment(raw.pending);
    const expiresAt = num(raw.pending.expiresAt, NaN);
    if (fragment && fragment.date !== '' && Number.isFinite(expiresAt)) {
      if (expiresAt > now) pending = { ...fragment, expiresAt };
      else fragments.push(fragment);
    }
  }

  const sameDay = raw.date === today;
  return {
    brewing,
    pending,
    fragments: fragments.slice(-MAX_DREAM_FRAGMENTS),
    lastDreamAt: Math.max(0, num(raw.lastDreamAt, 0)),
    date: today,
    countToday: sameDay ? Math.max(0, Math.round(num(raw.countToday, 0))) : 0,
  };
}

/**
 * Picks a theme colored by the pet's current context so dreams echo the day
 * (season, hunger, quiet signals) without being deterministic.
 */
export function pickDreamTheme(pet: PetState, now: number, rng: () => number): DreamThemeId {
  const weights = new Map<DreamThemeId, number>(DREAM_THEME_IDS.map((id) => [id, 1]));
  const bump = (id: DreamThemeId, amount: number) => weights.set(id, (weights.get(id) ?? 1) + amount);

  const period = getDayPeriod(new Date(now));
  if (period === 'night' || period === 'lateNight') bump('floating_lights', 1.5);
  if (getSeason(new Date(now)) !== 'winter') bump('season_wind', 0.8);
  if (pet.vitals.hunger < 40) bump('tiny_feast', 2);
  if (pet.vitals.mood >= 70) bump('wide_meadow', 1.5);
  if (pet.discovery.active !== null || pet.signals.triggeredToday.length > 0) bump('far_signal', 2);
  if (pet.personality === 'calm' || pet.personality === 'relaxed') bump('gentle_rain', 1.5);

  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const [id, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return DREAM_THEME_IDS[0];
}

export type DreamProgressOptions = {
  ambientFrequency?: AmbientFrequency;
  rng?: () => number;
};

export type DreamProgressResult = {
  pet: PetState;
  /** True when a fragment just surfaced (the pet woke holding a dream). */
  surfaced: boolean;
};

/**
 * Advances the dream lifecycle by one step: dreams form while the pet sleeps,
 * surface as a pending fragment on wake, and fade quietly if never listened
 * to. Fading keeps the fragment in the record as an unlistened trace; no
 * penalty and no message.
 */
export function progressDreams(pet: PetState, now: number, options: DreamProgressOptions = {}): DreamProgressResult {
  const rng = options.rng ?? Math.random;
  // Sanitizing also fades an expired pending into the fragment record.
  const state = sanitizeDreamState(pet.dreams, now);
  const sleeping = pet.currentAction === 'sleeping';

  if (state.brewing && !sleeping) {
    // Waking up surfaces the brewing dream as a fragment to listen to.
    const def = DREAM_THEME_BY_ID[state.brewing.themeId];
    const pending = {
      themeId: def.id,
      date: date(now),
      mood: def.mood,
      text: def.fragmentText,
      listened: false,
      expiresAt: now + PENDING_MIN_MS + Math.floor(rng() * PENDING_SPAN_MS),
    };
    const next: DreamState = {
      ...state,
      brewing: null,
      pending,
      lastDreamAt: now,
      countToday: state.countToday + 1,
    };
    return { pet: { ...pet, dreams: next }, surfaced: true };
  }

  if (
    sleeping &&
    !state.brewing &&
    !state.pending &&
    state.countToday < MAX_DREAMS_PER_DAY &&
    now - state.lastDreamAt >= MIN_DREAM_GAP_MS &&
    rng() < BREW_CHANCE[options.ambientFrequency ?? 'normal']
  ) {
    const themeId = pickDreamTheme(pet, now, rng);
    return { pet: { ...pet, dreams: { ...state, brewing: { themeId, startedAt: now } } }, surfaced: false };
  }

  return { pet: { ...pet, dreams: state }, surfaced: false };
}

/** Immediately surfaces a fragment regardless of sleep/cooldowns (DevTools). */
export function forceSurfaceDream(pet: PetState, now: number, rng: () => number = Math.random): PetState {
  const state = sanitizeDreamState(pet.dreams, now);
  const themeId = pickDreamTheme(pet, now, rng);
  const def = DREAM_THEME_BY_ID[themeId];
  const pending: PendingDream = {
    themeId,
    date: date(now),
    mood: def.mood,
    text: def.fragmentText,
    listened: false,
    expiresAt: now + PENDING_MIN_MS + PENDING_SPAN_MS,
  };
  return { ...pet, dreams: { ...state, brewing: null, pending, lastDreamAt: now } };
}

export function episodeFromDream(def: DreamThemeDef, now: number): EpisodeEntry {
  return {
    id: def.episodeId,
    date: date(now),
    title: def.label.slice(0, 24),
    text: def.episodeText,
    trigger: 'dream',
    relatedMemoryFlagIds: [def.id],
    relatedHabitatItemIds: [],
  };
}

export type ListenDreamResult = {
  pet: PetState;
  ok: boolean;
  bubble?: string;
  leveledUp: boolean;
  newLevel?: number;
};

/**
 * Listens to the pending dream fragment: stores it as a listened memory,
 * grants a small quiet reward, and may leave a short episode.
 */
export function listenToDream(pet: PetState, now: number): ListenDreamResult {
  const state = sanitizeDreamState(pet.dreams, now);
  if (!state.pending || pet.currentAction === 'sleeping') {
    return { pet: { ...pet, dreams: state }, ok: false, leveledUp: false };
  }
  const def = DREAM_THEME_BY_ID[state.pending.themeId];
  const fragments = [...state.fragments, { ...toFragment(state.pending), listened: true }].slice(-MAX_DREAM_FRAGMENTS);

  let next: PetState = {
    ...pet,
    dreams: { ...state, pending: null, fragments },
    vitals: applyVitalDelta(pet.vitals, { mood: 3, affection: 1 }),
  };
  next = { ...next, episodes: appendEpisodeEntries(next.episodes, [episodeFromDream(def, now)]) };
  const granted = grantExp(next, 2);
  return {
    pet: granted.pet,
    ok: true,
    bubble: def.bubble,
    leveledUp: granted.leveledUp,
    newLevel: granted.leveledUp ? granted.newLevel : undefined,
  };
}
