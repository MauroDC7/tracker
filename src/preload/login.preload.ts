import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('om', {
  login: (email: string, password: string) =>
    ipcRenderer.invoke('auth:login', { email, password }) as Promise<{ ok: boolean; error?: string }>,
});
