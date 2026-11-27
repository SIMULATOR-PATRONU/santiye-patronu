'use strict';

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const http = require('node:http');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const crypto = require('node:crypto');
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

function slotFiles(slot) {
  const s = String(slot || '');
  if (s === 'legacy') return { file: SAVE_FILE, backup: BACKUP_FILE, readOnly: true };
  if (!/^[a-z0-9_-]{1,48}$/.test(s)) return null;
  return {
    file: path.join(USER_DATA, `company-save.${s}.dat`),
    backup: path.join(USER_DATA, `company-save.${s}.previous.dat`),
    readOnly: false
  };
}

function loadSecureSave(slot) {
  const f = slotFiles(slot);
  if (!f) return null;
  return decryptSave(f.file) || decryptSave(f.backup) || null;
}

function writeSecureSave(text, slot) {
  const f = slotFiles(slot);
  if (!f || f.readOnly) throw new Error('Invalid save slot');
  if (!isValidGameSave(text)) throw new Error('Invalid game state');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage (DPAPI) is unavailable');
  }

  fs.mkdirSync(USER_DATA, { recursive: true });
  const existing = decryptSave(f.file);
  const encrypted = safeStorage.encryptString(text);
  const tempFile = `${f.file}.tmp`;
  fs.writeFileSync(tempFile, encrypted, { mode: 0o600 });

  // Keep last known-good encrypted save before replacing the current one.
  if (existing && existing !== text) {
    try {
      fs.copyFileSync(f.file, f.backup);
    } catch (error) {
      console.warn('Previous save backup could not be rotated:', error);
    }
  }
  fs.renameSync(tempFile, f.file);
  return true;
}


// ---------------------------------------------------------------------------
// Gerçek hesap girişi: Google ve X (OAuth 2.0 + PKCE, 127.0.0.1 geri dönüş).
// Kimlik bilgileri oauth.config.json içindeki clientId alanlarından okunur.
// ---------------------------------------------------------------------------
function readOAuthConfig() {
  const files = [path.join(USER_DATA, 'oauth.config.json'), path.join(__dirname, 'oauth.config.json')];
  for (const file of files) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      console.warn('oauth.config.json okunamadı:', error.message);
    }
  }
  return {};
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let oauthBusy = false;

function waitForOAuthCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const err = url.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<meta charset="utf-8"><body style="font-family:sans-serif;background:#07151e;color:#fff;text-align:center;padding-top:80px"><h2>' +
          (code && state === expectedState && !err ? 'Giriş tamamlandı. Bu sekmeyi kapatıp oyuna dönebilirsin.' : 'Giriş tamamlanamadı. Oyuna dönüp tekrar dene.') + '</h2></body>');
        clearTimeout(timer);
        server.close();
        if (err || !code || state !== expectedState) reject(new Error(err || 'Geçersiz yanıt'));
        else resolve(code);
      } catch (error) {
        clearTimeout(timer);
        server.close();
        reject(error);
      }
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('Zaman aşımı')); }, 180000);
    server.on('error', (error) => { clearTimeout(timer); reject(error); });
    server.listen(port, '127.0.0.1');
  });
}

async function oauthLogin(provider) {
  const cfg = readOAuthConfig()[provider] || {};
  if (!cfg.clientId || /YOUR_|BURAYA/i.test(cfg.clientId)) {
    return { ok: false, reason: 'not-configured' };
  }
  if (oauthBusy) return { ok: false, reason: 'busy' };
  oauthBusy = true;
  try {
    const port = Number(cfg.port) || (provider === 'x' ? 53682 : 53681);
    const redirect = `http://127.0.0.1:${port}/callback`;
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    let authUrl;
    if (provider === 'google') {
      authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: cfg.clientId, redirect_uri: redirect, response_type: 'code',
        scope: 'openid profile email', state, code_challenge: challenge, code_challenge_method: 'S256'
      });
    } else if (provider === 'x') {
      authUrl = 'https://twitter.com/i/oauth2/authorize?' + new URLSearchParams({
        client_id: cfg.clientId, redirect_uri: redirect, response_type: 'code',
        scope: 'users.read tweet.read', state, code_challenge: challenge, code_challenge_method: 'S256'
      });
    } else {
      return { ok: false, reason: 'unsupported' };
    }
    const codePromise = waitForOAuthCode(port, state);
    shell.openExternal(authUrl);
    const code = await codePromise;

    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirect,
      client_id: cfg.clientId, code_verifier: verifier
    });
    if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);
    const tokenUrl = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://api.twitter.com/2/oauth2/token';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (provider === 'x' && cfg.clientSecret) {
      headers.Authorization = 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      body.delete('client_secret');
    }
    const tokenRes = await fetch(tokenUrl, { method: 'POST', headers, body });
    const token = await tokenRes.json();
    if (!tokenRes.ok || token.error) throw new Error(token.error_description || token.error || 'Token alınamadı');

    let sub, name, email = '';
    if (provider === 'google') {
      const payload = JSON.parse(Buffer.from(String(token.id_token).split('.')[1], 'base64').toString('utf8'));
      sub = payload.sub; name = payload.name || payload.given_name || 'Google oyuncusu'; email = payload.email || '';
    } else {
      const me = await (await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
      if (!me.data || !me.data.id) throw new Error('X hesabı okunamadı');
      sub = me.data.id; name = me.data.name || me.data.username || 'X oyuncusu';
    }
    if (!sub) throw new Error('Hesap kimliği alınamadı');
    const uid = crypto.createHash('sha256').update(`${provider}:${sub}`).digest('hex').slice(0, 20);
    return { ok: true, provider, uid, name: String(name).slice(0, 28), email };
  } catch (error) {
    console.warn('OAuth hatası:', error.message);
    return { ok: false, reason: 'failed', message: String(error.message || error) };
  } finally {
    oauthBusy = false;
  }
}

function registerIpc() {
  ipcMain.on('secure-save:get', (event, slot) => {
    event.returnValue = loadSecureSave(slot);
  });

  ipcMain.on('secure-save:write', (event, payload, slot) => {
    try {
      event.returnValue = writeSecureSave(payload, slot);
    } catch (error) {
      console.error('Secure save failed:', error);
      event.returnValue = false;
    }
  });

  ipcMain.handle('admin:login', async (_event, username, password) => {
    const now = Date.now();
    if (now < adminLockUntil) return false;
    // Parola düz metin olarak saklanmaz; yalnızca scrypt özeti tutulur.
    const ADMIN_USER = 'patron';
    const ADMIN_SALT = 'e88b27fb68b0abd962c59da45c087399';
    const ADMIN_HASH = '29dd66576fa0c1738d05326bb4ee5fe3da1050a39a7da11c8568be6d7fdc45b6';
    let valid = false;
    try {
      const given = crypto.scryptSync(String(password || ''), Buffer.from(ADMIN_SALT, 'hex'), 32);
      valid = String(username || '') === ADMIN_USER && crypto.timingSafeEqual(given, Buffer.from(ADMIN_HASH, 'hex'));
    } catch (_) { valid = false; }
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

  ipcMain.handle('oauth:login', async (_event, provider) => oauthLogin(String(provider || '')));

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
