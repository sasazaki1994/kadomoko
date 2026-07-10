import assert from 'node:assert/strict';
import test from 'node:test';
import { performCareAction } from '../src/game/actions';
import { BALANCE } from '../src/game/data/balance';
import { rollDailyTasks } from '../src/game/dailyTasks';
import { gainExp, LEVEL_REQUIREMENTS } from '../src/game/level';
import { computeTendency, EMPTY_CARE_STATS, resolvePersonality } from '../src/game/personality';
import { CURRENT_SAVE_VERSION, createInitialPetState, recoverSave, sanitizeSave } from '../src/game/saveData';
import { deriveBaseState } from '../src/game/stateMachine';
import { progressTime } from '../src/game/timeProgress';
import type { CareStats, PetState } from '../src/game/types';
import { applyVitalDelta, clampVital } from '../src/game/vitals';

const NOW = new Date('2026-07-09T09:00:00Z').getTime();

function pet(overrides: Partial<PetState> = {}): PetState {
  const base = createInitialPetState(NOW);
  return { ...base, ...overrides };
}

function petWithoutDailyTasks(overrides: Partial<PetState> = {}): PetState {
  const base = pet(overrides);
  return { ...base, dailyTasks: { ...base.dailyTasks, tasks: [] } };
}

test('vitals are clamped and initial values match the v0.1 spec', () => {
  assert.equal(clampVital(-20), 0);
  assert.equal(clampVital(120), 100);
  assert.deepEqual(createInitialPetState(NOW).vitals, {
    hunger: 70,
    mood: 70,
    sleepiness: 20,
    affection: 10,
  });
  assert.deepEqual(
    applyVitalDelta(createInitialPetState(NOW).vitals, {
      hunger: 100,
      mood: -100,
      sleepiness: 90,
      affection: -30,
    }),
    { hunger: 100, mood: 0, sleepiness: 100, affection: 0 },
  );
});

test('base machine state follows priority and thresholds', () => {
  assert.equal(deriveBaseState({ hunger: 9, mood: 70, sleepiness: 20, affection: 10 }, 'none'), 'hungry');
  assert.equal(deriveBaseState({ hunger: 70, mood: 14, sleepiness: 20, affection: 10 }, 'none'), 'sulking');
  assert.equal(deriveBaseState({ hunger: 70, mood: 70, sleepiness: 80, affection: 10 }, 'none'), 'sleepy');
  assert.equal(deriveBaseState({ hunger: 70, mood: 80, sleepiness: 20, affection: 10 }, 'none'), 'happy');
  assert.equal(deriveBaseState({ hunger: 1, mood: 1, sleepiness: 20, affection: 10 }, 'sleeping'), 'sleeping');
});

test('care actions update vitals, exp, cooldowns, and blocked play conditions', () => {
  const base = petWithoutDailyTasks();
  const fed = performCareAction(base, 'feed', NOW + 20_000);
  assert.equal(fed.ok, true);
  assert.equal(fed.pet.vitals.hunger, 100);
  assert.equal(fed.pet.vitals.mood, 75);
  assert.equal(fed.pet.vitals.affection, 11);
  assert.equal(fed.pet.exp, 5);

  const overfull = performCareAction(petWithoutDailyTasks({ vitals: { ...base.vitals, hunger: 95 } }), 'feed', NOW + 20_000);
  assert.equal(overfull.pet.vitals.hunger, 100);
  assert.equal(overfull.pet.vitals.mood, 68);
  assert.equal(overfull.pet.exp, 0);

  const tooSleepy = performCareAction(petWithoutDailyTasks({ vitals: { ...base.vitals, sleepiness: 85 } }), 'play', NOW + 20_000);
  assert.equal(tooSleepy.ok, false);
  assert.equal(tooSleepy.blockReason, 'tooSleepy');
  assert.equal(tooSleepy.bubble, 'ちょっと眠い');

  const tooHungry = performCareAction(petWithoutDailyTasks({ vitals: { ...base.vitals, hunger: 9 } }), 'play', NOW + 20_000);
  assert.equal(tooHungry.ok, false);
  assert.equal(tooHungry.blockReason, 'tooHungry');
  assert.equal(tooHungry.bubble, 'おなかすいた');

  const firstTouch = performCareAction(base, 'touch', NOW + 20_000);
  const cooldown = performCareAction(firstTouch.pet, 'touch', NOW + 29_999);
  assert.equal(cooldown.ok, false);
  assert.equal(cooldown.blockReason, 'cooldown');
  assert.equal(cooldown.bubble, 'ちょっと待って');
  assert.deepEqual(cooldown.pet.vitals, firstTouch.pet.vitals);
});

