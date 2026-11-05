import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const TOGGLE_HOTKEY = 'Alt+Shift+D';

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

let captureInProgress = false;

app.setAppUserModelId('com.craftoverlay.app');

function createWindow(): void {
  const window = new BrowserWindow({
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

  window.setMenuBarVisibility(false);
  window.loadFile(join(__dirname, 'renderer/index.html'));

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function revealWindow(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
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
    [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-EncodedCommand',
      encoded,
    ],
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

    revealWindow();
    const [window] = BrowserWindow.getAllWindows();
    window?.webContents.send('capture:result', text);
  } catch (error) {
    console.error('Не удалось скопировать предмет из игры:', error);
    revealWindow();
    const [window] = BrowserWindow.getAllWindows();
    window?.webContents.send('capture:result', null);
  } finally {
    captureInProgress = false;
  }
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text);
  });

  createWindow();

  const registered = globalShortcut.register(TOGGLE_HOTKEY, () => {
    void captureItemFromGame();
  });
  if (!registered) {
    console.warn(`Не удалось зарегистрировать глобальный хоткей ${TOGGLE_HOTKEY}`);
  } else {
    console.log(`[hotkey] registered ${TOGGLE_HOTKEY}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
