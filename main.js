// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

function getJsonPath() {
  return path.join(app.getPath('userData'), 'noticias.json');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'scripts', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.removeMenu(); //Tira o menu de cima

  win.loadFile('src/pages/app.html');
}

// --- Inicialização do app e auto-update ---
app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Eventos do auto-updater
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização disponível',
    message: 'Uma nova versão está disponível! Baixando em segundo plano...',
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      type: 'question',
      buttons: ['Reiniciar', 'Mais tarde'],
      defaultId: 0,
      title: 'Atualização pronta',
      message: 'Uma nova versão foi baixada. Deseja reiniciar para atualizar?',
    })
    .then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
});

// --- IPC: executa o Python e gera o arquivo JSON ---
ipcMain.handle('scraper:run', async () => {
  const out = getJsonPath();
  const script = path.join(__dirname, 'backend', 'hub', 'get_notices.py');
  const py = process.platform === 'win32' ? 'python' : 'python3';

  return new Promise((resolve, reject) => {
    const child = spawn(py, [script, out], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, out });
      else reject(new Error(`get_notices.py saiu com código ${code}: ${stderr}`));
    });
  });
});

// --- IPC: lê o arquivo JSON e envia para o renderer ---
ipcMain.handle('scraper:read', async () => {
  const out = getJsonPath();
  const txt = await fs.readFile(out, 'utf-8');
  return JSON.parse(txt);
});

// --- Encerramento padrão ---
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('views:load', async (_e, viewName) => {
    const filePath = path.join(__dirname, 'src', 'pages', 'views', `${viewName}.html`);
    return fs.readFile(filePath, 'utf-8');
})