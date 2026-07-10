import type { DailyJournalEntry, PetState } from './types';

const BLAMING_PATTERNS = ['遅い', 'さみしかった', 'なんで', '放置'];

export function buildDailySummary(pet: PetState, now: number): string[] {
  void now;
  const lines: string[] = [];
  if (pet.vitals.sleepiness >= 80) lines.push('少し眠そう');
  if (pet.vitals.hunger < 20) lines.push('おなかが空いていそう');
  if (pet.vitals.mood >= 80) lines.push('機嫌はよさそう');
  if (pet.careStats.activeTogetherTimeMs >= 2 * 60 * 60_000) lines.push('よく一緒にいる');
  if (pet.careStats.feedCount >= 3) lines.push('よく食べた');
  if (pet.careStats.playCount >= 3) lines.push('よく遊んだ');
  if (pet.careStats.restCount >= 2) lines.push('よく休んだ');
  if (pet.careStats.touchCount >= 3) lines.push('よくふれあった');
  if (lines.length === 0) lines.push('ここで過ごしている');
  return lines.filter((line) => !BLAMING_PATTERNS.some((word) => line.includes(word))).slice(0, 3);
}

export function buildJournalNote(pet: PetState): string {
  return buildDailySummary(pet, Date.now())[0] ?? 'ゆっくり過ごした';
}

export function createDailyJournalEntry(pet: PetState): DailyJournalEntry {
  return {
    date: pet.dailyTasks.date,
    careCounts: {
      feed: pet.careStats.feedCount,
      touch: pet.careStats.touchCount,
      play: pet.careStats.playCount,
      rest: pet.careStats.restCount,
    },
    finalVitals: { ...pet.vitals },
    personality: pet.personality,
    completedTaskCount: pet.dailyTasks.tasks.filter((task) => task.completed).length,
    note: buildJournalNote(pet),
  };
}
