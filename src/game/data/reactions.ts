import type { ClickReactionDef } from '../types';

export const CLICK_REACTIONS: readonly ClickReactionDef[] = [
  { id: 'wiggle', effect: 'wiggle' },
  { id: 'hop', effect: 'hop', bubble: '……！' },
  { id: 'spin', effect: 'spin', bubble: '？' },
] as const;

/** Reactions available from the start. */
export const DEFAULT_REACTION_IDS: readonly string[] = ['wiggle'];

export const REACTION_DURATION_MS = 1_500;
