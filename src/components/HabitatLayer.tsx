import type { HabitatItemId } from '../game/types';
import { usePetStore } from '../store/usePetStore';

function ItemShape({ id }: { id: HabitatItemId }) {
  switch (id) {
    case 'soft_cloth': return <span className="habitat-shape cloth" />;
    case 'small_stone': return <span className="habitat-shape stone" />;
    case 'quiet_box': return <span className="habitat-shape box" />;
    case 'glow_speck': return <span className="habitat-shape glow" />;
    case 'old_note': return <span className="habitat-shape note" />;
    case 'round_trinket': return <span className="habitat-shape trinket" />;
  }
}

export default function HabitatLayer() {
  const items = usePetStore((s) => s.pet.habitat.placedItemIds.slice(0, 2));
  if (items.length === 0) return null;
  return <div className="habitat-layer" aria-label="すみかの小物">{items.map((id, i) => <span key={id} className={`habitat-item slot-${i}`} title={id}><ItemShape id={id} /></span>)}</div>;
}
