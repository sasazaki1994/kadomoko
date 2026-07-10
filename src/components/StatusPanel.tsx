import { expForNextLevel } from '../game/level';
import { describeVitals } from '../game/observation';
import type { AmbientFrequency, BubbleFrequency, Personality, StatusDisplayMode } from '../game/types';
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
  const settings = usePetStore((s) => s.settings);
  const updateSettings = usePetStore((s) => s.updateSettings);

  const nextExp = expForNextLevel(pet.level);
  const observations = describeVitals(pet.vitals);
  const showNumbers = settings.statusDisplayMode === 'numbers' || settings.statusDisplayMode === 'both';
  const showObservation = settings.statusDisplayMode === 'observation' || settings.statusDisplayMode === 'both';

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
        {showNumbers ? (
          <>
            <VitalBar label="満腹" value={pet.vitals.hunger} />
            <VitalBar label="機嫌" value={pet.vitals.mood} />
            <VitalBar label="眠気" value={pet.vitals.sleepiness} />
            <VitalBar label="なつき" value={pet.vitals.affection} />
          </>
        ) : null}
        {showObservation ? (
          <ul className="observation-list">
            {observations.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}
        <div className="personality-row">
          性格：{PERSONALITY_LABELS[pet.personality]}
        </div>
        <DailySummary />
        <div className="settings-section">
          <label>表示：
            <select value={settings.statusDisplayMode} onChange={(e) => void updateSettings({ statusDisplayMode: e.target.value as StatusDisplayMode })}>
              <option value="numbers">数値</option>
              <option value="observation">観察</option>
              <option value="both">両方</option>
            </select>
          </label>
          <label>気まぐれ：
            <select value={settings.ambientFrequency} onChange={(e) => void updateSettings({ ambientFrequency: e.target.value as AmbientFrequency })}>
              <option value="quiet">控えめ</option>
              <option value="normal">ふつう</option>
              <option value="lively">少し多め</option>
            </select>
          </label>
          <label>吹き出し：
            <select value={settings.bubbleFrequency} onChange={(e) => void updateSettings({ bubbleFrequency: e.target.value as BubbleFrequency })}>
              <option value="off">自発なし</option>
              <option value="quiet">少なめ</option>
              <option value="normal">ふつう</option>
            </select>
          </label>
          <label className="compact-check">
            <input type="checkbox" checked={settings.reduceActivityWhenFullscreen} onChange={(e) => void updateSettings({ reduceActivityWhenFullscreen: e.target.checked })} />
            全画面中は控えめ
          </label>
        </div>
        <DailyTaskList />
      </div>
    </div>
  );
}
