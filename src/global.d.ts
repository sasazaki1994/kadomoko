import type { KadomocoApi } from '../electron/preload';

type KadomocoE2eBridge = {
  waitLoaded: () => Promise<void>;
  runInteractionScenario: () => Promise<Record<string, unknown>>;
  runPanelScenario: () => Promise<Record<string, unknown>>;
  runPersistWriteScenario: () => Promise<Record<string, unknown>>;
  runPersistReadScenario: () => Promise<Record<string, unknown>>;
};

declare global {
  interface Window {
    /** Bridge exposed by the Electron preload script (absent in a plain browser). */
    kadomoco?: KadomocoApi;
    /** E2E-only marker exposed by the Electron preload script when KADOMOCO_E2E=1. */
    __kadomocoE2eEnabled?: true;
    /** Renderer-owned production E2E harness, installed only when the E2E marker is present. */
    __kadomocoE2e?: KadomocoE2eBridge;
  }
}

export {};
