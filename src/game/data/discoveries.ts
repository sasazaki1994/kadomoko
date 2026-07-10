import type { DiscoveryId, DiscoveryKind } from '../types';

export type DiscoveryDef = {
  id: DiscoveryId;
  kind: DiscoveryKind;
  label: string;
  shortText: string;
  episodeId?: Extract<import('../types').EpisodeId,
    'noticed_corner_light' | 'found_paper_echo' | 'watched_tiny_mark' | 'followed_soft_trace' | 'looked_at_lost_dot'>;
  episodeText?: string;
};

export const DISCOVERY_DEFS: readonly DiscoveryDef[] = [
  { id: 'drifting_seed', kind: 'object', label: '流れてきた小さな種のようなもの', shortText: '小さな種のようなもの' },
  { id: 'paper_echo', kind: 'object', label: '紙片のようなもの', shortText: '紙片のようなもの', episodeId: 'found_paper_echo', episodeText: '紙片のようなものを見つけたようだった。' },
  { id: 'sleepy_spark', kind: 'light', label: '眠い時間にだけ見える小さな光', shortText: '眠い時間の小さな光' },
  { id: 'quiet_shadow', kind: 'shadow', label: '画面端に少しだけ見える影', shortText: '少しだけ見える影' },
  { id: 'tiny_mark', kind: 'trace', label: 'どこかについた小さな印', shortText: '小さな印', episodeId: 'watched_tiny_mark', episodeText: '小さな印のそばでしばらく止まっていた。' },
  { id: 'corner_light', kind: 'light', label: '画面端の小さな光', shortText: '画面端の小さな光', episodeId: 'noticed_corner_light', episodeText: '画面端の小さな光を見ていた。' },
  { id: 'soft_trace', kind: 'trace', label: 'やわらかい跡', shortText: 'やわらかい跡', episodeId: 'followed_soft_trace', episodeText: 'やわらかい跡を見つめていた。' },
  { id: 'lost_dot', kind: 'soundless', label: '迷い込んだ小さな点', shortText: '迷い込んだ小さな点', episodeId: 'looked_at_lost_dot', episodeText: '迷い込んだ小さな点を見ていた。' },
] as const;

export const DISCOVERY_IDS = DISCOVERY_DEFS.map((d) => d.id) as DiscoveryId[];
export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERY_DEFS.map((d) => [d.id, d])) as Record<DiscoveryId, DiscoveryDef>;
