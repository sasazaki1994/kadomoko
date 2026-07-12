import { useEffect, useState } from 'react';
import { usePetStore } from '../store/usePetStore';
import type { FocusSession } from '../game/types';

function formatRemaining(endsAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function FocusSessionBadge({ session }: { session: FocusSession }) {
  const openFocusSession = usePetStore((s) => s.openFocusSession);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <button
      className="focus-session-badge"
      title="集中タイマーを開く"
      aria-label={`いっしょに集中、残り${formatRemaining(session.endsAt, now)}`}
      onClick={openFocusSession}
    >
      <span aria-hidden="true">◌</span>
      {formatRemaining(session.endsAt, now)}
    </button>
  );
}
