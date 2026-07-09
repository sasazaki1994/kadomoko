import { usePetStore } from '../store/usePetStore';

export default function PetMenu() {
  const alwaysOnTop = usePetStore((s) => s.alwaysOnTop);
  const performAction = usePetStore((s) => s.performAction);
  const togglePanel = usePetStore((s) => s.togglePanel);
  const toggleAlwaysOnTop = usePetStore((s) => s.toggleAlwaysOnTop);
  const setMenuOpen = usePetStore((s) => s.setMenuOpen);
  const quitApp = usePetStore((s) => s.quitApp);

  return (
    <div className="menu-backdrop" onMouseDown={() => setMenuOpen(false)}>
      <div className="pet-menu" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={() => performAction('feed')}>食べもの</button>
        <button onClick={() => performAction('touch')}>ふれあう</button>
        <button onClick={() => performAction('play')}>遊ぶ</button>
        <button onClick={() => performAction('rest')}>休ませる</button>
        <hr />
        <button
          onClick={() => {
            togglePanel();
          }}
        >
          ステータスを見る
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
