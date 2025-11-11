// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log'); // <<--- IMPORTANTE
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

//Botões secundarios do Parser
ipcMain.handle("dialog:open-folder", async (_event, caminho) => {
  if (!caminho) return;
  // Opens folder in Windows Explorer
  spawn('explorer.exe', [caminho]);
});

ipcMain.handle("open-json", async (_event, caminho) => {
  const jsonPath = path.join(app.getPath('userData'), 'padrao.json');
  if (!fs.existsSync(jsonPath)) return null;
  const data = JSON.parse(await fs.promises.readFile(jsonPath, 'utf-8'));
  return data;
});

ipcMain.handle('save-path', async (_event, caminho_entrada, caminho_saida) => {
  const dados = {
    entrada: caminho_entrada,
    saida: caminho_saida,
  };

  const jsonString = JSON.stringify(dados, null, 2);

  const fs = require('fs');

  const jsonPath = path.join(app.getPath('userData'), 'padrao.json');
  fs.writeFile(jsonPath, jsonString, (err) => {
    if (err) {
      console.error('Erro ao salvar o arquivo JSON:', err);
      return { success: false, message: 'Erro ao salvar o arquivo JSON.' };
    }
    console.log('Arquivo JSON salvo com sucesso!');
    })
  });

  ipcMain.handle("clear-paths", async () => {
  const fs = require("fs");
  const path = require("path");

  try {
    const jsonPath = path.join(app.getPath("userData"), "padrao.json");

    if (fs.existsSync(jsonPath)) {
      fs.unlinkSync(jsonPath); // remove o arquivo
      console.log("🧹 padrao.json removido com sucesso!");
      return { success: true };
    } else {
      console.log("⚠️ Nenhum padrao.json encontrado para limpar.");
      return { success: false, message: "Arquivo não existe." };
    }
  } catch (err) {
    console.error("❌ Erro ao limpar padrao.json:", err);
    return { success: false, message: err.message };
  }
  });



function getJsonPath() {
  // arquivo onde o Python salva/onde o renderer lê
  const p = path.join(app.getPath('userData'), 'noticias.json');
  // garante a pasta do arquivo
  fs.ensureDirSync(path.dirname(p));
  return p;
}

function ensureNoticesFile() {
  const out = getJsonPath();
  if (!fs.existsSync(out)) {
    // inicia vazio para evitar erro no primeiro read
    fs.writeFileSync(out, '[]', { encoding: 'utf-8' });
  }
  return out;
}

function getPythonPath() { const localVenv = path.join(__dirname, 'venv', 'Scripts', 'python.exe'); return require('fs').existsSync(localVenv) ? localVenv : 'python'; }


// ...

function resolvePreloadPath() {
  // Caminho durante o desenvolvimento
  const dev = path.resolve(app.getAppPath(), 'src', 'scripts', 'preload.js');

  // Caminho durante o executável (fora do .asar)
  const prod = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'scripts', 'preload.js');

  return app.isPackaged ? prod : dev;
}


function resolveAppHtml() {
  // carrega o app.html da pasta src/pages (dev e prod)
  const htmlDev = path.resolve(app.getAppPath(), 'src', 'pages', 'app.html');
  return htmlDev;
}

function createWindow() {
  const preloadPath = resolvePreloadPath();
  const appHtml = resolveAppHtml();

  console.log('[Electron] preload path =>', preloadPath, '| existe?', fs.existsSync(preloadPath));
  console.log('[Electron] app.html =>', appHtml, '| existe?', fs.existsSync(appHtml));

  const win = new BrowserWindow({
    width: 1940,
    height: 1120,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'src', 'assets', 'Vicon.ico'), // 👈 AQUI
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(appHtml);


  win.loadFile(appHtml);

  // log de sanidade no renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('console.log("[renderer] window.api =", typeof window.api)');
  });

  // 🔹 Adicione AQUI dentro da função
  const { shell } = require("electron");

  // Garante que links externos abram no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Também intercepta cliques diretos em <a href="http...">
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
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

