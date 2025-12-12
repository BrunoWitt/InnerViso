// src/main/ipc-expo8.js
const { ipcMain } = require("electron");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");


const BASE_UNC = '\\\\10.0.0.237\\visonet\\Sistemas\\FileSystem\\WSVISOparser';

// --- helpers de data + nome único (Windows-safe) ---
function dataHoraBRExibicao() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}-${hh}:${min}`; // <- bom pra mostrar
}

function dataHoraBRParaNome() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}-${hh}-${min}`; // <- bom pra pasta/arquivo
}

/**
 * Gera um nome único: "stamp", "stamp_2", "stamp_3"...
 * @param {string} baseDir pasta onde as execuções ficam (ex: \\server\...\HOST)
 * @param {string} stampBase ex: "12-12-2025-16-27"
 */
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
  /**
   * Cria as pastas de entrada e saída no servidor
   * Copia os arquivos de entrada local e cola na pasta do servidor
   * @param {string} entradaLocal é o caminho local da máquina do usuário
   * @param {string} tipoParser é responsável por definir a pasta onde estará os arquivos copiados para o servidor
   * @returns pastasEntradas e pastaSaida do servidor
   */

  const nomeMaquina = os.hostname();

  const baseExecDir = path.join(BASE_UNC, nomeMaquina);
  await fs.ensureDir(baseExecDir);

  const stampBase = dataHoraBRParaNome();        // ex: 12-12-2025-16-27
  const stamp = await gerarStampUnico(baseExecDir, stampBase); // ex: ... ou ..._2

  console.log("Execução:", dataHoraBRExibicao(), "=> pasta:", stamp);

  const enderecoFinal = path.join(baseExecDir, tipoParser, stamp);

  const pastaEntradas = path.join(enderecoFinal, "entrada");
  const pastaSaida    = path.join(enderecoFinal, "saida");

  await fs.ensureDir(pastaEntradas);
  await fs.ensureDir(pastaSaida);

  return { entradaServidor: pastaEntradas, saidaServidor: pastaSaida };
}


function registerExpo8Ipc() {
  ipcMain.handle('parserExpo8', async (_event, listCodes, pathOut) => {
    const url = 'http://127.0.0.1:8000/due_router/EXPO8/';

    const tipo = 'EXPO8'

    const {entradaServidor, saidaServidor} = await criar_pastas(tipo)

    try {
      const resp = await axios.get(url, {
        params: { RAW_DUE_NUMBER: listCodes, PATHIN: entradaServidor, PATHOUT: saidaServidor },
        paramsSerializer: params =>
          Object.entries(params)
            .map(([key, value]) =>
              Array.isArray(value)
                ? value.map(v => `${key}=${encodeURIComponent(v)}`).join('&')
                : `${key}=${encodeURIComponent(value)}`
            )
            .join('&'),
        timeout: 0,
      });

      const data = resp?.data || {};
      return {
        ok: data.ok ?? true,
        message: data.message ?? 'Processo finalizado.',
        log: data.log ?? JSON.stringify(data, null, 2),
      };
    } catch (err) {
      return {
        ok: false,
        message: `Erro ao chamar backend EXPO8: ${err.message}`,
        log: err.stack || String(err),
      };
    }
  });
}

module.exports = { registerExpo8Ipc };
