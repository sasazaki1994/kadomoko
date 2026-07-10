import type { HabitatItem } from '../types';

export const HABITAT_ITEMS: readonly HabitatItem[] = [
  { id: 'soft_cloth', label: '小さな布', description: '眠いときに近くで丸まる。', tags: ['rest', 'calm'] },
  { id: 'small_stone', label: '小さな石', description: '機嫌が良いときに小さく乗る。', unlockLevel: 3, tags: ['play', 'calm'] },
  { id: 'old_note', label: '古いメモ', description: '気になるしるしを見つける。', unlockLevel: 4, tags: ['curious', 'memory'] },
  { id: 'round_trinket', label: '丸い小物', description: 'なつきが高いときに近寄る。', unlockAffection: 50, tags: ['memory', 'calm'] },
  { id: 'glow_speck', label: '光る粒', description: '夜に少しだけ見つめる。', unlockLevel: 5, tags: ['night', 'curious'] },
  { id: 'quiet_box', label: '静かな箱', description: 'すねた時に少し隠れる。', tags: ['calm', 'rest'] },
] as const;

export const HABITAT_ITEM_IDS = HABITAT_ITEMS.map((item) => item.id);
