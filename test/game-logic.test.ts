import assert from 'node:assert/strict';
import test from 'node:test';
import { episodeFromDiscovery, maybeRollDiscovery, resolveDiscovery, sanitizeDiscoveryState } from '../src/game/discoveries';
import { DISCOVERY_BY_ID } from '../src/game/data/discoveries';
import { appendEpisodeEntries, createEpisodeCandidates, sanitizeEpisodeEntries } from '../src/game/episodes';
import { buildRelationshipNote } from '../src/game/relationship';
import { appendWeeklyReflection, createWeeklyReflection } from '../src/game/weeklyReflection';
import { performCareAction } from '../src/game/actions';
import { getAvailableContextAction, performContextAction } from '../src/game/contextActions';
import { buildDailySummary } from '../src/game/dailySummary';
import { BALANCE } from '../src/game/data/balance';
import { getDayPeriod, getLifeRhythmHints, getSeason } from '../src/game/lifeRhythm';
import { describeVitals } from '../src/game/observation';
import { getRandomEventWeight, pickWeightedRandomEvent, type RandomEventContext } from '../src/game/randomEvents';
import { dailyTaskCompletionBubble, getDailyTaskProgress, localDateString, rollDailyTasks } from '../src/game/dailyTasks';
import { createEmptyDreamState, forceSurfaceDream, listenToDream, pickDreamTheme, progressDreams, sanitizeDreamState, MAX_DREAM_FRAGMENTS } from '../src/game/dreams';
import { DREAM_THEME_BY_ID, DREAM_THEME_IDS } from '../src/game/data/dreams';
import { applySecretSignalReaction, createEmptySignalState, detectSecretSignals, recordSignalInput, sanitizeSignalState } from '../src/game/signals';
import { advanceTinyPlay, createEmptyTinyPlayState, maybeStartTinyPlay, sanitizeTinyPlayState } from '../src/game/tinyPlays';
import { gainExp, LEVEL_REQUIREMENTS } from '../src/game/level';
import { computeTendency, EMPTY_CARE_STATS, resolvePersonality } from '../src/game/personality';
import { CURRENT_SAVE_VERSION, createInitialPetState, recoverSave, sanitizeSave } from '../src/game/saveData';
import { deriveBaseState } from '../src/game/stateMachine';
import { progressTime } from '../src/game/timeProgress';
import type { CareStats, EpisodeId, PetState } from '../src/game/types';
import { applyVitalDelta, clampVital } from '../src/game/vitals';
import {
  completeQuietMoment,
  createEmptyQuietMomentState,
  getQuietMomentRewardStatus,
  QUIET_MOMENT_COOLDOWN_MS,
  sanitizeQuietMomentState,
} from '../src/game/quietMoments';

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

test('seasons follow local months and color rhythm hints', () => {
  assert.equal(getSeason(new Date(2026, 2, 1)), 'spring');
  assert.equal(getSeason(new Date(2026, 4, 31)), 'spring');
  assert.equal(getSeason(new Date(2026, 5, 1)), 'summer');
  assert.equal(getSeason(new Date(2026, 8, 1)), 'autumn');
  assert.equal(getSeason(new Date(2026, 11, 1)), 'winter');
  assert.equal(getSeason(new Date(2026, 1, 28)), 'winter');

  const base = pet();
  const winter = getLifeRhythmHints({
    now: new Date(2026, 0, 10, 13, 0).getTime(),
    vitals: base.vitals,
    personality: base.personality,
    currentAction: base.currentAction,
    activeTogetherTimeMs: base.careStats.activeTogetherTimeMs,
    lastCareAt: base.lastCareAt,
  });
  assert.equal(winter.season, 'winter');
  assert.ok(winter.preferredEventTags.includes('sleepy'));
  assert.ok(winter.speechCandidates.includes('ぬくぬくしたい'));

  const summer = getLifeRhythmHints({
    now: new Date(2026, 6, 10, 13, 0).getTime(),
    vitals: base.vitals,
    personality: base.personality,
    currentAction: base.currentAction,
    activeTogetherTimeMs: base.careStats.activeTogetherTimeMs,
    lastCareAt: base.lastCareAt,
  });
  assert.equal(summer.season, 'summer');
  assert.ok(summer.preferredEventTags.includes('playing'));
});

test('seasonal tags gently boost matching random events', () => {
  const context: RandomEventContext = {
    now: NOW,
    vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 },
    personality: 'normal',
    affection: 10,
    currentAction: 'none',
    dayPeriod: 'daytime',
    activeTogetherTimeMs: 0,
    lastCareAt: NOW,
  };
  const hop = { id: 'x-hop', state: 'happy', effect: 'hop', durationMs: 1, tags: ['playing', 'hop'], baseWeight: 1 } as const;
  const doze = { id: 'x-doze', state: 'sleepy', durationMs: 1, tags: ['sleepy', 'sleeping'], baseWeight: 1 } as const;
  assert.ok(getRandomEventWeight(hop, { ...context, season: 'summer' }) > getRandomEventWeight(hop, { ...context, season: 'autumn' }));
  assert.ok(getRandomEventWeight(doze, { ...context, season: 'winter' }) > getRandomEventWeight(doze, { ...context, season: 'summer' }));
});

