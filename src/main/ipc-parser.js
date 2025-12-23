// src/main/ipc-parser.js
const { ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { NONAME } = require('dns');
const tokenToSaidaServidor = new Map();

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

async function executarParser(pathInServer, pathOutServer, tipoParser, token, nomeSaida) {
  /**
   * Faz contato com o webservice para executar o parser.
   * @param pathInServer: Pasta de entrada do servidor
   * @param pathOutSErver: Pasta de saída do servidor
   * @param tipo: Tipo do parser à ser chamado
   * @param token: Token responsável pela tela de carregamento
   * @return response.data: Retorna 
   */
  
  const endpoints = {
      //NFE: 'http://127.0.0.1:8000/nfe_router/nfe',
      NFE:  'http://10.0.0.232:1051/nfe_router/nfe',
      //IMPO1: 'http://127.0.0.1:8000/di_router/IMPO1',
      IMPO1:'http://10.0.0.232:1051/di_router/IMPO1',
      //IMPO8: 'http://127.0.0.1:8000/di_router/IMPO8',
      IMPO8:'http://10.0.0.232:1051/di_router/IMPO8',
      //SPED: 'http://127.0.0.1:8000/sped_router/sped',
      SPED: 'http://10.0.0.232:1051/sped_router/sped',
      //BASE: 'http://127.0.0.1:8000/nfe_router/base_reintegra', 
      BASE: 'http://10.0.0.232:1051/nfe_router/base_reintegra',
    };

  const url = endpoints[tipoParser];
  if (!url) throw new Error(`Tipo de parser inválido: ${tipoParser}`);

  const {pathInLinux, pathOutLinux} = converter_pastas(pathInServer, pathOutServer)

  const response = await axios.get(url, {
    params: {
      pathIn: pathInLinux,
      pathOut: pathOutLinux,
      token: String(token || 'electron-ui'),
      nomeSaida: String(nomeSaida || null)
    },
    timeout: 0,
    validateStatus: () => true, // ok, mas agora vamos checar manualmente
  });


  if (response.status < 200 || response.status >= 300) {
    const detalhe =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data, null, 2);

    throw new Error(`HTTP ${response.status} em ${url}\n${detalhe}`);
  }

  return response.data;
}

async function criar_pastas(entradaLocal, tipoParser) {
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

  const st = await fs.stat(entradaLocal);

  if (st.isFile() && entradaLocal.toLowerCase().endsWith(".zip")) {
    const destZip = path.join(pastaEntradas, path.basename(entradaLocal));
    await fs.copy(entradaLocal, destZip, { overwrite: true });
    return { entradaServidor: destZip, saidaServidor: pastaSaida };
  }

  await fs.copy(entradaLocal, pastaEntradas, { overwrite: true });
  return { entradaServidor: pastaEntradas, saidaServidor: pastaSaida };
}

