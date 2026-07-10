import type { EpisodeId } from '../types';

export const EPISODE_TEXT: Record<EpisodeId, { title: string; text: string }> = {
  first_quiet_day: { title: '静かな日', text: '静かに過ごした日。' },
  played_again: { title: 'また少し', text: 'また少し跳ねていた。' },
  rested_well: { title: '休んだあと', text: 'よく休んで、少し落ち着いた。' },
  found_old_note: { title: '古いメモ', text: '古いメモを見つけたようだった。' },
  watched_glow_speck: { title: '光る粒', text: '光る粒をしばらく見ていた。' },
  stayed_together: { title: '近くで', text: '今日はよく一緒にいた。' },
  recovered_from_hunger: { title: '少し元気', text: '少し元気を取り戻した。' },
  gentle_morning: { title: '朝', text: '穏やかな朝を過ごした。' },
  sleepy_night: { title: '夜', text: '少し眠そうだけれど、落ち着いていた。' },
  calm_corner: { title: 'すみか', text: '小さなすみかで静かにしていた。' },
};

export const EPISODE_IDS = Object.keys(EPISODE_TEXT) as EpisodeId[];