test('seasonal episodes appear only on calm day rollovers with a free slot', () => {
  const quiet = pet({ vitals: { hunger: 70, mood: 55, sleepiness: 20, affection: 10 } });
  const july = new Date(2026, 6, 9, 9, 0).getTime();
  const rolled = createEpisodeCandidates(quiet, 'day_rollover', july);
  assert.ok(rolled.some((e) => e.id === 'found_cool_shade'));

  const lowMood = pet({ vitals: { hunger: 70, mood: 40, sleepiness: 20, affection: 10 } });
  assert.equal(createEpisodeCandidates(lowMood, 'day_rollover', july).some((e) => e.id === 'found_cool_shade'), false);
  assert.equal(createEpisodeCandidates(quiet, 'random_event', july).some((e) => e.id === 'found_cool_shade'), false);

  const january = new Date(2026, 0, 9, 9, 0).getTime();
  assert.ok(createEpisodeCandidates(quiet, 'day_rollover', january).some((e) => e.id === 'curled_up_warm'));

  const busy = pet({
    vitals: { hunger: 70, mood: 75, sleepiness: 20, affection: 30 },
    careStats: { ...EMPTY_CARE_STATS, playCount: 2, activeTogetherTimeMs: 31 * 60_000 },
  });
  const full = createEpisodeCandidates(busy, 'day_rollover', july);
  assert.equal(full.length, 2);
  assert.equal(full.some((e) => e.id === 'found_cool_shade'), false);
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
  }));
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


test('context actions select sleepy, sulking, hungry, priority and cooldown cases', () => {
  assert.equal(getAvailableContextAction(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 80, affection: 10 } }), NOW)?.id, 'give_space');
  assert.equal(getAvailableContextAction(pet({ vitals: { hunger: 70, mood: 10, sleepiness: 20, affection: 10 } }), NOW)?.id, 'wait_gently');
  assert.equal(getAvailableContextAction(pet({ vitals: { hunger: 20, mood: 70, sleepiness: 20, affection: 10 } }), NOW)?.id, 'small_bite');
  assert.equal(getAvailableContextAction(pet({ vitals: { hunger: 20, mood: 10, sleepiness: 85, affection: 10 } }), NOW)?.id, 'give_space');
  assert.equal(getAvailableContextAction(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 80, affection: 10 }, lastContextActionAt: { give_space: NOW - 1_000 } }), NOW), null);
});

test('context actions apply effects safely and preserve sleeping give_space', () => {
  const sleeping = petWithoutDailyTasks({ currentAction: 'sleeping', vitals: { hunger: 70, mood: 99, sleepiness: 100, affection: 99 } });
  const spaced = performContextAction(sleeping, 'give_space', NOW + 10_000);
  assert.equal(spaced.ok, true);
  assert.equal(spaced.pet.currentAction, 'sleeping');
  assert.deepEqual(spaced.pet.vitals, { hunger: 70, mood: 100, sleepiness: 97, affection: 100 });
  assert.equal(spaced.pet.exp, 2);
  assert.equal(spaced.pet.lastContextActionAt.give_space, NOW + 10_000);

  const base = petWithoutDailyTasks({ vitals: { hunger: 20, mood: 70, sleepiness: 20, affection: 10 } });
  const bite = performContextAction(base, 'small_bite', NOW + 10_000);
  const feed = performCareAction(base, 'feed', NOW + 10_000);
  assert.ok(bite.pet.vitals.hunger - base.vitals.hunger < feed.pet.vitals.hunger - base.vitals.hunger);
  assert.equal(bite.pet.exp, 2);
});

test('context action exp can level up consistently', () => {
  const result = performContextAction(petWithoutDailyTasks({ exp: 49, level: 1, vitals: { hunger: 70, mood: 70, sleepiness: 80, affection: 10 } }), 'give_space', NOW + 10_000);
  assert.equal(result.leveledUp, true);
  assert.equal(result.newLevel, 2);
  assert.equal(result.pet.level, 2);
});

test('describeVitals returns compact non-numeric gentle observations', () => {
  const lines = describeVitals({ hunger: 10, mood: 10, sleepiness: 90, affection: 80 });
  assert.ok(lines.length >= 1);
  assert.ok(lines.length <= 4);
  assert.equal(lines.some((line) => /\d/.test(line)), false);
  assert.ok(lines.includes('少しおなかが空いていそう'));
  assert.ok(lines.includes('少しすねている'));
  assert.ok(lines.includes('少し眠そう'));
  assert.ok(lines.includes('よくなついている'));
  assert.equal(lines.some((line) => /遅い|さみしかった|なんで|放置|だめ|悪い/.test(line)), false);
});

