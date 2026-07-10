import type { TinyPlayDef, TinyPlayId } from '../types';

export const TINY_PLAY_DEFS: Record<TinyPlayId, TinyPlayDef> = {
  follow_dot: { id: 'follow_dot', label: '小さな点', durationMs: 5_000, bubble: '？', episodeId: 'played_follow_dot' },
  mirror_bounce: { id: 'mirror_bounce', label: 'まねる跳ね', durationMs: 6_000, bubble: 'いい感じ', effect: 'hop' },
  hide_peek: { id: 'hide_peek', label: 'かくれて見る', durationMs: 7_000, bubble: '……', effect: 'peek', episodeId: 'peeked_from_corner' },
  slow_turn: { id: 'slow_turn', label: 'ゆっくり回る', durationMs: 6_500, bubble: 'いい感じ', effect: 'spin', episodeId: 'made_a_small_turn' },
  small_parade: { id: 'small_parade', label: '小さな行進', durationMs: 7_500, bubble: '……', effect: 'hop', episodeId: 'watched_tiny_play' },
  counting_blinks: { id: 'counting_blinks', label: 'まばたき', durationMs: 5_500, bubble: '……', episodeId: 'watched_tiny_play' },
};

export const TINY_PLAY_IDS = Object.keys(TINY_PLAY_DEFS) as TinyPlayId[];
