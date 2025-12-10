// src/main/ipc-comparator.js
const { ipcMain } = require('electron');
const axios = require('axios');

function registerComparatorIpc() {
  ipcMain.handle('comparar-listas', async (_event, list1, list2) => {
    const url = 'http://10.0.0.106:8100/comparar_ws';

    try {
      const response = await axios.post(
        url,
        { list1, list2 },
        { timeout: 0, headers: { 'Content-Type': 'application/json' } },
      );

      const data = response.data;
      if (typeof data === 'object' && data.resultado) return data.resultado;
      if (typeof data === 'string') return data;
      return JSON.stringify(data);
    } catch (err) {
      return `Erro: ${err.message}`;
    }
  });
}

module.exports = { registerComparatorIpc };
