import type { PetVitals } from './types';

const BLAMING = /遅い|さみしかった|なんで|放置|だめ|悪い|かわいそう/;

export function describeVitals(vitals: PetVitals): string[] {
  const lines: string[] = [];
  if (vitals.hunger >= 75) lines.push('おなかは満たされている');
  else if (vitals.hunger < 30) lines.push('少しおなかが空いていそう');

  if (vitals.mood >= 75) lines.push('機嫌はよさそう');
  else if (vitals.mood < 30) lines.push('少しすねている');

  if (vitals.sleepiness >= 70) lines.push('少し眠そう');
  else if (vitals.sleepiness <= 25) lines.push('目はぱっちりしている');

  if (vitals.affection >= 60) lines.push('よくなついている');
  else if (vitals.affection >= 30) lines.push('近くにいると落ち着いている');

  const safe = lines.filter((line) => !/\d/.test(line) && !BLAMING.test(line));
  return (safe.length > 0 ? safe : ['静かに過ごしている']).slice(0, 4);
}
