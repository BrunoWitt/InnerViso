// src/main/ipc-di-pdf.js
const { ipcMain, dialog } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

function dataHoraBRParaNome() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}-${hh}-${min}`;
}

function normalizeDiList(disRaw) {
    const dis = Array.isArray(disRaw) ? disRaw : [];
    // DI costuma ser 8–12 dígitos (pelo seu backend)
    const cleaned = dis
        .map((d) => String(d || "").replace(/\D+/g, ""))
        .filter((d) => d.length >= 8 && d.length <= 12);
    return Array.from(new Set(cleaned));
}

async function listFilesRecursive(rootDir) {
    const out = [];
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            await walk(full);
        } else {
            out.push(full);
        }
        }
    }
    if (await fs.pathExists(rootDir)) {
        await walk(rootDir);
    }
    return out;
}

async function copyDirContentsToDest(srcDir, destDir) {
    await fs.ensureDir(destDir);

    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    for (const e of entries) {
        const src = path.join(srcDir, e.name);
        const dst = path.join(destDir, e.name);
        await fs.copy(src, dst, { overwrite: true, errorOnExist: false });
    }
}

function registerDiPdf() {
    const running = new Map();

  // ============================
  // ESCOLHER PASTA (usuário)
  // ============================
    ipcMain.handle("select-di-pdf-output-dir", async () => {
        const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Selecione a pasta de saída",
        });

        if (result.canceled || !result.filePaths?.length) {
        return { ok: false, path: "" };
        }

        return { ok: true, path: result.filePaths[0] };
    });

    ipcMain.handle("open-path-dipdf", async (_event, targetPath) => {
    const p = String(targetPath || "").trim();
    if (!p) return { ok: false };

    try {
        await shell.openPath(p);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
    });

    // ============================
    // CANCELAR
    // ============================
    ipcMain.handle("cancelar-di-pdf", async (event) => {
        const run = running.get(event.sender.id);
        if (!run) return { ok: false };

        try {
        if (run.controller) run.controller.abort();
        return { ok: true };
        } finally {
        running.delete(event.sender.id);
        }
    });

    // ============================
    // DI -> PDF (backend + copia)
    // ============================
    ipcMain.handle("di-pdf-download-and-convert", async (event, payload = {}) => {
        const controller = new AbortController();
        running.set(event.sender.id, { controller });

        const sendProgress = (message) => {
        try {
            event.sender.send("di-pdf-progress", { message: String(message || "") });
        } catch {}
        };

        try {
        const dis = normalizeDiList(payload?.dis);
        const userOutDir = String(payload?.userOutDir || "").trim();

        if (!dis.length) {
            return {
            status: "erro",
            files: [],
            mensagem: "Informe pelo menos uma DI válida (8 a 12 dígitos).",
            };
        }

        if (!userOutDir) {
            return {
            status: "erro",
            files: [],
            mensagem: "Selecione a pasta de saída.",
            };
        }

        // Base "Windows" (rede mapeada)
        const BASE_WIN = "G:\\Sistemas\\FileSystem\\WSVISOScraper";

        // Base "Linux" (o backend exige Linux)
        const BASE_LINUX = "/mnt/sistemas_visonet/FileSystem/WSVISOScraper";

        const maquina = os.hostname();
        const stamp = dataHoraBRParaNome();

        // Pasta onde o backend deve escrever (Linux)
        const pathOutLinux = `${BASE_LINUX}/${maquina}/diParaPdf/${stamp}`;

        // A MESMA pasta, só que no Windows (para copiar depois)
        const pathOutWin = path.join(BASE_WIN, maquina, "diParaPdf", stamp);

        await fs.ensureDir(pathOutWin);

        sendProgress("Enviando solicitação para o backend (DI → PDF)...");

        const url = "http://10.0.0.230:1071/di/download-di-pdf";

        const headers = {
            "X-DI-List": dis.join(","),
            pathOut: pathOutLinux,
        };

        const resp = await axios.get(url, {
            timeout: 0,
            signal: controller.signal,
            headers,
        });

        sendProgress("Backend finalizou. Preparando cópia para a pasta escolhida...");

        // Lista o que saiu na pasta da rede
        const generatedFiles = await listFilesRecursive(pathOutWin);

        if (!generatedFiles.length) {
            // Mesmo que o backend respondeu OK, mas não gerou arquivo
            return {
            status: "sucesso",
            files: [],
            mensagem:
                "Processo finalizado, mas nenhum arquivo foi encontrado na pasta de saída do scraper.",
            debug: {
                pathOutLinux,
                pathOutWin,
                httpStatus: resp?.status,
            },
            };
        }

        // Copia só o conteúdo da pasta (não cria pasta stamp dentro do destino)
        await copyDirContentsToDest(pathOutWin, userOutDir);

        // Para mostrar no front: caminhos relativos (mais limpo)
        const copiedNames = generatedFiles.map((f) => path.relative(pathOutWin, f));

        sendProgress("Arquivos copiados com sucesso.");

        return {
            status: "sucesso",
            files: copiedNames,
            mensagem: `Gerado(s) ${copiedNames.length} arquivo(s) e copiado(s) para a pasta selecionada.`,
            output: {
            pathOutLinux,
            pathOutWin,
            userOutDir,
            maquina,
            stamp,
            },
        };
        } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return {
            status: "erro",
            files: [],
            mensagem: "Processo cancelado pelo usuário.",
            };
        }

        const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data ||
            err?.message ||
            String(err);

        return {
            status: "erro",
            files: [],
            mensagem: `Erro ao processar DI → PDF: ${backendMsg}`,
        };
        } finally {
        running.delete(event.sender.id);
        }
    });
}

module.exports = { registerDiPdf };
