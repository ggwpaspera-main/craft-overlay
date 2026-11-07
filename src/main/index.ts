import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, shell } from 'electron';
import { join } from 'node:path';
import { createNativeInput, type ForegroundSnapshot, type NativeInput } from './native-input';

const CAPTURE_HOTKEYS = ['Alt+F'];
const HIDE_GOAL_HOTKEY = 'Alt+R';

// Оверлей временно отключён, но код окна сохранён.
const OVERLAY_ENABLED = false;

const OVERLAY_WIDTH = 480;
const OVERLAY_MAX_HEIGHT = 760;
const GOAL_WIDTH = 820;
const GOAL_WIDTH_EXPANDED = 1320;
const GOAL_HEIGHT = 760;

const GAME_PROCESS_NAMES = new Set([
  'pathofexilesteam.exe',
  'pathofexile.exe',
  'pathofexile2.exe',
  'pathofexile2steam.exe',
]);


let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayReady: Promise<void> | null = null;
let goalWindow: BrowserWindow | null = null;
let goalReady: Promise<void> | null = null;
let goalHasContent = false;
let goalPositioned = false;
let captureInProgress = false;
let lastOverlayText: string | null = null;
let overlayHasContent = false;
let clipboardWatcher: NodeJS.Timeout | null = null;
let lastClipboardText: string | null = null;
let nativeInput: NativeInput | null = null;

app.setAppUserModelId('com.craftoverlay.app');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (overlayWindow?.isVisible()) {
    overlayWindow.moveTop();
  } else if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 840,
    minWidth: 780,
    minHeight: 600,
    title: 'Craft Overlay — PoE2',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(join(__dirname, 'renderer/index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow(): void {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_MAX_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: false,
    type: 'toolbar',
    roundedCorners: false,
    autoHideMenuBar: true,
    title: 'Craft Overlay',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.loadFile(join(__dirname, 'renderer/overlay.html'));

  overlayReady = new Promise((resolve) => {
    overlayWindow?.webContents.once('did-finish-load', () => resolve());
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    overlayReady = null;
  });
}

async function ensureOverlayWindow(): Promise<BrowserWindow> {
  if (!overlayWindow) createOverlayWindow();
  if (!overlayWindow) throw new Error('Не удалось создать окно оверлея');
  await overlayReady;
  return overlayWindow;
}

function positionOverlay(window: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { workArea } = display;

  const height = Math.min(OVERLAY_MAX_HEIGHT, workArea.height - 24);

  let x = cursor.x + 24;
  if (x + OVERLAY_WIDTH > workArea.x + workArea.width) {
    x = cursor.x - OVERLAY_WIDTH - 24;
  }
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - OVERLAY_WIDTH - 8));

  let y = cursor.y - 48;
  if (y + height > workArea.y + workArea.height) {
    y = workArea.y + workArea.height - height - 8;
  }
  y = Math.max(workArea.y + 8, y);

  window.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: OVERLAY_WIDTH,
    height: Math.round(height),
  });
}

function looksLikeItem(text: string): boolean {
  return text.includes('--------') && /(Класс предмета|Item Class):/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isGameWindow(snapshot: ForegroundSnapshot | null): boolean {
  if (snapshot === null || snapshot.pid <= 0) return false;
  const processName = snapshot.processName.toLowerCase();
  if (GAME_PROCESS_NAMES.has(processName)) return true;
  if (/pathofexile|poe2/i.test(processName)) return true;
  return /path of exile|path of exile 2/i.test(snapshot.windowTitle);
}

async function waitForHotkeyRelease(input: NativeInput, initial: ForegroundSnapshot): Promise<boolean> {
  const deadline = Date.now() + 1500;
  while (input.heldKeys()) {
    if (Date.now() >= deadline) return false;
    const current = input.snapshot();
    if (!current || !isGameWindow(current) || current.pid !== initial.pid || current.hwnd !== initial.hwnd) {
      return false;
    }
    await sleep(25);
  }
  return true;
}

async function waitForCopiedItem(previous: string): Promise<string | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 2500) {
    const current = await clipboard.readText();
    if (looksLikeItem(current) && current !== previous) {
      return current;
    }
    await sleep(50);
  }

  const current = await clipboard.readText();
  return looksLikeItem(current) && current !== previous ? current : null;
}

