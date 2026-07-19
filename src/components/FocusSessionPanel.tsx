import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  FOCUS_SESSION_DURATIONS,
  FOCUS_SESSION_DAILY_REWARD_LIMIT,
  focusSessionRemainingSeconds,
} from '../game/focusSessions';
import { usePetStore } from '../store/usePetStore';
import type { FocusSessionDuration } from '../game/types';

function formatRemaining(endsAt: number, now: number): string {
  const seconds = focusSessionRemainingSeconds(endsAt, now);
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
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = focusSessions.active;
  const activeStartedAt = active?.startedAt;
  useEffect(() => {
    setNow(Date.now());
    if (activeStartedAt !== undefined) {
      continueButtonRef.current?.focus();
    } else {
      closeButtonRef.current?.focus();
    }
  }, [activeStartedAt]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFocusSession();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const rewardedRemaining = Math.max(
    0,
    FOCUS_SESSION_DAILY_REWARD_LIMIT - focusSessions.rewardedToday,
  );

  return (
    <section
      ref={panelRef}
      className="focus-session-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-session-title"
      aria-describedby={active ? 'focus-session-active-copy' : 'focus-session-note'}
      onKeyDown={handleKeyDown}
    >
      <div className="panel-header focus-session-header">
        <span id="focus-session-title">いっしょに集中</span>
        <button
          ref={closeButtonRef}
          className="panel-close"
          aria-label="集中タイマーを閉じる"
          onClick={closeFocusSession}
        >
          ×
        </button>
      </div>
      <div className="focus-session-body">
        {active ? (
          <>
            <div className="focus-session-orbit" aria-hidden="true"><span /></div>
            <p
              className="focus-session-time"
              role="timer"
              aria-label={`残り時間 ${formatRemaining(active.endsAt, now)}`}
            >
              {formatRemaining(active.endsAt, now)}
            </p>
            <p id="focus-session-active-copy" className="focus-session-copy">カドモコは静かにそばにいます。</p>
            <button
              ref={continueButtonRef}
              className="focus-session-primary"
              onClick={closeFocusSession}
            >
              このまま続ける
            </button>
            <button className="focus-session-cancel" onClick={cancelFocusSession}>今は終える</button>
          </>
        ) : (
          <>
            <div className="focus-session-mark" aria-hidden="true">◌</div>
            <p className="focus-session-lead">終わるまで、静かにいっしょに。</p>
            <div className="focus-session-presets">
              {FOCUS_SESSION_DURATIONS.map((duration) => (
                <button
                  key={duration}
                  aria-label={`${duration}分の集中セッションを始める`}
                  onClick={() => startFocusSession(duration)}
                >
                  <strong>{duration}分</strong>
                  <span>{PRESET_COPY[duration]}</span>
                </button>
              ))}
            </div>
            <p id="focus-session-note" className="focus-session-note">
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
