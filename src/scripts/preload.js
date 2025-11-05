// src/scripts/preload.js
const { contextBridge, ipcRenderer } = require('electron');

//Aqui faz uma api de funções que o renderer pode chamar
contextBridge.exposeInMainWorld('api', {
  runScraper: () => ipcRenderer.invoke('scraper:run'),
  readNotices: () => ipcRenderer.invoke('scraper:read'),
  loadView: (name) => ipcRenderer.invoke('views:load', name), 
});
