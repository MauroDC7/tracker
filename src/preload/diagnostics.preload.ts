import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('omDiag', {
  request: () => ipcRenderer.invoke('diag:get'),
  onUpdate: (cb: (data: unknown) => void) => {
    const listener = (_e: unknown, data: unknown) => cb(data);
    ipcRenderer.on('diag:update', listener);
    return () => ipcRenderer.removeListener('diag:update', listener);
  },
  syncNow: () => ipcRenderer.invoke('diag:syncNow'),
  openLogin: () => ipcRenderer.invoke('diag:openLogin'),
  logout: () => ipcRenderer.invoke('diag:logout'),
});
