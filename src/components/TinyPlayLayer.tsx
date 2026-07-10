import { TINY_PLAY_DEFS } from '../game/data/tinyPlays';
import type { TinyPlaySession } from '../game/types';

export default function TinyPlayLayer({ active, hidden }: { active: TinyPlaySession | null; hidden: boolean }) {
  if (!active || hidden) return null;
  const def = TINY_PLAY_DEFS[active.id];
  return (
    <div className={`tiny-play-layer tiny-${active.id}`} aria-label={def.label}>
      <span className="tiny-dot" />
      <span className="tiny-line" />
      <span className="tiny-shadow" />
    </div>
  );
}
