import type { DreamFragment } from '../game/types';

export default function DreamFragmentList({ fragments }: { fragments: DreamFragment[] }) {
  const recent = [...fragments].slice(-3).reverse();
  if (recent.length === 0) return <p className="empty-note">まだ夢のかけらはありません。</p>;
  return (
    <ul className="dream-fragment-list">
      {recent.map((fragment, index) => (
        <li key={`${fragment.date}-${fragment.themeId}-${index}`} className={fragment.listened ? '' : 'faded'}>
          {fragment.text}
        </li>
      ))}
    </ul>
  );
}
