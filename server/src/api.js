// HTTP API for the desktop and Android apps. Auth: Bearer session token obtained by signing in with VK ID, Google or Apple.
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const cfg = require('./config');
const { users, identities, sessions, items } = require('./db');
const oauth = require('./oauth');
const ai = require('./ai');
const search = require('./search');
const watch = require('./watch');

// ---------- sign-in: the app opens the provider page in a browser and polls until the server has the profile ----------
const logins = new Map(); // code (= OAuth state) → { provider, verifier, device, status, token, userId, error, exp }
const links = new Map(); // code → { userId, exp }: linking the Telegram bot to a signed-in account
setInterval(() => { const t = Date.now(); for (const m of [logins, links]) for (const [c, l] of m) if (l.exp < t) m.delete(c); }, 60e3).unref();
let botUsername = '';
const setBotUsername = u => { botUsername = u; };

/** account for a provider profile: the one it is linked to, or a fresh one */
function signIn(provider, p) {
  const id = identities.user(provider, p.sub) || users.create({ name: p.name, photo: p.photo }).id;
  identities.link(provider, p.sub, id, p);
  return id;
}

/** the bot calls this on /start link_<code>; false when the link is stale */
function linkTelegram(code, tg) {
  const l = links.get(code);
  if (!l || l.exp < Date.now()) return false;
  links.delete(code);
  // the bot was used on its own before: bring its wishes into this account
  const prev = identities.user('tg', tg.id);
  if (prev && prev !== l.userId) users.merge(prev, l.userId);
  identities.unlink(l.userId, 'tg');
  identities.link('tg', tg.id, l.userId, tg);
  return true;
}
/** account a Telegram user is linked to, or null */
const tgUser = tgId => { const id = identities.user('tg', tgId); return id ? users.get(id) : null; };
const tgChat = userId => identities.of(userId, 'tg')?.sub || null;

function profile(user) {
  const ids = identities.list(user.id);
  const main = ids.find(i => i.provider !== 'tg'), tg = ids.find(i => i.provider === 'tg');
  const provider = main?.provider || 'tg';
  return { ...user, provider, providerName: oauth.NAMES[provider], email: main?.email || '', telegram: tg ? { username: tg.username, name: tg.name } : null };
}

