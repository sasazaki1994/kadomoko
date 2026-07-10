import type { ContextActionDef } from '../types';

export const CONTEXT_ACTIONS: readonly ContextActionDef[] = [
  { id: 'give_space', label: 'そっとする', description: '眠そうな様子をそっと見守る', priority: 100, cooldownMs: 5 * 60_000 },
  { id: 'wait_gently', label: 'まつ', description: 'すねた気持ちが落ち着くまで待つ', priority: 90, cooldownMs: 5 * 60_000 },
  { id: 'small_bite', label: '少しだけあげる', description: '少しだけ食べものをあげる', priority: 80, cooldownMs: 3 * 60_000 },
  { id: 'look_together', label: 'いっしょに見る', description: '気になるものを一緒に見る', priority: 60, cooldownMs: 5 * 60_000 },
  { id: 'stay_together', label: 'いっしょにいる', description: 'ただ近くで一緒にいる', priority: 40, cooldownMs: 4 * 60_000 },
  { id: 'tidy_habitat', label: 'すみかを整える', description: 'すみかを少し整える', priority: 30, cooldownMs: 6 * 60 * 60_000 },
] as const;

export const CONTEXT_ACTION_BY_ID = Object.fromEntries(
  CONTEXT_ACTIONS.map((action) => [action.id, action]),
) as Record<ContextActionDef['id'], ContextActionDef>;
