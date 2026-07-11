import { buildRelationshipNote } from '../game/relationship';
import { usePetStore } from '../store/usePetStore';
import DreamFragmentList from './DreamFragmentList';
import EpisodeList from './EpisodeList';
import WeeklyReflectionPanel from './WeeklyReflectionPanel';

export default function RecordPanel() {
  const pet = usePetStore((s) => s.pet);
  const toggleRecordPanel = usePetStore((s) => s.toggleRecordPanel);
  const note = buildRelationshipNote(pet);
  const latestReflection = pet.weeklyReflections.at(-1);
  const todaysDiscovery = pet.discovery.active?.shortText ?? 'なし';

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
          <div className="record-section-title">今日の気配</div>
          <p className="todays-discovery">・{todaysDiscovery}</p>
        </section>
        <section>
          <div className="record-section-title">最近のこと</div>
          <EpisodeList episodes={pet.episodes} />
        </section>
        <section>
          <div className="record-section-title">夢のかけら</div>
          <DreamFragmentList fragments={pet.dreams.fragments} />
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
