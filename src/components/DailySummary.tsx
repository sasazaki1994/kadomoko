import { buildDailySummary } from '../game/dailySummary';
import { usePetStore } from '../store/usePetStore';

export default function DailySummary() {
  const pet = usePetStore((s) => s.pet);
  const lines = buildDailySummary(pet, Date.now());

  return (
    <section className="daily-summary" aria-label="今日の様子">
      <div className="daily-summary-title">今日の様子</div>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
