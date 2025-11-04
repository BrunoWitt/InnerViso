// src/scripts/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  runScraper: () => ipcRenderer.invoke('scraper:run'),
  readNotices: () => ipcRenderer.invoke('scraper:read'),
  loadView: (name) => ipcRenderer.invoke('views:load', name), 
});
