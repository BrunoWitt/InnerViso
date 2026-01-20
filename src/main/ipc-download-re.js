const { ipcMain, dialog, shell } = require("electron");
const axios = require("axios");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");

const BACKEND_BASE = "http://10.0.0.232:1051";
const RE_ENDPOINT = `${BACKEND_BASE}/due_router/RE`;

// mesmo padrão do EXPO8
const BASE_UNC = "G:\\Sistemas\\FileSystem\\WSVISOparser";

function dataHoraBRParaNome() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}-${hh}-${min}`;
}

async function gerarStampUnico(baseDir, stampBase) {
    let stamp = stampBase;
    let i = 1;
    while (await fs.pathExists(path.join(baseDir, stamp))) {
        i += 1;
        stamp = `${stampBase}_${i}`;
    }
    return stamp;
    }

    async function criar_pastas(tipo) {
    const nomeMaquina = os.hostname();

    const baseExecDir = path.join(BASE_UNC, nomeMaquina);
    await fs.ensureDir(baseExecDir);

    const stampBase = dataHoraBRParaNome();
    const stamp = await gerarStampUnico(baseExecDir, stampBase);

    const enderecoFinal = path.join(baseExecDir, tipo, stamp);

    const pastaEntradas = path.join(enderecoFinal, "entrada");
    const pastaSaida = path.join(enderecoFinal, "saida");

    await fs.ensureDir(pastaEntradas);
    await fs.ensureDir(pastaSaida);

    return { entradaServidor: pastaEntradas, saidaServidor: pastaSaida };
}

async function copiarEntradaXlsx(pastaEntradaLocal, pastaEntradaServidor) {
    const st = await fs.stat(pastaEntradaLocal);

    if (!st.isDirectory()) {
        throw new Error("A entrada do RE deve ser uma pasta (diretório).");
    }

    const files = await fs.readdir(pastaEntradaLocal);
    const xlsx = files.filter((f) => path.extname(f).toLowerCase() === ".xlsx");

    if (!xlsx.length) {
        throw new Error("Não encontrei arquivos .xlsx na pasta de entrada.");
    }

    for (const f of xlsx) {
        await fs.copyFile(
        path.join(pastaEntradaLocal, f),
        path.join(pastaEntradaServidor, f)
        );
    }

    return xlsx.length;
}

async function resgate_arquivos_do_servidor(pathOutServer, pathOutLocal) {
    await fs.ensureDir(pathOutLocal);

    const arquivos = await fs.readdir(pathOutServer);
    let copied = 0;

    for (const arquivo of arquivos) {
        if (path.extname(arquivo).toLowerCase() === ".xlsx") {
        await fs.copyFile(
            path.join(pathOutServer, arquivo),
            path.join(pathOutLocal, arquivo)
        );
        copied += 1;
        }
    }

    return copied;
}

/* conversão windows -> linux (igual seu EXPO8) */
const LINUX_MOUNT = "/mnt/sistemas_visonet";

function winPathToLinux(p) {
    if (!p) return p;

    const raw = String(p).trim();
    if (raw.startsWith("/")) return path.posix.normalize(raw);

    const s = raw.replace(/\//g, "\\");
    const lower = s.toLowerCase();

    const marker1 = "\\filesystem\\wsvisoparser\\";
    const marker2 = "\\filesystem\\wsvisoparser";

    let idx = lower.indexOf(marker1);
    if (idx === -1) idx = lower.indexOf(marker2);

    if (idx === -1) {
        console.log("[converter] path recebido:", JSON.stringify(raw));
        console.log("[converter] path normalizado:", JSON.stringify(s));
        throw new Error(
        `Não foi possível converter. Não encontrei "FileSystem\\WSVISOparser" em: ${raw}`
        );
    }

    let tail = s.substring(idx + 1);
    tail = tail.replace(/[\\]+/g, "/");

    return path.posix.normalize(`${LINUX_MOUNT}/${tail}`);
}

function converter_pastas(pathInServer, pathOutServer) {
    const pathInLinux = winPathToLinux(pathInServer);
    const pathOutLinux = winPathToLinux(pathOutServer);

    console.log("[converter] pathInLinux:", pathInLinux);
    console.log("[converter] pathOutLinux:", pathOutLinux);

    return { pathInLinux, pathOutLinux };
}

    async function executarRE(entradaServidor, saidaServidor, nomeSaida) {
    const { pathInLinux, pathOutLinux } = converter_pastas(entradaServidor, saidaServidor);

    const response = await axios.post(RE_ENDPOINT, null, {
        params: {
        pathin: pathInLinux,
        pathout: pathOutLinux,
        nomeSaida: nomeSaida ?? null,
        },
        timeout: 0,
        validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
        const detalhe =
        typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data, null, 2);
        throw new Error(`HTTP ${response.status} em ${RE_ENDPOINT}\n${detalhe}`);
    }

    return response.data;
}

function downloadRe() {
  // selecionar pasta (entrada/saída)
    ipcMain.handle("re:dialog-select-folder", async (_event, kind) => {
        const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: kind === "in" ? "Selecione a pasta de entrada" : "Selecione a pasta de saída",
        });
        if (result.canceled) return null;
        return result.filePaths?.[0] || null;
    });

  // abrir pasta (pra garantir que window.api.openFolder funcione)
    ipcMain.handle("open-folder", async (_event, folderPath) => {
        try {
        if (!folderPath) return { ok: false, error: "Caminho vazio." };
        await fs.ensureDir(folderPath);
        const r = await shell.openPath(folderPath);
        if (r) return { ok: false, error: r };
        return { ok: true };
        } catch (err) {
        return { ok: false, error: err?.message || String(err) };
        }
    });

  // rodar RE
    ipcMain.handle("re:run", async (_event, payload) => {
        const { pathin, pathout, nomeSaida, pesoBert } = payload || {};

    if (!pathin || !pathout) {
        throw new Error("pathin e pathout são obrigatórios.");
    }

    // cria execução no servidor
    const tipo = "RE";
    const { entradaServidor, saidaServidor } = await criar_pastas(tipo);

    // copia entrada
    const qtdIn = await copiarEntradaXlsx(pathin, entradaServidor);

    // chama backend
    const resp = await executarRE(entradaServidor, saidaServidor, nomeSaida, pesoBert);

    // copia saída pro local do usuário
    const qtdOut = await resgate_arquivos_do_servidor(saidaServidor, pathout);

    return {
        status: "ok",
        message: `RE finalizado. Entrada copiada: ${qtdIn} .xlsx | Saída copiada: ${qtdOut} .xlsx`,
        backend: resp,
        };
    });
}

module.exports = { downloadRe };
