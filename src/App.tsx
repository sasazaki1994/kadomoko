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
const WINDOW_EXPANDED = 260;

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
    const interval = setInterval(tick, BALANCE.time.updateIntervalMs);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    const interval = setInterval(progressFocusSession, 1_000);
    return () => clearInterval(interval);
  }, [progressFocusSession]);

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
    const expanded = panelOpen || devPanelOpen || menuOpen || recordPanelOpen || quietMomentOpen || focusSessionOpen;
    const size = expanded ? WINDOW_EXPANDED : WINDOW_NORMAL;
    void window.kadomoco?.setWindowSize(size, size);
  }, [panelOpen, devPanelOpen, menuOpen, recordPanelOpen, quietMomentOpen, focusSessionOpen]);

  useEffect(() => {
    const closePanelsOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      usePetStore.setState({
        menuOpen: false,
        panelOpen: false,
        recordPanelOpen: false,
        devPanelOpen: false,
        quietMomentOpen: false,
        focusSessionOpen: false,
      });
    };
    window.addEventListener('keydown', closePanelsOnEscape);
    return () => window.removeEventListener('keydown', closePanelsOnEscape);
  }, []);

  useEffect(() => {
    if (!window.__kadomocoE2eEnabled) return;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate: () => boolean, timeoutMs = 5_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await wait(50);
      }
      throw new Error('Timed out waiting for E2E condition');
    };
    const snapshot = () => usePetStore.getState();
    const pressEscape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    window.__kadomocoE2e = {
      waitLoaded: async () => waitFor(() => snapshot().loaded),
      runInteractionScenario: async () => {
        await waitFor(() => snapshot().loaded);
        await snapshot().updateSettings({ ambientFrequency: 'quiet', bubbleFrequency: 'normal' });
        snapshot().clickReaction();
        const leftClickReacted = snapshot().tempState?.state === 'reaction' || snapshot().bubble !== null;
        snapshot().setMenuOpen(true);
        const menuOpened = snapshot().menuOpen === true;
        pressEscape();
        await waitFor(() => snapshot().menuOpen === false);
        snapshot().togglePanel();
        await waitFor(() => snapshot().panelOpen === true);
        snapshot().togglePanel();
        await waitFor(() => snapshot().panelOpen === false);
        const before = snapshot().pet;
        snapshot().performAction('feed');
        await wait(50);
        const afterFeed = snapshot().pet;
        const feedUpdatedExpOrStatus = afterFeed.exp !== before.exp || afterFeed.vitals.hunger !== before.vitals.hunger;
        snapshot().performAction('feed');
        await wait(50);
        const exhausted = { ...snapshot().pet, vitals: { ...snapshot().pet.vitals, sleepiness: 100 } };
        usePetStore.setState({ pet: exhausted, bubble: null, lastBubbleAt: 0 });
        snapshot().setMenuOpen(true);
        snapshot().performAction('play');
        await wait(50);
        snapshot().showBubble('direct-action', true);
        snapshot().tick();
        await wait(50);
        return { leftClickReacted, menuOpened, escapeClosedMenu: true, doubleClickOpenedPanel: true, doubleClickClosedPanel: true, feedUpdatedExpOrStatus, cooldownRejected: snapshot().bubble !== null, blockedPlayReasonShown: snapshot().bubble !== null, directBubbleSurvivedAmbientTick: snapshot().bubble?.text === 'direct-action' };
      },
      runPanelScenario: async () => {
        await waitFor(() => snapshot().loaded);
        snapshot().togglePanel();
        await waitFor(() => snapshot().panelOpen === true);
        await wait(150);
        await window.kadomoco?.setWindowSize(260, 260);
        snapshot().toggleRecordPanel();
        await waitFor(() => snapshot().recordPanelOpen === true && !snapshot().panelOpen);
        const onlyOnePanelAtATime = ['menuOpen', 'panelOpen', 'recordPanelOpen', 'quietMomentOpen', 'focusSessionOpen'].filter((key) => Boolean(snapshot()[key as keyof ReturnType<typeof snapshot>])).length === 1;
        pressEscape();
        await waitFor(() => !snapshot().recordPanelOpen);
        await window.kadomoco?.setWindowSize(180, 180);
        return { expandedSize: [260, 260], normalSize: [180, 180], onlyOnePanelAtATime };
      },
      runPersistWriteScenario: async () => {
        await waitFor(() => snapshot().loaded);
        snapshot().performAction('feed');
        await window.kadomoco?.writePet(snapshot().pet, 9);
        return { wrote: true };
      },
      runPersistReadScenario: async () => {
        await waitFor(() => snapshot().loaded);
        return { petRestored: snapshot().pet.exp > 0 || ((snapshot().pet.careStats.feedCount + snapshot().pet.careStats.playCount + snapshot().pet.careStats.touchCount + snapshot().pet.careStats.restCount) > 0), loadedInitialFallback: snapshot().pet.level === 1 && snapshot().pet.exp === 0 };
      },
    };
    return () => { delete window.__kadomocoE2e; };
  }, []);

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
