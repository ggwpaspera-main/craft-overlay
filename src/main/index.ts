import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, shell } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const CAPTURE_HOTKEY = 'Alt+F';
const HIDE_OVERLAY_HOTKEY = 'Alt+Shift+F';

const OVERLAY_WIDTH = 480;
const OVERLAY_MAX_HEIGHT = 760;

const execFileAsync = promisify(execFile);

/**
 * Отправляет в активное окно Ctrl+Alt+C (advanced item copy).
 * Electron не умеет отправлять ввод другим приложениям, поэтому используем
 * Win32 keybd_event через PowerShell. Команда статическая — инъекции нет.
 */
const SEND_ADVANCED_COPY_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CraftOverlayKeyboard {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
[CraftOverlayKeyboard]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 30
[CraftOverlayKeyboard]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 30
[CraftOverlayKeyboard]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 70
[CraftOverlayKeyboard]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 20
[CraftOverlayKeyboard]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 20
[CraftOverlayKeyboard]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
`;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayReady: Promise<void> | null = null;
let captureInProgress = false;

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
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
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

async function sendAdvancedCopy(): Promise<void> {
  if (process.platform !== 'win32') return;

  // -EncodedCommand избавляет от проблем с кавычками в C#-коде при передаче
  // аргументов через Windows.
  const encoded = Buffer.from(SEND_ADVANCED_COPY_SCRIPT, 'utf16le').toString('base64');
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 5000 },
  );
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

async function showOverlay(text: string | null): Promise<void> {
  const window = await ensureOverlayWindow();
  positionOverlay(window);
  window.webContents.send('capture:result', text);

  if (window.isVisible()) {
    window.moveTop();
  } else {
    window.showInactive();
  }

  window.setAlwaysOnTop(true, 'screen-saver');
}

async function captureItemFromGame(): Promise<void> {
  if (captureInProgress) return;
  captureInProgress = true;
  console.log('[hotkey] pressed');

  try {
    // Важно: окно приложения НЕ показываем и НЕ фокусируем до отправки клавиш,
    // иначе Ctrl+Alt+C уйдёт в наше окно, а не в игру.
    const previous = await clipboard.readText();
    await sendAdvancedCopy();
    console.log('[capture] Ctrl+Alt+C sent');
    const text = await waitForCopiedItem(previous);
    console.log(`[capture] clipboard: ${text ? `${text.length} chars` : 'no item'}`);

    mainWindow?.webContents.send('capture:result', text);
    await showOverlay(text);
  } catch (error) {
    console.error('Не удалось скопировать предмет из игры:', error);
    mainWindow?.webContents.send('capture:result', null);
    await showOverlay(null);
  } finally {
    captureInProgress = false;
  }
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text);
  });

  createMainWindow();
  createOverlayWindow();

  const captureRegistered = globalShortcut.register(CAPTURE_HOTKEY, () => {
    void captureItemFromGame();
  });
  if (!captureRegistered) {
    console.warn(`Не удалось зарегистрировать глобальный хоткей ${CAPTURE_HOTKEY}`);
  } else {
    console.log(`[hotkey] registered ${CAPTURE_HOTKEY}`);
  }

  const hideRegistered = globalShortcut.register(HIDE_OVERLAY_HOTKEY, () => {
    console.log('[hotkey] hide pressed');
    const wasVisible = overlayWindow?.isVisible();
    overlayWindow?.hide();
    console.log(`[overlay] hide: ${wasVisible} -> ${overlayWindow?.isVisible()}`);
  });
  if (!hideRegistered) {
    console.warn(`Не удалось зарегистрировать глобальный хоткей ${HIDE_OVERLAY_HOTKEY}`);
  } else {
    console.log(`[hotkey] registered ${HIDE_OVERLAY_HOTKEY}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
