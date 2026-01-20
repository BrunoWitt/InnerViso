const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// ===== CONFIG =====
const BASE_UNC = "G:\\Sistemas\\FileSystem\\WSVISOScraper";
const BACKEND_URL = "http://10.0.0.230:1071/li/download/xml";
// ===================

// helpers reaproveitados (idênticos ao DI)
function dataHoraBRParaNome() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${d.getFullYear()}-${String(d.getHours()).padStart(
    2,
    "0"
  )}-${String(d.getMinutes()).padStart(2, "0")}`;
}

async function gerarStampUnico(baseDir, stampBase) {
  let stamp = stampBase;
  let i = 1;
  while (await fs.pathExists(path.join(baseDir, stamp))) {
    i++;
    stamp = `${stampBase}_${i}`;
  }
  return stamp;
}

async function criar_pastas(tipo) {
  const nomeMaquina = os.hostname();
  const baseExecDir = path.join(BASE_UNC, nomeMaquina);
  await fs.ensureDir(baseExecDir);

  const stamp = await gerarStampUnico(
    baseExecDir,
    dataHoraBRParaNome()
  );

  const finalDir = path.join(baseExecDir, tipo, stamp);
  const entrada = path.join(finalDir, "entrada");
  const saida = path.join(finalDir, "saida");

  await fs.ensureDir(entrada);
  await fs.ensureDir(saida);

  return { entradaServidor: entrada, saidaServidor: saida };
}

const LINUX_MOUNT = "/mnt/sistemas_visonet";

function winPathToLinux(p) {
  const s = p.replace(/\//g, "\\").toLowerCase();
  const idx = s.indexOf("\\filesystem\\wsvisoscraper");
  if (idx === -1) throw new Error("Path inválido");

  return `${LINUX_MOUNT}/${p
    .substring(idx + 1)
    .replace(/[\\]+/g, "/")}`;
}

async function resgatarXmls(origem, destino) {
  const files = await fs.readdir(origem);
  for (const f of files) {
    if (path.extname(f).toLowerCase() === ".xml") {
      await fs.copyFile(
        path.join(origem, f),
        path.join(destino, f)
      );
    }
  }
}

function registerBaixarLiIpc() {
  const running = new Map();

  ipcMain.handle("cancelar-baixar-li", async (event) => {
    const run = running.get(event.sender.id);
    run?.controller?.abort();
    return { ok: true };
  });

  ipcMain.handle("baixar-li", async (event, listLis, pathOutLocal) => {
    const controller = new AbortController();
    running.set(event.sender.id, { controller });

    try {
      if (!listLis?.length) {
        return { status: "erro", mensagem: "Lista de LIs vazia." };
      }

      const { saidaServidor } = await criar_pastas("BAIXAR_LI");
      const pathOutLinux = winPathToLinux(saidaServidor);

      await axios.get(BACKEND_URL, {
        headers: {
          LIS: listLis.join(","),
          PATHOUT: pathOutLinux,
        },
        signal: controller.signal,
        timeout: 0,
      });

      await resgatarXmls(saidaServidor, pathOutLocal);

      return {
        status: "sucesso",
        mensagem: `Download concluído. ${listLis.length} LIs processadas.`,
      };
    } catch (e) {
      if (e.name === "AbortError") {
        return {
          status: "erro",
          mensagem: "Download cancelado pelo usuário.",
        };
      }

      return {
        status: "erro",
        mensagem: `Erro ao baixar LIs: ${e.message}`,
      };
    } finally {
      running.delete(event.sender.id);
    }
  });
}

module.exports = { registerBaixarLiIpc };