import {
  DAILY_TASK_COUNT,
  DAILY_TASK_POOL,
  GOOD_MOOD_TASK_TARGET_MS,
  TOGETHER_TASK_TARGET_MS,
} from './data/dailyTasks';
import type { CareActionId, DailyTaskDef, DailyTaskId, DailyTasksState } from './types';

export function localDateString(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rollDailyTasks(date: string, rng: () => number = Math.random): DailyTasksState {
  const shuffled = [...DAILY_TASK_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    date,
    tasks: shuffled.slice(0, DAILY_TASK_COUNT).map((def) => ({ id: def.id, completed: false })),
    togetherMsToday: 0,
    goodMoodStreakMs: 0,
  };
}

export function taskDefById(id: DailyTaskId): DailyTaskDef {
  const def = DAILY_TASK_POOL.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown daily task: ${id}`);
  return def;
}

const ACTION_TO_TASK: Record<CareActionId, DailyTaskId> = {
  feed: 'feed_once',
  touch: 'touch_once',
  play: 'play_once',
  rest: 'rest_once',
};

/** Marks the count-based task for an action as completed. Returns newly completed ids. */
export function completeActionTask(
  state: DailyTasksState,
  action: CareActionId,
): { state: DailyTasksState; completed: DailyTaskId[] } {
  return completeTasks(state, [ACTION_TO_TASK[action]]);
}

/** Marks time-based tasks whose accumulated targets have been met. */
export function completeTimeTasks(state: DailyTasksState): {
  state: DailyTasksState;
  completed: DailyTaskId[];
} {
  const ids: DailyTaskId[] = [];
  if (state.togetherMsToday >= TOGETHER_TASK_TARGET_MS) ids.push('together_30min');
  if (state.goodMoodStreakMs >= GOOD_MOOD_TASK_TARGET_MS) ids.push('good_mood_15min');
  return completeTasks(state, ids);
}

function completeTasks(
  state: DailyTasksState,
  ids: DailyTaskId[],
): { state: DailyTasksState; completed: DailyTaskId[] } {
  const completed: DailyTaskId[] = [];
  const tasks = state.tasks.map((task) => {
    if (!task.completed && ids.includes(task.id)) {
      completed.push(task.id);
      return { ...task, completed: true };
    }
    return task;
  });
  if (completed.length === 0) return { state, completed };
  return { state: { ...state, tasks }, completed };
}

/** Returns compact progress text for time-based daily tasks. */
export function dailyTaskProgressText(
  state: DailyTasksState,
  id: DailyTaskId,
): string | undefined {
  switch (id) {
    case 'together_30min':
      return formatMinuteProgress(state.togetherMsToday, TOGETHER_TASK_TARGET_MS);
    case 'good_mood_15min':
      return formatMinuteProgress(state.goodMoodStreakMs, GOOD_MOOD_TASK_TARGET_MS);
    case 'feed_once':
    case 'touch_once':
    case 'play_once':
    case 'rest_once':
      return undefined;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/** Quiet bubble text shown when one or more daily tasks are newly completed. */
export function dailyTaskCompletionBubble(
  completedIds: readonly DailyTaskId[],
): string | undefined {
  if (completedIds.length === 0) return undefined;
  if (completedIds.length === 1) return '日課できた';
  return `日課${completedIds.length}つできた`;
}

function formatMinuteProgress(currentMs: number, targetMs: number): string {
  const targetMinutes = Math.ceil(targetMs / 60_000);
  const currentMinutes = Math.min(
    targetMinutes,
    Math.max(0, Math.floor(currentMs / 60_000)),
  );
  return `${currentMinutes}/${targetMinutes}分`;
}
