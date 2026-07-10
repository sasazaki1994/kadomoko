import { useEffect } from 'react';
import DevToolsPanel from './components/DevToolsPanel';
import DiscoveryHint from './components/DiscoveryHint';
import DreamHint from './components/DreamHint';
import PetCharacter from './components/PetCharacter';
import PetMenu from './components/PetMenu';
import SpeechBubble from './components/SpeechBubble';
import TinyPlayLayer from './components/TinyPlayLayer';
import RecordPanel from './components/RecordPanel';
import SeasonAmbient from './components/SeasonAmbient';
import StatusPanel from './components/StatusPanel';
import { BALANCE } from './game/data/balance';
import { usePetStore } from './store/usePetStore';

const isDevMode = import.meta.env.DEV;

const WINDOW_NORMAL = 180;
const WINDOW_EXPANDED = 240;

export default function App() {
  const loaded = usePetStore((s) => s.loaded);
  const panelOpen = usePetStore((s) => s.panelOpen);
  const menuOpen = usePetStore((s) => s.menuOpen);
  const devPanelOpen = usePetStore((s) => s.devPanelOpen);
  const recordPanelOpen = usePetStore((s) => s.recordPanelOpen);
  const activeDiscovery = usePetStore((s) => s.pet.discovery.active);
  const activeTinyPlay = usePetStore((s) => s.pet.tinyPlay.active);
  const dreams = usePetStore((s) => s.pet.dreams);
  const init = usePetStore((s) => s.init);
  const tick = usePetStore((s) => s.tick);
  const catchUpOffline = usePetStore((s) => s.catchUpOffline);
  const setMenuOpen = usePetStore((s) => s.setMenuOpen);
  const toggleDevPanel = usePetStore((s) => s.toggleDevPanel);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const interval = setInterval(tick, BALANCE.time.updateIntervalMs);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    const unsubscribe = window.kadomoco?.onPowerResume(() => catchUpOffline(true));
    return unsubscribe;
  }, [catchUpOffline]);

  useEffect(() => {
    // Keep the in-app menu in sync when always-on-top is toggled from the tray.
    const unsubscribe = window.kadomoco?.onAlwaysOnTopChanged((value) => {
      usePetStore.setState((s) => ({ alwaysOnTop: value, settings: { ...s.settings, alwaysOnTop: value } }));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const expanded = panelOpen || devPanelOpen || menuOpen || recordPanelOpen;
    const size = expanded ? WINDOW_EXPANDED : WINDOW_NORMAL;
    void window.kadomoco?.setWindowSize(size, size);
  }, [panelOpen, devPanelOpen, menuOpen, recordPanelOpen]);

  if (!loaded) {
    return <div className="app-root" />;
  }

  return (
    <div
      className="app-root"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(!menuOpen);
      }}
    >
      <SeasonAmbient hidden={menuOpen || panelOpen || recordPanelOpen || devPanelOpen} />
      {!menuOpen && !panelOpen && !recordPanelOpen && !devPanelOpen && <DiscoveryHint discovery={activeDiscovery} />}
      {!menuOpen && !panelOpen && !recordPanelOpen && !devPanelOpen && <DreamHint dreams={dreams} />}
      <SpeechBubble />
      <TinyPlayLayer active={activeTinyPlay} hidden={menuOpen || panelOpen || recordPanelOpen || devPanelOpen} />
      <PetCharacter />
      {menuOpen && <PetMenu />}
      {panelOpen && <StatusPanel />}
      {recordPanelOpen && <RecordPanel />}
      {isDevMode && devPanelOpen && <DevToolsPanel />}
      {isDevMode && (
        <button
          className="dev-toggle"
          title="DevTools"
          onClick={(e) => {
            e.stopPropagation();
            toggleDevPanel();
          }}
        >
          D
        </button>
      )}
    </div>
  );
}
