// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

function getJsonPath() {
  return path.join(app.getPath('userData'), 'noticias.json');
}

function getBackendPath(...paths) {
  if (app.isPackaged) {
    // dentro do app empacotado → fica direto em resources/backend/
    return path.join(process.resourcesPath, 'backend', ...paths);
  } else {
    // ambiente de desenvolvimento
    return path.join(__dirname, 'backend', ...paths);
  }
}

function getPythonPath() {
  // usa o Python da venv se existir, senão o global do sistema
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

  //win.removeMenu(); //Tira o menu de cima

  win.loadFile('src/pages/app.html');
}

// --- Inicialização do app e auto-update ---
app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  console.log('Versão atual:', app.getVersion());
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

// --- IPC: executa o Python global e gera o arquivo JSON ---
ipcMain.handle('scraper:run', async () => {
  const out = getJsonPath();

  // durante empacotamento o backend fica em resources/app/backend/
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'hub', 'get_notices.py')
    : path.join(__dirname, 'backend', 'hub', 'get_notices.py');

  const py = getPythonPath(); // usa sua função que verifica a venv
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

//Carrega a página HTML pelo nome da view
ipcMain.handle('views:load', async (_e, viewName) => {
    const filePath = path.join(__dirname, 'src', 'pages', 'views', `${viewName}.html`);
    return fs.readFile(filePath, 'utf-8');
})