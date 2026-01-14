    // src/main/ipc-buscadorEp.js
    const { ipcMain, dialog, shell } = require("electron");
    const fs = require("fs-extra");
    const path = require("path");
    const os = require("os");
    const axios = require("axios");
    const FormData = require("form-data");
    const crypto = require("crypto");
    const XLSX = require("xlsx");

    function _filenameFromContentDisposition(cd) {
    if (!cd) return null;
    const m =
        /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd) ||
        /filename="([^"]+)"/i.exec(cd) ||
        /filename=([^;]+)/i.exec(cd);
    if (!m) return null;
    return decodeURIComponent(m[1].replace(/"/g, "").trim());
    }

    function _shortReqId() {
        return crypto.randomBytes(5).toString("hex");
    }

    async function _ensureXlsxExists(filePath) {
        if (!filePath) throw new Error("Caminho do arquivo não informado.");
        if (!(await fs.pathExists(filePath))) throw new Error(`Arquivo não encontrado: ${filePath}`);
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== ".xlsx") {
            throw new Error(`Arquivo inválido (${ext}). Envie .xlsx`);
        }
    }


    async function _saveArrayBufferToDisk(arrayBuffer, headers, outDir) {
    const cd = headers?.["content-disposition"];
    const filename = _filenameFromContentDisposition(cd) || `resultado_${Date.now()}.txt`;

    const finalOutDir =
        outDir && String(outDir).trim()
        ? String(outDir).trim()
        : path.join(os.homedir(), "Downloads");

    await fs.ensureDir(finalOutDir);

    const ext = path.extname(filename) || ".txt";
    const base = path.basename(filename, ext);
    let outFilePath = path.join(finalOutDir, filename);

    if (await fs.pathExists(outFilePath)) {
        outFilePath = path.join(finalOutDir, `${base}_${Date.now()}${ext}`);
    }

    await fs.writeFile(outFilePath, Buffer.from(arrayBuffer));
    return outFilePath;
    }

    function registerBuscadorEpIPC() {
    let dialogOpen = false;

    const API_BASE = "http:/10.0.0.232:1053/api";
    const API_START = `${API_BASE}/buscador_ep/start`;
    const API_PROGRESS = (reqId) => `${API_BASE}/progress/${reqId}`;
    const API_CANCEL = (reqId) => `${API_BASE}/progress/cancel/${reqId}`;
    const API_RESULT = (reqId) => `${API_BASE}/buscador_ep/result/${reqId}`;

    ipcMain.handle("select-base-file", async () => {
        if (dialogOpen) return null;
        dialogOpen = true;
        try {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
        } finally {
        dialogOpen = false;
        }
    });


    ipcMain.handle("select-search-file", async () => {
        if (dialogOpen) return null;
        dialogOpen = true;
        try {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
        } finally {
        dialogOpen = false;
        }
    });


    ipcMain.handle("select-path-out-folder", async () => {
        if (dialogOpen) return null;
        dialogOpen = true;
        try {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory"],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
        } finally {
        dialogOpen = false;
        }
    });

    ipcMain.handle("open-path", async (event, targetPath) => {
        try {
            const p = String(targetPath || "").trim();
            if (!p) return { ok: false, error: "Caminho vazio." };

            const exists = await fs.pathExists(p);
            if (!exists) return { ok: false, error: `Caminho não encontrado: ${p}` };

            const stat = await fs.stat(p);

            // Se for pasta: abre a pasta
            if (stat.isDirectory()) {
            const res = await shell.openPath(p);
            if (res) return { ok: false, error: res }; // shell.openPath retorna string vazia se ok
            return { ok: true };
            }

            // Se for arquivo: destaca no Explorer/Finder
            shell.showItemInFolder(p);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err?.message || String(err) };
        }
    });

    //Preview dos excel
    function previewXlsx(filePath, { sheetName = null, maxRows = 100 } = {}) {
        const wb = XLSX.readFile(filePath, { cellDates: true });

        const chosenSheet = sheetName || wb.SheetNames[0];
        const ws = wb.Sheets[chosenSheet];
        if (!ws) throw new Error(`Aba não encontrada: ${chosenSheet}`);

        // 2D array (linhas/colunas)
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

        // corta para N linhas
        const sliced = aoa.slice(0, Math.max(1, maxRows));

        const header = (sliced[0] || []).map((h, i) => (String(h || "").trim() ? String(h) : `Col ${i + 1}`));
        const rows = sliced.slice(1).map((r) => header.map((_, i) => (r?.[i] ?? "")));

        return {
            sheetNames: wb.SheetNames,
            sheet: chosenSheet,
            header,
            rows,
        };
    }

    ipcMain.handle("xlsx-preview", async (event, filePath, opts) => {
        await _ensureXlsxExists(filePath);
        return { ok: true, data: previewXlsx(filePath, opts) };
    });

    // 1) START
    ipcMain.handle("buscador-ep-start", async (event, payload) => {
        const p = payload || {};
        const basePath = p.basePath;
        const searchPath = p.searchPath;

        let bert_weight = Number.parseFloat(String(p.bert_weight ?? "0.5"));
        if (!Number.isFinite(bert_weight)) bert_weight = 0.5;
        bert_weight = Math.max(0, Math.min(1, bert_weight));

        const cnpj_sheet_name = (p.cnpj_sheet_name && String(p.cnpj_sheet_name).trim())
        ? String(p.cnpj_sheet_name).trim()
        : null;

        await _ensureXlsxExists(basePath);
        await _ensureXlsxExists(searchPath);

        const reqId = _shortReqId();

        const form = new FormData();
        form.append("first_file", fs.createReadStream(basePath), { filename: path.basename(basePath) });
        form.append("second_file", fs.createReadStream(searchPath), { filename: path.basename(searchPath) });

        const response = await axios.post(API_START, form, {
        params: {
            bert_weight,
            cnpj_sheet_name: cnpj_sheet_name || undefined,
        },
        headers: {
            ...form.getHeaders(),
            "X-Request-Id": reqId,
        },
        responseType: "json",
        timeout: 0,
        validateStatus: () => true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        });

        if (response.status !== 200) {
        throw new Error(`START: Backend retornou HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        }

        const returned = response.data?.req_id || reqId;
        return { ok: true, req_id: returned };
    });


    // 2) PROGRESS
    ipcMain.handle("buscador-ep-progress", async (event, req_id) => {
        if (!req_id) throw new Error("req_id não informado.");
        const response = await axios.get(API_PROGRESS(req_id), {
        responseType: "json",
        timeout: 0,
        validateStatus: () => true,
        });

        if (response.status === 404) return { ok: false, status: "missing" };
        if (response.status !== 200) {
        return { ok: false, status: "http_error", http_status: response.status, data: response.data };
        }
        return { ok: true, data: response.data };
    });


    ipcMain.handle("buscador-ep-cancel", async (event, req_id) => {
        if (!req_id) throw new Error("req_id não informado.");

        const response = await axios.post(API_CANCEL(req_id), null, {
            timeout: 0,
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            throw new Error(`CANCEL: Backend retornou HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        }

        return { ok: true, data: response.data };
    });

    // 3) DOWNLOAD RESULT
    ipcMain.handle("buscador-ep-download", async (event, req_id, pathOutLocal) => {
        if (!req_id) throw new Error("req_id não informado.");

        const response = await axios.get(API_RESULT(req_id), {
        responseType: "arraybuffer",
        timeout: 0,
        validateStatus: () => true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        });

        if (response.status !== 200) {
        let details = "";
        try {
            details = Buffer.from(response.data).toString("utf-8");
        } catch {}
        throw new Error(`RESULT: Backend retornou HTTP ${response.status}${details ? `: ${details}` : ""}`);
        }

        const outFilePath = await _saveArrayBufferToDisk(response.data, response.headers, pathOutLocal);
        return { ok: true, saved: true, filePath: outFilePath };
    });
    }

    module.exports = { registerBuscadorEpIPC };
