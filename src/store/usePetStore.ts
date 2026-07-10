import { create } from 'zustand';
import { performCareAction } from '../game/actions';
import { BALANCE } from '../game/data/balance';
import { CLICK_REACTIONS, REACTION_DURATION_MS } from '../game/data/reactions';
import {
  SPEECH_BY_STATE,
  SPEECH_DISPLAY_MS,
  SPEECH_MIN_INTERVAL_MS,
  SPEECH_PACK_EXTRA,
} from '../game/data/speechMessages';
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
  DailyTaskId,
  PetMachineState,
  PetState,
  Personality,
  RandomEventDef,
} from '../game/types';

const AMBIENT_SPEECH_CHANCE_PER_MINUTE = 0.08;
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
  alwaysOnTop: boolean;

  init: () => Promise<void>;
  tick: () => void;
  catchUpOffline: (fromResume?: boolean) => void;
  performAction: (action: CareActionId) => void;
  clickReaction: () => void;
  togglePanel: () => void;
  setMenuOpen: (open: boolean) => void;
  toggleDevPanel: () => void;
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
    alwaysOnTop: false,

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
      });
      scheduleSave(progressed.pet);
    },

    tick: () => {
      const now = Date.now();
      const { pet, showBubble } = get();
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
        activeTogetherTimeMs: next.careStats.activeTogetherTimeMs,
        lastCareAt: next.lastCareAt,
      });
      if (event) {
        next = { ...next, lastRandomEventAt: now };
        playRandomEvent(event);
      }

      applyPetUpdate(next, { leveledUp: result.leveledUp, newLevel: result.newLevel });
      if (!result.leveledUp) showDailyTaskBubble(result.completedTaskIds);

      if (!event && Math.random() < AMBIENT_SPEECH_CHANCE_PER_MINUTE) {
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
      if (fromResume && now - lastResumeReactionAt >= RESUME_REACTION_MIN_GAP_MS) {
        lastResumeReactionAt = now;
        showTempState('curious', 'gaze', 3_000);
        get().showBubble(RESUME_BUBBLES[Math.floor(Math.random() * RESUME_BUBBLES.length)], true);
      }
    },

    performAction: (action) => {
      const now = Date.now();
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

    clickReaction: () => {
      const { pet, showBubble } = get();
      const unlocked = CLICK_REACTIONS.filter((r) => pet.unlockedReactionIds.includes(r.id));
      const pool = unlocked.length > 0 ? unlocked : CLICK_REACTIONS.slice(0, 1);
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      showTempState('reaction', reaction.effect, REACTION_DURATION_MS);
      if (reaction.bubble) showBubble(reaction.bubble);
    },

    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen, menuOpen: false })),
    setMenuOpen: (open) => set({ menuOpen: open }),
    toggleDevPanel: () => set((s) => ({ devPanelOpen: !s.devPanelOpen })),

    toggleAlwaysOnTop: async () => {
      const target = !get().alwaysOnTop;
      const applied = (await window.kadomoco?.setAlwaysOnTop(target)) ?? target;
      set({ alwaysOnTop: applied });
    },

    quitApp: () => {
      if (saveTimer) clearTimeout(saveTimer);
      void window.kadomoco?.writePet(get().pet, CURRENT_SAVE_VERSION);
      window.kadomoco?.quitApp();
    },

    showBubble: (text, force = false) => {
      const now = Date.now();
      const { lastBubbleAt, bubble } = get();
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
