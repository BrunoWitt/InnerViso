// src/main/ipc-buscadorEp.js
const { ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const FormData = require("form-data");
const { inflate } = require('zlib');

function _filenameFromContentDisposition(cd) {
    if (!cd) return null;
    const m =
        /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd) ||
        /filename="([^"]+)"/i.exec(cd) ||
        /filename=([^;]+)/i.exec(cd);
    if (!m) return null;
    return decodeURIComponent(m[1].replace(/"/g, "").trim());
}

function registerBuscadorEpIPC() {
    let dialogOpen = false;

    ipcMain.handle('select-base-file', async () => {
        /**
         * Função responsável por abrir a caixa de dialogo para seleção do arquivo base do Buscador EP.
         */
        if (dialogOpen) return null;
        dialogOpen = true;
        
        try{
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx', 'xls'] },]
            })

            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        } finally {
            dialogOpen = false;
        }
    })

    ipcMain.handle('select-search-file', async () => {
        /**
         * Função responsável por abrir a caixa de dialogo para seleção do arquivo de busca do Buscador EP.
         */
        if (dialogOpen) return null;
        dialogOpen = true;

        try{
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx', 'xls'] },]
            })
            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        } finally {
            dialogOpen = false;
        }
    })

    ipcMain.handle('select-path-out-folder', async () => {
        /**
         * Função responsável por abrir a caixa de dialogo para seleção da pasta de saída do Buscador EP.
         */
        if (dialogOpen) return null;
        dialogOpen = true;

        try{
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
            })
            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        } finally {
            dialogOpen = false;
        }
    })

    ipcMain.handle('buscador-ep-run', async (event, payload, pathOutLocal) => {
        /**
         * Função responsável por executar o backend. 
         * Trata os caminhos path e transforma em FormData para envio via HTTP.
         */
        API_URL = 'http://127.0.0.1:8000/api/buscador_ep'; 
        const {
            basePath,
            searchPath,
            bert_weight = 0.5,
            cnpj_sheet_name = null,
        } = payload || {};

        if (!basePath || !searchPath) throw new Error("basePath e searchPath são obrigatórios.");
        if (!(await fs.pathExists(basePath))) throw new Error(`BASE não encontrada: ${basePath}`);
        if (!(await fs.pathExists(searchPath))) throw new Error(`BUSCA não encontrada: ${searchPath}`);

        const form = new FormData();
        form.append('first_file', fs.createReadStream(basePath), { filename: path.basename(basePath) });
        form.append('second_file', fs.createReadStream(searchPath), { filename: path.basename(searchPath) });

        const response = await axios.post(API_URL, form, {
            params: {
                bert_weight,
                cnpj_sheet_name: cnpj_sheet_name || undefined,
            },
            headers: {...form.getHeaders() },
            responseType: 'arraybuffer',
            timeout: 0,
            validateStatus: () => true,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        if (response.status !== 200) {
            let details = "";
            try { details = Buffer.from(response.data).toString("utf-8"); } catch {}
            throw new Error(`Backend retornou HTTP ${response.status}${details ? `: ${details}` : ""}`);
        }

        const cd = response.headers['content-disposition'];
        const filename = _filenameFromContentDisposition(cd) || `resultado_${Date.now()}.txt`;

        const outDir =
            (pathOutLocal && String(pathOutLocal).trim())
            ? String(pathOutLocal).trim()
            : path.join(os.homedir(), "Downloads");

        await fs.ensureDir(outDir);

        // ✅ monta caminho final; evita sobrescrever se já existir
        const ext = path.extname(filename) || ".txt";
        const base = path.basename(filename, ext);
        let outFilePath = path.join(outDir, filename);

        if (await fs.pathExists(outFilePath)) {
            outFilePath = path.join(outDir, `${base}_${Date.now()}${ext}`);
        }

        await fs.writeFile(outFilePath, Buffer.from(response.data));

        return { ok: true, saved: true, filePath: outFilePath };
        });
}

module.exports = { registerBuscadorEpIPC };