const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

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


async function criar_pastas(tipoParser) {
  const nomeMaquina = os.hostname();

  const baseExecDir = path.join(BASE_UNC, nomeMaquina);
  await fs.ensureDir(baseExecDir);

  const stampBase = dataHoraBRParaNome();
  const stamp = await gerarStampUnico(baseExecDir, stampBase);

  const enderecoFinal = path.join(baseExecDir, tipoParser, stamp);

  const pastaEntradas = path.join(enderecoFinal, "entrada");
  const pastaSaida = path.join(enderecoFinal, "saida");

  await fs.ensureDir(pastaEntradas);
  await fs.ensureDir(pastaSaida);

  console.log(pastaEntradas)
  console.log(pastaSaida)

  return { entradaServidor: pastaEntradas, saidaServidor: pastaSaida };
}


async function resgate_arquivos_do_servidor(pathOutServer, pathOutLocal) {
  const arquivos = await fs.readdir(pathOutServer);

  for (const arquivo of arquivos) {
    if (path.extname(arquivo).toLowerCase() === ".xlsx") {
      await fs.copyFile(
        path.join(pathOutServer, arquivo),
        path.join(pathOutLocal, arquivo)
      );
    }
  }
}


function parseMaybeJSON(v) {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return v;

  const s = v.trim();
  if (!s) return v;

  try {
    return JSON.parse(s);
  } catch (_) {}

  try {
    const maybe = s
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      .replace(/'/g, '"');
    return JSON.parse(maybe);
  } catch (_) {}

  return v;
}


function normalizeBackendPayload(payload) {
  let data =
    payload?.Resultado ??
    payload?.resultado ??
    payload?.result ??
    payload;

  data = parseMaybeJSON(data);

  if (!data || typeof data !== "object") {
    return {
      status: "erro",
      mensagem: "Resposta inesperada do backend (formato inválido).",
    };
  }

  // suporte a "ok" antigo
  const okBool = typeof data.ok === "boolean" ? data.ok : undefined;

  const statusRaw =
    data.status ?? data.Status ?? (okBool === true ? "sucesso" : okBool === false ? "erro" : undefined);

  const mensagemRaw =
    data.mensagem ??
    data.Mensagem ??
    data.message ??
    data.Message ??
    data.msg ??
    data.MSG;

  const status = String(statusRaw ?? "erro").trim().toLowerCase();
  const mensagem = String(mensagemRaw ?? "Processo finalizado.").trim();

  return { status, mensagem };
}

/*Sessão de converter as pastas de windows para linux */
const LINUX_MOUNT = "/mnt/sistemas_visonet";

// Converte UM caminho Windows (UNC ou G:\...) -> Linux (/mnt/...)
function winPathToLinux(p) {
  if (!p) return p;

  const raw = String(p).trim();

  // já é linux
  if (raw.startsWith("/")) return path.posix.normalize(raw);

  // normaliza para backslash
  const s = raw.replace(/\//g, "\\");

  // procura o marcador de forma case-insensitive
  const lower = s.toLowerCase();
  const marker1 = "\\filesystem\\wsvisoparser\\";
  const marker2 = "\\filesystem\\wsvisoparser"; // fallback sem barra no fim

  let idx = lower.indexOf(marker1);
  if (idx === -1) idx = lower.indexOf(marker2);

  if (idx === -1) {
    // debug útil pra ver caractere invisível
    console.log("[converter] path recebido:", JSON.stringify(raw));
    console.log("[converter] path normalizado:", JSON.stringify(s));
    throw new Error(
      `Não foi possível converter. Não encontrei "FileSystem\\WSVISOparser" em: ${raw}`
    );
  }

  // idx aponta para a "\" antes de FileSystem, então começa no próximo char
  let tail = s.substring(idx + 1); // "FileSystem\WSVISOparser\..."
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

function registerExpo8Ipc() {
  const runningExpo8 = new Map();

  ipcMain.handle("cancelExpo8", async (event) => {
    const wcId = event.sender.id;
    const run = runningExpo8.get(wcId);

    if (!run) return { ok: false, message: "Nenhum EXPO8 em andamento." };

    try {
      if (run.cancelPath) {
        await fs.outputFile(run.cancelPath, "cancel"); // simples e rápido
      }
    } catch (e) {
      console.warn("[expo8] falha ao criar cancel.flag:", e);
    }

    if (run.controller) run.controller.abort(); // para o await do front
    return { ok: true };
  });


  ipcMain.handle("getExpo8Progress", async (event) => {
    const wcId = event.sender.id;
    const run = runningExpo8.get(wcId);

    if (!run?.progressPath) {
      return { ok: false, message: null, current: 0, total: 0 };
    }

    try {
      if (!(await fs.pathExists(run.progressPath))) {
        return { ok: true, message: null, current: 0, total: 0 };
      }

      const raw = await fs.readFile(run.progressPath, "utf8");
      const data = JSON.parse(raw);

      return {
        ok: true,
        message: data?.message ?? null,
        current: Number(data?.current ?? 0),
        total: Number(data?.total ?? 0),
      };
    } catch (e) {
      return { ok: true, message: "Processando...", current: 0, total: 0 };
    }
  });

  
  ipcMain.handle("parserExpo8", async (event, listCodes, pathOut, nomeSaida) => {
    const url = "http://10.0.0.232:1051/due_router/EXPO8";
    //const url = "http://127.0.0.1:8000/due_router/EXPO8";

    const tipo = "EXPO8";

    const { entradaServidor, saidaServidor } = await criar_pastas(tipo);
    const {pathInLinux, pathOutLinux} = await converter_pastas(entradaServidor, saidaServidor)

    const wcId = event.sender.id;
    const controller = new AbortController();

    const progressPath = path.join(saidaServidor, "progress.json");
    const cancelPath = path.join(saidaServidor, 'cancel.flag')

    await fs.remove(cancelPath);

    runningExpo8.set(wcId, { controller, progressPath, cancelPath });

    try {
      const resp = await axios.get(url, {
        params: {
          RAW_DUE_NUMBER: listCodes,
          PATHIN: pathInLinux,
          PATHOUT: pathOutLinux,
          nomeSaida: String(nomeSaida || null),
        },
        paramsSerializer: (params) =>
          Object.entries(params)
            .map(([key, value]) =>
              Array.isArray(value)
                ? value.map((v) => `${key}=${encodeURIComponent(v)}`).join("&")
                : `${key}=${encodeURIComponent(value)}`
            )
            .join("&"),
        timeout: 0,
        signal: controller.signal,
      });

      await resgate_arquivos_do_servidor(saidaServidor, pathOut);

      const logPath = path.join(saidaServidor, "log_processo.log");
      const log = (await fs.pathExists(logPath))
        ? await fs.readFile(logPath, "utf8")
        : "(log não encontrado)";

      const payload = resp?.data ?? {};
      const { status, mensagem } = normalizeBackendPayload(payload);

      return { status, mensagem, log };
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.name === "AbortError") {
        return { status: "erro", mensagem: "Processo cancelado pelo usuário.", log: "" };
      }

      const httpStatus = err?.response?.status;
      const respData = err?.response?.data;

      return {
        status: "erro",
        mensagem:
          `Erro ao chamar backend EXPO8: ${err?.message || String(err)}` +
          (httpStatus ? ` (HTTP ${httpStatus})` : ""),
        log:
          JSON.stringify({ httpStatus, respData }, null, 2) +
          "\n\n" +
          (err?.stack || String(err)),
      };
    } finally {
      runningExpo8.delete(wcId);
    }
  });
}

module.exports = { registerExpo8Ipc };