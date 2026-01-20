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
const { registerModelo7Ipc } = require('./modelo7')
const { registerBuscadorEpIPC } = require('./ipc-buscadorEp');
const { registerColetarDiIpc } = require('./ipc-coletarDi');
const { registerBaixarDiIpc } = require("./ipc-baixar-di");
const { registerBaixarLiIpc } = require("./ipc-baixar-li")
const { registerBaixarDueIpc } = require("./ipc-baixar-due")
const { registerColedarDiCnpj } = require("./ipc-coletar-di-cnpj");
const { registerColetarLiIpc } = require("./ipc-coletar-li");
const { registerColetarLiCnpj } = require("./ipc-coletar-li-cnpj");
const { registerBaixarAtoCnpj } = require("./ipc-baixar-ato-cnpj");
const { registerDiPdf } = require("./ipc-di-pdf");
const { registerBaixarAto } = require("./ipc-baixar-ato");

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
    registerModelo7Ipc();
    registerBuscadorEpIPC();
    registerColetarDiIpc();
    registerBaixarDiIpc();
    registerBaixarLiIpc();
    registerBaixarDueIpc();
    registerColedarDiCnpj();
    registerColetarLiIpc();
    registerColetarLiCnpj();
    registerBaixarAtoCnpj();
    registerDiPdf();
    registerBaixarAto();
    
    // Notícias
    setupNotices();
    setInterval(startNoticesAutoUpdate, MINUTOS * 60 * 1000);

    // AutoUpdater só em produção
    setupAutoUpdater();

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
