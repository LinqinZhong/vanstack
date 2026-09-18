import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vanstackDesktop', {
  getServer: () => ipcRenderer.invoke('server:get'),
  setServer: (server: { host: string; port: number }) => ipcRenderer.invoke('server:set', server),
});
