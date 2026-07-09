import type { DailyTaskDef } from '../types';

export const DAILY_TASK_POOL: readonly DailyTaskDef[] = [
  {
    id: 'feed_once',
    label: '食べものを1回あげる',
    rewardExp: 8,
    rewardAffection: 1,
  },
  {
    id: 'touch_once',
    label: '1回ふれあう',
    rewardExp: 8,
    rewardAffection: 1,
  },
  {
    id: 'play_once',
    label: '1回遊ぶ',
    rewardExp: 10,
    rewardAffection: 1,
  },
  {
    id: 'rest_once',
    label: '1回休ませる',
    rewardExp: 6,
    rewardAffection: 1,
  },
  {
    id: 'together_30min',
    label: '30分一緒に過ごす',
    rewardExp: 12,
    rewardAffection: 1,
  },
  {
    id: 'good_mood_15min',
    label: '機嫌が良い状態を15分維持する',
    rewardExp: 12,
    rewardAffection: 2,
  },
] as const;

export const DAILY_TASK_COUNT = 3;

export const TOGETHER_TASK_TARGET_MS = 30 * 60_000;
export const GOOD_MOOD_TASK_TARGET_MS = 15 * 60_000;
