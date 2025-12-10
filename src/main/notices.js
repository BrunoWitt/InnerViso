// src/main/notices.js
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const noticesPath = path.join(app.getPath('userData'), 'notices.json');
const INTERVALO_MS = 45 * 60 * 1000;
const NOTICES_URL = 'http://10.0.0.106:8100/notices';

function setupNotices() {
  ipcMain.handle('salvar-notices', async (_event, noticias) => {
    try {
      const dir = path.dirname(noticesPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const payload = { last_update: Date.now(), ...noticias };
      fs.writeFileSync(noticesPath, JSON.stringify(payload, null, 2), 'utf8');

      return { success: true, path: noticesPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-notices-cached', async () => {
    const agora = Date.now();

    if (fs.existsSync(noticesPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
        const diff = agora - (saved.last_update || 0);
        if (diff < INTERVALO_MS) {
          console.log('📦 Usando notícias do cache.');
          return saved;
        }
        console.log('⏱ Cache velho, atualizando agora...');
      } catch (err) {
        console.error('Erro ao ler notices.json:', err);
      }
    }

    try {
      const res = await axios.get(NOTICES_URL, { timeout: 60000 });
      const payload = { last_update: Date.now(), ...res.data };
      fs.writeFileSync(noticesPath, JSON.stringify(payload, null, 2));
      return payload;
    } catch (err) {
      return { erro: err.message };
    }
  });

  ipcMain.handle('get-notices', async () => {
    try {
      const response = await axios.get(NOTICES_URL, { timeout: 60000, validateStatus: () => true });
      if (response.status !== 200) {
        return { erro: `HTTP ${response.status}`, url: NOTICES_URL };
      }
      return response.data;
    } catch (err) {
      return { erro: err.message, url: NOTICES_URL };
    }
  });
}

function startNoticesAutoUpdate() {
  try {
    const payload = { last_update: Date.now() };
    axios.get(NOTICES_URL, { timeout: 60000 })
      .then(res => {
        if (res.status === 200) {
          const out = { last_update: Date.now(), ...res.data };
          fs.writeFileSync(noticesPath, JSON.stringify(out, null, 2));
          console.log('🔄 Notícias atualizadas automaticamente.');
        }
      })
      .catch(err => {
        console.log('⚠ Falha ao atualizar notícias:', err.message);
      });
  } catch (e) {
    console.log('Erro em startNoticesAutoUpdate:', e.message);
  }
}

module.exports = {
  setupNotices,
  startNoticesAutoUpdate,
};
