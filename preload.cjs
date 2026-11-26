'use strict';

const { contextBridge, ipcRenderer } = require('electron');
let cachedSave = null;
try {
  cachedSave = ipcRenderer.sendSync('secure-save:get') || null;
} catch (error) {
  console.error('Initial secure save could not be loaded:', error);
}

contextBridge.exposeInMainWorld('desktopBridge', Object.freeze({
  isDesktop: true,
  loadSave() {
    return cachedSave;
  },
  saveGameSync(payload) {
    if (typeof payload !== 'string' || payload.length > 20_000_000) return false;
    try {
      const ok = ipcRenderer.sendSync('secure-save:write', payload) === true;
      if (ok) cachedSave = payload;
      return ok;
    } catch (error) {
      console.error('Secure save bridge failed:', error);
      return false;
    }
  },
  adminLogin(username, password) {
    return ipcRenderer.invoke('admin:login', String(username || ''), String(password || ''));
  },
  isAdmin() {
    try { return ipcRenderer.sendSync('admin:status') === true; }
    catch { return false; }
  },
  logoutAdmin() {
    ipcRenderer.send('admin:logout');
  }
}));
