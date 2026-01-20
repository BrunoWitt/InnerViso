const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// ===== CONFIG =====
const BASE_UNC = "G:\\Sistemas\\FileSystem\\WSVISOScraper";
const BACKEND_URL = "http://10.0.0.230:1071/di/download/xml";
// ===================

// ---------- helpers reaproveitados ----------
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
  const pastaEntrada = path.join(enderecoFinal, "entrada");
  const pastaSaida = path.join(enderecoFinal, "saida");

  await fs.ensureDir(pastaEntrada);
  await fs.ensureDir(pastaSaida);

  return { entradaServidor: pastaEntrada, saidaServidor: pastaSaida };
}

const LINUX_MOUNT = "/mnt/sistemas_visonet";

function winPathToLinux(p) {
  if (!p) return p;
  const raw = String(p).trim();
  if (raw.startsWith("/")) return path.posix.normalize(raw);

  const s = raw.replace(/\//g, "\\");
  const lower = s.toLowerCase();

  const marker1 = "\\filesystem\\wsvisoscraper\\";
  const marker2 = "\\filesystem\\wsvisoscraper";

  let idx = lower.indexOf(marker1);
  if (idx === -1) idx = lower.indexOf(marker2);
  if (idx === -1) {
    throw new Error(`Não foi possível converter path: ${raw}`);
  }

  let tail = s.substring(idx + 1).replace(/[\\]+/g, "/");
  return path.posix.normalize(`${LINUX_MOUNT}/${tail}`);
}

function converter_pastas(pathInServer, pathOutServer) {
  return {
    pathInLinux: winPathToLinux(pathInServer),
    pathOutLinux: winPathToLinux(pathOutServer),
  };
}

async function resgatar_xmls_do_servidor(pathOutServer, pathOutLocal) {
  const arquivos = await fs.readdir(pathOutServer);
  for (const arquivo of arquivos) {
    if (path.extname(arquivo).toLowerCase() === ".xml") {
      await fs.copyFile(
        path.join(pathOutServer, arquivo),
        path.join(pathOutLocal, arquivo)
      );
    }
  }
}

// ---------- IPC ----------
function registerBaixarDiIpc() {
  const running = new Map();

  ipcMain.handle("cancelar-baixar-di", async (event) => {
    const run = running.get(event.sender.id);
    if (!run) return { ok: false };
    if (run.controller) run.controller.abort();
    return { ok: true };
  });

  ipcMain.handle("baixar-di", async (event, listDis, pathOutLocal) => {
    const wcId = event.sender.id;
    const controller = new AbortController();
    running.set(wcId, { controller });

    try {
      if (!Array.isArray(listDis) || !listDis.length) {
        return { status: "erro", mensagem: "Lista de DIs vazia." };
      }

      if (!pathOutLocal) {
        return { status: "erro", mensagem: "Pasta de saída inválida." };
      }

      const tipo = "BAIXAR_DI";
      const { entradaServidor, saidaServidor } = await criar_pastas(tipo);
      const { pathOutLinux } = converter_pastas(
        entradaServidor,
        saidaServidor
      );

      await axios.get(BACKEND_URL, {
        headers: {
            DIS: listDis.join(","),        // <-- lista vira string
            PATHOUT: pathOutLinux,
        },
        timeout: 0,
        signal: controller.signal,
        });

      await resgatar_xmls_do_servidor(saidaServidor, pathOutLocal);

      return {
        status: "sucesso",
        mensagem: `Download concluído. ${listDis.length} DIs processadas.`,
      };
    } catch (err) {
      if (
        err?.name === "CanceledError" ||
        err?.name === "AbortError"
      ) {
        return {
          status: "erro",
          mensagem: "Download cancelado pelo usuário.",
        };
      }

      return {
        status: "erro",
        mensagem: `Erro ao baixar DIs: ${err?.message || err}`,
      };
    } finally {
      running.delete(wcId);
    }
  });
}

module.exports = { registerBaixarDiIpc };