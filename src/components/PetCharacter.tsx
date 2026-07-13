import { useEffect, useRef, useState } from 'react';
import type { PetMachineState } from '../game/types';
import { PET_SPRITE_SHEET, spriteRowForState, spriteStateForMachineState } from '../game/spriteSheet';
import {
  selectEffect,
  selectMachineState,
  usePetStore,
  type CharacterEffect,
} from '../store/usePetStore';

const sheetUrl = new URL('../assets/pet/pixel/kadomoco_sheet.png', import.meta.url).href;

const DRAG_THRESHOLD_PX = 4;
const CLICK_DELAY_MS = 250;

export default function PetCharacter() {
  const machineState = usePetStore(selectMachineState);
  const effect = usePetStore(selectEffect);
  const unlockedIdleMotionIds = usePetStore((s) => s.pet.unlockedIdleMotionIds);
  const unlockedPropIds = usePetStore((s) => s.pet.unlockedPropIds);
  const clickReaction = usePetStore((s) => s.clickReaction);
  const togglePanel = usePetStore((s) => s.togglePanel);

  const [spriteReady, setSpriteReady] = useState<boolean | null>(null);

  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSpriteReady(true);
    img.onerror = () => setSpriteReady(false);
    img.src = sheetUrl;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const press = pressRef.current;
      if (!press || draggingRef.current) return;
      if (Math.hypot(e.screenX - press.x, e.screenY - press.y) > DRAG_THRESHOLD_PX) {
        draggingRef.current = true;
        window.kadomoco?.dragStart();
      }
    };
    const onUp = () => {
      if (!pressRef.current) return;
      pressRef.current = null;
      if (draggingRef.current) {
        draggingRef.current = false;
        window.kadomoco?.dragEnd();
        return;
      }
      clickCountRef.current += 1;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current >= 2) {
          togglePanel();
        } else {
          clickReaction();
        }
        clickCountRef.current = 0;
      }, CLICK_DELAY_MS);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clickReaction, togglePanel]);

  const spriteState = spriteStateForMachineState(machineState);
  const idleSway = machineState === 'idle' && unlockedIdleMotionIds.includes('sway');
  const showSparkle =
    unlockedPropIds.includes('sparkle') &&
    (machineState === 'reaction' || machineState === 'levelUp');

  const wrapClasses = [
    'pet-wrap',
    effect ? `effect-${effect satisfies Exclude<CharacterEffect, null>}` : '',
    idleSway ? 'idle-sway' : '',
    machineState === 'levelUp' ? 'level-up' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={wrapClasses}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        pressRef.current = { x: e.screenX, y: e.screenY };
        draggingRef.current = false;
      }}
    >
      {showSparkle && <span className="pet-prop">✦</span>}
      {spriteReady ? (
        <div
          className="pet-sprite"
          role="img"
          aria-label="カドモコ"
          style={{
            backgroundImage: `url(${sheetUrl})`,
            backgroundPositionY: `${-spriteRowForState(spriteState) * PET_SPRITE_SHEET.frameHeight}px`,
            animationDuration: `${PET_SPRITE_SHEET.animationMs[spriteState]}ms`,
          }}
        />
      ) : (
        <FallbackPet state={machineState} />
      )}
    </div>
  );
}

/** Pure-CSS placeholder shown when the sprite sheet is missing. */
function FallbackPet({ state }: { state: PetMachineState }) {
  const eyesClosed = state === 'sleeping' || state === 'resting';
  return (
    <div className={`pet-fallback state-${state}`}>
      <span className="nub nub-left" />
      <span className="nub nub-right" />
      <span className={`eye eye-left${eyesClosed ? ' closed' : ''}`} />
      <span className={`eye eye-right${eyesClosed ? ' closed' : ''}`} />
      <span className="mouth" />
    </div>
  );
}
