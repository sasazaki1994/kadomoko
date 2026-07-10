import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { TINY_PLAY_DEFS, TINY_PLAY_IDS } from './data/tinyPlays';
import { appendEpisodeEntries } from './episodes';
import { deriveBaseState } from './stateMachine';
import type { EpisodeEntry, PetMachineState, PetState, TinyPlayId, TinyPlayState } from './types';

const MIN_GAP_MS = 3 * 60 * 60_000;
const CHANCE = { quiet: 0.004, normal: 0.012, lively: 0.018 } as const;
/** Keep a just-finished session around so advanceTinyPlay can complete it. */
const ENDED_GRACE_MS = 10 * 60_000;
// Local date so completedToday resets at the user's midnight, not UTC.
const date = localDateString;
function rec(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function n(v: unknown, f: number) { return typeof v === 'number' && Number.isFinite(v) ? v : f; }
function ep(id: TinyPlayId, now: number): EpisodeEntry { const eid = TINY_PLAY_DEFS[id].episodeId ?? 'watched_tiny_play'; return { id: eid, date: date(now), title: eid === 'made_a_small_turn' ? '小さく回る' : '小さな遊び', text: eid === 'played_follow_dot' ? '小さな点を見ていた。' : eid === 'peeked_from_corner' ? '少し隠れて、また出てきた。' : eid === 'made_a_small_turn' ? 'ゆっくり回っていた。' : '小さな遊びをしていた。', trigger: 'tiny_play', relatedMemoryFlagIds: [id], relatedHabitatItemIds: [] }; }

export function createEmptyTinyPlayState(now: number): TinyPlayState { return { active: null, lastStartedAt: 0, completedToday: [], date: date(now) }; }

export function sanitizeTinyPlayState(raw: unknown, now: number): TinyPlayState {
  const today = date(now); const data = rec(raw) ? raw : {};
  let active: TinyPlayState['active'] = null;
  if (rec(data.active) && TINY_PLAY_IDS.includes(data.active.id as TinyPlayId)) {
    const startedAt = n(data.active.startedAt, now); const endsAt = n(data.active.endsAt, startedAt + TINY_PLAY_DEFS[data.active.id as TinyPlayId].durationMs);
    if (endsAt + ENDED_GRACE_MS > now) {
      const phase = endsAt <= now ? 'ending' : data.active.phase === 'ending' || data.active.phase === 'playing' ? data.active.phase : 'starting';
      active = { id: data.active.id as TinyPlayId, startedAt, endsAt, phase, interacted: data.active.interacted === true };
    }
  }
  const rawCompleted = Array.isArray(data.completedToday) ? data.completedToday : [];
  const completedToday = data.date === today ? [...new Set(rawCompleted.filter((id): id is TinyPlayId => TINY_PLAY_IDS.includes(id as TinyPlayId)))] : [];
  return { active, lastStartedAt: Math.max(0, n(data.lastStartedAt, 0)), completedToday, date: today };
}

function pick(pet: PetState, rng: () => number): TinyPlayId {
  const state = deriveBaseState(pet.vitals, pet.currentAction);
  if ((pet.personality === 'moody' || pet.personality === 'sulky' || state === 'curious') && rng() < 0.45) return 'hide_peek';
  if ((state === 'happy' || pet.personality === 'energetic') && rng() < 0.55) return 'slow_turn';
  if ((pet.personality === 'calm' || new Date(pet.lastUpdatedAt).getHours() >= 20) && rng() < 0.45) return 'counting_blinks';
  return TINY_PLAY_IDS[Math.floor(rng() * TINY_PLAY_IDS.length)] ?? 'follow_dot';
}

export function maybeStartTinyPlay(pet: PetState, now: number, opts: { ambientFrequency?: 'quiet' | 'normal' | 'lively'; rng?: () => number; force?: boolean } = {}): { pet: PetState; started: boolean } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  if (tinyPlay.active || pet.currentAction === 'sleeping' || tinyPlay.completedToday.length >= 3 || (!opts.force && now - tinyPlay.lastStartedAt < MIN_GAP_MS)) return { pet: { ...pet, tinyPlay }, started: false };
  const freq = opts.ambientFrequency ?? 'normal'; const rng = opts.rng ?? Math.random;
  if (!opts.force && rng() > CHANCE[freq]) return { pet: { ...pet, tinyPlay }, started: false };
  const id = pick(pet, rng); const def = TINY_PLAY_DEFS[id];
  return { pet: { ...pet, tinyPlay: { ...tinyPlay, active: { id, startedAt: now, endsAt: now + def.durationMs, phase: 'starting' }, lastStartedAt: now } }, started: true };
}

export function advanceTinyPlay(pet: PetState, now: number): { pet: PetState; ended: boolean; bubble?: string; effect?: string } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  if (!tinyPlay.active) return { pet: { ...pet, tinyPlay }, ended: false };
  if (now < tinyPlay.active.endsAt) return { pet: { ...pet, tinyPlay: { ...tinyPlay, active: { ...tinyPlay.active, phase: now - tinyPlay.active.startedAt > 800 ? 'playing' : 'starting' } } }, ended: false };
  const id = tinyPlay.active.id; let next = grantExp({ ...pet, tinyPlay: { ...tinyPlay, active: null, completedToday: [...new Set([...tinyPlay.completedToday, id])] } }, 1).pet;
  if (now % 2 === 0) next = { ...next, episodes: appendEpisodeEntries(next.episodes, [ep(id, now)]) };
  return { pet: next, ended: true, bubble: TINY_PLAY_DEFS[id].bubble, effect: TINY_PLAY_DEFS[id].effect };
}

export function interactWithTinyPlay(pet: PetState, now: number): { pet: PetState; bubble?: string; tempState?: PetMachineState } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  if (!tinyPlay.active || now >= tinyPlay.active.endsAt) return { pet: { ...pet, tinyPlay } };
  const next = grantExp({ ...pet, tinyPlay: { ...tinyPlay, active: { ...tinyPlay.active, interacted: true } } }, 1).pet;
  return { pet: next, bubble: 'いい感じ', tempState: tinyPlay.active.id === 'mirror_bounce' ? 'playing' : 'curious' };
}
