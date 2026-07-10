import assert from 'node:assert/strict';
import test from 'node:test';
import { performCareAction } from '../src/game/actions';
import { buildDailySummary } from '../src/game/dailySummary';
import { BALANCE } from '../src/game/data/balance';
import { getDayPeriod, getLifeRhythmHints } from '../src/game/lifeRhythm';
import { getRandomEventWeight, pickWeightedRandomEvent, type RandomEventContext } from '../src/game/randomEvents';
import { dailyTaskCompletionBubble, getDailyTaskProgress, rollDailyTasks } from '../src/game/dailyTasks';
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

test('daily task progress helpers report capped whole-minute progress', () => {
  const dailyTasks = {
    date: '2026-07-09',
    tasks: [],
    togetherMsToday: 12 * 60_000 + 59_000,
    goodMoodStreakMs: 6 * 60_000 + 30_000,
  };

  assert.deepEqual(getDailyTaskProgress(dailyTasks, 'together_30min'), {
    current: 12,
    target: 30,
    unit: 'min',
  });
  assert.deepEqual(getDailyTaskProgress(dailyTasks, 'good_mood_15min'), {
    current: 6,
    target: 15,
    unit: 'min',
  });
  assert.deepEqual(
    getDailyTaskProgress({ ...dailyTasks, togetherMsToday: 45 * 60_000 }, 'together_30min'),
    { current: 30, target: 30, unit: 'min' },
  );
  assert.equal(getDailyTaskProgress(dailyTasks, 'feed_once'), null);
});

test('daily task completion bubble helper stays quiet without completed tasks', () => {
  assert.equal(dailyTaskCompletionBubble([]), undefined);
  const bubble = dailyTaskCompletionBubble(['feed_once']);
  assert.equal(typeof bubble, 'string');
  assert.ok((bubble ?? '').length > 0);
  assert.ok((bubble ?? '').length <= 8);
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

test('life rhythm returns local day periods and quiet hints', () => {
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 5, 0)), 'morning');
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 10, 59)), 'morning');
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 11, 0)), 'daytime');
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 17, 0)), 'evening');
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 21, 0)), 'night');
  assert.equal(getDayPeriod(new Date(2026, 6, 9, 4, 59)), 'lateNight');

  const base = pet({ vitals: { hunger: 70, mood: 70, sleepiness: 85, affection: 10 } });
  const late = getLifeRhythmHints({
    now: new Date(2026, 6, 9, 1, 0).getTime(),
    vitals: base.vitals,
    personality: base.personality,
    currentAction: base.currentAction,
    activeTogetherTimeMs: base.careStats.activeTogetherTimeMs,
    lastCareAt: base.lastCareAt,
  });
  assert.ok(late.preferredEventTags.includes('sleepy'));
  assert.ok(late.preferredEventTags.includes('sleeping'));

  const morning = getLifeRhythmHints({
    now: new Date(2026, 6, 9, 7, 0).getTime(),
    vitals: base.vitals,
    personality: base.personality,
    currentAction: 'none',
    activeTogetherTimeMs: base.careStats.activeTogetherTimeMs,
    lastCareAt: base.lastCareAt,
  });
  assert.ok(morning.preferredEventTags.includes('stretch'));
  assert.ok(morning.preferredEventTags.includes('curious'));
});

