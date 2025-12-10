// src/main/ipc-parser.js
const { ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

const BASE_UNC = '\\\\10.0.0.237\\visonet\\Sistemas\\FileSystem\\WSVISOparser';

// guarda a última estrutura criada (data/entrada/saida)
let ultimaExecucao = null;

//Seleciona a pasta da maquina do usuário
function selecionar_pasta_wb() {
  const nomeMaquina = os.hostname();
  const raiz = path.join(BASE_UNC, nomeMaquina);
  fs.ensureDirSync(raiz);
  return raiz;
}

// Cria a pasta da DATA/HORA e as subpastas "entrada" e "saida"
function salvar_pasta_wb(pastaMaquina) {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  // dd-mm-aaaa_hh-mm
  const baseNome = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}_${pad(date.getHours())}-${pad(date.getMinutes())}`;

  let n = 0;
  let pastaBase;

  while (true) {
    const nomePasta = n === 0 ? baseNome : `${baseNome}_${n}`;
    const tentativa = path.join(pastaMaquina, nomePasta);

    if (!fs.existsSync(tentativa)) {
      fs.ensureDirSync(tentativa);
      pastaBase = tentativa;
      break;
    }
    n++;
  }

  const pastaEntrada = path.join(pastaBase, 'entrada');
  const pastaSaida   = path.join(pastaBase, 'saida');

  fs.ensureDirSync(pastaEntrada);
  fs.ensureDirSync(pastaSaida);

  // guarda pra outras funções (parser:prepare / criar_pasta_saida_servidor)
  ultimaExecucao = {
    pastaBase,
    pastaEntrada,
    pastaSaida,
  };

  // mantém compatível com o restante do código:
  // quem chama usa o retorno como "onde vou jogar os arquivos de entrada"
  return pastaEntrada;
}

function criar_pasta_saida_servidor() {
  // se já houve seleção de pasta de entrada, reaproveita a mesma execução
  if (ultimaExecucao && ultimaExecucao.pastaSaida) {
    return ultimaExecucao.pastaSaida;
  }

  // fallback: se chamarem parser:prepare ANTES de escolher entrada
  const pastaMaquina = selecionar_pasta_wb();
  salvar_pasta_wb(pastaMaquina); // isso já preenche ultimaExecucao
  return ultimaExecucao.pastaSaida;
}

// ---------------- HTTP / parser ----------------
async function executarParser(pathIn, pathOut, tipo, token) {
  const endpoints = {
    NFE: 'http://127.0.0.1:8000/nfe_router/nfe',
    //NFE:   'http://10.0.0.106:8100/nfe_router/nfe',
    IMPO1: 'http://10.0.0.106:8100/di_router/IMPO1',
    IMPO8: 'http://10.0.0.106:8100/di_router/IMPO8',
    SPED:  'http:// 10.0.0.106:8100/sped_router/sped',
    BASE:  'http://10.0.0.106:8100/nfe_router/base_reintegra',
  };
  const url = endpoints[tipo];
  if (!url) throw new Error(`Tipo de parser desconhecido: ${tipo}`);

  const response = await axios.get(url, {
    params: { pathIn, pathOut, token: token || 'electron-ui' },
    timeout: 0,
  });
  return response.data;
}

function registerParserIpc() {

  // ---------- selecionar pasta (entrada / saída local) ----------
  ipcMain.handle('dialog:select-folder', async (_event, tipo) => {
    try {
      if (tipo === true) { // ENTRADA → copiar pro servidor
        const pasta_maquina = selecionar_pasta_wb();
        const pastaEntradaData = salvar_pasta_wb(pasta_maquina); // ...\MAQUINA\<data>\entrada

        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (result.canceled) return null;

        const origem = result.filePaths[0];
        const subdir_nome = path.basename(origem);

        // arquivos vão para ...\<data>\entrada\<nome_original>
        const destino_final = path.join(pastaEntradaData, subdir_nome);

        await fs.copy(origem, destino_final, { overwrite: true });
        console.log('✅ Pasta copiada para o servidor:', destino_final);

        // o backend usa esse caminho como pathIn
        return destino_final;
      } else { // SAÍDA LOCAL → apenas escolher
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

      const pastaMaquina = selecionar_pasta_wb();
      const pastaEntradaData = salvar_pasta_wb(pastaMaquina); // ...\<data>\entrada

      const nomeZip = path.basename(origemZip);
      const destinoZipServidor = path.join(pastaEntradaData, nomeZip);

      await fs.copy(origemZip, destinoZipServidor, { overwrite: true });
      console.log('✅ ZIP copiado para o servidor:', destinoZipServidor);

      return destinoZipServidor;
    } catch (err) {
      console.error('❌ Erro ao selecionar/copiar ZIP:', err);
      return null;
    }
  });

  // ---------- pasta de saída no servidor ----------
  ipcMain.handle('parser:prepare', async () => {
    const saidaServidor = criar_pasta_saida_servidor(); // ...\<data>\saida
    return { saidaServidor };
  });

  // ---------- iniciar parser ----------
  ipcMain.handle('iniciar-parser', async (_event, entradaLocal, saidaLocal, tipo, token, saidaServidor) => {
    if (!saidaServidor) saidaServidor = criar_pasta_saida_servidor();

    (async () => {
      try {
        const result = await executarParser(entradaLocal, saidaServidor, tipo, token);

        const resultPath = path.join(saidaServidor, `.result_${token}.json`);
        await fs.writeJson(resultPath, result, { spaces: 2 });

        await fs.ensureDir(saidaLocal);

        await fs.copy(saidaServidor, saidaLocal, {
          overwrite: true,
          filter: (src) => {
            const base = path.basename(src);
            if (base.startsWith('.')) return false;
            if (base.toLowerCase() === '._log' || base.toLowerCase() === '.log') return false;
            return true;
          },
        });

        await fs.writeFile(path.join(saidaServidor, `.done_${token}`), 'OK');

        try {
          const items = await fs.readdir(saidaServidor);
          await Promise.all(
            items
              .filter(n => n.startsWith('.progress_'))
              .map(n => fs.remove(path.join(saidaServidor, n)))
          );
        } catch {}
      } catch (err) {
        try {
          await fs.writeFile(path.join(saidaServidor, `.error_${token}`), String(err?.message || err));
        } catch {}
      }
    })();

    return { started: true, saidaServidor };
  });

  // ---------- copiar saída pra pasta local ----------
  ipcMain.handle('copiar-saida', async (_event, pathRemoto, pathLocal) => {
    try {
      if (!await fs.pathExists(pathRemoto)) throw new Error('Pasta remota não encontrada.');
      await fs.ensureDir(pathLocal);

      await fs.copy(pathRemoto, pathLocal, {
        overwrite: true,
        filter: (src) => {
          const base = path.basename(src);
          if (base.startsWith('.')) return false;
          if (base.toLowerCase() === '.log' || base.toLowerCase() === '._log') return false;
          return true;
        },
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerParserIpc };
