import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('craft', {
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),
  hideOverlay: (): void => ipcRenderer.send('overlay:hide'),
  quitApp: (): void => ipcRenderer.send('overlay:quit'),
  moveOverlay: (dx: number, dy: number): void => ipcRenderer.send('overlay:move', dx, dy),
  onCapture: (callback: (text: string | null) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, text: string | null): void => callback(text);
    ipcRenderer.on('capture:result', listener);
    return () => {
      ipcRenderer.removeListener('capture:result', listener);
    };
  },
});
