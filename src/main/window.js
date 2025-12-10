// src/main/window.js
const { BrowserWindow, shell, app } = require('electron');
const path = require('path');
const fs = require('fs-extra');

function resolvePreloadPath() {
  const dev = path.resolve(app.getAppPath(), 'src', 'scripts', 'preload.js');
  const prod = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'scripts', 'preload.js');
  return app.isPackaged ? prod : dev;
}

function resolveAppHtml() {
  return path.resolve(app.getAppPath(), 'src', 'pages', 'app.html');
}

function createMainWindow() {
  const preloadPath = resolvePreloadPath();
  const appHtml = resolveAppHtml();

  console.log('[Electron] preload path =>', preloadPath, '| existe?', fs.existsSync(preloadPath));
  console.log('[Electron] app.html =>', appHtml, '| existe?', fs.existsSync(appHtml));

  const win = new BrowserWindow({
    width: 1940,
    height: 1120,
    icon: path.join(__dirname, '..', 'assets', 'Vicon.ico'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(appHtml);

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('console.log("[renderer] window.api =", typeof window.api)');
  });

  // abrir links externos no browser padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

module.exports = {
  createMainWindow,
};
