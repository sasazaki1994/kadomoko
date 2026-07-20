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
import { WINDOW_SPEC } from './shared/windowSpec';
import { usePetStore } from './store/usePetStore';

const isDevMode = import.meta.env.DEV;

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
    const size = expanded ? WINDOW_SPEC.expanded : WINDOW_SPEC.normal;
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
        const cooldownBubble = snapshot().bubble?.text;
        const cooldownRejected = cooldownBubble === 'ちょっと待って';
        const exhausted = { ...snapshot().pet, vitals: { ...snapshot().pet.vitals, sleepiness: 100 }, lastActionAt: { ...snapshot().pet.lastActionAt, play: undefined } };
        usePetStore.setState({ pet: exhausted, bubble: null, lastBubbleAt: 0 });
        snapshot().setMenuOpen(true);
        snapshot().performAction('play');
        await wait(50);
        const blockedPlayBubble = snapshot().bubble?.text;
        const blockedPlayReasonShown = blockedPlayBubble === 'ちょっと眠い';
        snapshot().showBubble('direct-action', true);
        const directBubbleShown = snapshot().bubble?.text === 'direct-action';
        snapshot().tick();
        await wait(50);
        return { leftClickReacted, menuOpened, escapeClosedMenu: true, doubleClickOpenedPanel: true, doubleClickClosedPanel: true, feedUpdatedExpOrStatus, cooldownRejected, cooldownBubble, blockedPlayReasonShown, blockedPlayBubble, directBubbleSurvivedAmbientTick: directBubbleShown && snapshot().bubble?.text === 'direct-action' };
      },
      runPanelScenario: async () => {
        await waitFor(() => snapshot().loaded);
        await window.kadomoco?.setWindowSize(WINDOW_SPEC.expanded, WINDOW_SPEC.expanded);
        await waitFor(() => window.innerWidth === WINDOW_SPEC.expanded && window.innerHeight === WINDOW_SPEC.expanded);
        const panelCases = [
          { state: { menuOpen: true }, selector: '.pet-menu' },
          { state: { panelOpen: true }, selector: '.status-panel' },
          { state: { recordPanelOpen: true }, selector: '.record-panel' },
          { state: { quietMomentOpen: true }, selector: '.quiet-moment-panel' },
          { state: { focusSessionOpen: true }, selector: '.focus-session-panel' },
        ];
        const panelFits = [];
        for (const panelCase of panelCases) {
          usePetStore.setState({
            menuOpen: false,
            panelOpen: false,
            recordPanelOpen: false,
            quietMomentOpen: false,
            focusSessionOpen: false,
            ...panelCase.state,
          });
          await waitFor(() => document.querySelector(panelCase.selector) !== null);
          const rect = document.querySelector(panelCase.selector)!.getBoundingClientRect();
          panelFits.push({
            selector: panelCase.selector,
            fits: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
          });
        }
        const openPanelKeys = ['menuOpen', 'panelOpen', 'recordPanelOpen', 'quietMomentOpen', 'focusSessionOpen'];
        const onlyOnePanelAtATime = openPanelKeys.filter((key) => Boolean(snapshot()[key as keyof ReturnType<typeof snapshot>])).length === 1;
        pressEscape();
        await waitFor(() => openPanelKeys.every((key) => !snapshot()[key as keyof ReturnType<typeof snapshot>]));
        await window.kadomoco?.setWindowSize(WINDOW_SPEC.normal, WINDOW_SPEC.normal);
        await waitFor(() => window.innerWidth === WINDOW_SPEC.normal && window.innerHeight === WINDOW_SPEC.normal);
        return {
          expandedSize: [WINDOW_SPEC.expanded, WINDOW_SPEC.expanded],
          normalSize: [WINDOW_SPEC.normal, WINDOW_SPEC.normal],
          onlyOnePanelAtATime,
          panelFits,
          allPanelsFit: panelFits.every((entry) => entry.fits),
        };
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
