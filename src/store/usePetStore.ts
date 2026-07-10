import { create } from 'zustand';
import { performCareAction } from '../game/actions';
import { performContextAction as performContextCareAction } from '../game/contextActions';
import { BALANCE } from '../game/data/balance';
import { CLICK_REACTIONS, REACTION_DURATION_MS } from '../game/data/reactions';
import {
  SPEECH_BY_STATE,
  SPEECH_DISPLAY_MS,
  SPEECH_MIN_INTERVAL_MS,
  SPEECH_PACK_EXTRA,
} from '../game/data/speechMessages';
import { maybeRollDiscovery, resolveDiscovery } from '../game/discoveries';
import { applySecretSignalReaction, createEmptySignalState, recordSignalInput } from '../game/signals';
import { advanceTinyPlay, interactWithTinyPlay, maybeStartTinyPlay, createEmptyTinyPlayState } from '../game/tinyPlays';
import { getLifeRhythmHints } from '../game/lifeRhythm';
import { maybeRollRandomEvent, pickRandomEvent } from '../game/randomEvents';
import {
  createInitialPetState,
  CURRENT_SAVE_VERSION,
  recoverSave,
} from '../game/saveData';
import {
  deriveBaseState,
  isTempState,
  TEMP_STATE_DURATION_MS,
  type TempMachineState,
} from '../game/stateMachine';
import { dailyTaskCompletionBubble } from '../game/dailyTasks';
import { progressTime } from '../game/timeProgress';
import type {
  CareActionId,
  ContextActionId,
  DailyTaskId,
  PetMachineState,
  PetState,
  Personality,
  RandomEventDef,
  SaveSettings,
} from '../game/types';

const AMBIENT_SPEECH_CHANCE_PER_MINUTE = 0.08;
const AMBIENT_MULTIPLIER = { quiet: 0.45, normal: 1, lively: 1.25 } as const;
const BUBBLE_MULTIPLIER = { off: 0, quiet: 0.45, normal: 1 } as const;
const RESUME_REACTION_MIN_GAP_MS = 60_000;
const RESUME_BUBBLES = ['おかえり', '……', 'ここにいる', 'ひとやすみしてた'] as const;

export type CharacterEffect =
  | 'wiggle'
  | 'hop'
  | 'spin'
  | 'peek'
  | 'curl'
  | 'stretch'
  | 'gaze'
  | 'doze'
  | null;

type TempStateEntry = {
  state: TempMachineState;
  effect: CharacterEffect;
};

export type PetStore = {
  loaded: boolean;
  pet: PetState;
  tempState: TempStateEntry | null;
  bubble: { id: number; text: string } | null;
  lastBubbleAt: number;
  panelOpen: boolean;
  menuOpen: boolean;
  devPanelOpen: boolean;
  recordPanelOpen: boolean;
  alwaysOnTop: boolean;
  settings: SaveSettings;

  init: () => Promise<void>;
  tick: () => void;
  catchUpOffline: (fromResume?: boolean) => void;
  performAction: (action: CareActionId) => void;
  performContextAction: (action: ContextActionId) => void;
  updateSettings: (partial: Partial<SaveSettings>) => Promise<void>;
  clickReaction: () => void;
  togglePanel: () => void;
  setMenuOpen: (open: boolean) => void;
  toggleDevPanel: () => void;
  toggleRecordPanel: () => void;
  toggleAlwaysOnTop: () => Promise<void>;
  quitApp: () => void;
  showBubble: (text: string, force?: boolean) => void;

  devSetVitals: (delta: Partial<PetState['vitals']>) => void;
  devSetExp: (exp: number) => void;
  devSetLevel: (level: number) => void;
  devSimulateMinutes: (minutes: number) => void;
  devRerollTasks: () => void;
  devCompleteTasks: () => void;
  devSetPersonality: (personality: Personality) => void;
  devForceRandomEvent: () => void;
  devForceLevelUpEffect: () => void;
  devResetSave: () => void;
  devForceDiscovery: () => void;
  devResolveDiscovery: () => void;
  devExpireDiscovery: () => void;
  devForceSignal: () => void;
  devForceTinyPlay: () => void;
  devEndTinyPlay: () => void;
  devResetSignals: () => void;
};