function registerParserIpc() {
  // ---------- selecionar pasta (entrada / saída local) ----------
  ipcMain.handle('dialog:select-folder', async (_event, tipo) => {

    /**
     * Função que seleciona a entrada de arquivos
     * parametro tipo = pasta ou zip
     */

    try {
      if (tipo === true) {

        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (result.canceled) return null;

        const origem = result.filePaths[0];

        return origem;
      } else {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
      }
    } catch (err) {
      console.error('❌ Erro ao selecionar/copiar pasta:', err);
      return null;
    }
  });

  ipcMain.handle('select-file-zip', async () => {
    try {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'Arquivos ZIP', extensions: ['zip'] }],
        properties: ['openFile'],
      });

      if (result.canceled) return null;

      const origemZip = result.filePaths[0];

      const nomeZip = path.basename(origemZip);

      return origemZip;
    } catch (err) {
      console.error('❌ Erro ao selecionar/copiar ZIP:', err);
      return null;
    }
  });

  async function resgate_arquivos_do_servidor(pathOutServer, pathOutLocal, tipoParser) {
    const arquivos = await fs.readdir(pathOutServer)

    // Extensões a copiar
    const extensoes = new Set(['.xlsx'])
    if ((tipoParser || '').toUpperCase() === 'SPED') {
      extensoes.add('.txt')
    }

    for (const arquivo of arquivos) {
      const ext = path.extname(arquivo).toLowerCase()

      if (extensoes.has(ext)) {
        await fs.copyFile(
          path.join(pathOutServer, arquivo),
          path.join(pathOutLocal, arquivo)
        )
        console.log(`Arquivo ${ext} copiado: ${arquivo}`)
      }
    }
  }

  // ---------- iniciar parser ----------
  ipcMain.handle('iniciar-parser', async (_event, entradaLocal, saidaLocal, tipoParser, token, nomeSaida) => {
    
    const { entradaServidor, saidaServidor } = await criar_pastas(entradaLocal, tipoParser); //Cria as pastas no servidor para o WB ler

    tokenToSaidaServidor.set(String(token), saidaServidor);

    (async () => {
      try {
        const result = await executarParser(entradaServidor, saidaServidor, tipoParser, token, nomeSaida);

        const resultPath = path.join(saidaServidor, `.result_${token}.json`);
        await fs.writeJson(resultPath, result, { spaces: 2 });

        await fs.ensureDir(saidaLocal);

        resgate_arquivos_do_servidor(saidaServidor, saidaLocal, tipoParser)

        await fs.writeFile(path.join(saidaServidor, `.done_${token}`), 'OK');
      } catch (err) {
        try {
          const saidaSrv = tokenToSaidaServidor.get(String(token)) || saidaServidor;

          const msg = err?.message || String(err);
          await fs.writeFile(path.join(saidaSrv, `.error_${token}`), msg);

          console.error("❌ Erro no parser:", msg);
        } catch {}
      }
    })();

    return { started: true };
  });

  // ---------- status só por token ----------
  ipcMain.handle('parser:status', async (_event, token) => {
    const saidaServidor = tokenToSaidaServidor.get(String(token));
    if (!saidaServidor) return { ok: false, error: 'Token não registrado no Node.' };

    const donePath   = path.join(saidaServidor, `.done_${token}`);
    const errorPath  = path.join(saidaServidor, `.error_${token}`);
    const resultPath = path.join(saidaServidor, `.result_${token}.json`);

    if (await fs.pathExists(errorPath)) {
      const msg = await fs.readFile(errorPath, 'utf8').catch(() => '');
      return { ok: true, state: 'error', message: msg };
    }

    if (await fs.pathExists(donePath)) {
      const result = await fs.readJson(resultPath).catch(() => null);
      return { ok: true, state: 'done', result };
    }

    return { ok: true, state: 'running' };
  });

  // ---------- progresso só por token ----------
ipcMain.handle('parser:progress', async (_event, token) => {
  const saidaServidor = tokenToSaidaServidor.get(String(token));
  if (!saidaServidor) return { ok: false, error: 'Token não registrado no Node.' };

  const progPath = path.join(saidaServidor, `.progress_${token}`);

  try {
    if (!await fs.pathExists(progPath)) {
      return { ok: true, exists: false };
    }

    const raw = (await fs.readFile(progPath, 'utf8')).trim(); // ex: "6/20"
    const [current, total] = raw.split('/').map(n => parseInt(n || '0', 10));

    return {
      ok: true,
      exists: true,
      raw,
      current: Number.isFinite(current) ? current : 0,
      total: Number.isFinite(total) ? total : 0,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

// ---------- pedir cancelamento (cria flag no servidor) ----------
ipcMain.handle('parser:cancel', async (_event, token) => {
  const saidaServidor = tokenToSaidaServidor.get(String(token));
  if (!saidaServidor) return { ok: false, error: 'Token não registrado no Node.' };

  const cancelPath = path.join(saidaServidor, `.cancel_${token}`);
  try {
    await fs.ensureDir(saidaServidor);
    await fs.writeFile(cancelPath, '1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

}

module.exports = { registerParserIpc };