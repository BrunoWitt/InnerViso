// src/main/ipc-fs.js
const { ipcMain, shell, dialog, app } = require('electron');
const fs = require('fs-extra');
const path = require('path');

function registerFsIpc() {
  ipcMain.handle('fs:open-folder', async (_evt, absPath) => {
    try {
      if (!absPath || typeof absPath !== 'string') {
        return { ok: false, error: 'Caminho vazio ou inválido.' };
      }
      const p = path.resolve(absPath);
      await fs.promises.access(p, fs.constants.F_OK);

      const res = await shell.openPath(p);
      if (res) throw new Error(res);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('open-json', async () => {
    const jsonPath = path.join(app.getPath('userData'), 'padrao.json');
    if (!fs.existsSync(jsonPath)) return null;
    const data = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
    return data;
  });

  ipcMain.handle('save-path', async (_event, caminho_entrada, caminho_saida) => {
    try {
      const dados = { entrada: caminho_entrada, saida: caminho_saida };
      const jsonPath = path.join(app.getPath('userData'), 'padrao.json');
      await fs.writeJson(jsonPath, dados, { spaces: 2 });
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Erro ao salvar o arquivo JSON.' };
    }
  });

  ipcMain.handle('clear-paths', async () => {
    try {
      const jsonPath = path.join(app.getPath('userData'), 'padrao.json');
      if (fs.existsSync(jsonPath)) {
        await fs.remove(jsonPath);
        return { success: true };
      }
      return { success: false, message: 'Arquivo não existe.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = { registerFsIpc };
