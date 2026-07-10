import { grantExp } from './actions';
import { SECRET_SIGNAL_DEFS, SECRET_SIGNAL_IDS } from './data/signals';
import { appendEpisodeEntries } from './episodes';
import { applyVitalDelta } from './vitals';
import type { EpisodeEntry, PetMachineState, PetState, SecretSignalId, SignalEvent, SignalInput, SignalState } from './types';

export const MAX_SIGNAL_EVENTS = 20;
const EVENT_TTL_MS = 10 * 60_000;
const INPUTS: readonly SignalInput[] = ['click', 'right_click', 'menu_open', 'panel_open', 'pet_dragged', 'context_action', 'care_action'];

function date(now: number) { return new Date(now).toISOString().slice(0, 10); }
function n(v: unknown, f: number) { return typeof v === 'number' && Number.isFinite(v) ? v : f; }
function rec(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function entry(id: SecretSignalId, now: number): EpisodeEntry { return { id: 'answered_secret_signal', date: date(now), title: '小さな合図', text: '小さな合図に反応していた。', trigger: 'secret_signal', relatedMemoryFlagIds: [id], relatedHabitatItemIds: [] }; }

export function createEmptySignalState(now: number): SignalState { return { recentEvents: [], lastTriggeredAt: {}, triggeredToday: [], date: date(now) }; }

export function sanitizeSignalState(raw: unknown, now: number): SignalState {
  const today = date(now); const data = rec(raw) ? raw : {};
  const recentEvents = (Array.isArray(data.recentEvents) ? data.recentEvents : []).filter(rec).flatMap((e) => {
    if (!INPUTS.includes(e.input as SignalInput)) return [];
    const at = n(e.at, NaN); if (!Number.isFinite(at) || now - at > EVENT_TTL_MS) return [];
    return [{ input: e.input as SignalInput, at, detail: typeof e.detail === 'string' ? e.detail.slice(0, 40) : undefined }];
  }).slice(-MAX_SIGNAL_EVENTS);
  const lastTriggeredAt: SignalState['lastTriggeredAt'] = {};
  if (rec(data.lastTriggeredAt)) for (const id of SECRET_SIGNAL_IDS) { const at = n(data.lastTriggeredAt[id], NaN); if (Number.isFinite(at)) lastTriggeredAt[id] = at; }
  const rawToday = Array.isArray(data.triggeredToday) ? data.triggeredToday : [];
  const triggeredToday = data.date === today ? [...new Set(rawToday.filter((id): id is SecretSignalId => SECRET_SIGNAL_IDS.includes(id as SecretSignalId)))] : [];
  return { recentEvents, lastTriggeredAt, triggeredToday, date: today };
}

function onCooldown(pet: PetState, id: SecretSignalId, now: number) { const last = pet.signals.lastTriggeredAt[id]; return last !== undefined && now - last < SECRET_SIGNAL_DEFS[id].cooldownMs; }
function hasSeq(events: SignalEvent[], inputs: SignalInput[], windowMs: number) { const tail = events.slice(-inputs.length); return tail.length === inputs.length && tail.every((e, i) => e.input === inputs[i]) && tail.at(-1)!.at - tail[0].at <= windowMs; }

export function detectSecretSignals(pet: PetState, now: number): SecretSignalId[] {
  const s = sanitizeSignalState(pet.signals, now); const events = s.recentEvents; const out: SecretSignalId[] = [];
  const add = (id: SecretSignalId, ok: boolean) => { if (ok && !onCooldown({ ...pet, signals: s }, id, now) && !s.triggeredToday.includes(id)) out.push(id); };
  add('tap_tap_pause', hasSeq(events, ['click', 'click'], SECRET_SIGNAL_DEFS.tap_tap_pause.windowMs) && now - events.at(-1)!.at >= 900);
  add('hello_corner', hasSeq(events, ['click'], 1_000) && (new Date(now).getHours() < 10 || now - pet.lastUpdatedAt > 30 * 60_000));
  add('quiet_check', hasSeq(events, ['panel_open', 'panel_open'], SECRET_SIGNAL_DEFS.quiet_check.windowMs));
  add('sleepy_respect', pet.currentAction === 'sleeping' && hasSeq(events, ['context_action'], 2_000) && events.at(-1)?.detail === 'give_space');
  add('look_and_wait', (pet.discovery.active !== null || pet.personality === 'calm') && events.length > 0 && now - events.at(-1)!.at >= 4_000);
  add('little_spin', pet.vitals.mood >= 75 && (hasSeq(events, ['click', 'context_action'], 4_000) || hasSeq(events, ['context_action', 'click'], 4_000)));
  return out.slice(0, 1);
}

export function recordSignalInput(pet: PetState, event: SignalEvent, now: number): { pet: PetState; triggered: SecretSignalId[] } {
  const signals = sanitizeSignalState(pet.signals, now);
  const recentEvents = [...signals.recentEvents, event].filter((e) => now - e.at <= EVENT_TTL_MS).slice(-MAX_SIGNAL_EVENTS);
  let next = { ...pet, signals: { ...signals, recentEvents } };
  const triggered = detectSecretSignals(next, now);
  if (triggered.length) next = { ...next, signals: { ...next.signals, lastTriggeredAt: { ...next.signals.lastTriggeredAt, [triggered[0]]: now }, triggeredToday: [...new Set([...next.signals.triggeredToday, triggered[0]])] } };
  return { pet: next, triggered };
}

export function applySecretSignalReaction(pet: PetState, signalId: SecretSignalId, now: number): { pet: PetState; bubble?: string; tempState?: PetMachineState; effect?: string; episodeId?: string } {
  let next = { ...pet, vitals: applyVitalDelta(pet.vitals, signalId === 'sleepy_respect' ? { affection: 2, mood: 1 } : { mood: 2, affection: 1 }) };
  next = grantExp(next, 1).pet;
  const map: Record<SecretSignalId, { bubble: string; tempState: PetMachineState; effect: string }> = {
    tap_tap_pause: { bubble: '？', tempState: 'reaction', effect: 'gaze' }, hello_corner: { bubble: 'ここにいる', tempState: 'happy', effect: 'hop' }, quiet_check: { bubble: 'いい感じ', tempState: 'reaction', effect: 'gaze' }, sleepy_respect: { bubble: '……', tempState: 'sleeping', effect: 'curl' }, look_and_wait: { bubble: '……', tempState: 'curious', effect: 'wiggle' }, little_spin: { bubble: 'いい感じ', tempState: 'playing', effect: 'spin' },
  };
  if (now % 3 === 0) next = { ...next, episodes: appendEpisodeEntries(next.episodes, [entry(signalId, now)]) };
  return { pet: next, ...map[signalId], episodeId: 'answered_secret_signal' };
}
