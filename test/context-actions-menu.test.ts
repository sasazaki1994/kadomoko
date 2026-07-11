import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvailableContextActions } from '../src/game/contextActions';
import { createInitialPetState } from '../src/game/saveData';
import type { PetState } from '../src/game/types';

const NOW = new Date('2026-07-09T09:00:00Z').getTime();

function pet(overrides: Partial<PetState> = {}): PetState {
  const base = createInitialPetState(NOW);
  return { ...base, ...overrides };
}

test('context actions expose multiple prioritized choices for the menu', () => {
  const base = pet({
    vitals: { hunger: 20, mood: 10, sleepiness: 85, affection: 55 },
    personality: 'sweet',
    unlockedPropIds: ['old_note', 'small_cloth'],
  });

  assert.deepEqual(
    getAvailableContextActions(base, NOW).map((action) => action.id),
    ['give_space', 'wait_gently', 'small_bite'],
  );
  assert.deepEqual(
    getAvailableContextActions(base, NOW, 5).map((action) => action.id),
    ['give_space', 'wait_gently', 'small_bite', 'look_together', 'stay_together'],
  );
  assert.deepEqual(
    getAvailableContextActions(
      { ...base, lastContextActionAt: { give_space: NOW - 1_000, wait_gently: NOW - 1_000 } },
      NOW,
    ).map((action) => action.id),
    ['small_bite', 'look_together', 'stay_together'],
  );
  assert.deepEqual(getAvailableContextActions(base, NOW, 0), []);
});
