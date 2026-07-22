/**
 * Public Zustand entry point.
 *
 * Runtime composition and actions live in createPetStore so this stable module
 * remains the compatibility boundary used by React and the E2E bridge.
 */
export {
  usePetStore,
  selectMachineState,
  selectEffect,
  type CharacterEffect,
  type PetStore,
} from './createPetStore';
