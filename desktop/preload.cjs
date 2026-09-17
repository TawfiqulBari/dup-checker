const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopAPI', {
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  gpuInfo: () => ipcRenderer.invoke('gpu-info'),
  resetScan: () => ipcRenderer.invoke('reset-scan'),
  listFolder: id => ipcRenderer.invoke('list-folder', id),
  validateFile: id => ipcRenderer.invoke('validate-file', id),
  hashFile: id => ipcRenderer.invoke('hash-file', id),
  confirmRemoval: ids => ipcRenderer.invoke('confirm-removal', ids),
  trashFile: id => ipcRenderer.invoke('trash-file', id),
  smokeTest: process.argv.includes('--dup-smoke'),
  reportSmoke: result => ipcRenderer.invoke('smoke-result', result),
});
