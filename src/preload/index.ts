import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('craft', {
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),
  onHotkey: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('hotkey:parse-clipboard', listener);
    return () => {
      ipcRenderer.removeListener('hotkey:parse-clipboard', listener);
    };
  },
});
