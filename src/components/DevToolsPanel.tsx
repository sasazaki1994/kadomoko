import type { Personality, PetVitals } from '../game/types';
import { usePetStore } from '../store/usePetStore';

const PERSONALITIES: Personality[] = [
  'normal',
  'sweet',
  'energetic',
  'relaxed',
  'moody',
  'sulky',
  'calm',
];

const VITAL_KEYS: Array<keyof PetVitals> = ['hunger', 'mood', 'sleepiness', 'affection'];

export default function DevToolsPanel() {
  const pet = usePetStore((s) => s.pet);
  const toggleDevPanel = usePetStore((s) => s.toggleDevPanel);
  const devSetVitals = usePetStore((s) => s.devSetVitals);
  const devSetExp = usePetStore((s) => s.devSetExp);
  const devSetLevel = usePetStore((s) => s.devSetLevel);
  const devSimulateMinutes = usePetStore((s) => s.devSimulateMinutes);
  const devRerollTasks = usePetStore((s) => s.devRerollTasks);
  const devCompleteTasks = usePetStore((s) => s.devCompleteTasks);
  const devSetPersonality = usePetStore((s) => s.devSetPersonality);
  const devForceRandomEvent = usePetStore((s) => s.devForceRandomEvent);
  const devForceLevelUpEffect = usePetStore((s) => s.devForceLevelUpEffect);
  const devResetSave = usePetStore((s) => s.devResetSave);
  const devForceDiscovery = usePetStore((s) => s.devForceDiscovery);
  const devResolveDiscovery = usePetStore((s) => s.devResolveDiscovery);
  const devExpireDiscovery = usePetStore((s) => s.devExpireDiscovery);

  return (
    <div className="dev-panel">
      <div className="panel-header">
        <span>Dev</span>
        <button className="panel-close" onClick={toggleDevPanel}>
          ×
        </button>
      </div>
      <div className="dev-body">
        {VITAL_KEYS.map((key) => (
          <label key={key} className="dev-row">
            <span>{key}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={pet.vitals[key]}
              onChange={(e) => devSetVitals({ [key]: Number(e.target.value) })}
            />
            <span className="dev-value">{pet.vitals[key]}</span>
          </label>
        ))}
        <label className="dev-row">
          <span>exp</span>
          <input
            type="number"
            min={0}
            value={pet.exp}
            onChange={(e) => devSetExp(Number(e.target.value))}
          />
        </label>
        <label className="dev-row">
          <span>level</span>
          <input
            type="number"
            min={1}
            max={5}
            value={pet.level}
            onChange={(e) => devSetLevel(Number(e.target.value))}
          />
        </label>
        <div className="dev-row dev-buttons">
          <button onClick={() => devSimulateMinutes(10)}>+10分</button>
          <button onClick={() => devSimulateMinutes(60)}>+1時間</button>
          <button onClick={() => devSimulateMinutes(12 * 60)}>+12時間</button>
        </div>
        <div className="dev-row dev-buttons">
          <button onClick={devRerollTasks}>日課再抽選</button>
          <button onClick={devCompleteTasks}>日課達成</button>
        </div>
        <label className="dev-row">
          <span>性格</span>
          <select
            value={pet.personality}
            onChange={(e) => devSetPersonality(e.target.value as Personality)}
          >
            {PERSONALITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="dev-row dev-buttons">
          <button onClick={devForceRandomEvent}>イベント発生</button>
          <button onClick={devForceLevelUpEffect}>LvUP演出</button>
        </div>
        <div className="dev-row dev-buttons">
          <button onClick={devForceDiscovery}>発見を強制発生</button>
          <button onClick={devResolveDiscovery}>発見を解決</button>
          <button onClick={devExpireDiscovery}>発見を期限切れ</button>
        </div>
        <div className="dev-row dev-buttons">
          <button className="danger" onClick={devResetSave}>
            セーブ初期化
          </button>
        </div>
      </div>
    </div>
  );
}
