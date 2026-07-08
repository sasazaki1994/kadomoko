import type { KadomocoApi } from '../electron/preload';

declare global {
  interface Window {
    /** Bridge exposed by the Electron preload script (absent in a plain browser). */
    kadomoco?: KadomocoApi;
  }
}

export {};
