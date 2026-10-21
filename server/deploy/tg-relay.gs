// Telegram Bot API relay on Google Apps Script (free, Google account only).
// api.telegram.org is blocked from Russian hosting, script.google.com is not.
// Deploy → New deployment → Web app, execute as "Me", access "Anyone";
// put the /exec URL into server/.env as TG_RELAY=...
function doPost(e) {
  var b = JSON.parse(e.postData.contents);
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
