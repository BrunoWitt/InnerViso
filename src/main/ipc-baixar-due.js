const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// ===== CONFIG =====
const BASE_UNC = "G:\\Sistemas\\FileSystem\\WSVISOScraper";
const BACKEND_URL = "http://10.0.0.230:1071/due/download";
// ===================

// ---------- helpers ----------
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

  const enderecoFinal = path.join(baseExecDir, tipo, stamp);
  const pastaEntrada = path.join(enderecoFinal, "entrada");
  const pastaSaida = path.join(enderecoFinal, "saida");

  await fs.ensureDir(pastaEntrada);
  await fs.ensureDir(pastaSaida);

  return {
    entradaServidor: pastaEntrada,
    saidaServidor: pastaSaida,
  };
}

const LINUX_MOUNT = "/mnt/sistemas_visonet";

function winPathToLinux(p) {
  if (!p) throw new Error("Path inválido");

  const normalized = p.replace(/\//g, "\\").toLowerCase();
  const idx = normalized.indexOf("\\filesystem\\wsvisoscraper");

  if (idx === -1) {
    throw new Error(`Não foi possível converter o path: ${p}`);
  }

  return `${LINUX_MOUNT}/${p
    .substring(idx + 1)
    .replace(/[\\]+/g, "/")}`;
}

async function resgatarArquivos(origem, destino) {
  await fs.ensureDir(destino);

  const files = await fs.readdir(origem);

  for (const f of files) {
    const fullOrigem = path.join(origem, f);
    const stat = await fs.stat(fullOrigem);

    if (!stat.isFile()) continue;

    const ext = path.extname(f).toLowerCase();
    if (ext !== ".json" && ext !== ".xml") continue;

    await fs.copyFile(
      fullOrigem,
      path.join(destino, f)
    );
  }
}

// ---------- IPC ----------
function registerBaixarDueIpc() {
  const running = new Map();

  ipcMain.handle("cancelar-baixar-due", async (event) => {
    const run = running.get(event.sender.id);
    run?.controller?.abort();
    return { ok: true };
  });

  ipcMain.handle("baixar-due", async (event, listDues, pathOutLocal) => {
    const wcId = event.sender.id;
    const controller = new AbortController();
    running.set(wcId, { controller });

    try {
      if (!Array.isArray(listDues) || !listDues.length) {
        return {
          status: "erro",
          mensagem: "Lista de DUEs vazia.",
        };
      }

      if (!pathOutLocal) {
        return {
          status: "erro",
          mensagem: "Pasta de saída inválida.",
        };
      }

      // cria pastas no servidor
      const { entradaServidor, saidaServidor } =
        await criar_pastas("BAIXAR_DUE");

      // arquivo de progresso (OBRIGATÓRIO)
      const progressFileServer = path.join(
        entradaServidor,
        "progresso.json"
      );

      // inicializa JSON válido para o backend
      await fs.writeFile(
        progressFileServer,
        JSON.stringify(
          {
            status: "iniciado",
            total: listDues.length,
            atual: 0,
            erros: [],
          },
          null,
          2
        ),
        "utf-8"
      );

      const pathOutLinux = winPathToLinux(saidaServidor);
      const progressPathLinux = winPathToLinux(progressFileServer);

      // chamada da API (QUERY PARAMS)
      await axios.get(BACKEND_URL, {
        params: {
          RAW_DUE_NUMBER: listDues.join(","),
          PATHOUT: pathOutLinux,
          PROGRESSPATH: progressPathLinux,
        },
        timeout: 0,
        signal: controller.signal,
      });

      // copia arquivos para a máquina do usuário
      await resgatarArquivos(saidaServidor, pathOutLocal);

      return {
        status: "sucesso",
        mensagem: `Download concluído. ${listDues.length} DUEs processadas.`,
      };
    } catch (e) {
      if (
        e?.name === "AbortError" ||
        e?.name === "CanceledError"
      ) {
        return {
          status: "erro",
          mensagem: "Download cancelado pelo usuário.",
        };
      }

      return {
        status: "erro",
        mensagem: `Erro ao baixar DUEs: ${e?.message || e}`,
      };
    } finally {
      running.delete(wcId);
    }
  });
}

module.exports = { registerBaixarDueIpc };