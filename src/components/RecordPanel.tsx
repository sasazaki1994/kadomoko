import { buildRelationshipNote } from '../game/relationship';
import { usePetStore } from '../store/usePetStore';
import EpisodeList from './EpisodeList';
import WeeklyReflectionPanel from './WeeklyReflectionPanel';

export default function RecordPanel() {
  const pet = usePetStore((s) => s.pet);
  const toggleRecordPanel = usePetStore((s) => s.toggleRecordPanel);
  const note = buildRelationshipNote(pet);
  const latestReflection = pet.weeklyReflections.at(-1);

  return (
    <div className="record-panel">
      <div className="panel-header">
        <span>記録</span>
        <button className="panel-close" onClick={toggleRecordPanel}>×</button>
      </div>
      <div className="panel-body record-body">
        <section className="relationship-note">
          <div className="record-section-title">関係</div>
          <strong>{note.label}</strong>
          <p>{note.description}</p>
        </section>
        <section>
          <div className="record-section-title">最近のこと</div>
          <EpisodeList episodes={pet.episodes} />
        </section>
        <section>
          <div className="record-section-title">週のふりかえり</div>
          <WeeklyReflectionPanel reflection={latestReflection} />
        </section>
        <p className="record-counts">エピソード {pet.episodes.length}件 / 週 {pet.weeklyReflections.length}件</p>
      </div>
    </div>
  );
}
