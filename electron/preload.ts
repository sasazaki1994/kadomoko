import { contextBridge, ipcRenderer } from 'electron';

export type KadomocoApi = {
  loadSave: () => Promise<unknown>;
  writePet: (pet: unknown, version: number) => Promise<void>;
  getSettings: () => Promise<Record<string, unknown>>;
  setSettings: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>;
  setAlwaysOnTop: (value: boolean) => Promise<boolean>;
  setWindowSize: (width: number, height: number) => Promise<void>;
  dragStart: () => void;
  dragEnd: () => void;
  quitApp: () => void;
  onPowerResume: (callback: () => void) => () => void;
  onAlwaysOnTopChanged: (callback: (value: boolean) => void) => () => void;
};

const api: KadomocoApi = {
  loadSave: () => ipcRenderer.invoke('save:load'),
  writePet: (pet, version) => ipcRenderer.invoke('save:write-pet', pet, version),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('settings:set-always-on-top', value),
  setWindowSize: (width, height) => ipcRenderer.invoke('window:set-size', width, height),
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  quitApp: () => ipcRenderer.send('app:quit'),
  onPowerResume: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('power:resume', listener);
    return () => ipcRenderer.off('power:resume', listener);
  },
  onAlwaysOnTopChanged: (callback) => {
    const listener = (_event: unknown, value: boolean) => callback(value);
    ipcRenderer.on('settings:always-on-top-changed', listener);
    return () => ipcRenderer.off('settings:always-on-top-changed', listener);
  },
};

contextBridge.exposeInMainWorld('kadomoco', api);

if (process.env.KADOMOCO_E2E === '1') {
  type E2eStoreState = Record<string, unknown> & {
    loaded?: boolean;
    getState?: never;
    updateSettings: (partial: Record<string, unknown>) => Promise<void>;
    clickReaction: () => void;
    setMenuOpen: (open: boolean) => void;
    togglePanel: () => void;
    toggleRecordPanel: () => void;
    performAction: (action: string) => void;
    showBubble: (text: string, force?: boolean) => void;
    tick: () => void;
    pet: { exp: number; level: number; careStats?: { totalCareActions?: number }; vitals: Record<string, number> };
    bubble: { text: string } | null;
    tempState: { state: string } | null;
  };
  let store: {
    getState: () => E2eStoreState;
    setState: (partial: Partial<E2eStoreState> | ((state: E2eStoreState) => Partial<E2eStoreState>)) => void;
  } | null = null;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate: () => boolean, timeoutMs = 5_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await wait(50);
    }
    throw new Error('Timed out waiting for E2E condition');
  };
  const loaded = () => Boolean(store?.getState().loaded);
  const snapshot = () => {
    if (!store) throw new Error('E2E store is not bound');
    return store.getState();
  };
  const pressEscape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  contextBridge.exposeInMainWorld('__kadomocoE2e', {
    bindStore: (boundStore: typeof store) => { store = boundStore; },
    waitLoaded: async () => waitFor(loaded),
    runInteractionScenario: async () => {
      await waitFor(loaded);
      const s = snapshot();
      s.updateSettings({ ambientFrequency: 'quiet', bubbleFrequency: 'normal' });
      s.clickReaction();
      const leftClickReacted = snapshot().tempState?.state === 'reaction' || snapshot().bubble !== null;
      s.setMenuOpen(true);
      const menuOpened = snapshot().menuOpen === true;
      pressEscape();
      await waitFor(() => snapshot().menuOpen === false);
      const escapeClosedMenu = true;
      snapshot().togglePanel();
      await waitFor(() => snapshot().panelOpen === true);
      const doubleClickOpenedPanel = true;
      snapshot().togglePanel();
      await waitFor(() => snapshot().panelOpen === false);
      const doubleClickClosedPanel = true;
      const before = snapshot().pet;
      snapshot().performAction('feed');
      await wait(50);
      const afterFeed = snapshot().pet;
      const feedUpdatedExpOrStatus = afterFeed.exp !== before.exp || afterFeed.vitals.hunger !== before.vitals.hunger;
      snapshot().performAction('feed');
      await wait(50);
      const cooldownRejected = snapshot().bubble !== null;
      const exhausted = { ...snapshot().pet, vitals: { ...snapshot().pet.vitals, sleepiness: 100 } };
      store!.setState({ pet: exhausted, bubble: null, lastBubbleAt: 0 });
      snapshot().setMenuOpen(true);
      snapshot().performAction('play');
      await wait(50);
      const blockedPlayReasonShown = snapshot().bubble !== null;
      snapshot().showBubble('direct-action', true);
      snapshot().tick();
      await wait(50);
      const directBubbleSurvivedAmbientTick = snapshot().bubble?.text === 'direct-action';
      return { leftClickReacted, menuOpened, escapeClosedMenu, doubleClickOpenedPanel, doubleClickClosedPanel, feedUpdatedExpOrStatus, cooldownRejected, blockedPlayReasonShown, directBubbleSurvivedAmbientTick };
    },
    runPanelScenario: async () => {
      await waitFor(loaded);
      snapshot().togglePanel();
      await waitFor(() => snapshot().panelOpen === true);
      await wait(150);
      const expandedSize = await api.setWindowSize(260, 260).then(() => [260, 260]);
      snapshot().toggleRecordPanel();
      await waitFor(() => snapshot().recordPanelOpen === true && !snapshot().panelOpen);
      const onlyOnePanelAtATime = ['menuOpen', 'panelOpen', 'recordPanelOpen', 'quietMomentOpen', 'focusSessionOpen'].filter((key) => snapshot()[key]).length === 1;
      pressEscape();
      await waitFor(() => !snapshot().recordPanelOpen);
      await api.setWindowSize(180, 180);
      return { expandedSize, normalSize: [180, 180], onlyOnePanelAtATime };
    },
    runPersistWriteScenario: async () => {
      await waitFor(loaded);
      snapshot().performAction('feed');
      await api.writePet(snapshot().pet, 9);
      return { wrote: true };
    },
    runPersistReadScenario: async () => {
      await waitFor(loaded);
      return {
        petRestored: snapshot().pet.exp > 0 || (snapshot().pet.careStats?.totalCareActions ?? 0) > 0,
        loadedInitialFallback: snapshot().pet.level === 1 && snapshot().pet.exp === 0,
      };
    },
  });
}