test('random event weights follow personality and vitals without crashing on empty pools', () => {
  const base: RandomEventContext = {
    now: NOW,
    vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 },
    personality: 'normal',
    affection: 10,
    currentAction: 'none',
    dayPeriod: 'daytime',
    activeTogetherTimeMs: 0,
    lastCareAt: NOW,
  };
  const hop = { id: 'x-hop', state: 'happy', effect: 'hop', durationMs: 1, tags: ['playing', 'hop', 'happy'], baseWeight: 1 } as const;
  const calm = { id: 'x-calm', state: 'idle', durationMs: 1, tags: ['calm', 'idle'], baseWeight: 1 } as const;
  const hungry = { id: 'x-hungry', state: 'hungry', durationMs: 1, tags: ['hungry'], baseWeight: 1 } as const;
  const sleepy = { id: 'x-sleepy', state: 'sleepy', durationMs: 1, tags: ['sleepy'], baseWeight: 1 } as const;

  assert.ok(getRandomEventWeight(hop, { ...base, personality: 'energetic' }) > getRandomEventWeight(calm, { ...base, personality: 'energetic' }));
  assert.ok(getRandomEventWeight(calm, { ...base, personality: 'calm' }) > getRandomEventWeight(hop, { ...base, personality: 'calm' }));
  assert.ok(getRandomEventWeight(hungry, { ...base, vitals: { ...base.vitals, hunger: 10 } }) > getRandomEventWeight(hungry, base));
  assert.ok(getRandomEventWeight(sleepy, { ...base, vitals: { ...base.vitals, sleepiness: 90 } }) > getRandomEventWeight(sleepy, base));
  assert.equal(pickWeightedRandomEvent(base, () => 0.5, []), null);
});

test('daily summary is short, never empty, and avoids blaming language', () => {
  const summary = buildDailySummary(pet({
    vitals: { hunger: 10, mood: 85, sleepiness: 90, affection: 10 },
    careStats: { ...EMPTY_CARE_STATS, activeTogetherTimeMs: 3 * 60 * 60_000 },
  }), NOW);
  assert.ok(summary.length >= 1);
  assert.ok(summary.length <= 3);
  assert.ok(summary.includes('少し眠そう'));
  assert.ok(summary.includes('おなかが空いていそう'));
  assert.equal(summary.some((line) => /遅い|さみしかった|なんで|放置/.test(line)), false);
});

test('journal entries are created on day rollover and capped at 30', () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    careCounts: { feed: 0, touch: 0, play: 0, rest: 0 },
    finalVitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 },
    personality: 'normal' as const,
    completedTaskCount: 0,
    note: 'ゆっくり過ごした',
  }));
  const start = pet({
    dailyTasks: { date: '2026-07-08', tasks: [{ id: 'feed_once', completed: true }], togetherMsToday: 0, goodMoodStreakMs: 0 },
    journalEntries: entries,
    lastUpdatedAt: new Date('2026-07-08T23:50:00').getTime(),
  });
  const progressed = progressTime(start, new Date('2026-07-09T00:10:00').getTime(), { online: true }).pet;
  assert.equal(progressed.journalEntries.length, 30);
  assert.equal(progressed.journalEntries.at(-1)?.date, '2026-07-08');
  assert.equal(progressed.journalEntries.at(-1)?.completedTaskCount, 1);
});

test('v1 saves migrate to v2 and invalid journal entries are dropped', () => {
  const v1 = {
    version: 1,
    pet: { ...createInitialPetState(NOW), journalEntries: [{ bad: true }] },
    settings: { alwaysOnTop: false, volume: 50 },
    lastLaunchedAt: NOW,
  };
  const migrated = sanitizeSave(v1, NOW);
  assert.equal(migrated.version, CURRENT_SAVE_VERSION);
  assert.deepEqual(migrated.pet.journalEntries, []);

  const current = sanitizeSave({
    ...v1,
    version: CURRENT_SAVE_VERSION,
    pet: {
      ...v1.pet,
      journalEntries: [
        { bad: true },
        { date: '2026-07-08', careCounts: { feed: 1, touch: 2, play: 3, rest: 4 }, finalVitals: { hunger: 1, mood: 2, sleepiness: 3, affection: 4 }, personality: 'calm', completedTaskCount: 2, note: 'よく一緒にいる' },
      ],
    },
  }, NOW);
  assert.equal(current.pet.journalEntries.length, 1);
  assert.equal(current.pet.journalEntries[0].personality, 'calm');
});
