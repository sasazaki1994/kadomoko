import type { DreamState } from '../game/types';

type Props = { dreams: DreamState };

/**
 * Quiet visual cue for the dream lifecycle: a drifting mote while a dream is
 * forming during sleep, and a soft crescent while a fragment waits to be
 * listened to. Decorative only, never interactive.
 */
export default function DreamHint({ dreams }: Props) {
  if (dreams.pending) {
    return (
      <div className={`dream-hint dream-pending dream-${dreams.pending.mood}`} aria-label="夢のかけらの気配" title="夢のかけらがある">
        <span className="dream-crescent" />
      </div>
    );
  }
  if (dreams.brewing) {
    return (
      <div className="dream-hint dream-brewing" aria-label="夢を見ている気配">
        <span className="dream-mote" />
      </div>
    );
  }
  return null;
}
