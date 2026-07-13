import spriteSheetSpec from './spriteSheetSpec.json';
import type { PetMachineState } from './types';

export const PET_SPRITE_SHEET = {
  ...spriteSheetSpec,
  states: ['normal', 'happy', 'hungry', 'sleepy', 'sleeping', 'sulking', 'playing', 'curious'] as const,
  animationMs: {
    normal: 980,
    happy: 720,
    hungry: 1100,
    sleepy: 1350,
    sleeping: 1800,
    sulking: 1250,
    playing: 620,
    curious: 900,
  },
} as const;

export type SpriteSheetState = (typeof PET_SPRITE_SHEET.states)[number];

export function spriteStateForMachineState(state: PetMachineState): SpriteSheetState {
  switch (state) {
    case 'idle':
      return 'normal';
    case 'happy':
    case 'reaction':
    case 'levelUp':
      return 'happy';
    case 'hungry':
      return 'hungry';
    case 'sleepy':
    case 'resting':
      return 'sleepy';
    case 'sleeping':
      return 'sleeping';
    case 'sulking':
      return 'sulking';
    case 'playing':
      return 'playing';
    case 'curious':
      return 'curious';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function spriteRowForState(state: SpriteSheetState): number {
  return PET_SPRITE_SHEET.states.indexOf(state);
}