// --- IPCs do Hub ---
ipcMain.handle('scraper:run', async () => {
  const out = ensureNoticesFile(); // <— garante arquivo
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'hub', 'get_notices.py')
    : path.join(__dirname, 'backend', 'hub', 'get_notices.py');

  const py = getPythonPath();
  console.log('[Hub] Executando script:', script, '=>', out);

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
  const out = ensureNoticesFile(); // <— garante arquivo
  try {
    const txt = await fs.readFile(out, 'utf-8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    console.error('[Hub] Falha lendo', out, e);
    return []; // fallback seguro
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('views:load', async (_e, viewName) => {
  const filePath = path.join(__dirname, 'src', 'pages', 'views', `${viewName}.html`);
  return fs.readFile(filePath, 'utf-8');
});

const os = require("os");

const BASE_UNC = "\\\\10.0.0.237\\visonet\\Sistemas\\FileSystem\\WSVISOparser";

// Funções auxiliares
function selecionar_pasta_wb() {
  const nomeMaquina = os.hostname();
  const raiz = path.join(BASE_UNC, nomeMaquina);
  fs.ensureDirSync(raiz);
  return raiz;
}

function salvar_pasta_wb(pastaMaquina) {
  let n = 0;
  while (true) {
    const alvo = path.join(pastaMaquina, n.toString());
    if (!fs.existsSync(alvo)) {
      fs.ensureDirSync(alvo);
      return alvo;
    }
    n++;
  }
}

ipcMain.handle("dialog:select-folder", async (event, tipo) => {
  try {
    // se tipo = true → ENTRADA (copiar pro servidor)
    if (tipo === true) {
      const pasta_maquina = selecionar_pasta_wb();
      const pasta_num = salvar_pasta_wb(pasta_maquina);

      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (result.canceled) return null;

      const origem = result.filePaths[0];
      const subdir_nome = path.basename(origem);
      const destino_final = path.join(pasta_num, subdir_nome);

      await fs.copy(origem, destino_final, { overwrite: true });
      console.log("✅ Pasta copiada para o servidor:", destino_final);
      return destino_final;
    }

    // se tipo = false → SAÍDA (somente escolher)
    else {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      return result.canceled ? null : result.filePaths[0];
    }
  } catch (err) {
    console.error("❌ Erro ao selecionar/copiar pasta:", err);
    return null;
  }
});

ipcMain.handle("select-file-zip", async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "Arquivos ZIP", extensions: ["zip"] }],
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});

const axios = require("axios");
const fssync = require("fs");

function criar_pasta_saida_servidor() {
  const nomeMaquina = os.hostname();
  const pastaMaquina = path.join(BASE_UNC, nomeMaquina);

  fs.ensureDirSync(pastaMaquina);

  // cria pasta numerada única
  let n = 0;
  while (true) {
    const alvo = path.join(pastaMaquina, `saida_${n}`);
    if (!fs.existsSync(alvo)) {
      fs.ensureDirSync(alvo);
      console.log("📁 Pasta de saída criada no servidor:", alvo);
      return alvo;
    }
    n++;
  }
}

// ---- EXECUÇÃO DO PARSER VIA WEBSERVICE ----
async function executarParser(pathIn, pathOut, tipo, token) {
  const endpoints = {
    NFE: "http://10.0.0.106:8100/nfe_router/nfe",
    IMPO1: "http://10.0.0.106:8100/di_router/IMPO1",
    IMPO8: "http://10.0.0.106:8100/di_router/IMPO8",
    SPED: "http://10.0.0.106:8100/sped_router/sped",
    //NFE: "http://127.0.0.1:8000/nfe_router/nfe",
    //IMPO1: "http://127.0.0.1:8000/di_router/IMPO1",
    //IMPO8: "http://127.0.0.1:8000/di_router/IMPO8",
    //SPED: "http://127.0.0.1:8000/sped_router/sped",
  };

  const url = endpoints[tipo];
  if (!url) throw new Error(`Tipo de parser desconhecido: ${tipo}`);

  try {
    console.log(`➡️ Iniciando parser ${tipo}...`);
    console.log(`Entrada: ${pathIn}`);
    console.log(`Saída: ${pathOut}`);
    console.log(`Token: ${token}`);

    const response = await axios.get(url, {
      params: { pathIn, pathOut, token: token || "electron-ui" },
      timeout: 0, // sem limite, para permitir execução longa
    });

    console.log("✅ Resposta do parser:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Erro ao executar parser:", err.message);
    throw err;
  }
}