test('resting chooses resting or sleeping depending on sleepiness', () => {
  const rested = performCareAction(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 19, affection: 10 } }), 'rest', NOW + 20_000);
  assert.equal(rested.tempState, 'resting');
  assert.equal(rested.pet.currentAction, 'none');

  const slept = performCareAction(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 } }), 'rest', NOW + 20_000);
  assert.equal(slept.pet.currentAction, 'sleeping');
});

test('offline progression is capped at 12 hours', () => {
  const start = pet({ lastUpdatedAt: NOW, pendingDecayMs: 0 });
  const oneDayLater = NOW + 24 * 60 * 60_000;
  const progressed = progressTime(start, oneDayLater, { online: false }).pet;
  const expectedChunks = BALANCE.time.maxOfflineProgressMs / BALANCE.time.tenMinutesMs;
  assert.equal(progressed.vitals.hunger, Math.max(0, 70 + expectedChunks * BALANCE.decay.hungerPer10Min));
  assert.equal(progressed.lastUpdatedAt, oneDayLater);
});

test('level requirements and exp gains follow the v0.1 balance', () => {
  assert.deepEqual(LEVEL_REQUIREMENTS, { 1: 0, 2: 50, 3: 120, 4: 220, 5: 350 });
  assert.deepEqual(gainExp(45, 1, 5), { exp: 50, level: 2, leveledUp: true });
  assert.deepEqual(gainExp(120, 3, -200), { exp: 0, level: 1, leveledUp: false });
});

test('daily tasks roll deterministic unique task sets', () => {
  const tasks = rollDailyTasks('2026-07-09', () => 0).tasks;
  assert.equal(tasks.length, 3);
  assert.equal(new Set(tasks.map((task) => task.id)).size, 3);
  assert.equal(tasks.every((task) => task.completed === false), true);
});

test('personality tendency and repeated tendency resolution are stable', () => {
  const sweetStats: CareStats = { ...EMPTY_CARE_STATS, touchCount: 4, feedCount: 1 };
  assert.equal(computeTendency(sweetStats, 70), 'sweet');
  assert.equal(
    resolvePersonality('normal', [
      { date: '2026-07-08', tendency: 'sweet' },
      { date: '2026-07-09', tendency: 'sweet' },
    ]),
    'sweet',
  );
});


test('corrupted save payloads are sanitized without throwing', () => {
  const save = sanitizeSave(
    {
      version: CURRENT_SAVE_VERSION,
      pet: {
        vitals: { hunger: 999, mood: -20, sleepiness: 'bad', affection: 42.4 },
        exp: -10,
        level: 99,
        currentAction: 'invalid',
        dailyTasks: { date: '2026-07-09', tasks: [{ id: 'feed_once', completed: 'yes' }] },
        lastActionAt: { feed: NOW, play: 'bad' },
      },
      settings: { alwaysOnTop: true, volume: 999 },
      lastLaunchedAt: 'bad',
    },
    NOW,
  );

  assert.deepEqual(save.pet.vitals, { hunger: 100, mood: 0, sleepiness: 20, affection: 42 });
  assert.equal(save.pet.exp, 0);
  assert.equal(save.pet.level, 5);
  assert.equal(save.pet.currentAction, 'none');
  assert.deepEqual(save.pet.lastActionAt, { feed: NOW });
  assert.equal(save.settings.alwaysOnTop, true);
  assert.equal(save.settings.volume, 100);
  assert.equal(save.lastLaunchedAt, NOW);
});

test('recoverSave prefers a valid backup over a corrupted primary', () => {
  const backup = sanitizeSave(
    {
      version: CURRENT_SAVE_VERSION,
      pet: { ...createInitialPetState(NOW), vitals: { hunger: 33, mood: 44, sleepiness: 55, affection: 66 } },
      settings: { alwaysOnTop: true, volume: 25 },
      lastLaunchedAt: NOW - 1_000,
    },
    NOW,
  );
  const recovered = recoverSave({ version: 999, pet: null }, backup, NOW);
  assert.equal(recovered.source, 'backup');
  assert.deepEqual(recovered.save.pet.vitals, { hunger: 33, mood: 44, sleepiness: 55, affection: 66 });
  assert.equal(recovered.save.settings.alwaysOnTop, true);
});

test('recoverSave creates initial data only when primary and backup cannot be used', () => {
  const recovered = recoverSave({ version: 999, pet: null }, { version: 999, pet: null }, NOW);
  assert.equal(recovered.source, 'initial');
  assert.deepEqual(recovered.save.pet.vitals, createInitialPetState(NOW).vitals);
});
