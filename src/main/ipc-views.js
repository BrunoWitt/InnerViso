// src/main/ipc-views.js
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');

function registerViewIpc() {
  ipcMain.handle('views:load', async (_e, viewName) => {
    const filePath = path.join(__dirname, '..', 'pages', 'views', `${viewName}.html`);
    return fs.readFile(filePath, 'utf-8');
  });
}

module.exports = { registerViewIpc };
