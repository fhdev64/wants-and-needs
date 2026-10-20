// Price watch: history per item, target price, "when to buy" hints, background re-checks and alerts.
const crypto = require('crypto');
const { db, users, items } = require('./db');
const search = require('./search');

db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, item_id TEXT, data TEXT NOT NULL, created INTEGER, seen INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS alerts_user ON alerts(user_id, created);
`);

const DAY = 864e5;
const CHECK_EVERY = +(process.env.CHECK_HOURS || 12) * 36e5; // re-check each wish this often
const PER_TICK = +(process.env.CHECK_PER_TICK || 4); // AI/search budget per scheduler tick

// ---------- history ----------
/** one point per day: the day's lowest trustworthy price */
function recordHistory(item) {
  const p = item.minPrice;
  if (!p) return;
  const day = new Date().toISOString().slice(0, 10);
  item.history ||= [];
  const last = item.history.at(-1);
  if (last && last.d === day) last.p = Math.min(last.p, p);
  else item.history.push({ d: day, p });
  if (item.history.length > 365) item.history.splice(0, item.history.length - 365);
}

// ---------- "when to buy" ----------
// big Russian marketplace sales; prices on Ozon/WB/Я.Маркет typically dip around these dates
function sales(year) {
  const lastFriNov = (() => { const d = new Date(year, 10, 30); while (d.getDay() !== 5) d.setDate(d.getDate() - 1); return d; })();
  return [
    { name: '11.11', at: new Date(year, 10, 11) },
    { name: 'Чёрная пятница', at: lastFriNov },
    { name: '12.12', at: new Date(year, 11, 12) },
    { name: 'новогодние распродажи', at: new Date(year, 11, 26) },
    { name: 'распродажа 8 Марта', at: new Date(year, 2, 1) },
    { name: 'летняя распродажа', at: new Date(year, 5, 20) },
    { name: 'день рождения Ozon', at: new Date(year, 6, 1) }
  ];
}

function insights(item) {
  const h = item.history || [];
  const now = Date.now();
  const last30 = h.filter(x => now - Date.parse(x.d) <= 30 * DAY).map(x => x.p);
  const min30 = last30.length ? Math.min(...last30) : null, max30 = last30.length ? Math.max(...last30) : null;
  const cur = item.minPrice;
  const prev = h.length > 1 ? h.at(-2).p : null;
  const trend = prev && cur ? Math.round((cur - prev) / prev * 100) : 0;
  const atTarget = !!(item.target && cur && cur <= item.target);

  let hint = null, tone = 'info';
  const upcoming = [...sales(new Date().getFullYear()), ...sales(new Date().getFullYear() + 1)]
    .map(s => ({ ...s, days: Math.ceil((s.at - now) / DAY) })).filter(s => s.days >= 0 && s.days <= 21).sort((a, b) => a.days - b.days)[0];
  if (atTarget) { hint = `Цена дошла до вашей цели ${fmt(item.target)} — можно брать`; tone = 'good'; }
  else if (min30 && cur && cur <= min30 && h.length >= 3) { hint = 'Сейчас минимальная цена за месяц — хороший момент для покупки'; tone = 'good'; }
  else if (upcoming) { hint = upcoming.days <= 1 ? `Идёт ${upcoming.name} — проверьте цены ещё раз` : `Через ${upcoming.days} ${plural(upcoming.days, 'день', 'дня', 'дней')} ${upcoming.name} — цены обычно снижаются на 10–20%, можно подождать`; tone = 'wait'; }
  else if (trend >= 5) { hint = `Цена выросла на ${trend}% — если не срочно, лучше подождать`; tone = 'wait'; }
  else if (trend <= -5) { hint = `Цена снизилась на ${-trend}% с прошлой проверки`; tone = 'good'; }
  else if (h.length < 3) hint = 'Собираем историю цены — проверяем каждые 12 часов';
  return { min30, max30, trend, atTarget, hint, tone, points: h.slice(-60) };
}
const fmt = n => n == null ? '—' : Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;

// ---------- alerts ----------
const alertsApi = {
  add(userId, data) {
    const a = { id: crypto.randomUUID(), created: Date.now(), ...data };
    db.prepare('INSERT INTO alerts (id, user_id, item_id, data, created) VALUES (?, ?, ?, ?, ?)').run(a.id, userId, data.itemId || null, JSON.stringify(a), a.created);
    return a;
  },
  list(userId, since = 0) {
    return db.prepare('SELECT data, seen FROM alerts WHERE user_id = ? AND created > ? ORDER BY created DESC LIMIT 50').all(userId, since)
      .map(r => ({ ...JSON.parse(r.data), seen: !!r.seen }));
  },
  markSeen: userId => db.prepare('UPDATE alerts SET seen = 1 WHERE user_id = ?').run(userId),
  unseen: userId => db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id = ? AND seen = 0').get(userId).c
};

let notifyBot = null; // set by bot.js: (userId, alert) => send a Telegram message
const onAlert = fn => { notifyBot = fn; };

/** compare the finished job with the previous price; raise a drop / target alert when it matters */
function evaluate(userId, before, after) {
  const old = before.minPrice, cur = after.minPrice;
  if (!cur) return;
  const best = (after.offers || []).find(o => !o.flags?.includes('cheap')) || {};
  const base = { itemId: after.id, name: after.name, image: after.image || '', store: best.store || '', url: best.url || '', oldPrice: old || null, newPrice: cur, condition: best.condition || 'new' };
  let alert = null;
  if (after.target && cur <= after.target && !(old && old <= after.target)) {
    alert = { kind: 'target', ...base, target: after.target, title: `🎯 ${after.name}`, body: `Цена дошла до вашей цели: ${fmt(cur)}${best.store ? ' на ' + best.store : ''}` };
  } else if (old && cur <= old * 0.97 && old - cur >= 300) {
    const pct = Math.round((old - cur) / old * 100);
    alert = { kind: 'drop', ...base, pct, title: `📉 ${after.name} −${pct}%`, body: `${fmt(old)} → ${fmt(cur)}${best.store ? ' · ' + best.store : ''}` };
  }
  if (!alert) return;
  const a = alertsApi.add(userId, alert);
  notifyBot?.(userId, a);
}

/** run a fresh search for a saved item, keep history and raise alerts when done */
function recheck(userId, item, { onJob } = {}) {
  const user = users.get(userId);
  const before = { minPrice: item.minPrice };
  const job = search.start(item.name, user?.city || item.city || '', { withInfo: !item.description, fresh: true });
  const apply = j => {
    const cur = items.get(userId, item.id);
    if (!cur) return j.listeners.delete(apply);
    Object.assign(cur, { offers: j.offers, minPrice: j.minPrice, minNew: j.minNew, minUsed: j.minUsed, minDiscounted: j.minDiscounted, maxPrice: j.maxPrice, status: j.status, city: j.city });
    if (j.info) Object.assign(cur, { description: j.info.description, pros: j.info.pros || [], cons: j.info.cons || [], specs: j.info.specs || [] });
    if (!cur.image && j.image) cur.image = j.image;
    if (j.done) {
      j.listeners.delete(apply);
      recordHistory(cur);
      cur.checkedAt = Date.now();
      items.save(userId, cur);
      evaluate(userId, before, cur);
    } else items.save(userId, cur);
  };
  job.listeners.add(apply);
  apply(job);
  onJob?.(job);
  return job;
}

// ---------- scheduler: a few stale wishes per tick, oldest first ----------
let running = 0;
function tick() {
  if (running) return;
  const rows = db.prepare('SELECT user_id, data FROM items').all().map(r => ({ userId: r.user_id, item: JSON.parse(r.data) }))
    .filter(({ item }) => !item.done && Date.now() - (item.checkedAt || item.updatedAt || 0) > CHECK_EVERY)
    .sort((a, b) => (a.item.checkedAt || 0) - (b.item.checkedAt || 0))
    .slice(0, PER_TICK);
  for (const { userId, item } of rows) {
    running++;
    const job = recheck(userId, item);
    const done = () => { if (job.done) { running--; job.listeners.delete(done); } };
    job.listeners.add(done);
  }
}
function startScheduler() {
  setTimeout(tick, 60e3);
  setInterval(tick, 15 * 60e3).unref();
  console.log(`Проверка цен: каждые ${CHECK_EVERY / 36e5} ч, до ${PER_TICK} товаров за раз`);
}

module.exports = { recordHistory, insights, alerts: alertsApi, onAlert, evaluate, recheck, startScheduler };