// the page the browser shows after the provider sent the user back
function donePage(ok, text, appLink) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>хотелкино ✦︎</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(120% 80% at 20% 0%,#1d3bd1 0%,#0b1033 45%,#05060a 100%);color:#fff;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.c{max-width:360px;margin:24px;padding:36px 28px;border-radius:30px;text-align:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.m{width:72px;height:72px;margin:0 auto 18px;border-radius:22px;display:grid;place-items:center;font-size:36px;background:linear-gradient(135deg,#3b66ff,#1a2fb8 60%,#0e1440);box-shadow:0 12px 40px rgba(47,91,255,.5)}
h1{font-size:22px;margin:0 0 8px}p{margin:0;color:rgba(255,255,255,.7)}
a{display:inline-block;margin-top:22px;padding:14px 26px;border-radius:999px;background:#2f5bff;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><div class="c"><div class="m">${ok ? '✦' : '!'}</div><h1>${ok ? 'Вход выполнен' : 'Не получилось войти'}</h1><p>${esc(text)}</p>
${appLink ? `<a href="${appLink}">Вернуться в приложение</a><script>setTimeout(()=>location.href=${JSON.stringify(appLink)},700)</script>` : ''}</div></body></html>`;
}

// keep a saved item in sync with its running search
function attachJob(userId, item, job) {
  const apply = j => {
    const cur = items.get(userId, item.id);
    if (!cur) return j.listeners.delete(apply);
    Object.assign(cur, { offers: j.offers, minPrice: j.minPrice, minNew: j.minNew, minUsed: j.minUsed, minDiscounted: j.minDiscounted, maxPrice: j.maxPrice, status: j.status, city: j.city });
    if (j.info) Object.assign(cur, { description: j.info.description, pros: j.info.pros || [], cons: j.info.cons || [], specs: j.info.specs || [] });
    if (!cur.image && j.image) cur.image = j.image;
    if (j.done) { j.listeners.delete(apply); watch.recordHistory(cur); cur.checkedAt = Date.now(); }
    items.save(userId, cur);
  };
  job.listeners.add(apply);
  apply(job);
}

function itemFromJob(job, meta = {}) {
  return {
    id: crypto.randomUUID(), name: job.name, brand: meta.brand || '', category: meta.category || '', city: job.city,
    image: meta.image || job.image || '', offers: job.offers, status: job.status,
    minPrice: job.minPrice, minNew: job.minNew, minUsed: job.minUsed, minDiscounted: job.minDiscounted, maxPrice: job.maxPrice,
    description: job.info?.description || '', pros: job.info?.pros || [], cons: job.info?.cons || [], specs: job.info?.specs || []
  };
}

// ---------- tiny router ----------
const routes = [];
const route = (method, pattern, auth, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), auth, fn });
const userOf = req => sessions.user((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
const fail = (status, msg) => { throw Object.assign(new Error(msg), { status }); };

// vkClientId / googleClientId let the Android app sign in through the VK app and the system Google account picker
route('GET', '/api/health', false, () => ({ ok: true, bot: botUsername, providers: oauth.enabled(), vkClientId: cfg.oauth.vk.androidClientId, googleClientId: cfg.oauth.google.clientId }));

route('POST', '/api/auth/start', false, ({ body }) => {
  if (!body.provider) fail(400, 'Вход через Telegram больше не работает — обновите приложение');
  const p = oauth.get(String(body.provider)) || fail(400, 'Этот способ входа пока недоступен');
  const code = crypto.randomBytes(32).toString('hex'), verifier = crypto.randomBytes(48).toString('base64url');
  logins.set(code, { provider: body.provider, verifier, status: 'pending', device: String(body.device || '').slice(0, 60), exp: Date.now() + 10 * 60e3 });
  // challenge: for the VK ID SDK, which sends the code to the app; the server swaps it at /api/auth/vk/code
  return { code, url: p.url(code, verifier), challenge: oauth.challenge(verifier), expiresIn: 600 };
});
route('GET', '/api/auth/poll', false, ({ query }) => {
  const code = query.get('code') || '', l = logins.get(code);
  if (!l || l.exp < Date.now()) return { status: 'expired' };
  if (l.status === 'pending') return { status: 'pending' };
  logins.delete(code);
  if (l.status === 'error') return { status: 'error', error: l.error };
  return { status: 'ok', token: l.token, user: profile(users.get(l.userId)) };
});
// native sign-in on Android: the app already holds the provider's answer, the session comes back at once
async function nativeSignIn(provider, device, getProfile) {
  let p;
  try {
    p = await getProfile();
  } catch (e) {
    console.error('oauth native', provider, e.message);
    fail(400, `Не удалось войти через ${oauth.NAMES[provider]}`);
  }
  if (!p.sub || p.sub === 'undefined') fail(400, `Не удалось войти через ${oauth.NAMES[provider]}`);
  const userId = signIn(provider, p);
  return { status: 'ok', token: sessions.create(userId, device), user: profile(users.get(userId)) };
}
route('POST', '/api/auth/vk/code', false, async ({ body }) => {
  const state = String(body.state || ''), l = logins.get(state);
  if (!l || l.exp < Date.now() || l.status !== 'pending' || l.provider !== 'vk' || !oauth.get('vk')) fail(400, 'Вход не завершён, попробуйте ещё раз');
  logins.delete(state);
  return nativeSignIn('vk', l.device, () => oauth.get('vk').profile({ code: String(body.code || ''), device_id: String(body.deviceId || ''), state }, l.verifier, oauth.vkAppRedirect(), cfg.oauth.vk.androidClientId));
});
route('POST', '/api/auth/google/token', false, async ({ body }) => {
  if (!cfg.oauth.google.clientId) fail(400, 'Этот способ входа пока недоступен');
  return nativeSignIn('google', String(body.device || '').slice(0, 60), () => oauth.googleIdToken(String(body.idToken || '')));
});
route('POST', '/api/auth/logout', true, ({ req }) => { sessions.drop((req.headers.authorization || '').replace(/^Bearer\s+/i, '')); return { ok: true }; });

// the provider sends the browser back here (Apple POSTs a form, the others GET with query params)
async function callback({ params, query, body }) {
  const q = { ...Object.fromEntries(query), ...body };
  let state = q.state;
  try { state ||= JSON.parse(q.payload || '{}').state; } catch {}
  const l = logins.get(state || '');
  const app = l?.device === 'Android' ? 'hotelkino://login' : '';
  if (!l || l.exp < Date.now() || l.status !== 'pending' || l.provider !== params.provider) return donePage(false, 'Ссылка для входа устарела. Нажмите кнопку входа в приложении ещё раз.', app);
  const name = oauth.NAMES[l.provider];
  if (q.error) { Object.assign(l, { status: 'error', error: 'Вход отменён' }); return donePage(false, 'Вход отменён. Вернитесь в приложение и попробуйте снова.', app); }
  try {
    const p = await oauth.get(l.provider).profile(q, l.verifier);
    if (!p.sub || p.sub === 'undefined') throw new Error('нет id пользователя');
    l.userId = signIn(l.provider, p);
    l.token = sessions.create(l.userId, l.device);
    l.status = 'ok';
    return donePage(true, app ? 'Возвращаемся в приложение…' : 'Вкладку можно закрыть — приложение уже открыто.', app);
  } catch (e) {
    console.error('oauth', l.provider, e.message);
    Object.assign(l, { status: 'error', error: `Не удалось войти через ${name}` });
    return donePage(false, `${name} не отдал данные для входа. Попробуйте ещё раз.`, app);
  }
}
route('GET', '/auth/cb/:provider', false, callback);
route('POST', '/auth/cb/:provider', false, callback);

// link the Telegram bot to the signed-in account: the app opens t.me/<bot>?start=link_<code>
route('POST', '/api/link/telegram', true, ({ user }) => {
  if (!botUsername) fail(503, 'Бот сейчас недоступен');
  const code = crypto.randomBytes(16).toString('hex');
  links.set(code, { userId: user.id, exp: Date.now() + 10 * 60e3 });
  return { code, bot: botUsername, url: `https://t.me/${botUsername}?start=link_${code}`, expiresIn: 600 };
});
route('DELETE', '/api/link/telegram', true, ({ user }) => ({ ok: identities.unlink(user.id, 'tg') }));

