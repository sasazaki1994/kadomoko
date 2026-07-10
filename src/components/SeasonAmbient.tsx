import { useEffect, useState } from 'react';
import { getSeason } from '../game/lifeRhythm';
import type { Season } from '../game/types';

const SEASON_CHECK_INTERVAL_MS = 60 * 60_000;

type Props = { hidden: boolean };

/**
 * A whisper-quiet seasonal backdrop: two or three drifting motes whose color
 * and motion follow the current season. Purely decorative and non-interactive.
 */
export default function SeasonAmbient({ hidden }: Props) {
  const [season, setSeason] = useState<Season>(() => getSeason(new Date()));

  useEffect(() => {
    const interval = setInterval(() => setSeason(getSeason(new Date())), SEASON_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (hidden) return null;
  return (
    <div className={`season-ambient season-${season}`} aria-hidden="true">
      <span className="season-mote mote-a" />
      <span className="season-mote mote-b" />
      <span className="season-mote mote-c" />
    </div>
  );
}
