'use strict';

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

const APP_VERSION = app.getVersion();
const USER_DATA = app.getPath('userData');
const SAVE_FILE = path.join(USER_DATA, 'company-save.dat');
const BACKUP_FILE = path.join(USER_DATA, 'company-save.previous.dat');
const GAME_FILE = path.join(__dirname, 'app', 'game.html');

let mainWindow = null;
let adminSession = false;
let failedAdminAttempts = 0;
let adminLockUntil = 0;
let isQuitting = false;

function isValidGameSave(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' &&
      Number.isFinite(Number(data.cash)) &&
      Number.isFinite(Number(data.day)) &&
      Array.isArray(data.projects) && Array.isArray(data.plots);
  } catch {
    return false;
  }
}

function decryptSave(filePath) {
  try {
    if (!fs.existsSync(filePath) || !safeStorage.isEncryptionAvailable()) return null;
    const encrypted = fs.readFileSync(filePath);
    const text = safeStorage.decryptString(encrypted);
    return isValidGameSave(text) ? text : null;
  } catch (error) {
    console.error('Encrypted save could not be read:', error);
    return null;
  }
}

function loadSecureSave() {
  return decryptSave(SAVE_FILE) || decryptSave(BACKUP_FILE) || null;
}

function writeSecureSave(text) {
  if (!isValidGameSave(text)) throw new Error('Invalid game state');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage (DPAPI) is unavailable');
  }

  fs.mkdirSync(USER_DATA, { recursive: true });
  const existing = decryptSave(SAVE_FILE);
  const encrypted = safeStorage.encryptString(text);
  const tempFile = `${SAVE_FILE}.tmp`;
  fs.writeFileSync(tempFile, encrypted, { mode: 0o600 });

  // Keep last known-good encrypted save before replacing the current one.
  if (existing && existing !== text) {
    try {
      fs.copyFileSync(SAVE_FILE, BACKUP_FILE);
    } catch (error) {
      console.warn('Previous save backup could not be rotated:', error);
    }
  }
  fs.renameSync(tempFile, SAVE_FILE);
  return true;
}

function registerIpc() {
  ipcMain.on('secure-save:get', (event) => {
    event.returnValue = loadSecureSave();
  });

  ipcMain.on('secure-save:write', (event, payload) => {
    try {
      event.returnValue = writeSecureSave(payload);
    } catch (error) {
      console.error('Secure save failed:', error);
      event.returnValue = false;
    }
  });

  ipcMain.handle('admin:login', async (_event, username, password) => {
    const now = Date.now();
    if (now < adminLockUntil) return false;
    // Initial credentials requested by the owner. Replace before public release.
    const valid = username === 'admin11' && password === 'admin11';
    if (valid) {
      failedAdminAttempts = 0;
      adminLockUntil = 0;
      adminSession = true;
      return true;
    }
    failedAdminAttempts += 1;
    if (failedAdminAttempts >= 5) {
      adminLockUntil = now + 30_000;
      failedAdminAttempts = 0;
    }
    return false;
  });

  ipcMain.on('admin:status', (event) => {
    event.returnValue = adminSession;
  });
  ipcMain.on('admin:logout', () => {
    adminSession = false;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: '#07151e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase();
    if (key === 'f12' || ((input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(key))) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on('context-menu', (event) => event.preventDefault());
  mainWindow.on('close', () => {
    adminSession = false;
  });
  mainWindow.loadFile(GAME_FILE);
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (error) => console.warn('Update check:', error.message));
  autoUpdater.on('update-available', async (info) => {
    if (!mainWindow) return;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Güncellemeyi indir', 'Daha sonra'],
      defaultId: 0,
      cancelId: 1,
      title: 'Şantiye Patronu güncellemesi',
      message: `Yeni sürüm ${info.version} hazır.`,
      detail: 'Kayıtların Windows güvenli kayıt alanında saklanır; güncelleme oyun ilerlemeni silmez.'
    });
    if (choice.response === 0) autoUpdater.downloadUpdate();
  });
  autoUpdater.on('update-downloaded', async (info) => {
    if (!mainWindow) return;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Şimdi yeniden başlat', 'Sonra'],
      defaultId: 0,
      cancelId: 1,
      title: 'Güncelleme indirildi',
      message: `Şantiye Patronu ${info.version} kurulum için hazır.`
    });
    if (choice.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch((error) => console.warn(error)), 3500);
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  setupAutoUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  adminSession = false;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
