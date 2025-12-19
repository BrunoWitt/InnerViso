// src/main/main.js
const { app } = require('electron');
const log = require('electron-log');

const { createMainWindow } = require('./window');
const { setupAutoUpdater } = require('./updater');
const { setupNotices, startNoticesAutoUpdate } = require('./notices');

const { registerViewIpc } = require('./ipc-views');
const { registerFsIpc } = require('./ipc-fs');
const { registerParserIpc } = require('./ipc-parser');
const { registerExpo8Ipc } = require('./ipc-expo8');
const { registerComparatorIpc } = require('./ipc-comparador');

console.log('Versão atual:', app.getVersion());

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

  const focusMainWindow = () => {
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();

    mainWindow.focus();
  };

  app.on('second-instance', () => {
    // Não cria outra janela: só foca a existente
    if (mainWindow) focusMainWindow();
    else mainWindow = createMainWindow();
  });

  app.whenReady().then(() => {
    const MINUTOS = 45;

    // IMPORTANTÍSSIMO: não use "const mainWindow" aqui, use a variável de cima
    mainWindow = createMainWindow();

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // IPCs
    registerViewIpc();
    registerFsIpc();
    registerParserIpc();
    registerExpo8Ipc();
    registerComparatorIpc();

    // Notícias
    setupNotices();
    setInterval(startNoticesAutoUpdate, MINUTOS * 60 * 1000);

    // AutoUpdater só em produção
    if (app.isPackaged) {
      setupAutoUpdater();
    }

    log.info('App iniciado - versão', app.getVersion());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // (opcional, mas bom pro macOS)
  app.on('activate', () => {
    if (mainWindow) focusMainWindow();
    else mainWindow = createMainWindow();
  });
}
