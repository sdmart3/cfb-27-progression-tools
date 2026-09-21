// Bridges the window to the main process. contextIsolation stays on: the UI never gets Node access.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dd', {
  listSaves: () => ipcRenderer.invoke('list-saves'),
  browseSave: () => ipcRenderer.invoke('browse-save'),
  inspect: (save) => ipcRenderer.invoke('inspect-save', save),
  run: (opts) => ipcRenderer.invoke('run-plan', opts),
  confirmApply: (text) => ipcRenderer.invoke('confirm-apply', text),
  showBackup: (p) => ipcRenderer.invoke('show-backup', p),
  exportCsv: (payload) => ipcRenderer.invoke('export-csv', payload),
});
