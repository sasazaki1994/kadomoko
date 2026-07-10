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
  noticed_corner_light: { title: '小さな光', text: '画面端の小さな光を見ていた。' },
  found_paper_echo: { title: '紙片', text: '紙片のようなものを見つけたようだった。' },
  watched_tiny_mark: { title: '小さな印', text: '小さな印のそばでしばらく止まっていた。' },
  followed_soft_trace: { title: 'やわらかい跡', text: 'やわらかい跡を見つめていた。' },
  looked_at_lost_dot: { title: '小さな点', text: '迷い込んだ小さな点を見ていた。' },
  answered_secret_signal: { title: '小さな合図', text: '小さな合図に反応していた。' },
  played_follow_dot: { title: '小さな点', text: '小さな点を見ていた。' },
  peeked_from_corner: { title: 'すみっこ', text: '少し隠れて、また出てきた。' },
  made_a_small_turn: { title: '小さな回転', text: 'ゆっくり回っていた。' },
  watched_tiny_play: { title: '小さな遊び', text: '小さな遊びをしていた。' },
};

export const EPISODE_IDS = Object.keys(EPISODE_TEXT) as EpisodeId[];
