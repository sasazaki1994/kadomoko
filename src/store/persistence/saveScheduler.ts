import type { PetState } from '../../game/types';
import { CURRENT_SAVE_VERSION } from '../../game/saveData';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** The sole debounced persistence owner for ordinary pet-state updates. */
export function schedulePetSave(pet: PetState, delayMs = 400): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void window.kadomoco?.writePet(pet, CURRENT_SAVE_VERSION).catch(() => undefined);
  }, delayMs);
}

export function cancelScheduledPetSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
}
