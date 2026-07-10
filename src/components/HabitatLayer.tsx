import type { ReactElement } from 'react';
import { HABITAT_ITEMS } from '../game/data/habitatItems';
import type { HabitatItemId } from '../game/types';
import { usePetStore } from '../store/usePetStore';

function ItemShape({ id }: { id: HabitatItemId }): ReactElement {
  switch (id) {
    case 'soft_cloth': return <span className="habitat-shape cloth" />;
    case 'small_stone': return <span className="habitat-shape stone" />;
    case 'quiet_box': return <span className="habitat-shape box" />;
    case 'glow_speck': return <span className="habitat-shape glow" />;
    case 'old_note': return <span className="habitat-shape note" />;
    case 'round_trinket': return <span className="habitat-shape trinket" />;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

export default function HabitatLayer() {
  const placedItemIds = usePetStore((s) => s.pet.habitat.placedItemIds);
  const items = placedItemIds.slice(0, 2);
  if (items.length === 0) return null;
  return <div className="habitat-layer" aria-label="すみかの小物">{items.map((id, i) => <span key={id} className={`habitat-item slot-${i}`} title={HABITAT_ITEMS.find((item) => item.id === id)?.label ?? 'すみかの小物'}><ItemShape id={id} /></span>)}</div>;
}
