import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell } from 'electron';
import { join } from 'node:path';

const TOGGLE_HOTKEY = 'CommandOrControl+Shift+D';

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

function showAndParseClipboard(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
  window.webContents.send('hotkey:parse-clipboard');
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text);
  });

  createWindow();

  const registered = globalShortcut.register(TOGGLE_HOTKEY, showAndParseClipboard);
  if (!registered) {
    console.warn(`Не удалось зарегистрировать глобальный хоткей ${TOGGLE_HOTKEY}`);
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
