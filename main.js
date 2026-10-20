const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { avitoCity } = require('./server/src/shops-core');

// The app is a thin client: wishlists, search and AI keys live on the server.
const SERVER = (process.env.HOTELKI_SERVER || require('./package.json').hotelki.server).replace(/\/+$/, '');

const DATA = () => path.join(app.getPath('userData'), 'data.json');
function load() {
  try { return JSON.parse(fs.readFileSync(DATA(), 'utf8')); }
  catch { return { items: [], settings: {} }; }
}
function save(d) { fs.writeFileSync(DATA(), JSON.stringify(d, null, 2)); }

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 920, minHeight: 620,
    frame: false, backgroundColor: '#0b1016', roundedCorners: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); win.webContents.focus(); });
  // Windows frameless bug: DOM gets focus (caret blinks) but keystrokes don't reach the page
  win.on('focus', () => win.webContents.focus());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('win', (_, a) => {
  if (a === 'close') win.close();
  else if (a === 'min') win.minimize();
  else if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.handle('focus', () => { if (!win.isFocused()) win.focus(); win.webContents.focus(); });
ipcMain.handle('open', (_, url) => { if (/^(https:\/\/|tg:\/\/)/.test(url)) shell.openExternal(url); });
ipcMain.handle('data:get', () => load());
ipcMain.handle('data:set', (_, d) => { save(d); return true; });
ipcMain.handle('city:slug', (_, c) => avitoCity(c));

// all server calls go through the main process (no CORS/CSP issues, token never leaves this machine except to our server)
ipcMain.handle('srv', async (_, { method, path: p, body, token }) => {
  try {
    const r = await fetch(SERVER + '/api' + p, {
      method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000)
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, body: { error: 'Сервер недоступен. Проверьте интернет.' } };
  }
});

if (process.env.SHOT) app.whenReady().then(() => setTimeout(async () => {
  if (process.env.SHOT_JS) await win.webContents.executeJavaScript(process.env.SHOT_JS);
  await new Promise(r => setTimeout(r, +(process.env.SHOT_WAIT || 1500)));
  if (process.env.SHOT_EVAL) console.log('EVAL', await win.webContents.executeJavaScript(process.env.SHOT_EVAL));
  fs.writeFileSync(process.env.SHOT, (await win.webContents.capturePage()).toPNG()); app.quit();
}, 2000));
