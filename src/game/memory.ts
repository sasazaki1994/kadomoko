import type { MemoryFlag, MemoryFlagId, PetState } from './types';

export const MEMORY_FLAG_IDS: readonly MemoryFlagId[] = ['played_yesterday','rested_often','touched_often','fed_often','calm_day','good_mood_day','low_hunger_recovered','long_time_together','quiet_week'];
const VALID = new Set<string>(MEMORY_FLAG_IDS);
const DAYS: Record<MemoryFlagId, number> = { played_yesterday: 1, rested_often: 3, touched_often: 3, fed_often: 2, calm_day: 2, good_mood_day: 2, low_hunger_recovered: 2, long_time_together: 3, quiet_week: 7 };
export const clampMemoryStrength = (n: unknown) => Math.min(3, Math.max(1, Math.round(typeof n === 'number' && Number.isFinite(n) ? n : 1)));
function addDays(date: string, days: number) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
export function createInitialMemoryState() { return { flags: [] }; }
export function makeMemoryFlag(id: MemoryFlagId, date: string, strength = 2): MemoryFlag { return { id, createdDate: date, expiresDate: addDays(date, DAYS[id]), strength: clampMemoryStrength(strength) }; }
export function sanitizeMemoryFlags(raw: unknown, today: string): MemoryFlag[] {
  if (!Array.isArray(raw)) return [];
  return mergeMemoryFlags([], raw.flatMap((f) => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) return [];
    const r = f as Record<string, unknown>;
    if (typeof r.id !== 'string' || !VALID.has(r.id)) return [];
    return [{ id: r.id as MemoryFlagId, createdDate: typeof r.createdDate === 'string' ? r.createdDate : today, expiresDate: typeof r.expiresDate === 'string' ? r.expiresDate : addDays(today, DAYS[r.id as MemoryFlagId]), strength: clampMemoryStrength(r.strength) }];
  }), today);
}
export function deriveMemoryFlagsFromDay(pet: PetState, date: string): MemoryFlag[] {
  const s = pet.careStats; const out: MemoryFlag[] = [];
  if (s.playCount >= 3) out.push(makeMemoryFlag('played_yesterday', date, s.playCount >= 5 ? 3 : 2));
  if (s.restCount >= 2) out.push(makeMemoryFlag('rested_often', date, s.restCount >= 4 ? 3 : 2));
  if (s.touchCount >= 4) out.push(makeMemoryFlag('touched_often', date, 2));
  if (s.feedCount >= 3) out.push(makeMemoryFlag('fed_often', date, 2));
  if (pet.vitals.mood >= 80) out.push(makeMemoryFlag('good_mood_day', date, 2));
  if (pet.vitals.sleepiness <= 35 && pet.vitals.mood >= 60) out.push(makeMemoryFlag('calm_day', date, 1));
  if (s.activeTogetherTimeMs >= 90 * 60_000) out.push(makeMemoryFlag('long_time_together', date, 2));
  if (s.lowHungerTimeMs >= 20 * 60_000 && pet.vitals.hunger >= 60) out.push(makeMemoryFlag('low_hunger_recovered', date, 2));
  return out;
}
export function mergeMemoryFlags(existing: MemoryFlag[], next: MemoryFlag[], today: string): MemoryFlag[] {
  const map = new Map<MemoryFlagId, MemoryFlag>();
  for (const flag of [...existing, ...next]) {
    if (!VALID.has(flag.id)) continue;
    if (flag.expiresDate && flag.expiresDate < today) continue;
    const clean = { ...flag, strength: clampMemoryStrength(flag.strength) };
    const prev = map.get(clean.id);
    if (!prev || clean.strength >= prev.strength) map.set(clean.id, clean);
  }
  return [...map.values()];
}
