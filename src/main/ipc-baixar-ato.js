// src/main/ipc-baixar-ato.js
const { ipcMain, dialog, shell } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const readline = require("readline");

function dataHoraBRParaNome() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}-${hh}-${min}`;
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

// numAto normalmente é algo como 20230004180 (11 dígitos). Vamos aceitar 8–20 p/ não bloquear caso mude.
function normalizeAto(raw) {
  const d = onlyDigits(raw);
  return d.length >= 8 ? d : "";
}

async function listFilesRecursive(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  if (await fs.pathExists(rootDir)) await walk(rootDir);
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

function detectDelimiter(line) {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function cleanCell(v) {
  const s = String(v ?? "").trim();
  // remove aspas externas
  return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
}

async function readFirstColPreview(csvPath, limit = 200) {
  // lê somente o necessário (não varre o arquivo inteiro)
  const stream = fs.createReadStream(csvPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let delimiter = null;
  let isFirstLine = true;

  const codes = [];
  let hasMore = false;

  try {
    for await (const line of rl) {
      const l = String(line || "").trim();
      if (!l) continue;

      if (isFirstLine) {
        delimiter = detectDelimiter(l);
        isFirstLine = false;
        // se primeira linha parece header, vamos apenas “pular” (mas sem depender disso)
        // continuamos lendo normalmente; só ignoramos se o valor da primeira coluna não parece código
      }

      const parts = delimiter ? l.split(delimiter) : [l];
      const first = cleanCell(parts[0] ?? "");

      // ignora cabeçalho óbvio
      if (/^(ato|numato|numero|número)\b/i.test(first)) continue;

      if (first) codes.push(first);

      if (codes.length >= limit) {
        // tenta consumir “mais 1 linha” para saber se existe mais
        for await (const extra of rl) {
          const el = String(extra || "").trim();
          if (el) {
            hasMore = true;
            break;
          }
        }
        break;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return { codes, hasMore };
}

// Cache em memória (pra não ficar relendo CSV gigantesco toda hora)
const cache = new Map(); // csvPath -> { codes: string[], loadedAll: boolean, delimiter: string, ts: number }

async function loadAllFirstColToCache(csvPath, maxLines = 250000) {
  // Se já está em cache completo, retorna
  const cached = cache.get(csvPath);
  if (cached?.loadedAll) return cached;

  const stream = fs.createReadStream(csvPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let delimiter = null;
  let isFirstLine = true;

  const codes = [];
  let loadedAll = true;

  try {
    for await (const line of rl) {
      const l = String(line || "").trim();
      if (!l) continue;

      if (isFirstLine) {
        delimiter = detectDelimiter(l);
        isFirstLine = false;
      }

      const parts = delimiter ? l.split(delimiter) : [l];
      const first = cleanCell(parts[0] ?? "");

      if (/^(ato|numato|numero|número)\b/i.test(first)) continue;
      if (first) codes.push(first);

      if (codes.length >= maxLines) {
        loadedAll = false;
        break;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  const obj = { codes, loadedAll, delimiter: delimiter || ";", ts: Date.now() };
  cache.set(csvPath, obj);
  return obj;
}

function registerBaixarAto() {
  const running = new Map();

  // ============================
  // ESCOLHER PASTA (usuário)
  // ============================
  ipcMain.handle("select-baixar-ato-output-dir", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Selecione a pasta de saída",
    });

    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, path: "" };
    }

    return { ok: true, path: result.filePaths[0] };
  });

  // ============================
  // ABRIR PATH (SEM CONFLITAR)
  // ============================
  ipcMain.handle("open-path-ato", async (_event, targetPath) => {
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
  ipcMain.handle("cancelar-baixar-ato", async (event) => {
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
  // BAIXAR ATO (backend + copia + preview)
  // ============================
  ipcMain.handle("baixar-ato", async (event, payload = {}) => {
    const controller = new AbortController();
    running.set(event.sender.id, { controller });

    const sendProgress = (message) => {
      try {
        event.sender.send("baixar-ato-progress", { message: String(message || "") });
      } catch {}
    };

    try {
      const numAto = normalizeAto(payload?.numAto);
      const userOutDir = String(payload?.userOutDir || "").trim();

      if (!numAto) {
        return { status: "erro", mensagem: "Informe um número de Ato válido.", csvPath: "", preview: [], hasMore: false };
      }
      if (!userOutDir) {
        return { status: "erro", mensagem: "Selecione a pasta de saída.", csvPath: "", preview: [], hasMore: false };
      }

      // Base Windows/Linux
      const BASE_WIN = "G:\\Sistemas\\FileSystem\\WSVISOScraper";
      const BASE_LINUX = "/mnt/sistemas_visonet/FileSystem/WSVISOScraper";

      const maquina = os.hostname();
      const stamp = dataHoraBRParaNome();

      const pathOutLinux = `${BASE_LINUX}/${maquina}/baixarAto/${stamp}`;
      const pathOutWin = path.join(BASE_WIN, maquina, "baixarAto", stamp);

      await fs.ensureDir(pathOutWin);

      const url = "http://10.0.0.230:1071/ato/collect/Documents/due";

      sendProgress("Enviando solicitação para o backend (Baixar Ato)...");
      await axios.get(url, {
        timeout: 0,
        signal: controller.signal,
        headers: {
          numAto: numAto,
          pathOut: pathOutLinux,
        },
      });

      sendProgress("Backend finalizou. Procurando CSV gerado...");

      const generatedFiles = await listFilesRecursive(pathOutWin);
      const csvs = generatedFiles.filter((f) => /\.csv$/i.test(f));

      if (!csvs.length) {
        return {
          status: "sucesso",
          mensagem: "Processo finalizado, mas nenhum CSV foi encontrado na pasta do scraper.",
          csvPath: "",
          preview: [],
          hasMore: false,
          output: { pathOutLinux, pathOutWin, userOutDir, maquina, stamp },
        };
      }

      // pega o primeiro CSV (se tiver mais de um, escolhe o mais recente)
      csvs.sort((a, b) => (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0));
      const csvWin = csvs[0];

      sendProgress("Copiando arquivos para a pasta escolhida...");

      // copia tudo do stamp (inclui csv e qualquer outro arquivo)
      await copyDirContentsToDest(pathOutWin, userOutDir);

      // csv no destino (mesmo nome do csvWin)
      const csvDest = path.join(userOutDir, path.basename(csvWin));

      // Preview rápido (200 linhas da 1ª coluna)
      sendProgress("Lendo preview da 1ª coluna (sem travar a tela)...");
      const { codes: preview, hasMore } = await readFirstColPreview(csvDest, 200);

      // carrega cache completo “best effort” (pode ser útil pra carregar mais rápido depois)
      // (não é obrigatório; se quiser, pode remover)
      try {
        await loadAllFirstColToCache(csvDest);
      } catch {}

      sendProgress("Concluído.");

      return {
        status: "sucesso",
        mensagem: "CSV gerado e copiado para a pasta escolhida.",
        csvPath: csvDest,
        preview,
        hasMore,
        output: { pathOutLinux, pathOutWin, userOutDir, maquina, stamp },
      };
    } catch (err) {
      if (err?.name === "CanceledError" || err?.name === "AbortError") {
        return { status: "erro", mensagem: "Processo cancelado pelo usuário.", csvPath: "", preview: [], hasMore: false };
      }

      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        String(err);

      return { status: "erro", mensagem: `Erro ao baixar Ato: ${backendMsg}`, csvPath: "", preview: [], hasMore: false };
    } finally {
      running.delete(event.sender.id);
    }
  });

  // ============================
  // PAGINAÇÃO / "CARREGAR MAIS"
  // ============================
  ipcMain.handle("baixar-ato-get-page", async (_event, payload = {}) => {
    const csvPath = String(payload?.csvPath || "").trim();
    const offset = Number(payload?.offset || 0);
    const limit = Math.min(Math.max(Number(payload?.limit || 500), 1), 5000);

    if (!csvPath) return { ok: false, codes: [], hasMore: false };

    try {
      // tenta usar cache completo
      const cached = cache.get(csvPath);
      if (cached?.loadedAll) {
        const slice = cached.codes.slice(offset, offset + limit);
        return { ok: true, codes: slice, hasMore: offset + limit < cached.codes.length };
      }

      // se não tem cache completo, tenta carregar (até um limite grande)
      const loaded = await loadAllFirstColToCache(csvPath);
      const slice = loaded.codes.slice(offset, offset + limit);
      const hasMore = loaded.loadedAll ? offset + limit < loaded.codes.length : true;

      return { ok: true, codes: slice, hasMore };
    } catch (e) {
      return { ok: false, codes: [], hasMore: false, error: e?.message || String(e) };
    }
  });
}

module.exports = { registerBaixarAto };
