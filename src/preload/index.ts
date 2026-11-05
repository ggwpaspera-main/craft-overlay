import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('craft', {
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),
});
