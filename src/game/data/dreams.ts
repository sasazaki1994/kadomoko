import type { DreamThemeDef, DreamThemeId } from '../types';

export const DREAM_THEME_DEFS: readonly DreamThemeDef[] = [
  {
    id: 'floating_lights',
    label: 'ただよう光',
    bubble: 'ひかってた',
    fragmentText: '小さな光がいくつも、ゆっくり流れていく夢。',
    mood: 'quiet',
    episodeId: 'dreamed_of_floating_lights',
    episodeText: 'ただよう光の夢を見ていたようだった。',
  },
  {
    id: 'wide_meadow',
    label: 'ひろい野原',
    bubble: 'ひろかった',
    fragmentText: 'どこまでも続く野原を、ころころ転がる夢。',
    mood: 'warm',
    episodeId: 'dreamed_of_wide_meadow',
    episodeText: '広い野原の夢を見て、少しうれしそうだった。',
  },
  {
    id: 'tiny_feast',
    label: 'ちいさなごちそう',
    bubble: 'おいしかった',
    fragmentText: '小さなごちそうを少しずつ味わう夢。',
    mood: 'warm',
    episodeId: 'dreamed_of_tiny_feast',
    episodeText: 'ごちそうの夢を見ていたのか、口をもごもごさせていた。',
  },
  {
    id: 'gentle_rain',
    label: 'やさしい雨',
    bubble: 'しとしと',
    fragmentText: 'やわらかい雨音を、屋根の下で聞いている夢。',
    mood: 'quiet',
    episodeId: 'dreamed_of_gentle_rain',
    episodeText: 'やさしい雨の夢を見て、静かに眠っていた。',
  },
  {
    id: 'far_signal',
    label: 'とおくの合図',
    bubble: '？',
    fragmentText: '遠くから小さな合図が届く、ふしぎな夢。',
    mood: 'curious',
    episodeId: 'dreamed_of_far_signal',
    episodeText: '遠くの合図の夢を見ていたようだった。',
  },
  {
    id: 'season_wind',
    label: 'きせつの風',
    bubble: 'いいにおい',
    fragmentText: '季節のにおいがする風に、ふわりと乗る夢。',
    mood: 'curious',
    episodeId: 'dreamed_of_season_wind',
    episodeText: '季節の風の夢を見て、鼻をひくひくさせていた。',
  },
] as const;

export const DREAM_THEME_IDS = DREAM_THEME_DEFS.map((d) => d.id) as DreamThemeId[];
export const DREAM_THEME_BY_ID = Object.fromEntries(
  DREAM_THEME_DEFS.map((d) => [d.id, d]),
) as Record<DreamThemeId, DreamThemeDef>;