function createGoalWindow(): void {
  goalWindow = new BrowserWindow({
    width: GOAL_WIDTH,
    height: GOAL_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    alwaysOnTop: false,
    type: 'toolbar',
    roundedCorners: false,
    autoHideMenuBar: true,
    title: 'Цель крафта',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  goalWindow.setAlwaysOnTop(true, 'screen-saver');
  goalWindow.setMenuBarVisibility(false);
  goalWindow.loadFile(join(__dirname, 'renderer/goal.html'));

  goalReady = new Promise((resolve) => {
    goalWindow?.webContents.once('did-finish-load', () => resolve());
  });

  goalWindow.on('closed', () => {
    goalWindow = null;
    goalReady = null;
    goalHasContent = false;
  });
}

async function ensureGoalWindow(): Promise<BrowserWindow> {
  if (!goalWindow) createGoalWindow();
  if (!goalWindow) throw new Error('Не удалось создать окно цели');
  await goalReady;
  return goalWindow;
}

function positionGoalWindow(window: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { workArea } = display;
  const goalBounds = window.getBounds();
  const width = goalBounds.width;
  const height = Math.min(goalBounds.height || GOAL_HEIGHT, workArea.height - 24);

  if (!OVERLAY_ENABLED || !overlayWindow) {
    const x = Math.max(workArea.x + 8, workArea.x + workArea.width - width - 16);
    const y = Math.max(workArea.y + 8, workArea.y + workArea.height - height - 16);
    window.setBounds({ x, y, width, height });
    return;
  }

  const overlayBounds = overlayWindow.getBounds();
  const baseX = overlayBounds.x;
  const baseY = overlayBounds.y;
  const baseWidth = overlayBounds.width;
  const baseHeight = overlayBounds.height;

  const rightX = baseX + baseWidth + 16;
  const leftX = baseX - width - 16;
  let sideX: number | null = null;
  if (rightX + width <= workArea.x + workArea.width - 8) sideX = rightX;
  else if (leftX >= workArea.x + 8) sideX = leftX;

  let x: number;
  let y: number;
  if (sideX !== null) {
    x = sideX;
    y = baseY;
  } else {
    x = baseX + Math.round((baseWidth - width) / 2);
    y = baseY + baseHeight + 12;
    if (y + height > workArea.y + workArea.height) y = baseY - height - 12;
    if (y < workArea.y + 8) y = baseY + 42;
  }

  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - width - 8));
  y = Math.max(workArea.y + 8, Math.min(y, workArea.y + workArea.height - height - 8));

  window.setBounds({ x: Math.round(x), y: Math.round(y), width, height });
}

async function sendGoalText(text: string | null): Promise<void> {
  const window = await ensureGoalWindow();
  window.webContents.send('capture:result', text);
  if (!text) {
    goalHasContent = false;
    window.hide();
  }
}

async function startClipboardWatcher(): Promise<void> {
  lastClipboardText = await clipboard.readText();
  clipboardWatcher = setInterval(() => {
    void (async () => {
      if (captureInProgress) return;
      let text = '';
      try {
        text = await clipboard.readText();
      } catch {
        return;
      }
      if (text === lastClipboardText) return;
      lastClipboardText = text;
      if (!looksLikeItem(text)) return;
      console.log('[clipboard] manual item detected');
      mainWindow?.webContents.send('capture:result', text);
      await showOverlay(text);
    })();
  }, 250);
}

async function showOverlay(text: string | null): Promise<void> {
  lastOverlayText = text;
  overlayHasContent = true;
  if (text !== null) lastClipboardText = text;
  await sendGoalText(text);
  if (!text) {
    goalWindow?.hide();
    return;
  }
  if (goalHasContent) {
    if (!goalPositioned) {
      positionGoalWindow(goalWindow as BrowserWindow);
      goalPositioned = true;
    }
    goalWindow?.showInactive();
    goalWindow?.setAlwaysOnTop(true, 'screen-saver');
  }
}

