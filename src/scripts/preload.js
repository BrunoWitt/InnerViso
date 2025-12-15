// src/scripts/preload.js
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('[preload] carregado');

try {
  contextBridge.exposeInMainWorld('api', {
    runScraper: () => ipcRenderer.invoke('scraper:run'),
    readNotices: () => ipcRenderer.invoke('scraper:read'),
    loadView: (name) => ipcRenderer.invoke('views:load', name),
    selectFolder: (tipo) => ipcRenderer.invoke('dialog:select-folder', tipo),
    selectFileZip: () => ipcRenderer.invoke('select-file-zip'),
    openFolder: (absPath) => ipcRenderer.invoke('fs:open-folder', absPath),
    savePath: (caminho_entrada, caminho_saida) => ipcRenderer.invoke('save-path', caminho_entrada, caminho_saida),
    fileExists: (caminho) => ipcRenderer.invoke('open-json', caminho),
    clearPaths: () => ipcRenderer.invoke("clear-paths"),
    compararListas: (list1, list2) => ipcRenderer.invoke("comparar-listas", list1, list2),
    getNotices: () => ipcRenderer.invoke("get-notices"),
    getNoticesCached: () => ipcRenderer.invoke("get-notices-cached"),
    saveNotices: (data) => ipcRenderer.invoke("salvar-notices", data),
    parserExpo8: (listCodes, caminho_saida) => ipcRenderer.invoke("parserExpo8", listCodes, caminho_saida),
    readExpo8Log: () => ipcRenderer.invoke("readExpo8Log"),
    runExpo8: (dues, saida) => ipcRenderer.invoke("run-expo8", dues, saida),
    cancelExpo8: () => ipcRenderer.invoke("cancelExpo8"),

    // Parser WSViso

    iniciarParser: (entrada, saida, tipoParser, token) => ipcRenderer.invoke('iniciar-parser', entrada, saida, tipoParser, token),
    parserStatus: (token) => ipcRenderer.invoke('parser:status', token),
    parserProgress: (token) => ipcRenderer.invoke('parser:progress', token),
    parserCancel:   (token) => ipcRenderer.invoke('parser:cancel', token),

    copiarSaida: (remoto, local) => ipcRenderer.invoke('copiar-saida', remoto, local),

    lerProgresso(saidaServidor, token) {
      try {
        const progressFile = path.join(saidaServidor, `.progress_${token}`);
        if (fs.existsSync(progressFile)) return fs.readFileSync(progressFile, 'utf-8');
        return '';
      } catch (err) {
        console.error('[preload] Erro lendo progresso:', err);
        return '';
      }
    },
    existeDone: (saidaServidor, token) => {
      try { return fs.existsSync(path.join(saidaServidor, `.done_${token}`)); }
      catch { return false; }
    },
    existeErro: (saidaServidor, token) => {
      try { return fs.existsSync(path.join(saidaServidor, `.error_${token}`)); }
      catch { return false; }
    },
    lerResultado: (saidaServidor, token) => {
      try {
        const f = path.join(saidaServidor, `.result_${token}.json`);
        if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
        return null;
      } catch { return null; }
    },
    lerErro: (saidaServidor, token) => {
      try {
        const f = path.join(saidaServidor, `.error_${token}`);
        if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8');
        return null;
      } catch { return null; }
    },

  });

  contextBridge.exposeInMainWorld("api", {
    runExpo8: (dues, output) => ipcRenderer.invoke("run-expo8", dues, output),
  });


  console.log('[preload] API exposta com sucesso');
} catch (e) {
  console.error('[preload] Falha ao expor API:', e);
}

