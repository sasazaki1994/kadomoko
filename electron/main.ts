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

const store = new Store<StoreSchema>({
  name: 'kadomoco-save',
  defaults: {
    version: 1,
    pet: null,
    settings: { alwaysOnTop: false, volume: 50, statusDisplayMode: 'both', ambientFrequency: 'normal', bubbleFrequency: 'normal', reduceActivityWhenFullscreen: true },
    windowPosition: null,
    lastLaunchedAt: 0,
  },
});

const backupStore = new Store<SaveEnvelope>({
  name: 'kadomoco-save-backup',
  defaults: {
    version: 1,
    pet: null,
    settings: { alwaysOnTop: false, volume: 50, statusDisplayMode: 'both', ambientFrequency: 'normal', bubbleFrequency: 'normal', reduceActivityWhenFullscreen: true },
    windowPosition: null,
    lastLaunchedAt: 0,
  },
});

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let dragInterval: ReturnType<typeof setInterval> | null = null;
let movedSaveTimer: ReturnType<typeof setTimeout> | null = null;

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

function createTrayIcon() {
  // Draw a small pale round blob programmatically so no image asset is needed.
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
        // BGRA: pale warm beige body.
        buffer[i] = 0xc8;
        buffer[i + 1] = 0xe0;
        buffer[i + 2] = 0xf2;
        buffer[i + 3] = 0xff;
      } else {
        buffer[i + 3] = 0x00;
      }
    }
  }
  // Simple dark eyes.
  for (const [ex, ey] of [
    [5, 7],
    [10, 7],
  ]) {
    const i = (ey * size + ex) * 4;
    buffer[i] = 0x55;
    buffer[i + 1] = 0x4a;
    buffer[i + 2] = 0x46;
    buffer[i + 3] = 0xff;
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
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
    win.webContents.once('did-finish-load', () => {
      console.log(`[kadomoco-e2e-ready] frameless=${FRAMELESS_WINDOW} transparent=${TRANSPARENT_WINDOW} skipTaskbar=${SKIP_TASKBAR} devTools=${win?.webContents.isDevToolsOpened()}`);
    });
  }

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
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
