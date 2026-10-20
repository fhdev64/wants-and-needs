const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  win: a => ipcRenderer.invoke('win', a),
  focus: () => ipcRenderer.invoke('focus'),
  open: u => ipcRenderer.invoke('open', u),
  getData: () => ipcRenderer.invoke('data:get'),
  setData: d => ipcRenderer.invoke('data:set', d),
  citySlug: c => ipcRenderer.invoke('city:slug', c),
  srv: req => ipcRenderer.invoke('srv', req)
});
