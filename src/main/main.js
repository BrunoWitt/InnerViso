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

app.whenReady().then(() => {
  const MINUTOS = 45;

  const win = createMainWindow();

  // IPCs
  registerViewIpc();
  registerFsIpc();
  registerParserIpc();
  registerExpo8Ipc();
  registerComparatorIpc();

  // Notícias (cache + atualização periódica)
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
