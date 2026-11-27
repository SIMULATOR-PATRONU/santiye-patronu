'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', Object.freeze({
  isDesktop: true,
  loadSave(slot) {
    try {
      return ipcRenderer.sendSync('secure-save:get', String(slot || '')) || null;
    } catch (error) {
      console.error('Secure save could not be loaded:', error);
      return null;
    }
  },
  saveGameSync(payload, slot) {
    if (typeof payload !== 'string' || payload.length > 20_000_000) return false;
    try {
      return ipcRenderer.sendSync('secure-save:write', payload, String(slot || '')) === true;
    } catch (error) {
      console.error('Secure save bridge failed:', error);
      return false;
    }
  },
  adminLogin(username, password) {
    return ipcRenderer.invoke('admin:login', String(username || ''), String(password || ''));
  },
  oauthLogin(provider) {
    return ipcRenderer.invoke('oauth:login', String(provider || ''));
  },
  isAdmin() {
    try { return ipcRenderer.sendSync('admin:status') === true; }
    catch { return false; }
  },
  logoutAdmin() {
    ipcRenderer.send('admin:logout');
  }
}));
