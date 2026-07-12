import { useEffect, useState } from 'react';
import { FOCUS_SESSION_DURATIONS, FOCUS_SESSION_DAILY_REWARD_LIMIT } from '../game/focusSessions';
import { usePetStore } from '../store/usePetStore';
import type { FocusSessionDuration } from '../game/types';

function formatRemaining(endsAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const PRESET_COPY: Record<FocusSessionDuration, string> = {
  10: '小さくひと区切り',
  25: 'じっくりひと区切り',
};

export default function FocusSessionPanel() {
  const focusSessions = usePetStore((s) => s.pet.focusSessions);
  const closeFocusSession = usePetStore((s) => s.closeFocusSession);
  const startFocusSession = usePetStore((s) => s.startFocusSession);
  const cancelFocusSession = usePetStore((s) => s.cancelFocusSession);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = focusSessions.active;
  const rewardedRemaining = Math.max(
    0,
    FOCUS_SESSION_DAILY_REWARD_LIMIT - focusSessions.rewardedToday,
  );

  return (
    <section className="focus-session-panel" aria-labelledby="focus-session-title">
      <div className="panel-header focus-session-header">
        <span id="focus-session-title">いっしょに集中</span>
        <button className="panel-close" aria-label="集中タイマーを閉じる" onClick={closeFocusSession}>×</button>
      </div>
      <div className="focus-session-body">
        {active ? (
          <>
            <div className="focus-session-orbit" aria-hidden="true"><span /></div>
            <p className="focus-session-time" aria-live="polite">
              {formatRemaining(active.endsAt, now)}
            </p>
            <p className="focus-session-copy">カドモコは静かにそばにいます。</p>
            <button className="focus-session-primary" onClick={closeFocusSession}>このまま続ける</button>
            <button className="focus-session-cancel" onClick={cancelFocusSession}>今は終える</button>
          </>
        ) : (
          <>
            <div className="focus-session-mark" aria-hidden="true">◌</div>
            <p className="focus-session-lead">終わるまで、静かにいっしょに。</p>
            <div className="focus-session-presets">
              {FOCUS_SESSION_DURATIONS.map((duration) => (
                <button key={duration} onClick={() => startFocusSession(duration)}>
                  <strong>{duration}分</strong>
                  <span>{PRESET_COPY[duration]}</span>
                </button>
              ))}
            </div>
            <p className="focus-session-note">
              途中で終えても何も減りません。
              {rewardedRemaining > 0
                ? ` 小さなごほうびは今日はあと${rewardedRemaining}回。`
                : ' 今日のごほうび後も何度でも使えます。'}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
