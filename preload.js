const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  win: a => ipcRenderer.invoke('win', a),
  focus: () => ipcRenderer.invoke('focus'),
  open: u => ipcRenderer.invoke('open', u),
  getData: () => ipcRenderer.invoke('data:get'),
  setData: d => ipcRenderer.invoke('data:set', d),
  identify: p => ipcRenderer.invoke('ai:identify', p),
  codexModels: p => ipcRenderer.invoke('ai:codexModels', p),
  info: p => ipcRenderer.invoke('ai:info', p),
  offers: p => ipcRenderer.invoke('ai:offers', p)
});
