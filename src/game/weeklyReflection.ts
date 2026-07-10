import type { CareActionId, DailyJournalEntry, EpisodeEntry, Personality, WeeklyReflection } from './types';

export const MAX_WEEKLY_REFLECTIONS = 12;
const CARE: CareActionId[] = ['feed', 'touch', 'play', 'rest'];
const BLAME = /もっと|未達成|放置|評価|低い|だめ|悪い|ランク|スコア/;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createWeeklyReflection(journalEntries: DailyJournalEntry[], episodes: EpisodeEntry[], weekStartDate: string): WeeklyReflection | null {
  const weekEndDate = addDays(weekStartDate, 6);
  const inWeek = journalEntries.filter((e) => e.date >= weekStartDate && e.date <= weekEndDate);
  if (inWeek.length === 0) return null;
  const completedTaskTotal = inWeek.reduce((sum, e) => sum + e.completedTaskCount, 0);
  const careTotals = CARE.map((id) => ({ id, count: inWeek.reduce((sum, e) => sum + e.careCounts[id], 0) })).sort((a, b) => b.count - a.count);
  const mostFrequentCareAction = careTotals[0]?.count > 0 ? careTotals[0].id : null;
  const personalities = new Map<Personality, number>();
  for (const e of inWeek) personalities.set(e.personality, (personalities.get(e.personality) ?? 0) + 1);
  const dominantPersonality = [...personalities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'normal';
  const weekEpisodes = episodes.filter((e) => e.date >= weekStartDate && e.date <= weekEndDate);
  const active = weekEpisodes.filter((e) => e.id === 'played_again' || e.id === 'stayed_together').length + (mostFrequentCareAction === 'play' ? 1 : 0);
  const restful = weekEpisodes.filter((e) => e.id === 'rested_well' || e.id === 'sleepy_night').length + (mostFrequentCareAction === 'rest' ? 1 : 0);
  const calm = weekEpisodes.filter((e) => e.id === 'first_quiet_day' || e.id === 'calm_corner').length + (dominantPersonality === 'calm' ? 1 : 0);
  let tone: WeeklyReflection['tone'] = 'mixed';
  let summary = 'いろいろな様子が見えた週だった。';
  if (calm >= active && calm >= restful && calm > 0) { tone = 'calm'; summary = '静かに過ごした週だった。'; }
  else if (active > restful && active > 0) { tone = 'active'; summary = mostFrequentCareAction === 'play' ? '少しよく遊んだ週だった。' : 'よく一緒にいた週だった。'; }
  else if (restful > 0) { tone = 'restful'; summary = '休む時間が多い週だった。'; }
  if (BLAME.test(summary)) summary = 'いろいろな様子が見えた週だった。';
  return { weekStartDate, weekEndDate, summary, dominantPersonality, completedTaskTotal, mostFrequentCareAction, tone };
}

export function appendWeeklyReflection(existing: WeeklyReflection[], next: WeeklyReflection): WeeklyReflection[] {
  const merged = existing.filter((item) => item.weekStartDate !== next.weekStartDate);
  merged.push(next);
  return merged.slice(-MAX_WEEKLY_REFLECTIONS);
}
