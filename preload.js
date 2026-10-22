const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  win: a => ipcRenderer.invoke('win', a),
  focus: () => ipcRenderer.invoke('focus'),
  open: u => ipcRenderer.invoke('open', u),
  raise: () => ipcRenderer.invoke('raise'),
  getData: () => ipcRenderer.invoke('data:get'),
  setData: d => ipcRenderer.invoke('data:set', d),
  citySlug: c => ipcRenderer.invoke('city:slug', c),
  deviceId: () => ipcRenderer.invoke('device:id'),
  srv: req => ipcRenderer.invoke('srv', req),
  notify: a => ipcRenderer.invoke('notify', a),
  onOpenItem: fn => ipcRenderer.on('open-item', (_, id) => fn(id))
});
