// HTTP API for the desktop and Android apps. Auth: Bearer session token obtained via the Telegram bot.
const http = require('http');
const crypto = require('crypto');
const cfg = require('./config');
const { users, sessions, items } = require('./db');
const ai = require('./ai');
const search = require('./search');

// ---------- login via bot: app asks for a code, user confirms it in Telegram ----------
const logins = new Map(); // code → { status, token, userId, device, exp }
setInterval(() => { const t = Date.now(); for (const [c, l] of logins) if (l.exp < t) logins.delete(c); }, 60e3).unref();
let botUsername = '';
const setBotUsername = u => { botUsername = u; };

function confirmLogin(code, tgUser) {
  const l = logins.get(code);
  if (!l || l.exp < Date.now() || l.status !== 'pending') return false;
  const user = users.upsert(tgUser);
  l.token = sessions.create(user.id, l.device);
  l.userId = user.id; l.status = 'ok';
  return true;
}
const loginInfo = code => logins.get(code);

// keep a saved item in sync with its running search
function attachJob(userId, item, job) {
  const apply = j => {
    const cur = items.get(userId, item.id);
    if (!cur) return j.listeners.delete(apply);
    Object.assign(cur, { offers: j.offers, minPrice: j.minPrice, minNew: j.minNew, minUsed: j.minUsed, minDiscounted: j.minDiscounted, maxPrice: j.maxPrice, status: j.status, city: j.city });
    if (j.info) Object.assign(cur, { description: j.info.description, pros: j.info.pros || [], cons: j.info.cons || [], specs: j.info.specs || [] });
    if (!cur.image && j.image) cur.image = j.image;
    items.save(userId, cur);
    if (j.done) j.listeners.delete(apply);
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

route('GET', '/api/health', false, () => ({ ok: true, bot: botUsername }));

route('POST', '/api/auth/start', false, ({ body }) => {
  const code = crypto.randomBytes(9).toString('base64url');
  logins.set(code, { status: 'pending', device: String(body.device || '').slice(0, 60), exp: Date.now() + 10 * 60e3 });
  return { code, bot: botUsername, url: `https://t.me/${botUsername}?start=login_${code}`, expiresIn: 600 };
});
route('GET', '/api/auth/poll', false, ({ query }) => {
  const l = logins.get(query.get('code') || '');
  if (!l || l.exp < Date.now()) return { status: 'expired' };
  if (l.status !== 'ok') return { status: l.status };
  logins.delete(query.get('code'));
  return { status: 'ok', token: l.token, user: users.get(l.userId) };
});
route('POST', '/api/auth/logout', true, ({ req }) => { sessions.drop((req.headers.authorization || '').replace(/^Bearer\s+/i, '')); return { ok: true }; });

route('GET', '/api/me', true, ({ user }) => ({ ...user, count: items.count(user.id), bot: botUsername }));
route('PUT', '/api/me', true, ({ user, body }) => { if ('city' in body) users.setCity(user.id, String(body.city || '').slice(0, 60)); return users.get(user.id); });

route('GET', '/api/items', true, ({ user }) => items.list(user.id));
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
route('POST', '/api/items/:id/refresh', true, ({ user, params }) => {
  const item = items.get(user.id, params.id);
  if (!item) throw Object.assign(new Error('Не найдено'), { status: 404 });
  const job = search.start(item.name, user.city || item.city || '', { withInfo: !item.description });
  attachJob(user.id, item, job);
  return search.view(job);
});

route('POST', '/api/identify', true, async ({ body }) => ({ candidates: await ai.identify({ query: String(body.query || ''), image: body.image || null }) }));
route('POST', '/api/search', true, ({ user, body }) => search.view(search.start(String(body.name), body.city ?? user.city ?? '')));
route('GET', '/api/search/:id', true, ({ params }) => {
  const j = search.get(params.id);
  if (!j) throw Object.assign(new Error('Поиск не найден'), { status: 404 });
  return search.view(j);
});

function serve() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
    try {
      let m, r = routes.find(r => r.method === req.method && (m = url.pathname.match(r.re)));
      if (!r) return send(404, { error: 'Не найдено' });
      const user = r.auth ? userOf(req) : null;
      if (r.auth && !user) return send(401, { error: 'Нужен вход через Telegram' });
      let body = {};
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 12e6) return send(413, { error: 'Слишком большой файл' }); chunks.push(c); }
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      }
      send(200, await r.fn({ req, user, body, params: m.groups || {}, query: url.searchParams }));
    } catch (e) {
      send(e.status || 500, { error: String(e.message || e) });
    }
  });
  server.listen(cfg.port, () => console.log(`API: http://localhost:${cfg.port}`));
  return server;
}

module.exports = { serve, confirmLogin, loginInfo, setBotUsername, attachJob, itemFromJob };
