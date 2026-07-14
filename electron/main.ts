import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  Tray,
} from 'electron';
import Store from 'electron-store';
import path from 'node:path';
import fs from 'node:fs';

const WINDOW_SIZE = 180;
const WINDOW_MIN = 120;
const WINDOW_MAX = 260;
const SCREEN_MARGIN = 12;
const FRAMELESS_WINDOW = true;
const TRANSPARENT_WINDOW = true;
const SKIP_TASKBAR = true;

type StoreSchema = {
  version: number;
  pet: unknown;
  settings: { alwaysOnTop: boolean; volume: number; statusDisplayMode?: string; ambientFrequency?: string; bubbleFrequency?: string; reduceActivityWhenFullscreen?: boolean };
  windowPosition: { x: number; y: number } | null;
  lastLaunchedAt: number;
};

type SaveEnvelope = StoreSchema;

const storeDefaults: StoreSchema = {
  version: 1,
  pet: null,
  settings: { alwaysOnTop: false, volume: 50, statusDisplayMode: 'both', ambientFrequency: 'normal', bubbleFrequency: 'normal', reduceActivityWhenFullscreen: true },
  windowPosition: null,
  lastLaunchedAt: 0,
};

let store: Store<StoreSchema>;
let backupStore: Store<SaveEnvelope>;

function quarantineCorruptStoreFile(name: string) {
  const file = path.join(app.getPath('userData'), `${name}.json`);
  if (!fs.existsSync(file)) return;
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (parseError) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantined = path.join(app.getPath('userData'), `${name}.corrupt-${stamp}.json`);
    try {
      fs.renameSync(file, quarantined);
    } catch (renameError) {
      console.warn(`Failed to quarantine corrupt store file ${file}:`, renameError);
      try {
        fs.writeFileSync(file, JSON.stringify(storeDefaults, null, 2));
      } catch (writeError) {
        console.warn(`Failed to replace corrupt store file ${file}; electron-store may need to use its own fallback.`, writeError, parseError);
      }
    }
  }
}

function createStore(name: string) {
  quarantineCorruptStoreFile(name);
  return new Store<StoreSchema>({ name, defaults: storeDefaults });
}

function initializeStores() {
  store = createStore('kadomoco-save');
  backupStore = createStore('kadomoco-save-backup');
  const primaryIsInitial = store.get('pet') === null && store.get('lastLaunchedAt') === 0;
  const backupHasData = backupStore.get('pet') !== null || backupStore.get('lastLaunchedAt') !== 0 || backupStore.get('settings').alwaysOnTop || backupStore.get('windowPosition') !== null;
  if (primaryIsInitial && backupHasData) {
    store.set(backupStore.store);
  }
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let dragInterval: ReturnType<typeof setInterval> | null = null;
let movedSaveTimer: ReturnType<typeof setTimeout> | null = null;
const e2eConsoleErrors: string[] = [];
const e2eUnhandledErrors: string[] = [];

function bottomRightPosition(width: number, height: number): { x: number; y: number } {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - width - SCREEN_MARGIN,
    y: area.y + area.height - height - SCREEN_MARGIN,
  };
}

/** Returns the saved position if it is still visible on some display. */
function resolveInitialPosition(width: number, height: number): { x: number; y: number } {
  const saved = store.get('windowPosition');
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    const visible = screen.getAllDisplays().some((display) => {
      const a = display.workArea;
      return (
        saved.x + width > a.x + 8 &&
        saved.x < a.x + a.width - 8 &&
        saved.y + height > a.y + 8 &&
        saved.y < a.y + a.height - 8
      );
    });
    if (visible) return saved;
  }
  return bottomRightPosition(width, height);
}

function persistWindowPosition() {
  if (!win) return;
  const [x, y] = win.getPosition();
  writeBackup();
  store.set('windowPosition', { x, y });
}

function currentPrimarySave() {
  return {
    version: store.get('version'),
    pet: store.get('pet'),
    settings: store.get('settings'),
    windowPosition: store.get('windowPosition'),
    lastLaunchedAt: store.get('lastLaunchedAt'),
  };
}

function writeBackup() {
  backupStore.set(currentPrimarySave());
}

function createFallbackTrayIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const radius = 6.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        buffer[i] = 0xc8;
        buffer[i + 1] = 0xe0;
        buffer[i + 2] = 0xf2;
        buffer[i + 3] = 0xff;
      } else {
        buffer[i + 3] = 0x00;
      }
    }
  }
  for (const [ex, ey] of [[5, 7], [10, 7]]) {
    const i = (ey * size + ex) * 4;
    buffer[i] = 0x55;
    buffer[i + 1] = 0x4a;
    buffer[i + 2] = 0x46;
    buffer[i + 3] = 0xff;
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

function resolveTrayIconPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'tray-icon.png')]
    : [path.join(process.cwd(), 'build', 'tray-icon.png')];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createTrayIcon() {
  const iconPath = resolveTrayIconPath();
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
    console.warn(`Tray icon file could not be decoded: ${iconPath}`);
  } else {
    console.warn('Tray icon file was not found; using fallback tray icon.');
  }
  return createFallbackTrayIcon();
}

function updateTrayMenu() {
  if (!tray) return;
  const alwaysOnTop = store.get('settings').alwaysOnTop;
  const menu = Menu.buildFromTemplate([
    {
      label: '表示する',
      click: () => {
        win?.show();
      },
    },
    {
      label: '最前面に表示',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (item) => {
        setAlwaysOnTop(item.checked);
      },
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function setAlwaysOnTop(value: boolean) {
  const settings = store.get('settings');
  writeBackup();
  store.set('settings', { ...settings, alwaysOnTop: value });
  win?.setAlwaysOnTop(value);
  updateTrayMenu();
  win?.webContents.send('settings:always-on-top-changed', value);
}

function createWindow() {
  const settings = store.get('settings');
  const position = resolveInitialPosition(WINDOW_SIZE, WINDOW_SIZE);

  win = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    minWidth: WINDOW_MIN,
    minHeight: WINDOW_MIN,
    maxWidth: WINDOW_MAX,
    maxHeight: WINDOW_MAX,
    x: position.x,
    y: position.y,
    frame: !FRAMELESS_WINDOW,
    transparent: TRANSPARENT_WINDOW,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: SKIP_TASKBAR,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (process.env.KADOMOCO_E2E === '1' && level >= 3) e2eConsoleErrors.push(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (process.env.KADOMOCO_E2E === '1') e2eUnhandledErrors.push(`render-process-gone:${details.reason}`);
  });
  win.webContents.on('unresponsive', () => {
    if (process.env.KADOMOCO_E2E === '1') e2eUnhandledErrors.push('renderer-unresponsive');
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win?.hide();
    }
  });

  win.on('moved', () => {
    if (movedSaveTimer) clearTimeout(movedSaveTimer);
    movedSaveTimer = setTimeout(persistWindowPosition, 500);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (process.env.KADOMOCO_E2E === '1') {
    win.webContents.once('did-finish-load', async () => {
      await runE2eScenario();
    });
  }

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function evaluateRenderer(script: string) {
  if (!win) return null;
  return win.webContents.executeJavaScript(script, true);
}

async function waitForE2eCondition(predicate: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for E2E main-process condition');
}

async function runE2eScenario() {
  if (!win) return;
  const scenario = process.env.KADOMOCO_E2E_SCENARIO ?? 'window';
  const base = {
    windowCount: BrowserWindow.getAllWindows().length,
    frameless: FRAMELESS_WINDOW,
    transparent: TRANSPARENT_WINDOW,
    skipTaskbar: SKIP_TASKBAR,
    initialSize: win.getSize(),
    devTools: win.webContents.isDevToolsOpened(),
  };
  try {
    let result: Record<string, unknown> = {};
    if (scenario === 'window') {
      result = await evaluateRenderer(`(async()=>{await window.__kadomocoE2e.waitLoaded();return {devButtonVisible:!!document.querySelector('.dev-toggle')}})()`) as Record<string, unknown>;
    } else if (scenario === 'interaction') {
      result = await evaluateRenderer(`window.__kadomocoE2e.runInteractionScenario()`) as Record<string, unknown>;
    } else if (scenario === 'panels') {
      result = await evaluateRenderer(`window.__kadomocoE2e.runPanelScenario()`) as Record<string, unknown>;
      result.expandedSize = result.expandedSize ?? win.getSize();
      result.withinDisplay = screen.getAllDisplays().some((display) => {
        const b = win!.getBounds();
        const a = display.workArea;
        return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
      });
    } else if (scenario === 'persist-write') {
      win.setPosition(64, 72);
      persistWindowPosition();
      setAlwaysOnTop(true);
      result = await evaluateRenderer(`window.__kadomocoE2e.runPersistWriteScenario()`) as Record<string, unknown>;
    } else if (scenario === 'persist-read') {
      result = await evaluateRenderer(`window.__kadomocoE2e.runPersistReadScenario()`) as Record<string, unknown>;
      result.positionRestored = win.getPosition()[0] === 64 && win.getPosition()[1] === 72;
      result.alwaysOnTopRestored = win.isAlwaysOnTop();
    } else if (scenario === 'lifecycle') {
      const id = win.id;
      win.close();
      const closeHidWindow = !win.isVisible() && BrowserWindow.getAllWindows().length === 1;
      win.show();
      setAlwaysOnTop(!store.get('settings').alwaysOnTop);
      let beforeQuitObserved = false;
      app.once('before-quit', (event) => {
        beforeQuitObserved = true;
        event.preventDefault();
      });
      await evaluateRenderer(`window.kadomoco.quitApp()`);
      await waitForE2eCondition(() => beforeQuitObserved);
      result = {
        closeHidWindow,
        showReusedWindow: win.id === id && win.isVisible(),
        trayAlwaysOnTopSynced: win.isAlwaysOnTop() === store.get('settings').alwaysOnTop,
        quitRequested: beforeQuitObserved && isQuitting,
      };
    } else {
      throw new Error(`Unsupported KADOMOCO_E2E_SCENARIO: ${scenario}`);
    }
    console.log(`[kadomoco-e2e-result] ${JSON.stringify({ ok: true, ...base, ...result, consoleErrors: e2eConsoleErrors, unhandledErrors: e2eUnhandledErrors })}`);
  } catch (error) {
    console.log(`[kadomoco-e2e-result] ${JSON.stringify({ ok: false, ...base, error: error instanceof Error ? error.message : String(error), consoleErrors: e2eConsoleErrors, unhandledErrors: e2eUnhandledErrors })}`);
  }
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('KadoMoco');
  tray.on('click', () => {
    win?.show();
  });
  updateTrayMenu();
}

function registerIpc() {
  ipcMain.handle('save:load', () => ({
    primary: currentPrimarySave(),
    backup: backupStore.store,
  }));

  ipcMain.handle('save:write-pet', (_event, pet: unknown, version: number) => {
    writeBackup();
    store.set({
      pet,
      version,
      lastLaunchedAt: Date.now(),
    });
  });

  ipcMain.handle('settings:get', () => store.get('settings'));

  ipcMain.handle('settings:set-always-on-top', (_event, value: boolean) => {
    setAlwaysOnTop(Boolean(value));
    return store.get('settings').alwaysOnTop;
  });

  ipcMain.handle('settings:set', (_event, partial: Record<string, unknown>) => {
    const current = store.get('settings');
    writeBackup();
    store.set('settings', { ...current, ...partial });
    updateTrayMenu();
    return store.get('settings');
  });

  ipcMain.handle('window:set-size', (_event, width: number, height: number) => {
    if (!win) return;
    const w = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, Math.round(width)));
    const h = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, Math.round(height)));
    // Keep the bottom-right corner anchored, then clamp to the current display work area.
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const targetX = Math.min(Math.max(bounds.x + bounds.width - w, area.x), area.x + area.width - w);
    const targetY = Math.min(Math.max(bounds.y + bounds.height - h, area.y), area.y + area.height - h);
    win.setBounds({ x: targetX, y: targetY, width: w, height: h });
    persistWindowPosition();
  });

  ipcMain.on('drag:start', () => {
    if (!win || dragInterval) return;
    const cursor = screen.getCursorScreenPoint();
    const [winX, winY] = win.getPosition();
    const offsetX = cursor.x - winX;
    const offsetY = cursor.y - winY;
    dragInterval = setInterval(() => {
      if (!win) return;
      const point = screen.getCursorScreenPoint();
      win.setPosition(point.x - offsetX, point.y - offsetY);
    }, 16);
  });

  ipcMain.on('drag:end', () => {
    if (dragInterval) {
      clearInterval(dragInterval);
      dragInterval = null;
    }
    persistWindowPosition();
  });

  ipcMain.on('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

app.whenReady().then(() => {
  initializeStores();
  registerIpc();
  createWindow();
  createTray();

  powerMonitor.on('resume', () => {
    win?.webContents.send('power:resume');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else win?.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  persistWindowPosition();
});

// Keep running in the tray even when the window is hidden.
app.on('window-all-closed', () => {
  if (isQuitting) app.quit();
});
