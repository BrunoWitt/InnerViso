const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const BASE_UNC = "\\\\10.0.0.237\\visonet\\Sistemas\\FileSystem\\WSVISOparser";

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

// tenta converter:
// - objeto já pronto
// - JSON string
// - dict python com aspas simples: "{'status': 'sucesso'}"
function parseMaybeJSON(v) {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return v;

  const s = v.trim();
  if (!s) return v;

  // tenta JSON normal
  try {
    return JSON.parse(s);
  } catch (_) {}

  // tenta "python dict" simples -> JSON (não é perfeito, mas ajuda muito)
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

  // se ainda não for objeto, devolve fallback
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

function registerExpo8Ipc() {

  const runningExpo8 = new Map();

  ipcMain.handle("cancelExpo8", async (event) => {
    const wcId = event.sender.id;
    const controller = runningExpo8.get(wcId);

    if (controller) {
      controller.abort();           // <- cancela axios
      runningExpo8.delete(wcId);
      return { ok: true };
    }
    return { ok: false, message: "Nenhum EXPO8 em andamento." };
  });

  ipcMain.handle("parserExpo8", async (_event, listCodes, pathOut) => {
    const url = "http://127.0.0.1:8000/due_router/EXPO8/"; // pode manter

    const tipo = "EXPO8";
    const { entradaServidor, saidaServidor } = await criar_pastas(tipo);

    const wcId = _event.sender.id;
    const controller = new AbortController();
    runningExpo8.set(wcId, controller);

    try {
      const resp = await axios.get(url, {
        params: { RAW_DUE_NUMBER: listCodes, PATHIN: entradaServidor, PATHOUT: saidaServidor },
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
      const httpStatus = err?.response?.status;
      const respData = err?.response?.data;

      return {
        status: "erro",
        mensagem: `Erro ao chamar backend EXPO8: ${err?.message || String(err)}` + (httpStatus ? ` (HTTP ${httpStatus})` : ""),
        log:
          JSON.stringify({ httpStatus, respData }, null, 2) +
          "\n\n" +
          (err?.stack || String(err)),
      };
    }
  });
}

module.exports = { registerExpo8Ipc };
