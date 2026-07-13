import type { KadomocoApi } from '../electron/preload';

declare global {
  interface Window {
    /** Bridge exposed by the Electron preload script (absent in a plain browser). */
    kadomoco?: KadomocoApi;
  }
}

export {};

type KadomocoE2eBridge = {
  bindStore: (store: unknown) => void;
  waitLoaded: () => Promise<void>;
  runInteractionScenario: () => Promise<Record<string, unknown>>;
  runPanelScenario: () => Promise<Record<string, unknown>>;
  runPersistWriteScenario: () => Promise<Record<string, unknown>>;
  runPersistReadScenario: () => Promise<Record<string, unknown>>;
};

declare global {
  interface Window {
    /** Production-only test bridge exposed only when KADOMOCO_E2E=1 in Electron. */
    __kadomocoE2e: KadomocoE2eBridge;
  }
}
