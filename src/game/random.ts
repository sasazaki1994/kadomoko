export type RandomSource = () => number;

/** Picks one item while keeping injected random sources safe at their boundaries. */
export function pickRandom<T>(items: readonly T[], rng: RandomSource = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  const sample = rng();
  const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 1) : 0;
  const index = Math.min(Math.floor(normalized * items.length), items.length - 1);
  return items[index];
}

export function rollChance(chance: number, rng: RandomSource = Math.random): boolean {
  return rng() < Math.min(Math.max(chance, 0), 1);
}

export function randomOffset(span: number, rng: RandomSource = Math.random): number {
  if (span <= 0) return 0;
  const sample = rng();
  const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 1) : 0;
  return Math.min(Math.floor(normalized * span), Math.ceil(span) - 1);
}
