import { grantExp } from './actions';
import { localDateString } from './dailyTasks';
import { SECRET_SIGNAL_DEFS, SECRET_SIGNAL_IDS } from './data/signals';
import { appendEpisodeEntries } from './episodes';
import { rollChance, type RandomSource } from './random';
import { applyVitalDelta } from './vitals';
import { finiteNumber, isRecord } from './validation';
import type { EpisodeEntry, PetMachineState, PetState, SecretSignalId, SignalEvent, SignalInput, SignalState } from './types';

export const MAX_SIGNAL_EVENTS = 20;
const EVENT_TTL_MS = 10 * 60_000;
const INPUTS: readonly SignalInput[] = ['click', 'right_click', 'menu_open', 'panel_open', 'pet_dragged', 'context_action', 'care_action'];
const EPISODE_CHANCE = 1 / 3;

// Local date so the once-per-day reset happens at the user's midnight, not UTC.
const date = localDateString;

function episodeEntry(id: SecretSignalId, now: number): EpisodeEntry {
  return {
    id: 'answered_secret_signal',
    date: date(now),
    title: '小さな合図',
    text: '小さな合図に反応していた。',
    trigger: 'secret_signal',
    relatedMemoryFlagIds: [id],
    relatedHabitatItemIds: [],
  };
}

export function createEmptySignalState(now: number): SignalState {
  return { recentEvents: [], lastTriggeredAt: {}, triggeredToday: [], date: date(now) };
}

export function sanitizeSignalState(raw: unknown, now: number): SignalState {
  const today = date(now);
  const data = isRecord(raw) ? raw : {};
  const recentEvents = (Array.isArray(data.recentEvents) ? data.recentEvents : []).filter(isRecord).flatMap((e) => {
    if (!INPUTS.includes(e.input as SignalInput)) return [];
    const at = finiteNumber(e.at, NaN);
    if (!Number.isFinite(at) || now - at > EVENT_TTL_MS) return [];
    return [{ input: e.input as SignalInput, at, detail: typeof e.detail === 'string' ? e.detail.slice(0, 40) : undefined }];
  }).slice(-MAX_SIGNAL_EVENTS);
  const lastTriggeredAt: SignalState['lastTriggeredAt'] = {};
  if (isRecord(data.lastTriggeredAt)) {
    for (const id of SECRET_SIGNAL_IDS) {
      const at = finiteNumber(data.lastTriggeredAt[id], NaN);
      if (Number.isFinite(at)) lastTriggeredAt[id] = at;
    }
  }
  const rawToday = Array.isArray(data.triggeredToday) ? data.triggeredToday : [];
  const triggeredToday = data.date === today ? [...new Set(rawToday.filter((id): id is SecretSignalId => SECRET_SIGNAL_IDS.includes(id as SecretSignalId)))] : [];
  return { recentEvents, lastTriggeredAt, triggeredToday, date: today };
}

function onCooldown(pet: PetState, id: SecretSignalId, now: number): boolean {
  const last = pet.signals.lastTriggeredAt[id];
  return last !== undefined && now - last < SECRET_SIGNAL_DEFS[id].cooldownMs;
}

function hasSequence(events: SignalEvent[], inputs: SignalInput[], windowMs: number): boolean {
  const tail = events.slice(-inputs.length);
  return tail.length === inputs.length
    && tail.every((event, index) => event.input === inputs[index])
    && tail.at(-1)!.at - tail[0].at <= windowMs;
}

export function detectSecretSignals(pet: PetState, now: number): SecretSignalId[] {
  const signals = sanitizeSignalState(pet.signals, now);
  const events = signals.recentEvents;
  const detected: SecretSignalId[] = [];
  const add = (id: SecretSignalId, matches: boolean) => {
    if (matches && !onCooldown({ ...pet, signals }, id, now) && !signals.triggeredToday.includes(id)) {
      detected.push(id);
    }
  };
  add('tap_tap_pause', hasSequence(events, ['click', 'click'], SECRET_SIGNAL_DEFS.tap_tap_pause.windowMs) && now - events.at(-1)!.at >= 900);
  add('hello_corner', hasSequence(events, ['click'], 1_000) && (new Date(now).getHours() < 10 || now - pet.lastUpdatedAt > 30 * 60_000));
  add('quiet_check', hasSequence(events, ['panel_open', 'panel_open'], SECRET_SIGNAL_DEFS.quiet_check.windowMs));
  add('sleepy_respect', pet.currentAction === 'sleeping' && hasSequence(events, ['context_action'], 2_000) && events.at(-1)?.detail === 'give_space');
  add('look_and_wait', (pet.discovery.active !== null || pet.personality === 'calm') && events.length > 0 && now - events.at(-1)!.at >= 4_000);
  add('little_spin', pet.vitals.mood >= 75 && (hasSequence(events, ['click', 'context_action'], 4_000) || hasSequence(events, ['context_action', 'click'], 4_000)));
  return detected.slice(0, 1);
}

export function recordSignalInput(pet: PetState, event: SignalEvent, now: number): { pet: PetState; triggered: SecretSignalId[] } {
  const signals = sanitizeSignalState(pet.signals, now);
  // Signals ending in a deliberate pause (e.g. tap_tap_pause) are only visible
  // in the history *before* the newest input lands, so detect on both sides.
  const preTriggered = detectSecretSignals({ ...pet, signals }, now);
  const recentEvents = [...signals.recentEvents, event].filter((e) => now - e.at <= EVENT_TTL_MS).slice(-MAX_SIGNAL_EVENTS);
  let next = { ...pet, signals: { ...signals, recentEvents } };
  const triggered = preTriggered.length > 0 ? preTriggered : detectSecretSignals(next, now);
  if (triggered.length) {
    next = {
      ...next,
      signals: {
        ...next.signals,
        lastTriggeredAt: { ...next.signals.lastTriggeredAt, [triggered[0]]: now },
        triggeredToday: [...new Set([...next.signals.triggeredToday, triggered[0]])],
      },
    };
  }
  return { pet: next, triggered };
}

export function applySecretSignalReaction(
  pet: PetState,
  signalId: SecretSignalId,
  now: number,
  rng: RandomSource = Math.random,
): { pet: PetState; bubble?: string; tempState?: PetMachineState; effect?: string; episodeId?: string } {
  let next = { ...pet, vitals: applyVitalDelta(pet.vitals, signalId === 'sleepy_respect' ? { affection: 2, mood: 1 } : { mood: 2, affection: 1 }) };
  next = grantExp(next, 1).pet;
  const map: Record<SecretSignalId, { bubble: string; tempState: PetMachineState; effect: string }> = {
    tap_tap_pause: { bubble: '？', tempState: 'reaction', effect: 'gaze' },
    hello_corner: { bubble: 'ここにいる', tempState: 'happy', effect: 'hop' },
    quiet_check: { bubble: 'いい感じ', tempState: 'reaction', effect: 'gaze' },
    sleepy_respect: { bubble: '……', tempState: 'sleeping', effect: 'curl' },
    look_and_wait: { bubble: '……', tempState: 'curious', effect: 'wiggle' },
    little_spin: { bubble: 'いい感じ', tempState: 'playing', effect: 'spin' },
  };
  if (rollChance(EPISODE_CHANCE, rng)) {
    next = { ...next, episodes: appendEpisodeEntries(next.episodes, [episodeEntry(signalId, now)]) };
  }
  return { pet: next, ...map[signalId], episodeId: 'answered_secret_signal' };
}
