const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');

const entry = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString();

function isAppDocument(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) ===
      path.resolve(__dirname, '..', 'dist', 'index.html');
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 360,
    minHeight: 560,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAppDocument(target)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, target) => {
    if (!isAppDocument(target)) event.preventDefault();
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(entry);
}

app.whenReady().then(() => {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);
  // The application is fully local. Deny all renderer initiated network access.
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      allowed = ['file:', 'data:', 'blob:'].includes(new URL(details.url).protocol);
    } catch {}
    callback({ cancel: !allowed });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
