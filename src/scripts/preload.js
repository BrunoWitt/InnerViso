// src/scripts/preload.js
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('[preload] carregado');

try {
  contextBridge.exposeInMainWorld('api', {
    // =========================
    // SCRAPER / HUB
    // =========================
    baixarDi: (dis, pathOut) => ipcRenderer.invoke("baixar-di", dis, pathOut),
    cancelBaixarDi: () => ipcRenderer.invoke("cancelar-baixar-di"),
    runScraper: () => ipcRenderer.invoke('scraper:run'),
    readNotices: () => ipcRenderer.invoke('scraper:read'),
    loadView: (name) => ipcRenderer.invoke('views:load', name),

    // =========================
    // FILESYSTEM / DIALOG
    // =========================
    selectFolder: (tipo) => ipcRenderer.invoke('dialog:select-folder', tipo),
    selectFileZip: () => ipcRenderer.invoke('select-file-zip'),
    openFolder: (absPath) => ipcRenderer.invoke('fs:open-folder', absPath),
    savePath: (caminho_entrada, caminho_saida) =>
      ipcRenderer.invoke('save-path', caminho_entrada, caminho_saida),
    fileExists: (caminho) => ipcRenderer.invoke('open-json', caminho),
    clearPaths: () => ipcRenderer.invoke("clear-paths"),

    // =========================
    // COMPARADOR / HUB
    // =========================
    compararListas: (list1, list2) =>
      ipcRenderer.invoke("comparar-listas", list1, list2),
    getNotices: () => ipcRenderer.invoke("get-notices"),
    getNoticesCached: () => ipcRenderer.invoke("get-notices-cached"),
    saveNotices: (data) => ipcRenderer.invoke("salvar-notices", data),

    // =========================
    // EXPO8
    // =========================
    parserExpo8: (listCodes, caminho_saida, nomeSaida) =>
      ipcRenderer.invoke("parserExpo8", listCodes, caminho_saida, nomeSaida),
    readExpo8Log: () => ipcRenderer.invoke("readExpo8Log"),
    runExpo8: (dues, saida) => ipcRenderer.invoke("run-expo8", dues, saida),
    cancelExpo8: () => ipcRenderer.invoke("cancelExpo8"),
    getExpo8Progress: () => ipcRenderer.invoke("getExpo8Progress"),

    // =========================
    // MODELO 7
    // =========================
    runModelo7: (args = []) => ipcRenderer.invoke('modelo7:run', args),

    // =========================
    // COLETAR DI
    // =========================
    coletarDi: () => ipcRenderer.invoke("coletar-di"),
    cancelColetarDi: () => ipcRenderer.invoke("cancelar-coletar-di"),

    // =========================
    // BAIXAR DI  <<< NOVO >>>
    // =========================
    baixarDi: (listDis, pathOut) =>
      ipcRenderer.invoke("baixar-di", listDis, pathOut),
    cancelBaixarDi: () =>
      ipcRenderer.invoke("cancelar-baixar-di"),

    baixarLi: (listLis, pathOut) =>
      ipcRenderer.invoke("baixar-li", listLis, pathOut),
    cancelBaixarLi: () =>
      ipcRenderer.invoke("cancelar-baixar-li"),

    baixarDue: (listDues, pathOut, ) =>
      ipcRenderer.invoke("baixar-due", listDues, pathOut),
    cancelBaixarDue: () =>
      ipcRenderer.invoke("cancelar-baixar-due"),
    coletarDiCnpj: (cnpjs, initialDate, endDate) =>
      ipcRenderer.invoke("coletar-di-cnpj", { cnpjs, initialDate, endDate }),
    cancelColetarDiCnpj: () =>
      ipcRenderer.invoke("cancelar-coletar-di-cnpj"),
    coletarLi: () => ipcRenderer.invoke("coletar-li"),
    cancelColetarLi: () => ipcRenderer.invoke("cancelar-coletar-li"),
    coletarLiCnpj: (cnpjs, initialDate, endDate) =>
      ipcRenderer.invoke("coletar-li-cnpj", { cnpjs, initialDate, endDate }),
    cancelColetarLiCnpj: () =>
      ipcRenderer.invoke("cancelar-coletar-li-cnpj"),
    baixarAtoCnpj: (cnpjs) => ipcRenderer.invoke("baixar-ato-cnpj", { cnpjs }),
    cancelBaixarAtoCnpj: () => ipcRenderer.invoke("cancelar-baixar-ato-cnpj"),
    selectDiPdfOutputDir: () => ipcRenderer.invoke("select-di-pdf-output-dir"),

    diPdfDownloadAndConvert: (dis, userOutDir) =>
      ipcRenderer.invoke("di-pdf-download-and-convert", { dis, userOutDir }),

    cancelDiPdf: () => ipcRenderer.invoke("cancelar-di-pdf"),

    onDiPdfProgress: (cb) => {
      ipcRenderer.removeAllListeners("di-pdf-progress");
      ipcRenderer.on("di-pdf-progress", (_e, payload) => cb?.(payload));
    },
    openPath: (p) => ipcRenderer.invoke("open-path-dipdf", p),

    // baixarAto
    baixarAto: (numAto, userOutDir) => ipcRenderer.invoke("baixar-ato", { numAto, userOutDir }),
    cancelBaixarAto: () => ipcRenderer.invoke("cancelar-baixar-ato"),
    selectBaixarAtoOutputDir: () => ipcRenderer.invoke("select-baixar-ato-output-dir"),
    openPathAto: (p) => ipcRenderer.invoke("open-path-ato", p),
    baixarAtoGetPage: (csvPath, offset, limit) => ipcRenderer.invoke("baixar-ato-get-page", { csvPath, offset, limit }),
    onBaixarAtoProgress: (cb) => ipcRenderer.on("baixar-ato-progress", (_e, payload) => cb(payload)),

    // =========================
    // PARSER WSViso
    // =========================
    iniciarParser: (entrada, saida, tipoParser, token, nomeSaida) =>
      ipcRenderer.invoke('iniciar-parser', entrada, saida, tipoParser, token, nomeSaida),
    parserStatus: (token) => ipcRenderer.invoke('parser:status', token),
    parserProgress: (token) => ipcRenderer.invoke('parser:progress', token),
    parserCancel: (token) => ipcRenderer.invoke('parser:cancel', token),
    copiarSaida: (remoto, local) =>
      ipcRenderer.invoke('copiar-saida', remoto, local),

    lerProgresso(saidaServidor, token) {
      try {
        const progressFile = path.join(saidaServidor, `.progress_${token}`);
        if (fs.existsSync(progressFile))
          return fs.readFileSync(progressFile, 'utf-8');
        return '';
      } catch (err) {
        console.error('[preload] Erro lendo progresso:', err);
        return '';
      }
    },

    existeDone: (saidaServidor, token) => {
      try {
        return fs.existsSync(path.join(saidaServidor, `.done_${token}`));
      } catch {
        return false;
      }
    },

    existeErro: (saidaServidor, token) => {
      try {
        return fs.existsSync(path.join(saidaServidor, `.error_${token}`));
      } catch {
        return false;
      }
    },

    lerResultado: (saidaServidor, token) => {
      try {
        const f = path.join(saidaServidor, `.result_${token}.json`);
        if (fs.existsSync(f))
          return JSON.parse(fs.readFileSync(f, 'utf-8'));
        return null;
      } catch {
        return null;
      }
    },

    lerErro: (saidaServidor, token) => {
      try {
        const f = path.join(saidaServidor, `.error_${token}`);
        if (fs.existsSync(f))
          return fs.readFileSync(f, 'utf-8');
        return null;
      } catch {
        return null;
      }
    },

    // =========================
    // BUSCADOR EP
    // =========================
    selectBaseFile: () => ipcRenderer.invoke('select-base-file'),
    selectSearchFile: () => ipcRenderer.invoke('select-search-file'),
    selectPathOutFolder: () => ipcRenderer.invoke('select-path-out-folder'),
    previewXlsx: (filePath, opts) => ipcRenderer.invoke("xlsx-preview", filePath, opts),
    openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),

    buscadorEpStart: (payload) => ipcRenderer.invoke('buscador-ep-start', payload),
    buscadorEpProgress: (reqId) => ipcRenderer.invoke('buscador-ep-progress', reqId),
    buscadorEpCancel: (reqId) => ipcRenderer.invoke('buscador-ep-cancel', reqId),
    buscadorEpDownload: (reqId, pathOutLocal) => ipcRenderer.invoke('buscador-ep-download', reqId, pathOutLocal),


    //Expo8
    runExpo8: (dues, output) => ipcRenderer.invoke("run-expo8", dues, output),
  });

  console.log('[preload] API exposta com sucesso');
} catch (e) {
  console.error('[preload] Falha ao expor API:', e);
}