test('v3 save migration fills settings and strips invalid context action keys', () => {
  const save = sanitizeSave({
    version: 2,
    pet: { ...createInitialPetState(NOW), lastContextActionAt: { give_space: NOW, bad: NOW } },
    settings: { alwaysOnTop: false, volume: 50, statusDisplayMode: 'bad', ambientFrequency: 'bad', bubbleFrequency: 'bad' },
    lastLaunchedAt: NOW,
  }, NOW);
  assert.equal(save.version, CURRENT_SAVE_VERSION);
  assert.equal(save.settings.statusDisplayMode, 'both');
  assert.equal(save.settings.ambientFrequency, 'normal');
  assert.equal(save.settings.bubbleFrequency, 'normal');
  assert.equal(save.settings.reduceActivityWhenFullscreen, true);
  assert.deepEqual(save.pet.lastContextActionAt, { give_space: NOW });
});


test('episode candidates follow care and quiet conditions', () => {
  const p = pet({
    vitals: { hunger: 70, mood: 75, sleepiness: 20, affection: 30 },
    careStats: { ...EMPTY_CARE_STATS, playCount: 2, activeTogetherTimeMs: 31 * 60_000 },
  });
  const candidates = createEpisodeCandidates(p, 'day_rollover', NOW);
  assert.ok(candidates.some((e) => e.id === 'first_quiet_day'));
  assert.ok(candidates.some((e) => e.id === 'played_again' || e.id === 'stayed_together'));
  assert.ok(candidates.length <= 2);
});

test('episode append avoids duplicates and caps per day and total', () => {
  const first = createEpisodeCandidates(pet({ vitals: { hunger: 70, mood: 75, sleepiness: 20, affection: 10 } }), 'day_rollover', NOW);
  const duplicated = appendEpisodeEntries(first, first);
  assert.equal(duplicated.length, first.length);
  const many = Array.from({ length: 70 }, (_, i) => {
    const day = Math.floor(i / 2);
    const date = `2026-${day < 28 ? '05' : '06'}-${String((day % 28) + 1).padStart(2, '0')}`;
    return { ...first[0], date, id: (i % 2 ? 'played_again' : 'first_quiet_day') as EpisodeId };
  });
  const capped = appendEpisodeEntries([], many, { maxEntries: 60 });
  assert.equal(capped.length, 60);
});

test('episode sanitize trims long text and drops invalid entries', () => {
  const clean = sanitizeEpisodeEntries([
    { id: 'bad', date: '2026-07-09', title: 'x', text: 'x', trigger: 'day_rollover' },
    { id: 'first_quiet_day', date: 'bad', title: 'x', text: 'x', trigger: 'day_rollover' },
    { id: 'first_quiet_day', date: '2026-07-09', title: 't'.repeat(99), text: 'x'.repeat(99), trigger: 'day_rollover', relatedMemoryFlagIds: ['ok', '../bad'], relatedHabitatItemIds: ['glow_speck'] },
  ]);
  assert.equal(clean.length, 1);
  assert.ok(clean[0].title.length <= 24);
  assert.ok(clean[0].text.length <= 80);
  assert.deepEqual(clean[0].relatedMemoryFlagIds, ['ok']);
});

