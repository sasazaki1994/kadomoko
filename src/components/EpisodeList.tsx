import type { EpisodeEntry } from '../game/types';

export default function EpisodeList({ episodes }: { episodes: EpisodeEntry[] }) {
  const recent = [...episodes].slice(-5).reverse();
  if (recent.length === 0) return <p className="empty-note">まだ静かな記録です。</p>;
  return (
    <ul className="episode-list">
      {recent.map((episode) => <li key={`${episode.date}-${episode.id}`}>{episode.text}</li>)}
    </ul>
  );
}