route('GET', '/api/alerts', true, ({ user, query }) => watch.alerts.list(user.id, +(query.get('since') || 0)));
route('POST', '/api/alerts/seen', true, ({ user }) => { watch.alerts.markSeen(user.id); return { ok: true }; });
route('GET', '/api/me', true, ({ user }) => {
  const list = items.list(user.id), active = list.filter(i => !i.done);
  return { ...profile(user), count: list.length, active: active.length, done: list.length - active.length,
    total: active.reduce((s, i) => s + (i.minPrice || 0), 0), unseen: watch.alerts.unseen(user.id), bot: botUsername };
});
route('PUT', '/api/me', true, ({ user, body }) => { if ('city' in body) users.setCity(user.id, String(body.city || '').slice(0, 60)); return profile(users.get(user.id)); });

// each wish comes with its price insights (history points, 30-day range, "when to buy" hint)
route('GET', '/api/items', true, ({ user }) => items.list(user.id).map(i => ({ ...i, insights: watch.insights(i) })));
route('DELETE', '/api/items/:id', true, ({ user, params }) => ({ ok: items.remove(user.id, params.id) }));
// save the result of a search as a wishlist item; offers still arriving are merged in
route('POST', '/api/items', true, ({ user, body }) => {
  const job = body.jobId && search.get(body.jobId);
  if (!job) throw Object.assign(new Error('Поиск устарел, начните заново'), { status: 410 });
  if (items.hasName(user.id, job.name)) throw Object.assign(new Error('Уже в хотелках'), { status: 409 });
  const item = items.save(user.id, itemFromJob(job, body));
  attachJob(user.id, item, job);
  return items.get(user.id, item.id);
});
// mark a wish as fulfilled (or bring it back)
route('PUT', '/api/items/:id', true, ({ user, params, body }) => {
  const item = items.get(user.id, params.id);
  if (!item) throw Object.assign(new Error('Не найдено'), { status: 404 });
  if ('done' in body) { item.done = !!body.done; item.doneAt = item.done ? Date.now() : null; }
  if ('target' in body) item.target = body.target ? Math.max(1, Math.round(+body.target)) : null;
  const saved = items.save(user.id, item);
  return { ...saved, insights: watch.insights(saved) };
});
route('POST', '/api/items/:id/refresh', true, ({ user, params }) => {
  const item = items.get(user.id, params.id);
  if (!item) throw Object.assign(new Error('Не найдено'), { status: 404 });
  return search.view(watch.recheck(user.id, item));
});

