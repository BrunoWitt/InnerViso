// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log'); // <<--- IMPORTANTE
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

function getJsonPath() {
  return path.join(app.getPath('userData'), 'noticias.json');
}

function getBackendPath(...paths) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', ...paths);
  } else {
    return path.join(__dirname, 'backend', ...paths);
  }
}

function getPythonPath() {
  const localVenv = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
  return require('fs').existsSync(localVenv) ? localVenv : 'python';
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
  // win.removeMenu();
  win.loadFile('src/pages/app.html');
}

app.whenReady().then(() => {
  createWindow();
  console.log('Versão atual:', app.getVersion());

  if (!app.isPackaged) return;

  // ---- LOGS
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  log.info('App iniciado - versão', app.getVersion());

  // ---- REPO PRIVADO: passe o token no header (ou via GH_TOKEN no ambiente)
  const token = process.env.GH_TOKEN; // defina no Windows com setx (abaixo)
  if (token) {
    autoUpdater.requestHeaders = { Authorization: `token ${token}` };
    log.info('Header de auth para GitHub configurado.');
  } else {
    log.warn('GH_TOKEN não definido. Em repositório privado o update não vai baixar.');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log.info('Verificando atualizações...'));
  autoUpdater.on('update-available', (info) => {
    log.info('Atualização disponível:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização disponível',
      message: `Uma nova versão (${info.version}) está disponível! Baixando em segundo plano...`,
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
      message: 'A nova versão foi baixada. Deseja reiniciar para aplicar?',
    }).then(result => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdates();
});

// --- IPCs (iguais aos seus) ---
ipcMain.handle('scraper:run', async () => {
  const out = getJsonPath();
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'hub', 'get_notices.py')
    : path.join(__dirname, 'backend', 'hub', 'get_notices.py');

  const py = getPythonPath();
  console.log("Executando script:", script);

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

ipcMain.handle('scraper:read', async () => {
  const out = getJsonPath();
  const txt = await fs.readFile(out, 'utf-8');
  return JSON.parse(txt);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('views:load', async (_e, viewName) => {
  const filePath = path.join(__dirname, 'src', 'pages', 'views', `${viewName}.html`);
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("parser:start", async(_e, { entrada, saida, tipoParser }) => {

  let endPoints = {
    "NFE": "http://10.0.0.106:8100/nfe_router/nfe",
    "IMPO1": "http://10.0.0.106:8100/di_router/IMPO1",
    "IMPO8": "http://10.0.0.106:8100/di_router/IMPO8",
    "SPED": "http://10.0.0.106:8100/sped_router/sped",
  }

  try {
    let url = endPoints[tipoParser];

    const axios = require('axios');
    const response = await axios.get(url, {
      params: {
        pathIn: entrada,
        pathOut: saida,
        token: "electron-ui",
      },
      timeout: 60000,
    });

    console.log("Resposta do parser:", response.data);
    return { success: true, data: response.data };

  } catch (error) {
    console.error("Erro ao iniciar o parser:", error);
    return { success: false, error: error.message };
  }
});
