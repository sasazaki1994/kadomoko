import { HABITAT_ITEMS } from '../game/data/habitatItems';
import { expForNextLevel } from '../game/level';
import type { Personality } from '../game/types';
import { usePetStore } from '../store/usePetStore';
import DailySummary from './DailySummary';
import DailyTaskList from './DailyTaskList';

const PERSONALITY_LABELS: Record<Personality, string> = {
  normal: 'ふつう',
  sweet: 'あまえんぼう',
  energetic: 'げんき',
  relaxed: 'のんびり',
  moody: 'きまぐれ',
  sulky: 'すねやすい',
  calm: 'おだやか',
};

function VitalBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="vital-row">
      <span className="vital-label">{label}</span>
      <span className="vital-bar">
        <span className="vital-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="vital-value">{value}</span>
    </div>
  );
}

export default function StatusPanel() {
  const pet = usePetStore((s) => s.pet);
  const togglePanel = usePetStore((s) => s.togglePanel);

  const nextExp = expForNextLevel(pet.level);
  const placedHabitat = pet.habitat.placedItemIds
    .map((id) => HABITAT_ITEMS.find((item) => item.id === id)?.label)
    .filter(Boolean)
    .join(' / ') || '小さな布';

  return (
    <div className="status-panel">
      <div className="panel-header">
        <span>KadoMoco</span>
        <button className="panel-close" onClick={togglePanel}>
          ×
        </button>
      </div>
      <div className="panel-body">
        <div className="level-row">
          <span>Lv {pet.level}</span>
          <span className="exp-text">
            EXP {pet.exp}
            {nextExp !== null ? ` / ${nextExp}` : ''}
          </span>
        </div>
        <VitalBar label="満腹" value={pet.vitals.hunger} />
        <VitalBar label="機嫌" value={pet.vitals.mood} />
        <VitalBar label="眠気" value={pet.vitals.sleepiness} />
        <VitalBar label="なつき" value={pet.vitals.affection} />
        <div className="personality-row">
          性格：{PERSONALITY_LABELS[pet.personality]}
        </div>
        <div className="habitat-status">すみか：{placedHabitat}</div>
        <DailySummary />
        <DailyTaskList />
      </div>
    </div>
  );
}
