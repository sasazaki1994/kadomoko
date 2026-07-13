import type { PetMachineState } from './types';

export const PET_SPRITE_SHEET = {
  path: 'src/assets/pet/pixel/kadomoco_sheet.png',
  width: 256,
  height: 512,
  columns: 4,
  rows: 8,
  frameWidth: 64,
  frameHeight: 64,
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
