// src/main/updater.js
const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  const token = process.env.GH_TOKEN;
  if (token) {
    autoUpdater.requestHeaders = { Authorization: `token ${token}` };
    log.info('Header de auth para GitHub configurado.');
  } else {
    log.warn('GH_TOKEN não definido. Update privado não vai baixar.');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log.info('Verificando atualizações...'));
  autoUpdater.on('update-available', (info) => {
    log.info('Atualização disponível:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização disponível',
      message: `Nova versão (${info.version}) disponível. Baixando...`,
    });
  });
  autoUpdater.on('update-not-available', () => log.info('Nenhuma atualização disponível.'));
  autoUpdater.on('error', (err) => log.error('Erro no autoUpdater:', err));
  autoUpdater.on('download-progress', (p) => log.info(`Progresso: ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update baixado:', info.version);
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      title: 'Atualização pronta',
      message: 'Reiniciar para aplicar a nova versão?',
    }).then(result => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdates();
}

module.exports = {
  setupAutoUpdater,
};
