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
