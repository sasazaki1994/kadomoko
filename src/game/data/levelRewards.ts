export type LevelReward =
  | { type: 'reaction'; id: string; label: string }
  | { type: 'idleMotion'; id: string; label: string }
  | { type: 'speechPack'; id: string; label: string }
  | { type: 'prop'; id: string; label: string };

export const LEVEL_REWARDS: Partial<Record<number, LevelReward>> = {
  2: { type: 'reaction', id: 'hop', label: '新しいリアクション' },
  3: { type: 'idleMotion', id: 'sway', label: '新しい待機モーション' },
  4: { type: 'speechPack', id: 'extra', label: 'あたらしいことば' },
  5: { type: 'prop', id: 'sparkle', label: 'ちいさなきらめき' },
};
