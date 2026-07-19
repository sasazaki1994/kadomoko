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
import QuietMomentPanel from './components/QuietMomentPanel';
import FocusSessionBadge from './components/FocusSessionBadge';
import FocusSessionPanel from './components/FocusSessionPanel';
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
  const quietMomentOpen = usePetStore((s) => s.quietMomentOpen);
  const focusSessionOpen = usePetStore((s) => s.focusSessionOpen);
  const activeFocusSession = usePetStore((s) => s.pet.focusSessions.active);
  const activeDiscovery = usePetStore((s) => s.pet.discovery.active);
  const activeTinyPlay = usePetStore((s) => s.pet.tinyPlay.active);
  const dreams = usePetStore((s) => s.pet.dreams);
  const init = usePetStore((s) => s.init);
  const tick = usePetStore((s) => s.tick);
  const catchUpOffline = usePetStore((s) => s.catchUpOffline);
  const progressFocusSession = usePetStore((s) => s.progressFocusSession);
  const setMenuOpen = usePetStore((s) => s.setMenuOpen);
  const toggleDevPanel = usePetStore((s) => s.toggleDevPanel);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!loaded) return undefined;
    const interval = setInterval(tick, BALANCE.time.updateIntervalMs);
    return () => clearInterval(interval);
  }, [loaded, tick]);

  useEffect(() => {
    if (!loaded) return undefined;
    const interval = setInterval(progressFocusSession, 1_000);
    return () => clearInterval(interval);
  }, [loaded, progressFocusSession]);

  useEffect(() => {
    const unsubscribe = window.kadomoco?.onPowerResume(() => catchUpOffline(true));
    return unsubscribe;
  }, [catchUpOffline]);

  useEffect(() => {
    if (!loaded) return undefined;
    const catchUpWhenVisible = () => {
      if (document.visibilityState === 'visible') catchUpOffline();
    };
    document.addEventListener('visibilitychange', catchUpWhenVisible);
    return () => document.removeEventListener('visibilitychange', catchUpWhenVisible);
  }, [catchUpOffline, loaded]);

  useEffect(() => {
    // Keep the in-app menu in sync when always-on-top is toggled from the tray.
    const unsubscribe = window.kadomoco?.onAlwaysOnTopChanged((value) => {
      usePetStore.setState((s) => ({ alwaysOnTop: value, settings: { ...s.settings, alwaysOnTop: value } }));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const expanded = panelOpen || devPanelOpen || menuOpen || recordPanelOpen || quietMomentOpen || focusSessionOpen;
    const size = expanded ? WINDOW_EXPANDED : WINDOW_NORMAL;
    void window.kadomoco?.setWindowSize(size, size);
  }, [panelOpen, devPanelOpen, menuOpen, recordPanelOpen, quietMomentOpen, focusSessionOpen]);

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
      <SeasonAmbient hidden={menuOpen || panelOpen || recordPanelOpen || devPanelOpen || quietMomentOpen || focusSessionOpen} />
      {!activeFocusSession && !menuOpen && !panelOpen && !recordPanelOpen && !devPanelOpen && !quietMomentOpen && !focusSessionOpen && <DiscoveryHint discovery={activeDiscovery} />}
      {!activeFocusSession && !menuOpen && !panelOpen && !recordPanelOpen && !devPanelOpen && !quietMomentOpen && !focusSessionOpen && <DreamHint dreams={dreams} />}
      {activeFocusSession && !menuOpen && !panelOpen && !recordPanelOpen && !devPanelOpen && !quietMomentOpen && !focusSessionOpen && (
        <FocusSessionBadge session={activeFocusSession} />
      )}
      <SpeechBubble />
      <TinyPlayLayer active={activeTinyPlay} hidden={Boolean(activeFocusSession) || menuOpen || panelOpen || recordPanelOpen || devPanelOpen || quietMomentOpen || focusSessionOpen} />
      <PetCharacter />
      {menuOpen && <PetMenu />}
      {panelOpen && <StatusPanel />}
      {recordPanelOpen && <RecordPanel />}
      {quietMomentOpen && <QuietMomentPanel />}
      {focusSessionOpen && <FocusSessionPanel />}
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
