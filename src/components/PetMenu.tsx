import { bubbleForBlockReason, getCareActionBlockReason } from '../game/actions';
import { getAvailableContextAction } from '../game/contextActions';
import { usePetStore } from '../store/usePetStore';
import type { CareActionId } from '../game/types';

const ACTION_LABELS: Record<CareActionId, string> = {
  feed: '食べもの',
  touch: 'ふれあう',
  play: '遊ぶ',
  rest: '休ませる',
};

export default function PetMenu() {
  const pet = usePetStore((s) => s.pet);
  const alwaysOnTop = usePetStore((s) => s.alwaysOnTop);
  const performAction = usePetStore((s) => s.performAction);
  const performContextAction = usePetStore((s) => s.performContextAction);
  const showBubble = usePetStore((s) => s.showBubble);
  const togglePanel = usePetStore((s) => s.togglePanel);
  const toggleRecordPanel = usePetStore((s) => s.toggleRecordPanel);
  const toggleAlwaysOnTop = usePetStore((s) => s.toggleAlwaysOnTop);
  const setMenuOpen = usePetStore((s) => s.setMenuOpen);
  const quitApp = usePetStore((s) => s.quitApp);
  const now = Date.now();
  const actions = (['feed', 'touch', 'play', 'rest'] as const).map((action) => ({
    action,
    blockReason: getCareActionBlockReason(pet, action, now),
  }));
  const contextAction = getAvailableContextAction(pet, now);

  return (
    <div className="menu-backdrop" onMouseDown={() => setMenuOpen(false)}>
      <div className="pet-menu" onMouseDown={(e) => e.stopPropagation()}>
        {actions.map(({ action, blockReason }) => {
          const blocked = action === 'play' && blockReason !== undefined;
          return (
            <button
              key={action}
              className={[blockReason === 'cooldown' ? 'cooldown' : '', blocked ? 'blocked' : '']
                .filter(Boolean)
                .join(' ')}
              aria-disabled={blocked}
              title={blockReason ? bubbleForBlockReason(blockReason) : undefined}
              onClick={() => {
                if (blocked && blockReason) {
                  const bubble = bubbleForBlockReason(blockReason);
                  if (bubble) showBubble(bubble, true);
                  return;
                }
                performAction(action);
              }}
            >
              {ACTION_LABELS[action]}
              {blockReason === 'cooldown' ? '・待' : ''}
            </button>
          );
        })}
        {contextAction ? (
          <>
            <hr />
            <button
              title={contextAction.description}
              onClick={() => performContextAction(contextAction.id)}
            >
              {contextAction.label}
            </button>
          </>
        ) : null}
        <hr />
        <button
          onClick={() => {
            togglePanel();
          }}
        >
          ステータスを見る
        </button>
        <button onClick={toggleRecordPanel}>
          記録を見る
        </button>
        <button
          onClick={() => {
            togglePanel();
          }}
        >
          設定を見る
        </button>
        <button
          onClick={() => {
            void toggleAlwaysOnTop();
          }}
        >
          最前面表示 {alwaysOnTop ? 'ON' : 'OFF'}
        </button>
        <hr />
        <button className="danger" onClick={quitApp}>
          終了
        </button>
      </div>
    </div>
  );
}