let tempStateTimer: ReturnType<typeof setTimeout> | null = null;
let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let bubbleSeq = 0;
let lastResumeReactionAt = 0;

function scheduleSave(pet: PetState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void window.kadomoco?.writePet(pet, CURRENT_SAVE_VERSION);
  }, 400);
}

export const usePetStore = create<PetStore>((set, get) => {
  const showTempState = (state: TempMachineState, effect: CharacterEffect, durationMs?: number) => {
    if (tempStateTimer) clearTimeout(tempStateTimer);
    set({ tempState: { state, effect } });
    tempStateTimer = setTimeout(() => {
      set({ tempState: null });
    }, durationMs ?? TEMP_STATE_DURATION_MS[state]);
  };

  const playRandomEvent = (event: RandomEventDef) => {
    if (isTempState(event.state)) {
      showTempState(event.state, event.effect ?? null, event.durationMs);
    } else if (event.effect) {
      // Non-temp target states (e.g. happy hop) still show as a short reaction.
      showTempState('reaction', event.effect, event.durationMs);
    }
    if (event.bubble) get().showBubble(event.bubble);
  };

  const reactToSignal = (pet: PetState, signalId: Parameters<typeof applySecretSignalReaction>[1], now: number) => {
    const result = applySecretSignalReaction(pet, signalId, now);
    applyPetUpdate(result.pet);
    if (result.tempState && isTempState(result.tempState)) showTempState(result.tempState, (result.effect as CharacterEffect) ?? 'gaze', 3_000);
    if (result.bubble) get().showBubble(result.bubble, true);
  };

  const recordSignal = (pet: PetState, input: Parameters<typeof recordSignalInput>[1]) => {
    const now = Date.now();
    const result = recordSignalInput(pet, input, now);
    if (result.triggered[0]) reactToSignal(result.pet, result.triggered[0], now);
    else applyPetUpdate(result.pet);
    return result.pet;
  };

  const applyPetUpdate = (
    pet: PetState,
    extras?: { leveledUp?: boolean; newLevel?: number },
  ) => {
    set({ pet });
    if (extras?.leveledUp) {
      showTempState('levelUp', null);
      get().showBubble(`Lv${extras.newLevel ?? pet.level}!`, true);
    }
    scheduleSave(pet);
  };

  const showDailyTaskBubble = (completedTaskIds: readonly DailyTaskId[]) => {
    const bubble = dailyTaskCompletionBubble(completedTaskIds);
    if (!bubble) return false;
    get().showBubble(bubble, true);
    return true;
  };

  return {
    loaded: false,
    pet: createInitialPetState(Date.now()),
    tempState: null,
    bubble: null,
    lastBubbleAt: 0,
    panelOpen: false,
    menuOpen: false,
    devPanelOpen: false,
    recordPanelOpen: false,
    alwaysOnTop: false,
    settings: { alwaysOnTop: false, volume: 50, statusDisplayMode: 'both', ambientFrequency: 'normal', bubbleFrequency: 'normal', reduceActivityWhenFullscreen: true },

    init: async () => {
      const now = Date.now();
      const raw = await window.kadomoco?.loadSave();
      const save = recoverSave(
        raw && typeof raw === 'object' && 'primary' in raw ? (raw as { primary?: unknown }).primary : raw,
        raw && typeof raw === 'object' && 'backup' in raw ? (raw as { backup?: unknown }).backup : null,
        now,
      ).save;
      const progressed = progressTime(save.pet, now, { online: false });
      set({
        loaded: true,
        pet: progressed.pet,
        alwaysOnTop: save.settings.alwaysOnTop,
        settings: save.settings,
      });
      scheduleSave(progressed.pet);
    },

    tick: () => {
      const now = Date.now();
      const { pet, showBubble, settings } = get();
      const result = progressTime(pet, now, { online: true });
      let next = result.pet;

      const hints = getLifeRhythmHints({
        now,
        vitals: next.vitals,
        personality: next.personality,
        currentAction: next.currentAction,
        activeTogetherTimeMs: next.careStats.activeTogetherTimeMs,
        lastCareAt: next.lastCareAt,
      });
      const event = maybeRollRandomEvent(now, next.lastRandomEventAt, {
        now,
        vitals: next.vitals,
        personality: next.personality,
        affection: next.vitals.affection,
        currentAction: next.currentAction,
        dayPeriod: hints.dayPeriod,
        season: hints.season,
        activeTogetherTimeMs: next.careStats.activeTogetherTimeMs,
        lastCareAt: next.lastCareAt,
        episodes: next.episodes,
        activeDiscovery: next.discovery.active,
      }, Math.random, AMBIENT_MULTIPLIER[settings.ambientFrequency]);
      const discoveryRoll = maybeRollDiscovery(next, now, { ambientFrequency: settings.ambientFrequency });
      next = discoveryRoll.pet;
      const tinyAdvanced = advanceTinyPlay(next, now);
      next = tinyAdvanced.pet;
      if (tinyAdvanced.ended && tinyAdvanced.effect) showTempState('reaction', tinyAdvanced.effect as CharacterEffect, 2_500);
      if (tinyAdvanced.ended && tinyAdvanced.bubble) showBubble(tinyAdvanced.bubble);
      if (!tinyAdvanced.ended) next = maybeStartTinyPlay(next, now, { ambientFrequency: settings.ambientFrequency }).pet;

      if (event) {
        next = { ...next, lastRandomEventAt: now };
        playRandomEvent(event);
      }

      applyPetUpdate(next, { leveledUp: result.leveledUp, newLevel: result.newLevel });
      if (!result.leveledUp && settings.bubbleFrequency === 'normal') showDailyTaskBubble(result.completedTaskIds);

      if (!event && Math.random() < AMBIENT_SPEECH_CHANCE_PER_MINUTE * BUBBLE_MULTIPLIER[settings.bubbleFrequency]) {
        const state = deriveBaseState(next.vitals, next.currentAction);
        const base = SPEECH_BY_STATE[state] ?? [];
        const extra = next.unlockedSpeechPackIds.includes('extra') ? SPEECH_PACK_EXTRA : [];
        const pool = [...base, ...extra, ...hints.speechCandidates];
        if (pool.length > 0) {
          showBubble(pool[Math.floor(Math.random() * pool.length)]);
        }
      }
    },

    catchUpOffline: (fromResume = false) => {
      const now = Date.now();
      const result = progressTime(get().pet, now, { online: false });
      applyPetUpdate(result.pet, { leveledUp: result.leveledUp, newLevel: result.newLevel });
      if (!result.leveledUp) showDailyTaskBubble(result.completedTaskIds);
      recordSignal(result.pet, { input: 'click', at: now, detail: 'resume' });
      if (fromResume && now - lastResumeReactionAt >= RESUME_REACTION_MIN_GAP_MS) {
        lastResumeReactionAt = now;
        showTempState('curious', 'gaze', 3_000);
        get().showBubble(RESUME_BUBBLES[Math.floor(Math.random() * RESUME_BUBBLES.length)], true);
      }
    },

    performAction: (action) => {
      const now = Date.now();
      recordSignal(get().pet, { input: 'care_action', at: now, detail: action });
      const result = performCareAction(get().pet, action, now);
      if (!result.ok) {
        if (result.tempState && isTempState(result.tempState)) {
          showTempState(result.tempState, 'wiggle');
        }
        if (result.bubble) get().showBubble(result.bubble, true);
        return;
      }
      applyPetUpdate(result.pet, {
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
      });
      if (!result.leveledUp && result.tempState && isTempState(result.tempState)) {
        const effect: CharacterEffect = result.tempState === 'playing' ? 'hop' : 'wiggle';
        showTempState(result.tempState, effect);
      }
      const showedDailyTaskBubble = !result.leveledUp && showDailyTaskBubble(result.completedTaskIds);
      if (!showedDailyTaskBubble && result.bubble) {
        get().showBubble(result.bubble);
      }
      set({ menuOpen: false });
    },


    performContextAction: (action) => {
      const now = Date.now();
      const tiny = interactWithTinyPlay(get().pet, now);
      if (tiny.bubble) { applyPetUpdate(tiny.pet); if (tiny.tempState && isTempState(tiny.tempState)) showTempState(tiny.tempState, 'hop'); get().showBubble(tiny.bubble, true); set({ menuOpen: false }); return; }
      recordSignal(get().pet, { input: 'context_action', at: now, detail: action });
      const result = performContextCareAction(get().pet, action, now);
      if (!result.ok) {
        if (result.tempState && isTempState(result.tempState)) showTempState(result.tempState, 'wiggle');
        if (result.bubble) get().showBubble(result.bubble, true);
        return;
      }
      applyPetUpdate(result.pet, { leveledUp: result.leveledUp, newLevel: result.newLevel });
      if (!result.leveledUp && result.tempState && isTempState(result.tempState)) showTempState(result.tempState, 'gaze');
      if (result.bubble) get().showBubble(result.bubble, true);
      set({ menuOpen: false });
    },

    updateSettings: async (partial) => {
      const next = { ...get().settings, ...partial };
      const saved = (await window.kadomoco?.setSettings?.(partial)) ?? next;
      const merged = { ...next, ...saved } as SaveSettings;
      set({ settings: merged, alwaysOnTop: merged.alwaysOnTop });
    },

    clickReaction: () => {
      const { pet, showBubble } = get();
      const unlocked = CLICK_REACTIONS.filter((r) => pet.unlockedReactionIds.includes(r.id));
      const pool = unlocked.length > 0 ? unlocked : CLICK_REACTIONS.slice(0, 1);
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      showTempState('reaction', reaction.effect, REACTION_DURATION_MS);
      if (reaction.bubble) showBubble(reaction.bubble);
      recordSignal(get().pet, { input: 'click', at: Date.now() });
    },

    togglePanel: () => { const now = Date.now(); recordSignal(get().pet, { input: 'panel_open', at: now }); set((s) => ({ panelOpen: !s.panelOpen, menuOpen: false, recordPanelOpen: false })); },
    setMenuOpen: (open) => { if (open) recordSignal(get().pet, { input: 'menu_open', at: Date.now() }); set({ menuOpen: open }); },
    toggleDevPanel: () => set((s) => ({ devPanelOpen: !s.devPanelOpen })),
    toggleRecordPanel: () => set((s) => ({ recordPanelOpen: !s.recordPanelOpen, menuOpen: false, panelOpen: false })),

    toggleAlwaysOnTop: async () => {
      const target = !get().alwaysOnTop;
      const applied = (await window.kadomoco?.setAlwaysOnTop(target)) ?? target;
      const settings = { ...get().settings, alwaysOnTop: applied };
      set({ alwaysOnTop: applied, settings });
    },

    quitApp: () => {
      if (saveTimer) clearTimeout(saveTimer);
      void window.kadomoco?.writePet(get().pet, CURRENT_SAVE_VERSION);
      window.kadomoco?.quitApp();
    },

    showBubble: (text, force = false) => {
      const now = Date.now();
      const { lastBubbleAt, bubble, settings } = get();
      if (!force && settings.bubbleFrequency === 'off') return;
      if (!force && (bubble !== null || now - lastBubbleAt < SPEECH_MIN_INTERVAL_MS)) return;
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleSeq += 1;
      set({ bubble: { id: bubbleSeq, text }, lastBubbleAt: now });
      bubbleTimer = setTimeout(() => set({ bubble: null }), SPEECH_DISPLAY_MS);
    },

    devSetVitals: (delta) => {
      const pet = get().pet;
      const vitals = { ...pet.vitals };
      for (const key of ['hunger', 'mood', 'sleepiness', 'affection'] as const) {
        const value = delta[key];
        if (value !== undefined) {
          vitals[key] = Math.min(BALANCE.vitals.max, Math.max(BALANCE.vitals.min, value));
        }
      }
      applyPetUpdate({ ...pet, vitals });
    },

    devSetExp: (exp) => {
      const pet = get().pet;
      applyPetUpdate({ ...pet, exp: Math.max(0, Math.round(exp)) });
    },

    devSetLevel: (level) => {
      const pet = get().pet;
      const lv = Math.min(5, Math.max(1, Math.round(level)));
      const exp = BALANCE.levelRequirements[lv as keyof typeof BALANCE.levelRequirements];
      applyPetUpdate({ ...pet, level: lv, exp });
    },

    devSimulateMinutes: (minutes) => {
      const now = Date.now();
      const pet = get().pet;
      const shifted = { ...pet, lastUpdatedAt: pet.lastUpdatedAt - minutes * 60_000 };
      const result = progressTime(shifted, now, { online: false });
      applyPetUpdate(result.pet, { leveledUp: result.leveledUp, newLevel: result.newLevel });
      if (!result.leveledUp) showDailyTaskBubble(result.completedTaskIds);
    },

    devRerollTasks: () => {
      const pet = get().pet;
      const fresh = createInitialPetState(Date.now());
      applyPetUpdate({ ...pet, dailyTasks: fresh.dailyTasks });
    },

    devCompleteTasks: () => {
      const pet = get().pet;
      applyPetUpdate({
        ...pet,
        dailyTasks: {
          ...pet.dailyTasks,
          tasks: pet.dailyTasks.tasks.map((t) => ({ ...t, completed: true })),
        },
      });
    },

    devSetPersonality: (personality) => {
      applyPetUpdate({ ...get().pet, personality });
    },

    devForceRandomEvent: () => {
      playRandomEvent(pickRandomEvent());
    },

    devForceLevelUpEffect: () => {
      showTempState('levelUp', null);
      get().showBubble(`Lv${get().pet.level}!`, true);
    },

    devResetSave: () => {
      const fresh = createInitialPetState(Date.now());
      applyPetUpdate(fresh);
    },

    devForceDiscovery: () => {
      const result = maybeRollDiscovery(get().pet, Date.now(), { force: true, rng: () => 0 });
      applyPetUpdate(result.pet);
    },

    devResolveDiscovery: () => {
      const active = get().pet.discovery.active;
      if (!active) return;
      const result = resolveDiscovery(get().pet, active.id, Date.now());
      applyPetUpdate(result.pet);
      get().showBubble('いい感じ', true);
    },

    devExpireDiscovery: () => {
      const pet = get().pet;
      applyPetUpdate({ ...pet, discovery: { ...pet.discovery, active: null, lastRolledAt: Date.now() } });
    },

    devForceSignal: () => reactToSignal(get().pet, 'tap_tap_pause', Date.now()),
    devForceTinyPlay: () => applyPetUpdate(maybeStartTinyPlay(get().pet, Date.now(), { force: true, rng: () => 0 }).pet),
    devEndTinyPlay: () => { const pet = get().pet; applyPetUpdate({ ...pet, tinyPlay: { ...pet.tinyPlay, active: null } }); },
    devResetSignals: () => applyPetUpdate({ ...get().pet, signals: createEmptySignalState(Date.now()), tinyPlay: createEmptyTinyPlayState(Date.now()) }),
  };
});

/** The machine state currently displayed (temporary state wins). */
export function selectMachineState(store: PetStore): PetMachineState {
  if (store.tempState) return store.tempState.state;
  return deriveBaseState(store.pet.vitals, store.pet.currentAction);
}

export function selectEffect(store: PetStore): CharacterEffect {
  return store.tempState?.effect ?? null;
}