route('POST', '/api/identify', true, async ({ body }) => ({ candidates: await ai.identify({ query: String(body.query || ''), image: body.image || null }) }));
route('POST', '/api/search', true, ({ user, body }) => search.view(search.start(String(body.name), body.city ?? user.city ?? '')));
route('GET', '/api/search/:id', true, async ({ params, query }) => {
  const j = search.get(params.id);
  if (!j) throw Object.assign(new Error('Поиск не найден'), { status: 404 });
  // ?after=<rev>&wait=<sec>: hold the request until there is something new (fewer round trips over slow routes)
  if (query.has('after')) await search.waitFor(j, +query.get('after'), Math.min(25, +(query.get('wait') || 20)) * 1000);
  return search.view(j);
});

function serve() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    // gzip: search results and wishlists shrink several times, which matters on slow mobile networks
    const send = (code, obj) => {
      const html = typeof obj === 'string';
      let buf = Buffer.from(html ? obj : JSON.stringify(obj));
      const head = { 'content-type': html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store' };
      if (buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { buf = zlib.gzipSync(buf); head['content-encoding'] = 'gzip'; head.vary = 'accept-encoding'; }
      res.writeHead(code, head); res.end(buf);
    };
    try {
      let m, r = routes.find(r => r.method === req.method && (m = url.pathname.match(r.re)));
      if (!r) return send(404, { error: 'Не найдено' });
      const user = r.auth ? userOf(req) : null;
      if (r.auth && !user) return send(401, { error: 'Нужно войти в аккаунт' });
      let body = {};
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 12e6) return send(413, { error: 'Слишком большой файл' }); chunks.push(c); }
        const text = Buffer.concat(chunks).toString('utf8');
        body = !text ? {} : /x-www-form-urlencoded/.test(req.headers['content-type'] || '') ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
      }
      send(200, await r.fn({ req, user, body, params: m.groups || {}, query: url.searchParams }));
    } catch (e) {
      send(e.status || 500, { error: String(e.message || e) });
    }
  });
  // keep connections open between polls: a new TCP+TLS handshake costs seconds on a bad mobile network
  server.keepAliveTimeout = 75e3; server.headersTimeout = 80e3;
  server.listen(cfg.port, () => console.log(`API: http://localhost:${cfg.port}`));
  return server;
}

module.exports = { serve, linkTelegram, tgUser, tgChat, setBotUsername, attachJob, itemFromJob };
