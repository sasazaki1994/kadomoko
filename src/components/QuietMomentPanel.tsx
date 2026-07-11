import { useEffect, useRef, useState } from 'react';
import {
  getQuietMomentRewardStatus,
  QUIET_MOMENT_DURATION_MS,
} from '../game/quietMoments';
import { usePetStore } from '../store/usePetStore';

const BREATH_DURATION_MS = 8_000;
const INHALE_END_MS = 3_500;
const EXHALE_END_MS = 7_000;

function rewardNote(remainingCooldownMs: number, remainingToday: number): string {
  if (remainingToday === 0) return '今日の小さなごほうびは受け取り済み。呼吸は何度でもどうぞ。';
  if (remainingCooldownMs > 0) {
    return `次の小さなごほうびまで約${Math.ceil(remainingCooldownMs / 60_000)}分。`;
  }
  return `終えると、きもちが少し整います（今日はあと${remainingToday}回）。`;
}

export default function QuietMomentPanel() {
  const pet = usePetStore((s) => s.pet);
  const closeQuietMoment = usePetStore((s) => s.closeQuietMoment);
  const completeQuietMoment = usePetStore((s) => s.completeQuietMoment);
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const elapsed = Math.min(QUIET_MOMENT_DURATION_MS, Date.now() - startedAt);
      setElapsedMs(elapsed);
      if (elapsed >= QUIET_MOMENT_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        completeQuietMoment();
      }
    };
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [completeQuietMoment, startedAt]);

  const done = elapsedMs >= QUIET_MOMENT_DURATION_MS;
  const cycle = Math.min(3, Math.floor(elapsedMs / BREATH_DURATION_MS) + 1);
  const cycleElapsed = elapsedMs % BREATH_DURATION_MS;
  const guide = cycleElapsed < INHALE_END_MS
    ? 'すって'
    : cycleElapsed < EXHALE_END_MS
      ? 'はいて'
      : 'そのまま';
  const secondsLeft = Math.ceil((QUIET_MOMENT_DURATION_MS - elapsedMs) / 1_000);
  const rewardStatus = getQuietMomentRewardStatus(pet, Date.now());

  return (
    <section className="quiet-moment-panel" aria-labelledby="quiet-moment-title">
      <div className="panel-header quiet-moment-header">
        <span id="quiet-moment-title">いっしょに深呼吸</span>
        <button className="panel-close" aria-label="深呼吸を閉じる" onClick={closeQuietMoment}>×</button>
      </div>
      <div className="quiet-moment-body">
        <div className={`breath-orb${done ? ' is-done' : ''}`} aria-hidden="true">
          <span />
        </div>
        <p className="breath-guide" aria-live="polite">{done ? 'おつかれさま' : guide}</p>
        <p className="breath-counter">
          {done ? '3回、ゆっくりできました' : `${cycle} / 3 · あと ${secondsLeft}秒`}
        </p>
        <div className="breath-dots" aria-hidden="true">
          {[1, 2, 3].map((value) => (
            <span key={value} className={value < cycle || done ? 'complete' : value === cycle ? 'current' : ''} />
          ))}
        </div>
        <p className="quiet-moment-note">
          {done ? 'カドモコも、少しだけ穏やかな顔をしています。' : rewardNote(rewardStatus.remainingCooldownMs, rewardStatus.remainingToday)}
        </p>
        {done ? (
          <button className="quiet-moment-finish" onClick={closeQuietMoment}>もどる</button>
        ) : (
          <button className="quiet-moment-skip" onClick={closeQuietMoment}>今はやめる</button>
        )}
      </div>
    </section>
  );
}
