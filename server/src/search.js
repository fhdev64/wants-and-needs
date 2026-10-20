// Search orchestration: product info + direct marketplaces + AI web search, all in parallel.
// A job is polled by clients (apps) or watched by the bot; results are cached briefly.
const crypto = require('crypto');
const ai = require('./ai');
const shops = require('./shops');
const cfg = require('./config');

const GROUPS = [
  ['avito', 'Авито', 'direct'], ['wb', 'Wildberries', 'direct'], ['ozon', 'Ozon', 'direct'], ['ym', 'Яндекс Маркет', 'direct'],
  ['retail', 'Магазины', 'ai'], ['used', 'Б/у и уценка', 'ai'], ['market', 'Мегамаркет и др.', 'ai']
].filter(g => cfg.directSearch || g[2] === 'ai');

// ---------- trust & condition ----------
const TRUSTED = ['ozon.ru', 'wildberries.ru', 'wb.ru', 'market.yandex.ru', 'megamarket.ru', 'aliexpress.ru', 'avito.ru', 'youla.ru',
  'dns-shop.ru', 'mvideo.ru', 'eldorado.ru', 'citilink.ru', 're-store.ru', 'shop.mts.ru', 'mts.ru', 'beeline.ru', 'megafon.ru', 'svyaznoy.ru',
  'technopark.ru', 'biggeek.ru', 'onlinetrade.ru', 'regard.ru', 'vseinstrumenti.ru', 'holodilnik.ru', 'lamoda.ru', 'sportmaster.ru',
  'leroymerlin.ru', 'lemanapro.ru', 'petrovich.ru', 'detmir.ru', 'goldapple.ru', 'letu.ru', 'kuper.ru', 'samokat.ru', 'apple.com', 'samsung.com',
  'xiaomi.ru', 'mi-shop.com', 'indexiq.ru', 'store77.net', 'hoff.ru', 'divan.ru', 'ikea.com', 'auchan.ru', 'lenta.com', 'perekrestok.ru'];
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const trustedRoot = h => TRUSTED.find(t => h === t || h.endsWith('.' + t));
function condOf(o) {
  const c = String(o.condition || '').toLowerCase();
  if (/refurb|восстан/.test(c)) return 'refurbished';
  if (/discount|уцен|витрин/.test(c)) return 'discounted';
  if (/used|б\/у|бу|подерж/.test(c)) return 'used';
  return 'new';
}
function annotate(list) {
  const news = list.filter(o => condOf(o) === 'new').map(o => o.price).sort((a, b) => a - b);
  const median = news.length ? news[Math.floor(news.length / 2)] : 0;
  return list.map(o => {
    const h = host(o.url), flags = [];
    if (!h) flags.push('nourl'); else if (!trustedRoot(h)) flags.push('unknown');
    if (median && o.price < median * 0.55 && condOf(o) === 'new') flags.push('cheap');
    return { ...o, condition: condOf(o), url: /^https:\/\//.test(o.url || '') ? o.url : '', host: trustedRoot(h) || h, flags };
  });
}
function dedupe(list) {
  const seen = new Set();
  return list.filter(o => { const k = (o.url || o.store + o.price).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function summarize(offers) {
  const ok = offers.filter(o => !o.flags.includes('cheap'));
  const min = c => { const p = ok.filter(o => !c || o.condition === c || (c === 'discounted' && o.condition === 'refurbished')).map(o => o.price); return p.length ? Math.min(...p) : null; };
  const all = ok.map(o => o.price);
  return { minPrice: min('new') ?? min(), minNew: min('new'), minUsed: min('used'), minDiscounted: min('discounted'), maxPrice: all.length ? Math.max(...all) : null };
}

// ---------- jobs ----------
const jobs = new Map();
const cache = new Map(); // name|city → finished job, 30 min
setInterval(() => { const t = Date.now(); for (const [k, j] of jobs) if (t - j.started > 30 * 60e3) jobs.delete(k); for (const [k, j] of cache) if (t - j.started > 30 * 60e3) cache.delete(k); }, 60e3).unref();

function start(name, city = '', { withInfo = true, fresh = false } = {}) {
  const key = name.toLowerCase() + '|' + city.toLowerCase();
  const cached = cache.get(key);
  if (cached && !fresh && Date.now() - cached.started < 30 * 60e3) return cached;

  const job = {
    id: crypto.randomBytes(8).toString('hex'), name, city, started: Date.now(), done: false,
    status: Object.fromEntries(GROUPS.map(([g]) => [g, 'loading'])), errors: {},
    info: null, infoDone: !withInfo, offers: [], ...summarize([]), listeners: new Set()
  };
  const raw = [];
  const changed = () => {
    job.offers = annotate(dedupe(raw)).sort((a, b) => (a.flags.includes('cheap') - b.flags.includes('cheap')) || a.price - b.price);
    Object.assign(job, summarize(job.offers));
    if (!job.image) job.image = job.info?.image || job.offers.find(o => /^https:\/\//.test(o.image || ''))?.image || '';
    job.done = job.infoDone && Object.values(job.status).every(s => s !== 'loading');
    if (job.done) cache.set(key, job);
    for (const fn of job.listeners) try { fn(job); } catch {}
  };
  const tasks = [];
  if (withInfo) tasks.push(ai.info(name).then(r => { job.info = r; }).catch(e => { job.errors.info = e.message; })
    .finally(() => { job.infoDone = true; changed(); }));
  for (const [g, , kind] of GROUPS) {
    const run = kind === 'direct'
      ? shops.scrape(g, name, city).then(r => { if (r.blocked) { job.status[g] = 'blocked'; return; } raw.push(...r.offers.map(o => ({ ...o, group: g }))); job.status[g] = 'done'; })
      : ai.offers(name, g, city).catch(() => ai.offers(name, g, city))
        .then(list => { raw.push(...list.filter(o => +o.price > 0).map(o => ({ ...o, price: +o.price, group: g }))); job.status[g] = 'done'; });
    tasks.push(run.catch(e => { job.status[g] = 'error'; job.errors[g] = e.message; }).finally(changed));
  }
  jobs.set(job.id, job);
  return job;
}

const get = id => jobs.get(id);
// JSON view without internals
const view = j => j && ({
  id: j.id, name: j.name, city: j.city, done: j.done, status: j.status, groups: GROUPS.map(([k, l, kind]) => ({ key: k, label: l, kind })),
  info: j.info, infoDone: j.infoDone, image: j.image || '', offers: j.offers,
  minPrice: j.minPrice, minNew: j.minNew, minUsed: j.minUsed, minDiscounted: j.minDiscounted, maxPrice: j.maxPrice
});

module.exports = { start, get, view, GROUPS, condOf };
