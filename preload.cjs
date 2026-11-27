'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', Object.freeze({
  isDesktop: true,
  loadSave(slot = 'guest') {
    try { return ipcRenderer.sendSync('secure-save:get', slot === 'admin' ? 'admin' : 'guest') || null; }
    catch (error) { console.error('Secure save could not be loaded:', error); return null; }
  },
  saveGameSync(payload, slot = 'guest') {
    if (typeof payload !== 'string' || payload.length > 20_000_000) return false;
    try { return ipcRenderer.sendSync('secure-save:write', payload, slot === 'admin' ? 'admin' : 'guest') === true; }
    catch (error) { console.error('Secure save bridge failed:', error); return false; }
  },
  adminLogin(username, password) {
    return ipcRenderer.invoke('admin:login', String(username || ''), String(password || ''));
  },
  isAdmin() {
    try { return ipcRenderer.sendSync('admin:status') === true; }
    catch { return false; }
  },
  logoutAdmin() { ipcRenderer.send('admin:logout'); }
}));