ipcMain.handle('copiar-saida', async (_event, pathRemoto, pathLocal) => {
  try {
    console.log("➡️ Copiando saída do servidor para local...");
    console.log("Origem:", pathRemoto);
    console.log("Destino:", pathLocal);

    // Verifica se ambos os caminhos existem
    if (!fs.existsSync(pathRemoto)) throw new Error("Pasta remota não encontrada.");
    await fs.ensureDir(pathLocal);

    // Copia todo o conteúdo do servidor para o local
    await fs.copy(pathRemoto, pathLocal, { overwrite: true });
    console.log("✅ Cópia concluída com sucesso!");
    return { success: true };
  } catch (err) {
    console.error("❌ Erro ao copiar saída:", err);
    return { success: false, error: err.message };
  }
});

// main.js (trechos novos/alterados)

ipcMain.handle("parser:prepare", async () => {
  const saidaServidor = criar_pasta_saida_servidor();
  return { saidaServidor };
});

ipcMain.handle("iniciar-parser", async (_event, entradaLocal, saidaLocal, tipo, token, saidaServidor) => {
  // se não veio de fora, cria aqui (backward compat)
  if (!saidaServidor) saidaServidor = criar_pasta_saida_servidor();

  // dispara em background (não await)
  (async () => {
    try {
      const result = await executarParser(entradaLocal, saidaServidor, tipo, token);

      // persiste o JSON de resultado para a UI ler
      const resultPath = path.join(saidaServidor, `.result_${token}.json`);
      await fs.writeJson(resultPath, result, { spaces: 2 });

      // copia saída para a pasta local escolhida
      await fs.ensureDir(saidaLocal);
      await fs.copy(saidaServidor, saidaLocal, { overwrite: true });

      // marca finalização
      await fs.writeFile(path.join(saidaServidor, `.done_${token}`), "OK");
    } catch (err) {
      try {
        await fs.writeFile(path.join(saidaServidor, `.error_${token}`), String(err?.message || err));
      } catch {}
    }
  })();

  // retorna imediatamente para a renderer poder iniciar o polling
  return { started: true, saidaServidor };
});

ipcMain.handle("comparar-listas", async (_event, list1, list2) => {
  const url = "http://10.0.0.106:8100/comparar_ws";//"http://127.0.0.1:8000/comparar_ws"//;

  console.log(">>> IPC comparar-listas - list1:", list1);
  console.log(">>> IPC comparar-listas - list2:", list2);

  try {
    const response = await axios.post(
      url,
      { list1, list2 }, // BODY JSON
      {
        timeout: 0,
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log(">>> Resposta FastAPI:", response.data);
    const data = response.data;

    if (typeof data === "object" && data.resultado) {
      return data.resultado;
    }
    if (typeof data === "string") {
      return data;
    }

    return JSON.stringify(data);
  } catch (err) {
    console.error("Erro no comparar-listas:", err.response?.data || err);
    return `Erro: ${err.message}`;
  }
});

ipcMain.handle("get-notices", async () => {
  const url = "http://10.0.0.106:8100/notices";
  try {
    console.log("Buscando notícias do gov...");
    const response = await axios.get(url, { timeout: 60000 });
    console.log("✅ Notícias carregadas:", Object.keys(response.data));
    return response.data;
  } catch (err) {
    console.error("❌ Erro ao obter notícias:", err.message);
    return { erro: err.message };
  }
});