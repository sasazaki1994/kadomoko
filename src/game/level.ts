import { BALANCE, MAX_LEVEL } from './data/balance';

export const LEVEL_REQUIREMENTS = BALANCE.levelRequirements;

export function levelForExp(exp: number): number {
  let level = 1;
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    const required = LEVEL_REQUIREMENTS[lv as keyof typeof LEVEL_REQUIREMENTS];
    if (exp >= required) level = lv;
  }
  return level;
}

export function expForNextLevel(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  const next = (level + 1) as keyof typeof LEVEL_REQUIREMENTS;
  return LEVEL_REQUIREMENTS[next];
}

export type ExpGainResult = {
  exp: number;
  level: number;
  leveledUp: boolean;
};

export function gainExp(currentExp: number, currentLevel: number, amount: number): ExpGainResult {
  const exp = Math.max(0, currentExp + amount);
  const level = levelForExp(exp);
  return { exp, level, leveledUp: level > currentLevel };
}
