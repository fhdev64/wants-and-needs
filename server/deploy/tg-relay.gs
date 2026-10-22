// Telegram Bot API relay on Google Apps Script (free, Google account only).
// api.telegram.org is blocked from Russian hosting, script.google.com is not.
// Deploy → New deployment → Web app, execute as "Me", access "Anyone";
// put the /exec URL into server/.env as TG_RELAY=...
// The same web app is the fallback route to the hotelkino API for clients behind a VPN:
// some VPN exits can't reach Russian hosting directly, but Google can.
var API = 'https://188-120-246-113.sslip.io/api';

function doPost(e) {
  var b = JSON.parse(e.postData.contents);
  if (b.api) return api_(b.api);
  if (!/^\d+:[\w-]+$/.test(b.t || '')) return json_({ ok: false, description: 'bad token' });
  if (b.f) {
    var f = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + b.t + '/' + b.f, { muteHttpExceptions: true });
    return json_({ ok: true, result: Utilities.base64Encode(f.getContent()) });
  }
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + b.t + '/' + b.m, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(b.p || {}), muteHttpExceptions: true
  });
  return ContentService.createTextOutput(r.getContentText()).setMimeType(ContentService.MimeType.JSON);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function api_(q) {
  if (!/^\/[\w\/.?=&%:-]*$/.test(q.p || '')) return json_({ status: 400, body: { error: 'bad path' } });
  var o = { method: (q.m || 'GET').toLowerCase(), muteHttpExceptions: true, headers: {} };
  if (q.k) o.headers.authorization = 'Bearer ' + q.k;
  if (q.b !== undefined && q.b !== null && o.method !== 'get') { o.contentType = 'application/json'; o.payload = JSON.stringify(q.b); }
  var r = UrlFetchApp.fetch(API + q.p, o);
  var t = r.getContentText(), body = null;
  try { body = t ? JSON.parse(t) : null; } catch (err) { body = { error: 'Ошибка ' + r.getResponseCode() }; }
  return json_({ status: r.getResponseCode(), body: body });
}
