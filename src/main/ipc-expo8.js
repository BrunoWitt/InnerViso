// src/main/ipc-expo8.js
const { ipcMain } = require('electron');
const axios = require('axios');

function registerExpo8Ipc() {
  ipcMain.handle('parserExpo8', async (_event, listCodes, pathOut) => {
    const url = 'http://127.0.0.1:8000/due/collect/today';

    try {
      const resp = await axios.get(url, {
        params: { RAW_DUE_NUMBER: listCodes, PATHOUT: pathOut },
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