test('weekly reflection summarizes task totals, care action, tone and caps history', () => {
  const journals = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, '0')}`,
    careCounts: { feed: 0, touch: 0, play: 2, rest: 0 },
    finalVitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 },
    personality: 'energetic' as const,
    completedTaskCount: 2,
    note: 'ゆっくり過ごした',
  }));
  const reflection = createWeeklyReflection(journals, [{ id: 'played_again', date: '2026-07-02', title: 't', text: 'また少し跳ねていた。', trigger: 'day_rollover', relatedMemoryFlagIds: [], relatedHabitatItemIds: [] }], '2026-07-01');
  assert.ok(reflection);
  assert.equal(reflection.completedTaskTotal, 14);
  assert.equal(reflection.mostFrequentCareAction, 'play');
  assert.ok(['calm', 'active', 'restful', 'mixed'].includes(reflection.tone));
  assert.equal(/もっと|未達成|放置|評価|低い|ランク|スコア/.test(reflection.summary), false);
  const history = Array.from({ length: 13 }, (_, i) => ({ ...reflection, weekStartDate: `2026-${String(i + 1).padStart(2, '0')}-01` })).reduce<NonNullable<typeof reflection>[]>((acc, x) => appendWeeklyReflection(acc, x), []);
  assert.equal(history.length, 12);
});

test('relationship note changes without rank or score language', () => {
  assert.equal(buildRelationshipNote(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 80 }, personality: 'calm' })).label, '静かに近くにいる相棒');
  assert.equal(buildRelationshipNote(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 30 }, personality: 'energetic' })).label, 'よく遊ぶ小さな相棒');
  assert.equal(buildRelationshipNote(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 30 }, personality: 'relaxed' })).label, '休むのが上手な相棒');
  assert.equal(buildRelationshipNote(pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 30 }, personality: 'sulky' })).label, '気まぐれな小さな相棒');
  assert.equal(/ランク|スコア|S|A|B/.test(buildRelationshipNote(pet()).label), false);
});

test('v4 migration fills and sanitizes episode and weekly reflection fields', () => {
  const old = sanitizeSave({ version: 3, pet: createInitialPetState(NOW), settings: { alwaysOnTop: false, volume: 50 }, lastLaunchedAt: NOW }, NOW);
  assert.deepEqual(old.pet.episodes, []);
  assert.deepEqual(old.pet.weeklyReflections, []);
  const current = sanitizeSave({
    version: CURRENT_SAVE_VERSION,
    pet: { ...createInitialPetState(NOW), vitals: { hunger: 22, mood: 33, sleepiness: 44, affection: 55 }, episodes: [{ id: 'bad' }, { id: 'first_quiet_day', date: '2026-07-09', title: '静かな日', text: '静かに過ごした日。', trigger: 'day_rollover' }], weeklyReflections: [{ bad: true }] },
    settings: { alwaysOnTop: false, volume: 50 },
    lastLaunchedAt: NOW,
  }, NOW);
  assert.deepEqual(current.pet.vitals, { hunger: 22, mood: 33, sleepiness: 44, affection: 55 });
  assert.equal(current.pet.episodes.length, 1);
  assert.equal(current.pet.weeklyReflections.length, 0);
});


test('discovery rolling creates at most one active entry, expires quietly, and avoids same-day repeats', () => {
  const base = pet({ vitals: { hunger: 70, mood: 80, sleepiness: 20, affection: 40 }, careStats: { ...EMPTY_CARE_STATS, activeTogetherTimeMs: 25 * 60_000 } });
  const rolled = maybeRollDiscovery(base, NOW + 60 * 60_000, { force: true, rng: () => 0 });
  assert.equal(rolled.created, true);
  assert.ok(rolled.pet.discovery.active);
  const second = maybeRollDiscovery(rolled.pet, NOW + 61 * 60_000, { force: true, rng: () => 0 });
  assert.equal(second.created, false);
  assert.equal(second.pet.discovery.active?.id, rolled.pet.discovery.active?.id);
  const expired = maybeRollDiscovery({ ...rolled.pet, discovery: { ...rolled.pet.discovery, active: { ...rolled.pet.discovery.active!, expiresAt: NOW - 1 } } }, NOW, { rng: () => 0 });
  assert.equal(expired.pet.discovery.active, null);
  // Resolve while the discovery is still active (they expire in 10-30 min).
  const resolved = resolveDiscovery(rolled.pet, rolled.pet.discovery.active!.id, NOW + 65 * 60_000).pet;
  assert.deepEqual(resolved.discovery.resolvedToday, [rolled.pet.discovery.active!.id]);
  const next = maybeRollDiscovery(resolved, NOW + 2 * 60 * 60_000, { force: true, rng: () => 0 });
  assert.notEqual(next.pet.discovery.active?.id, rolled.pet.discovery.active?.id);
});

test('discovery sanitize removes invalid ids, duplicates, and invalid active entries', () => {
  const clean = sanitizeDiscoveryState({
    active: { id: 'bad', expiresAt: NOW + 1 },
    resolvedToday: ['corner_light', 'corner_light', 'bad'],
    lastRolledAt: NOW,
  }, NOW);
  assert.equal(clean.active, null);
  assert.deepEqual(clean.resolvedToday, ['corner_light']);
});

test('inspect_edge context action appears only for active awake discoveries and applies rewards', () => {
  const rolled = maybeRollDiscovery(petWithoutDailyTasks({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 30 } }), NOW + 60 * 60_000, { force: true, rng: () => 0 }).pet;
  assert.equal(getAvailableContextAction(rolled, NOW + 61 * 60_000)?.id, 'inspect_edge');
  assert.notEqual(getAvailableContextAction({ ...rolled, currentAction: 'sleeping' }, NOW + 61 * 60_000)?.id, 'inspect_edge');
  const acted = performContextAction(rolled, 'inspect_edge', NOW + 62 * 60_000);
  assert.equal(acted.ok, true);
  assert.equal(acted.pet.discovery.active, null);
  assert.equal(acted.pet.vitals.mood, 74);
  assert.equal(acted.pet.vitals.affection, 31);
  assert.equal(acted.pet.exp, 2);
  assert.equal(getAvailableContextAction(acted.pet, NOW + 63 * 60_000)?.id, undefined);
});

test('discovery episodes are non-collecting, deduplicated, and capped by daily episode limit', () => {
  const def = DISCOVERY_BY_ID.corner_light;
  const entry = { id: def.id, date: '2026-07-09', kind: def.kind, label: def.label, shortText: def.shortText, relatedEpisodeId: def.episodeId, expiresAt: NOW + 1_000 };
  const candidate = episodeFromDiscovery(entry, NOW);
  assert.ok(candidate);
  assert.equal(/図鑑|捕獲|レア|SSR|失敗|見逃しました|寂しかった/.test(candidate!.text), false);
  const base = petWithoutDailyTasks({ discovery: { active: entry, resolvedToday: [], lastRolledAt: NOW } });
  const once = resolveDiscovery(base, 'corner_light', NOW).pet;
  const twice = appendEpisodeEntries(once.episodes, [candidate!]);
  assert.equal(twice.length, once.episodes.length);
  const filled = appendEpisodeEntries([candidate!, { ...candidate!, id: 'found_paper_echo', title: '紙片', text: '紙片のようなものを見つけたようだった。' }], [{ ...candidate!, id: 'watched_tiny_mark', title: '印', text: '小さな印のそばでしばらく止まっていた。' }]);
  assert.equal(filled.length, 2);
});

test('v5 save migration fills and sanitizes discovery state while backup recovery still works', () => {
  const old = sanitizeSave({ version: 4, pet: createInitialPetState(NOW), settings: { alwaysOnTop: false, volume: 50 }, lastLaunchedAt: NOW }, NOW);
  assert.equal(old.version, CURRENT_SAVE_VERSION);
  assert.deepEqual(old.pet.discovery.resolvedToday, []);
  const current = sanitizeSave({ version: CURRENT_SAVE_VERSION, pet: { ...createInitialPetState(NOW), discovery: { active: { id: 'bad', expiresAt: NOW + 1 }, resolvedToday: ['lost_dot', 'bad'], lastRolledAt: NOW } }, settings: { alwaysOnTop: false, volume: 50 }, lastLaunchedAt: NOW }, NOW);
  assert.equal(current.pet.discovery.active, null);
  assert.deepEqual(current.pet.discovery.resolvedToday, ['lost_dot']);
  const backup = sanitizeSave({ version: CURRENT_SAVE_VERSION, pet: { ...createInitialPetState(NOW), vitals: { hunger: 11, mood: 22, sleepiness: 33, affection: 44 } }, settings: { alwaysOnTop: false, volume: 50 }, lastLaunchedAt: NOW }, NOW);
  assert.equal(recoverSave({ version: 999 }, backup, NOW).source, 'backup');
});

test('quiet ambient frequency lowers discovery roll chance', () => {
  const base = pet({ vitals: { hunger: 70, mood: 80, sleepiness: 20, affection: 40 }, careStats: { ...EMPTY_CARE_STATS, activeTogetherTimeMs: 25 * 60_000 } });
  const normal = maybeRollDiscovery(base, NOW + 60 * 60_000, { rng: () => 0.2, ambientFrequency: 'normal' });
  const quiet = maybeRollDiscovery(base, NOW + 60 * 60_000, { rng: () => 0.2, ambientFrequency: 'quiet' });
  assert.equal(normal.created, true);
  assert.equal(quiet.created, false);
});

test('secret signals trim recent events, drop old events, and sanitize ids', () => {
  const raw = { date: localDateString(NOW), recentEvents: Array.from({ length: 25 }, (_, i) => ({ input: 'click', at: NOW - i * 100 })), lastTriggeredAt: { tap_tap_pause: NOW, bad: NOW }, triggeredToday: ['tap_tap_pause', 'bad', 'tap_tap_pause'] };
  const clean = sanitizeSignalState(raw, NOW);
  assert.equal(clean.recentEvents.length, 20);
  assert.deepEqual(clean.triggeredToday, ['tap_tap_pause']);
  assert.deepEqual(Object.keys(clean.lastTriggeredAt), ['tap_tap_pause']);
  assert.equal(sanitizeSignalState({ recentEvents: [{ input: 'click', at: NOW - 99 * 60_000 }] }, NOW).recentEvents.length, 0);
});

test('tap tap pause detects once and respects cooldown and date reset', () => {
  let p = pet({ signals: createEmptySignalState(NOW) });
  p = recordSignalInput(p, { input: 'click', at: NOW }, NOW).pet;
  p = recordSignalInput(p, { input: 'click', at: NOW + 200 }, NOW + 200).pet;
  assert.deepEqual(detectSecretSignals(p, NOW + 1_300), ['tap_tap_pause']);
  const triggered = recordSignalInput(p, { input: 'click', at: NOW + 1_300 }, NOW + 1_300);
  assert.equal(triggered.triggered.length, 1);
  assert.deepEqual(detectSecretSignals(triggered.pet, NOW + 2_600), []);
  assert.deepEqual(sanitizeSignalState({ ...triggered.pet.signals, date: '2026-07-08' }, NOW + 24 * 60 * 60_000).triggeredToday, []);
});

test('signal reactions are small, clamped, quiet, and can return episode ids', () => {
  const base = pet({ vitals: { hunger: 100, mood: 100, sleepiness: 100, affection: 100 }, currentAction: 'sleeping' });
  const res = applySecretSignalReaction(base, 'sleepy_respect', NOW);
  assert.deepEqual(res.pet.vitals, { hunger: 100, mood: 100, sleepiness: 100, affection: 100 });
  assert.equal(res.pet.currentAction, 'sleeping');
  assert.equal(res.episodeId, 'answered_secret_signal');
  assert.ok(!/(成功|失敗|スコア|実績|コンボ)/.test(`${res.bubble}`));
});

test('tiny plays start, avoid duplicates, end naturally, and sanitize ids', () => {
  const base = pet({ tinyPlay: createEmptyTinyPlayState(NOW) });
  const started = maybeStartTinyPlay(base, NOW, { force: true, rng: () => 0 });
  assert.equal(started.started, true);
  assert.ok(started.pet.tinyPlay.active);
  assert.equal(maybeStartTinyPlay(started.pet, NOW + 100, { force: true }).started, false);
  const ended = advanceTinyPlay(started.pet, NOW + 10_000);
  assert.equal(ended.ended, true);
  assert.equal(ended.pet.tinyPlay.completedToday.length, 1);
  assert.equal(advanceTinyPlay(ended.pet, NOW + 11_000).pet.tinyPlay.completedToday.length, 1);
  assert.deepEqual(sanitizeTinyPlayState({ date: localDateString(NOW), completedToday: ['follow_dot', 'bad', 'follow_dot'], active: { id: 'bad' } }, NOW).completedToday, ['follow_dot']);
});

test('tiny plays avoid sleeping and quiet frequency can suppress starts', () => {
  const sleeping = pet({ currentAction: 'sleeping', tinyPlay: createEmptyTinyPlayState(NOW) });
  assert.equal(maybeStartTinyPlay(sleeping, NOW, { force: true }).started, false);
  const quiet = pet({ tinyPlay: createEmptyTinyPlayState(NOW) });
  assert.equal(maybeStartTinyPlay(quiet, NOW, { ambientFrequency: 'quiet', rng: () => 0.9 }).started, false);
  assert.deepEqual(sanitizeTinyPlayState({ date: localDateString(NOW - 24 * 60 * 60_000), completedToday: ['follow_dot'] }, NOW).completedToday, []);
});

test('v6 migration adds and sanitizes signal and tiny play state without losing pet data', () => {
  const save = sanitizeSave({ version: 5, pet: { ...createInitialPetState(NOW), vitals: { hunger: 33, mood: 44, sleepiness: 55, affection: 66 }, signals: { triggeredToday: ['bad'] }, tinyPlay: { completedToday: ['bad'] } }, settings: {}, lastLaunchedAt: NOW }, NOW);
  assert.equal(save.version, CURRENT_SAVE_VERSION);
  assert.deepEqual(save.pet.vitals, { hunger: 33, mood: 44, sleepiness: 55, affection: 66 });
  assert.deepEqual(save.pet.signals.triggeredToday, []);
  assert.deepEqual(save.pet.tinyPlay.completedToday, []);
  const backup = { ...save, pet: { ...save.pet, vitals: { hunger: 22, mood: 44, sleepiness: 55, affection: 66 } } };
  assert.equal(recoverSave({ version: 999 }, backup, NOW).source, 'backup');
});

test('signal and tiny play daily state track the local calendar date', () => {
  assert.equal(createEmptySignalState(NOW).date, localDateString(NOW));
  assert.equal(createEmptyTinyPlayState(NOW).date, localDateString(NOW));
  const sameDay = sanitizeSignalState({ date: localDateString(NOW), triggeredToday: ['tap_tap_pause'] }, NOW);
  assert.deepEqual(sameDay.triggeredToday, ['tap_tap_pause']);
  const nextDay = NOW + 24 * 60 * 60_000;
  assert.deepEqual(sanitizeSignalState({ date: localDateString(NOW), triggeredToday: ['tap_tap_pause'] }, nextDay).triggeredToday, []);
  assert.deepEqual(sanitizeTinyPlayState({ date: localDateString(NOW), completedToday: ['follow_dot'] }, nextDay).completedToday, []);
});

test('dream state sanitize drops invalid themes, expired pendings, and caps fragments', () => {
  const fragment = { themeId: 'wide_meadow', date: '2026-07-08', mood: 'warm', text: 'どこまでも続く野原を、ころころ転がる夢。', listened: true };
  const clean = sanitizeDreamState({
    brewing: { themeId: 'bad', startedAt: NOW },
    pending: { themeId: 'tiny_feast', date: '2026-07-09', mood: 'warm', text: 'x', listened: false, expiresAt: NOW - 1 },
    fragments: [
      { themeId: 'bad' },
      fragment,
      ...Array.from({ length: 20 }, () => fragment),
    ],
    lastDreamAt: NOW - 1_000,
    date: localDateString(NOW),
    countToday: 1.7,
  }, NOW);
  assert.equal(clean.brewing, null);
  assert.equal(clean.pending, null);
  assert.equal(clean.fragments.length, MAX_DREAM_FRAGMENTS);
  assert.equal(clean.lastDreamAt, NOW - 1_000);
  assert.equal(clean.countToday, 2);
  assert.equal(sanitizeDreamState({ date: '2026-07-01', countToday: 2 }, NOW).countToday, 0);
  assert.equal(sanitizeDreamState('garbage', NOW).pending, null);
});

test('dreams brew while sleeping, surface on wake, and fade quietly when unheard', () => {
  const sleeping = pet({ currentAction: 'sleeping', dreams: { ...createEmptyDreamState(NOW), lastDreamAt: 0 } });
  const brewed = progressDreams(sleeping, NOW + 60_000, { rng: () => 0 });
  assert.ok(brewed.pet.dreams.brewing);
  assert.equal(brewed.surfaced, false);

  const stillAsleep = progressDreams(brewed.pet, NOW + 120_000, { rng: () => 0 });
  assert.equal(stillAsleep.surfaced, false);
  assert.ok(stillAsleep.pet.dreams.brewing);

  const awake = { ...stillAsleep.pet, currentAction: 'none' as const };
  const surfaced = progressDreams(awake, NOW + 180_000, { rng: () => 0 });
  assert.equal(surfaced.surfaced, true);
  assert.ok(surfaced.pet.dreams.pending);
  assert.equal(surfaced.pet.dreams.brewing, null);
  assert.equal(surfaced.pet.dreams.countToday, 1);

  const expiresAt = surfaced.pet.dreams.pending!.expiresAt;
  const faded = progressDreams(surfaced.pet, expiresAt + 1, { rng: () => 0 });
  assert.equal(faded.pet.dreams.pending, null);
  assert.equal(faded.pet.dreams.fragments.length, 1);
  assert.equal(faded.pet.dreams.fragments[0].listened, false);
});

test('dreams respect the per-day cap, the gap, sleep requirement, and quiet frequency', () => {
  const base = createEmptyDreamState(NOW);
  const awake = pet({ currentAction: 'none', dreams: base });
  assert.equal(progressDreams(awake, NOW + 60_000, { rng: () => 0 }).pet.dreams.brewing, null);

  const capped = pet({ currentAction: 'sleeping', dreams: { ...base, countToday: 2 } });
  assert.equal(progressDreams(capped, NOW + 60_000, { rng: () => 0 }).pet.dreams.brewing, null);

  const recent = pet({ currentAction: 'sleeping', dreams: { ...base, lastDreamAt: NOW } });
  assert.equal(progressDreams(recent, NOW + 60_000, { rng: () => 0 }).pet.dreams.brewing, null);

  const quiet = pet({ currentAction: 'sleeping', dreams: base });
  assert.equal(progressDreams(quiet, NOW + 60_000, { ambientFrequency: 'quiet', rng: () => 0.1 }).pet.dreams.brewing, null);
  assert.ok(progressDreams(quiet, NOW + 60_000, { ambientFrequency: 'normal', rng: () => 0.1 }).pet.dreams.brewing);
});

test('listening to a dream stores a listened fragment, small rewards, and an episode', () => {
  const surfaced = forceSurfaceDream(petWithoutDailyTasks({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 } }), NOW, () => 0);
  assert.ok(surfaced.dreams.pending);
  const listened = listenToDream(surfaced, NOW + 1_000);
  assert.equal(listened.ok, true);
  assert.equal(listened.pet.dreams.pending, null);
  assert.equal(listened.pet.dreams.fragments.at(-1)?.listened, true);
  assert.equal(listened.pet.vitals.mood, 73);
  assert.equal(listened.pet.vitals.affection, 11);
  assert.equal(listened.pet.exp, 2);
  assert.equal(listened.pet.episodes.length, 1);
  assert.equal(listened.pet.episodes[0].trigger, 'dream');
  assert.ok(!/(成功|失敗|スコア|実績|ランク)/.test(`${listened.bubble}`));

  const sleeping = { ...surfaced, currentAction: 'sleeping' as const };
  assert.equal(listenToDream(sleeping, NOW + 1_000).ok, false);
  assert.equal(listenToDream(pet(), NOW).ok, false);
});

test('listen_dream context action appears for pending dreams and applies rewards once', () => {
  const surfaced = forceSurfaceDream(petWithoutDailyTasks({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 } }), NOW, () => 0);
  assert.equal(getAvailableContextAction(surfaced, NOW + 1_000)?.id, 'listen_dream');
  assert.notEqual(getAvailableContextAction({ ...surfaced, currentAction: 'sleeping' }, NOW + 1_000)?.id, 'listen_dream');

  const acted = performContextAction(surfaced, 'listen_dream', NOW + 1_000);
  assert.equal(acted.ok, true);
  assert.equal(acted.pet.dreams.pending, null);
  assert.equal(acted.pet.exp, 2);
  assert.equal(acted.pet.vitals.mood, 73);
  assert.equal(acted.pet.lastContextActionAt.listen_dream, NOW + 1_000);
  assert.equal(getAvailableContextAction(acted.pet, NOW + 2_000)?.id, undefined);

  const blocked = performContextAction(pet(), 'listen_dream', NOW);
  assert.equal(blocked.ok, false);
});

test('dream themes are context-weighted and always valid', () => {
  for (let i = 0; i < 10; i++) {
    const themeId = pickDreamTheme(pet(), NOW, Math.random);
    assert.ok(DREAM_THEME_IDS.includes(themeId));
  }
  assert.equal(pickDreamTheme(pet(), NOW, () => 0), DREAM_THEME_IDS[0]);
  const hungry = pet({ vitals: { hunger: 20, mood: 50, sleepiness: 20, affection: 10 } });
  // With hunger low, tiny_feast has the largest single weight bump.
  const picks = new Set(Array.from({ length: 40 }, (_, i) => pickDreamTheme(hungry, NOW, () => (i + 0.5) / 40)));
  assert.ok(picks.has('tiny_feast'));
  for (const def of Object.values(DREAM_THEME_BY_ID)) {
    assert.ok(def.fragmentText.length <= 60);
    assert.ok(!/(成功|失敗|スコア|実績|ランク|レア)/.test(def.fragmentText + def.episodeText));
  }
});

test('v7 migration adds and sanitizes dream state without losing pet data', () => {
  const old = sanitizeSave({ version: 6, pet: { ...createInitialPetState(NOW), vitals: { hunger: 33, mood: 44, sleepiness: 55, affection: 66 } }, settings: {}, lastLaunchedAt: NOW }, NOW);
  assert.equal(old.version, CURRENT_SAVE_VERSION);
  assert.deepEqual(old.pet.vitals, { hunger: 33, mood: 44, sleepiness: 55, affection: 66 });
  assert.deepEqual(old.pet.dreams, createEmptyDreamState(NOW));

  const current = sanitizeSave({
    version: CURRENT_SAVE_VERSION,
    pet: { ...createInitialPetState(NOW), dreams: { pending: { themeId: 'bad' }, fragments: [{ themeId: 'gentle_rain', date: '2026-07-08' }], countToday: -3 } },
    settings: {},
    lastLaunchedAt: NOW,
  }, NOW);
  assert.equal(current.pet.dreams.pending, null);
  assert.equal(current.pet.dreams.fragments.length, 1);
  assert.equal(current.pet.dreams.fragments[0].text, DREAM_THEME_BY_ID.gentle_rain.fragmentText);
  assert.equal(current.pet.dreams.countToday, 0);

  const backup = { ...current, pet: { ...current.pet, vitals: { hunger: 22, mood: 44, sleepiness: 55, affection: 66 } } };
  assert.equal(recoverSave({ version: 999 }, backup, NOW).source, 'backup');
});

test('look_together and tidy_habitat become reachable through unlocked props', () => {
  const vitals = { hunger: 70, mood: 70, sleepiness: 20, affection: 10 };
  assert.equal(getAvailableContextAction(pet({ vitals }), NOW), null);
  assert.equal(getAvailableContextAction(pet({ vitals, unlockedPropIds: ['old_note'] }), NOW)?.id, 'look_together');
  assert.equal(getAvailableContextAction(pet({ vitals, unlockedPropIds: ['small_cloth'] }), NOW)?.id, 'tidy_habitat');
  const tidied = performContextAction(petWithoutDailyTasks({ vitals, unlockedPropIds: ['small_cloth'] }), 'tidy_habitat', NOW + 10_000);
  assert.equal(tidied.ok, true);
  assert.equal(tidied.pet.vitals.mood, 74);
});

test('quiet moments give a small capped reward with a gentle cooldown', () => {
  const base = pet({ vitals: { hunger: 70, mood: 70, sleepiness: 20, affection: 10 } });
  const first = completeQuietMoment(base, NOW);
  assert.equal(first.rewarded, true);
  assert.equal(first.pet.vitals.mood, 74);
  assert.equal(first.pet.vitals.affection, 11);
  assert.equal(first.pet.exp, 2);
  assert.equal(first.pet.quietMoments.completedToday, 1);

  const tooSoon = completeQuietMoment(first.pet, NOW + QUIET_MOMENT_COOLDOWN_MS - 1);
  assert.equal(tooSoon.rewarded, false);
  assert.equal(tooSoon.pet, first.pet);
  assert.equal(getQuietMomentRewardStatus(first.pet, NOW + 60_000).eligible, false);

  const second = completeQuietMoment(first.pet, NOW + QUIET_MOMENT_COOLDOWN_MS);
  const third = completeQuietMoment(second.pet, NOW + QUIET_MOMENT_COOLDOWN_MS * 2);
  assert.equal(third.pet.quietMoments.completedToday, 3);
  const capped = completeQuietMoment(third.pet, NOW + QUIET_MOMENT_COOLDOWN_MS * 3);
  assert.equal(capped.rewarded, false);
  assert.equal(getQuietMomentRewardStatus(third.pet, NOW + QUIET_MOMENT_COOLDOWN_MS * 3).remainingToday, 0);
});

test('quiet moment state sanitizes corruption and resets on a new local day', () => {
  assert.deepEqual(createEmptyQuietMomentState(NOW), {
    date: localDateString(NOW),
    completedToday: 0,
    lastCompletedAt: 0,
  });
  const clean = sanitizeQuietMomentState({
    date: localDateString(NOW),
    completedToday: 99,
    lastCompletedAt: -10,
  }, NOW);
  assert.equal(clean.completedToday, 3);
  assert.equal(clean.lastCompletedAt, 0);

  const nextDay = NOW + 24 * 60 * 60_000;
  const reset = sanitizeQuietMomentState({
    date: localDateString(NOW),
    completedToday: 2,
    lastCompletedAt: NOW,
  }, nextDay);
  assert.equal(reset.completedToday, 0);
  assert.equal(reset.lastCompletedAt, NOW);
});

test('v8 migration adds quiet moments without losing pet data', () => {
  const migrated = sanitizeSave({
    version: 7,
    pet: { ...createInitialPetState(NOW), vitals: { hunger: 31, mood: 42, sleepiness: 53, affection: 64 } },
    settings: {},
    lastLaunchedAt: NOW,
  }, NOW);
  assert.equal(migrated.version, CURRENT_SAVE_VERSION);
  assert.deepEqual(migrated.pet.vitals, { hunger: 31, mood: 42, sleepiness: 53, affection: 64 });
  assert.deepEqual(migrated.pet.quietMoments, createEmptyQuietMomentState(NOW));
});