async function captureItemFromGame(): Promise<void> {
  if (captureInProgress) return;
  if (!nativeInput) {
    console.warn('[capture] native input недоступен');
    return;
  }
  const initial = nativeInput.snapshot();
  if (!initial || !isGameWindow(initial)) {
    console.log(
      `[capture] активное окно не игра — отмена: ${initial?.processName ?? 'none'} | ${initial?.windowTitle ?? ''}`,
    );
    return;
  }

  captureInProgress = true;
  console.log('[hotkey] pressed');
  let clearedItem: string | null = null;

  try {
    // Не показываем и не фокусируем окна до отправки Ctrl+C.
    const released = await waitForHotkeyRelease(nativeInput, initial);
    if (!released) {
      console.log('[capture] клавиши не отпущены или фокус сменился — отмена');
      return;
    }
    const previous = await clipboard.readText();
    if (looksLikeItem(previous)) {
      clearedItem = previous;
      clipboard.clear();
    }
    nativeInput.sendCtrlC();
    console.log('[capture] Ctrl+C sent');
    const text = await waitForCopiedItem(clearedItem === null ? previous : '');

    const current = nativeInput.snapshot();
    if (!current || !isGameWindow(current) || current.pid !== initial.pid || current.hwnd !== initial.hwnd) {
      console.log('[capture] фокус сменился после Ctrl+C — отмена');
      return;
    }

    console.log(`[capture] clipboard: ${text ? `${text.length} chars` : 'no item'}`);
    mainWindow?.webContents.send('capture:result', text);
    await showOverlay(text);
  } catch (error) {
    console.error('Не удалось скопировать предмет из игры:', error);
    mainWindow?.webContents.send('capture:result', null);
    await showOverlay(null);
  } finally {
    if (clearedItem !== null && !clipboard.readText()) clipboard.writeText(clearedItem);
    captureInProgress = false;
  }
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text);
  });
  ipcMain.on('overlay:hide', () => {
    const wasVisible = overlayWindow?.isVisible();
    overlayWindow?.hide();
    goalWindow?.hide();
    console.log(`[overlay] hide via titlebar: ${wasVisible} -> ${overlayWindow?.isVisible()}`);
  });
  ipcMain.on('goal:available', (event, available: unknown) => {
    if (!goalWindow || event.sender !== goalWindow.webContents) return;
    goalHasContent = available === true;
    if (goalHasContent) {
      if (!goalPositioned) {
        positionGoalWindow(goalWindow);
        goalPositioned = true;
      }
      goalWindow.showInactive();
      goalWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      goalWindow.hide();
    }
  });
  ipcMain.on('goal:expanded', (event, expanded: unknown) => {
    if (!goalWindow || event.sender !== goalWindow.webContents) return;
    const bounds = goalWindow.getBounds();
    const width = expanded === true ? GOAL_WIDTH_EXPANDED : GOAL_WIDTH;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { workArea } = display;
    let x = bounds.x;
    if (x + width > workArea.x + workArea.width - 8) {
      x = workArea.x + workArea.width - width - 8;
    }
    x = Math.max(workArea.x + 8, x);
    goalWindow.setBounds({ x, y: bounds.y, width, height: bounds.height });
  });
  ipcMain.on('goal:move', (event, dx: unknown, dy: unknown) => {
    if (!goalWindow || event.sender !== goalWindow.webContents) return;
    if (typeof dx !== 'number' || typeof dy !== 'number') return;
    const bounds = goalWindow.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2),
    });
    const { workArea } = display;
    const x = Math.max(
      workArea.x + 8,
      Math.min(bounds.x + Math.round(dx), workArea.x + workArea.width - bounds.width - 8),
    );
    const y = Math.max(
      workArea.y + 8,
      Math.min(bounds.y + Math.round(dy), workArea.y + workArea.height - bounds.height - 8),
    );
    goalWindow.setPosition(x, y);
  });
  ipcMain.on('goal:hide', (event) => {
    if (!goalWindow || event.sender !== goalWindow.webContents) return;
    goalWindow.hide();
  });
  ipcMain.on('overlay:quit', () => {
    console.log('[overlay] quit via titlebar');
    app.quit();
  });
  ipcMain.on('overlay:move', (_event, dx: unknown, dy: unknown) => {
    if (!overlayWindow || typeof dx !== 'number' || typeof dy !== 'number') return;
    const [x = 0, y = 0] = overlayWindow.getPosition();
    overlayWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  });

  createMainWindow();
  if (OVERLAY_ENABLED) createOverlayWindow();
  nativeInput = createNativeInput();
  if (nativeInput) {
    console.log('[native] uiohook/koffi loaded');
  } else {
    console.warn('[native] uiohook/koffi недоступны');
  }
  void startClipboardWatcher();

  for (const hotkey of CAPTURE_HOTKEYS) {
    const registered = globalShortcut.register(hotkey, () => {
      void captureItemFromGame();
    });
    if (!registered) {
      console.warn(`Не удалось зарегистрировать глобальный хоткей ${hotkey}`);
    } else {
      console.log(`[hotkey] registered ${hotkey}`);
    }
  }

  const hideGoalRegistered = globalShortcut.register(HIDE_GOAL_HOTKEY, () => {
    console.log('[hotkey] Alt+R hide goal');
    goalWindow?.hide();
  });
  if (!hideGoalRegistered) {
    console.warn(`Не удалось зарегистрировать глобальный хоткей ${HIDE_GOAL_HOTKEY}`);
  } else {
    console.log(`[hotkey] registered ${HIDE_GOAL_HOTKEY}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (clipboardWatcher) clearInterval(clipboardWatcher);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
