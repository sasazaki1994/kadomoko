import type { DiscoveryEntry } from '../game/types';

type Props = { discovery: DiscoveryEntry | null };

export default function DiscoveryHint({ discovery }: Props) {
  if (!discovery) return null;
  return (
    <div className={`discovery-hint discovery-${discovery.kind}`} aria-label="小さな発見の気配" title={discovery.shortText}>
      <span />
    </div>
  );
}
