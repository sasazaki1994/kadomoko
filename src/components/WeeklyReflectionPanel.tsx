import type { WeeklyReflection } from '../game/types';

export default function WeeklyReflectionPanel({ reflection }: { reflection?: WeeklyReflection }) {
  return <p className="weekly-reflection">{reflection?.summary ?? '週のふりかえりはまだありません。'}</p>;
}
