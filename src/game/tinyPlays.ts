import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { TINY_PLAY_DEFS, TINY_PLAY_IDS } from './data/tinyPlays';
import { appendEpisodeEntries } from './episodes';
import { pickRandom, rollChance, type RandomSource } from './random';
import { deriveBaseState } from './stateMachine';
import { finiteNumber, isRecord } from './validation';
import type { EpisodeEntry, PetMachineState, PetState, TinyPlayId, TinyPlayState } from './types';

const MIN_GAP_MS = 3 * 60 * 60_000;
const CHANCE = { quiet: 0.004, normal: 0.012, lively: 0.018 } as const;
const EPISODE_CHANCE = 0.5;
/** Keep a just-finished session around so advanceTinyPlay can complete it. */
const ENDED_GRACE_MS = 10 * 60_000;
// Local date so completedToday resets at the user's midnight, not UTC.
const date = localDateString;

function episodeEntry(id: TinyPlayId, now: number): EpisodeEntry {
  const episodeId = TINY_PLAY_DEFS[id].episodeId ?? 'watched_tiny_play';
  const title = episodeId === 'made_a_small_turn' ? '小さく回る' : '小さな遊び';
  const textByEpisode: Partial<Record<EpisodeEntry['id'], string>> = {
    played_follow_dot: '小さな点を見ていた。',
    peeked_from_corner: '少し隠れて、また出てきた。',
    made_a_small_turn: 'ゆっくり回っていた。',
  };
  return {
    id: episodeId,
    date: date(now),
    title,
    text: textByEpisode[episodeId] ?? '小さな遊びをしていた。',
    trigger: 'tiny_play',
    relatedMemoryFlagIds: [id],
    relatedHabitatItemIds: [],
  };
}

export function createEmptyTinyPlayState(now: number): TinyPlayState {
  return { active: null, lastStartedAt: 0, completedToday: [], date: date(now) };
}

export function sanitizeTinyPlayState(raw: unknown, now: number): TinyPlayState {
  const today = date(now);
  const data = isRecord(raw) ? raw : {};
  let active: TinyPlayState['active'] = null;
  if (isRecord(data.active) && TINY_PLAY_IDS.includes(data.active.id as TinyPlayId)) {
    const id = data.active.id as TinyPlayId;
    const startedAt = finiteNumber(data.active.startedAt, now);
    const endsAt = finiteNumber(data.active.endsAt, startedAt + TINY_PLAY_DEFS[id].durationMs);
    if (endsAt + ENDED_GRACE_MS > now) {
      const phase = endsAt <= now ? 'ending' : data.active.phase === 'ending' || data.active.phase === 'playing' ? data.active.phase : 'starting';
      active = { id, startedAt, endsAt, phase, interacted: data.active.interacted === true };
    }
  }
  const rawCompleted = Array.isArray(data.completedToday) ? data.completedToday : [];
  const completedToday = data.date === today ? [...new Set(rawCompleted.filter((id): id is TinyPlayId => TINY_PLAY_IDS.includes(id as TinyPlayId)))] : [];
  return { active, lastStartedAt: Math.max(0, finiteNumber(data.lastStartedAt, 0)), completedToday, date: today };
}

function pick(pet: PetState, rng: () => number): TinyPlayId {
  const state = deriveBaseState(pet.vitals, pet.currentAction);
  if ((pet.personality === 'moody' || pet.personality === 'sulky' || state === 'curious') && rng() < 0.45) return 'hide_peek';
  if ((state === 'happy' || pet.personality === 'energetic') && rng() < 0.55) return 'slow_turn';
  if ((pet.personality === 'calm' || new Date(pet.lastUpdatedAt).getHours() >= 20) && rng() < 0.45) return 'counting_blinks';
  return pickRandom(TINY_PLAY_IDS, rng) ?? 'follow_dot';
}

export function maybeStartTinyPlay(
  pet: PetState,
  now: number,
  opts: { ambientFrequency?: 'quiet' | 'normal' | 'lively'; rng?: RandomSource; force?: boolean } = {},
): { pet: PetState; started: boolean } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  const isBlocked = tinyPlay.active
    || pet.currentAction === 'sleeping'
    || tinyPlay.completedToday.length >= 3
    || (!opts.force && now - tinyPlay.lastStartedAt < MIN_GAP_MS);
  if (isBlocked) return { pet: { ...pet, tinyPlay }, started: false };

  const frequency = opts.ambientFrequency ?? 'normal';
  const rng = opts.rng ?? Math.random;
  if (!opts.force && !rollChance(CHANCE[frequency], rng)) {
    return { pet: { ...pet, tinyPlay }, started: false };
  }

  const id = pick(pet, rng);
  const def = TINY_PLAY_DEFS[id];
  return {
    pet: {
      ...pet,
      tinyPlay: {
        ...tinyPlay,
        active: { id, startedAt: now, endsAt: now + def.durationMs, phase: 'starting' },
        lastStartedAt: now,
      },
    },
    started: true,
  };
}

export function advanceTinyPlay(
  pet: PetState,
  now: number,
  rng: RandomSource = Math.random,
): { pet: PetState; ended: boolean; bubble?: string; effect?: string } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  if (!tinyPlay.active) return { pet: { ...pet, tinyPlay }, ended: false };
  if (now < tinyPlay.active.endsAt) {
    const phase = now - tinyPlay.active.startedAt > 800 ? 'playing' : 'starting';
    return {
      pet: { ...pet, tinyPlay: { ...tinyPlay, active: { ...tinyPlay.active, phase } } },
      ended: false,
    };
  }

  const id = tinyPlay.active.id;
  let next = grantExp({
    ...pet,
    tinyPlay: {
      ...tinyPlay,
      active: null,
      completedToday: [...new Set([...tinyPlay.completedToday, id])],
    },
  }, 1).pet;
  if (rollChance(EPISODE_CHANCE, rng)) {
    next = { ...next, episodes: appendEpisodeEntries(next.episodes, [episodeEntry(id, now)]) };
  }
  return { pet: next, ended: true, bubble: TINY_PLAY_DEFS[id].bubble, effect: TINY_PLAY_DEFS[id].effect };
}

export function interactWithTinyPlay(pet: PetState, now: number): { pet: PetState; bubble?: string; tempState?: PetMachineState } {
  const tinyPlay = sanitizeTinyPlayState(pet.tinyPlay, now);
  if (!tinyPlay.active || now >= tinyPlay.active.endsAt) {
    return { pet: { ...pet, tinyPlay } };
  }
  const next = grantExp({
    ...pet,
    tinyPlay: { ...tinyPlay, active: { ...tinyPlay.active, interacted: true } },
  }, 1).pet;
  return { pet: next, bubble: 'いい感じ', tempState: tinyPlay.active.id === 'mirror_bounce' ? 'playing' : 'curious' };
}
