// Direct marketplace search in headless Chromium (one shared browser, a page per site).
// On a Russian VPS Avito/Ozon answer normally; a block page is reported as `blocked`.
const puppeteer = require('puppeteer');
const path = require('path');
const cfg = require('./config');
const { SITES, BLOCK, extractor, relevant, condFromText } = require('./shops-core');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let browserP = null;
function browser() {
  if (!browserP) browserP = puppeteer.launch({
    headless: true,
    userDataDir: path.join(cfg.dataDir, 'chrome'), // cookies persist between searches
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage', '--lang=ru-RU', '--window-size=1366,1000']
  }).then(b => { b.on('disconnected', () => { browserP = null; }); return b; });
  return browserP;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrape(site, query, city) {
  const S = SITES[site];
  const page = await (await browser()).newPage();
  try {
    await page.setUserAgent(UA);
    // look like a regular browser, not an automated one
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en'] });
      window.chrome = window.chrome || { runtime: {} };
    });
    await page.setExtraHTTPHeaders({ 'accept-language': 'ru-RU,ru;q=0.9' });
    await page.setViewport({ width: 1366, height: 1000 });
    // skip heavy resources: we only need DOM text and image URLs
    await page.setRequestInterception(true);
    page.on('request', r => ['media', 'font'].includes(r.resourceType()) ? r.abort() : r.continue());
    page.goto(S.url(encodeURIComponent(query), city), { timeout: 25000, waitUntil: 'domcontentloaded' }).catch(() => {});
    let items = [], blocked = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const probe = await page.evaluate(() => document.title + ' ' + (document.body?.innerText || '').slice(0, 600)).catch(() => '');
      if (BLOCK.test(probe)) { blocked = true; break; }
      if (i === 6) page.evaluate(() => window.scrollTo(0, 1600)).catch(() => {});
      items = await page.evaluate(`(${extractor})(${JSON.stringify(S.link)})`).catch(() => []);
      // stop once enough *relevant* priced tiles are rendered (titles load after the tiles themselves)
      const good = items.filter(it => it.price > 0 && relevant(it.title, query)).length;
      if (good >= 8 || (good && i > 14) || (items.length && i > 24)) break;
    }
    if (blocked) return { blocked: true, offers: [] };
    const offers = items.filter(it => it.price > 0 && relevant(it.title, query)).slice(0, 12).map(it => ({
      store: S.name, seller: '', price: it.price, url: it.url, image: it.image,
      condition: condFromText(it.title + ' ' + it.text, S.cond), note: it.title.slice(0, 60), place: it.place, date: it.date, direct: true
    }));
    return { offers };
  } finally { page.close().catch(() => {}); }
}

module.exports = { scrape, SITES };
