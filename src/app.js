const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
const rub = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('ru-RU') + ' ₽';
const I = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 15.5l-4.8-4.8L7 19.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  sort: '<svg viewBox="0 0 24 24"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>',
  check: '<svg class="ck" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.5-9.3C1.1 7.8 3.3 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2-2 4.7-9.5 9.3-9.5 9.3z"/></svg>'
};
const btn = (cls, html, attrs = '') => `<button class="btn lg lg-clear ${cls}" data-lens="999" ${attrs}>${html}</button>`;

let data = { items: [], settings: {} };
let view = 'list', sortMode = 'date', filter = '';
const add = { image: null, query: '', cond: 'any', candidates: null, item: null, loading: false, error: null };

// ---------- conditions, trust ----------
const COND = { new: 'Новый', used: 'Б/у', discounted: 'Уценка', refurbished: 'Восстановленный' };
const COND_FILTERS = [['any', 'Все'], ['new', 'Новые'], ['used', 'Б/у'], ['discounted', 'Уценка']];
const condOf = o => {
  const c = String(o.condition || '').toLowerCase();
  if (/refurb|восстан/.test(c)) return 'refurbished';
  if (/discount|уцен|витрин/.test(c)) return 'discounted';
  if (/used|б\/у|бу|подерж/.test(c)) return 'used';
  return 'new';
};
const matchCond = (o, f) => f === 'any' || condOf(o) === f || (f === 'discounted' && condOf(o) === 'refurbished');
const TRUSTED = ['ozon.ru', 'wildberries.ru', 'wb.ru', 'market.yandex.ru', 'megamarket.ru', 'aliexpress.ru', 'avito.ru', 'youla.ru',
  'dns-shop.ru', 'mvideo.ru', 'eldorado.ru', 'citilink.ru', 're-store.ru', 'shop.mts.ru', 'mts.ru', 'beeline.ru', 'megafon.ru', 'svyaznoy.ru',
  'technopark.ru', 'biggeek.ru', 'onlinetrade.ru', 'regard.ru', 'vseinstrumenti.ru', 'holodilnik.ru', 'lamoda.ru', 'sportmaster.ru',
  'leroymerlin.ru', 'lemanapro.ru', 'petrovich.ru', 'detmir.ru', 'goldapple.ru', 'letu.ru', 'kuper.ru', 'samokat.ru', 'apple.com', 'samsung.com',
  'xiaomi.ru', 'mi-shop.com', 'indexiq.ru', 'store77.net', 'hoff.ru', 'divan.ru', 'ikea.com', 'auchan.ru', 'lenta.com', 'perekrestok.ru'];
const host = u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return h; } catch { return ''; } };
const isTrusted = h => TRUSTED.some(t => h === t || h.endsWith('.' + t));
const shortHost = h => TRUSTED.find(t => h === t || h.endsWith('.' + t)) || h.split('.').slice(-2).join('.');
function annotate(offers) {
  const news = offers.filter(o => condOf(o) === 'new').map(o => o.price).sort((a, b) => a - b);
  const median = news.length ? news[Math.floor(news.length / 2)] : 0;
  return offers.map(o => {
    const h = host(o.url);
    const safeUrl = /^https:\/\//.test(o.url || '') ? o.url : '';
    const flags = [];
    if (!h) flags.push('nourl'); else if (!isTrusted(h)) flags.push('unknown');
    if (median && o.price < median * 0.55 && condOf(o) === 'new') flags.push('cheap');
    return { ...o, url: safeUrl, host: h, flags };
  });
}
function dedupe(list) {
  const seen = new Set();
  return list.filter(o => { const k = (o.url || o.store + o.price).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------- window chrome ----------
document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => api.win(b.dataset.w));
document.querySelectorAll('.nav [data-view]').forEach(b => b.onclick = () => { if (b.dataset.view === 'add' && view !== 'add') resetAdd(); go(b.dataset.view); });
document.addEventListener('focusin', e => { if (e.target.matches('input,select,textarea')) api.focus(); });
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); resetAdd(); go('add'); }
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && view === 'list') { e.preventDefault(); $('#filter')?.focus(); }
  if (e.key === 'Escape') { closeMenu(); closeSheet(); }
});
$('#content').addEventListener('scroll', e => $('.toolbar').classList.toggle('scrolled', e.target.scrollTop > 4), { passive: true });

// nav selection: a droplet that stretches toward its target, then settles
let pillY = null;
function movePill() {
  const a = document.querySelector('.nav .nav-btn.active'), pill = $('.nav-pill');
  if (!a) { pill.style.opacity = 0; return; }
  const y = a.offsetTop, h = a.offsetHeight;
  pill.style.opacity = 1;
  if (pillY == null || pillY === y) { pill.style.transform = `translateY(${y}px)`; pill.style.height = h + 'px'; pillY = y; return; }
  pill.style.transform = `translateY(${Math.min(pillY, y)}px)`; pill.style.height = Math.abs(pillY - y) + h + 'px';
  pillY = y;
  clearTimeout(movePill.t);
  movePill.t = setTimeout(() => { pill.style.transform = `translateY(${y}px)`; pill.style.height = h + 'px'; }, 160);
}

// smooth cross-fade between screens
function transition(fn) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(fn);
  else fn();
}
function go(v) {
  view = v;
  closeMenu();
  document.querySelectorAll('.nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  movePill();
  transition(() => { $('#content').scrollTop = 0; render(); });
}
function rerender() { transition(render); }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
// IPC can't clone functions (item.retry) — save a plain JSON copy without runtime-only fields
const TRANSIENT = new Set(['retry', 'prevOffers', 'infoLoading']);
async function persist() {
  $('#count').textContent = data.items.length || '';
  const plain = JSON.parse(JSON.stringify(data, (k, v) => TRANSIENT.has(k) ? undefined : v));
  try { await api.setData(plain); }
  catch (e) { toast('Не удалось сохранить: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': /, '')); throw e; }
}

// ---------- segmented control ----------
function seg(opts, cur, onPick) {
  const w = document.createElement('div'); w.className = 'seg';
  w.innerHTML = '<div class="thumb"></div>' + opts.map(([k, l]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('');
  const place = () => { const b = w.querySelector('.on'), t = w.querySelector('.thumb'); if (!b) return; t.style.left = b.offsetLeft + 'px'; t.style.width = b.offsetWidth + 'px'; };
  w.querySelectorAll('button').forEach(b => b.onclick = () => { w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); place(); onPick(b.dataset.k); });
  w.place = place;
  new ResizeObserver(place).observe(w);
  return w;
}

// ---------- menu that morphs out of its button ----------
function openMenu(anchor, items) {
  const m = $('#menu'), r = anchor.getBoundingClientRect();
  m.innerHTML = items.map((it, i) => `<button role="menuitem" data-i="${i}" class="${it.on ? 'on' : ''}">${it.icon || ''}<span>${esc(it.label)}</span>${I.check}</button>`).join('');
  m.style.top = (r.bottom + 8) + 'px'; m.style.right = (innerWidth - r.right) + 'px';
  m.style.setProperty('--ox', `calc(100% - ${r.width / 2}px)`); m.style.setProperty('--oy', `-${r.height / 2 + 8}px`);
  m.querySelectorAll('button').forEach(b => b.onclick = () => { closeMenu(); items[b.dataset.i].run(); });
  requestAnimationFrame(() => { m.classList.add('open'); Glass.refresh(m); });
  setTimeout(() => addEventListener('pointerdown', outside), 0);
}
function outside(e) { if (!e.target.closest('#menu')) closeMenu(); }
function closeMenu() { $('#menu').classList.remove('open'); removeEventListener('pointerdown', outside); }

// ---------- render ----------
function render() {
  const el = $('#view'), tools = $('#tools');
  tools.innerHTML = '';
  if (view === 'list') { $('#title').textContent = 'Мои хотелки'; renderList(el, tools); }
  else if (view === 'add') { $('#title').textContent = add.item ? 'Товар' : 'Новая хотелка'; renderAdd(el, tools); }
  else { $('#title').textContent = 'Настройки'; renderSettings(el); }
}

function media(src, name) {
  const letter = esc((name || '?').trim()[0]?.toUpperCase());
  if (!src) return `<div class="media noimg"><span class="ph">${letter}</span></div>`;
  return `<div class="media"><img src="${esc(src)}" referrerpolicy="no-referrer" alt="" data-l="${letter}"></div>`;
}
document.addEventListener('error', e => {
  const im = e.target; if (im.tagName !== 'IMG' || !im.dataset.l) return;
  im.parentNode.classList.add('noimg'); im.outerHTML = `<span class="ph">${im.dataset.l}</span>`;
}, true);

const SORTS = [
  { k: 'date', label: 'Сначала новые', icon: I.clock },
  { k: 'cheap', label: 'Сначала дешёвые', icon: I.down },
  { k: 'exp', label: 'Сначала дорогие', icon: I.up }
];

function renderList(el, tools) {
  if (!data.items.length) {
    el.innerHTML = `<div class="empty">${I.heart}<h2>Хотелок пока нет</h2><p>Добавьте товар по фото или по названию —<br>найдём цены в российских магазинах и на Авито.</p>${btn('prominent big', I.plus + 'Добавить хотелку')}</div>`;
    el.querySelector('.btn').onclick = () => { resetAdd(); go('add'); };
    return;
  }
  tools.innerHTML = `
    <label class="tsearch lg lg-clear" data-lens="999">${I.search}<input id="filter" placeholder="Поиск" value="${esc(filter)}" aria-label="Поиск по хотелкам"></label>
    <div class="group lg lg-clear" data-lens="999">
      <button class="icon-btn" id="sortBtn" aria-label="Сортировка" title="Сортировка">${I.sort}</button>
      <button class="icon-btn" id="addBtn" aria-label="Добавить хотелку" title="Добавить (Ctrl+N)">${I.plus}</button>
    </div>`;
  $('#filter').oninput = e => { filter = e.target.value; drawGrid(el); };
  $('#sortBtn').onclick = e => openMenu(e.currentTarget, SORTS.map(s => ({ ...s, on: s.k === sortMode, run: () => { sortMode = s.k; drawGrid(el); } })));
  $('#addBtn').onclick = () => { resetAdd(); go('add'); };
  drawGrid(el);
}

function drawGrid(el) {
  const q = filter.trim().toLowerCase();
  const items = data.items.filter(i => !q || (i.name + ' ' + (i.brand || '')).toLowerCase().includes(q));
  if (sortMode === 'cheap') items.sort((a, b) => (a.minPrice ?? 1e15) - (b.minPrice ?? 1e15));
  else if (sortMode === 'exp') items.sort((a, b) => (b.minPrice ?? -1) - (a.minPrice ?? -1));
  else items.sort((a, b) => b.addedAt - a.addedAt);
  el.innerHTML = items.length ? `<div class="grid">${items.map((it, i) => `
    <article class="card frost" style="--i:${i}" data-id="${it.id}" tabindex="0">
      ${media(it.image || it.userImage, it.name)}
      <div class="body">
        <h3>${esc(it.name)}</h3>
        <div class="sub">${esc([it.brand, it.offers?.length ? it.offers.length + ' ' + plural(it.offers.length, 'предложение', 'предложения', 'предложений') : ''].filter(Boolean).join(' · '))}</div>
        <div class="foot"><span class="price"><small>от</small>${rub(it.minPrice)}</span></div>
      </div>
    </article>`).join('')}</div>`
    : `<div class="empty">${I.search}<h2>Ничего не найдено</h2><p>Нет хотелок по запросу «${esc(filter)}»</p></div>`;
  el.querySelectorAll('.card[data-id]').forEach(c => {
    c.onclick = () => openItem(c.dataset.id);
    c.onkeydown = e => { if (e.key === 'Enter') openItem(c.dataset.id); };
  });
}

function resetAdd() { Object.assign(add, { image: null, query: '', candidates: null, item: null, loading: false, error: null }); }

// ---------- add: search & choose ----------
function renderAdd(el, tools) {
  if (add.item) return renderDetailView(el, tools);
  if (add.candidates || add.loading) {
    tools.innerHTML = btn('', I.back + 'Новый поиск');
    tools.firstChild.onclick = () => { resetAdd(); rerender(); };
  }
  let html = '<div class="add-wrap">';
  if (!add.candidates && !add.loading) {
    html += `<div class="composer frost">
        <div class="drop" id="drop" tabindex="0" role="button" aria-label="Загрузить фото товара">
          ${add.image ? `<img class="preview" src="${add.image}" alt="">` : `<div class="ico">${I.photo}</div><b>Перетащите фото товара</b><span>или нажмите, чтобы выбрать · Ctrl+V — вставить</span>`}
        </div>
        <div class="bigsearch">${I.search}<input id="q" placeholder="Название: AirPods 4, Dyson V15, Nike Pegasus 41…" value="${esc(add.query)}">${btn('prominent', 'Найти', 'id="go"')}</div>
        <div class="opts">
          <label class="cityf" title="Город для объявлений и самовывоза">${I.pin}<input id="city" list="cities" placeholder="Вся Россия" value="${esc(city())}" spellcheck="false"></label>
          <div id="condSeg"></div>
        </div>
        <datalist id="cities">${CITIES.map(c => `<option value="${c}">`).join('')}</datalist>
      </div>
      <input type="file" id="file" accept="image/*" hidden>`;
  }
  if (add.error) html += `<div class="err">${add.error}</div>`;
  if (add.loading) html += `<div class="loader"><span class="spinner"></span><div>Подбираю варианты…</div></div><div class="cand-grid">${'<div class="skel"></div>'.repeat(4)}</div>`;
  if (add.candidates && !add.loading) {
    html += `<div class="h-section">Выберите подходящий товар</div><div class="h-sub">Цены начнём собирать сразу после выбора</div><div class="cand-grid">` +
      add.candidates.map((c, i) => `<article class="card frost" style="--i:${i}" data-i="${i}" tabindex="0">${media(c.image, c.name)}<div class="body"><h3>${esc(c.name)}</h3><div class="sub">${esc(c.summary || '')}</div><div class="foot"><span class="chip"><span>${esc(c.category || c.brand || 'Товар')}</span></span></div></div></article>`).join('') +
      `</div>`;
    if (!add.candidates.length) html += `<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуйте уточнить название</p></div>`;
  }
  el.innerHTML = html + '</div>';

  const drop = $('#drop');
  if (drop) {
    $('#condSeg').replaceWith(seg([['any', 'Любой'], ['new', 'Новый'], ['used', 'Б/у'], ['discounted', 'Уценка']], add.cond, k => add.cond = k));
    $('#city').onchange = e => setCity(e.target.value).then(() => toast(city() ? 'Город: ' + city() : 'Поиск по всей России'));
    const file = $('#file');
    drop.onclick = () => file.click();
    drop.onkeydown = e => { if (e.key === 'Enter') file.click(); };
    file.onchange = () => file.files[0] && readImg(file.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; f && readImg(f); };
    const q = $('#q');
    q.oninput = () => add.query = q.value;
    q.onkeydown = e => { if (e.key === 'Enter') identify(); };
    $('#go').onclick = identify;
  }
  el.querySelectorAll('.cand-grid .card[data-i]').forEach(c => {
    const pick = () => choose(add.candidates[c.dataset.i]);
    c.onclick = pick; c.onkeydown = e => { if (e.key === 'Enter') pick(); };
  });
}

function readImg(f) {
  if (!f.type.startsWith('image/')) return toast('Нужна картинка');
  const r = new FileReader();
  r.onload = () => shrink(r.result).then(d => { add.image = d; identify(); });
  r.readAsDataURL(f);
}
function shrink(src) {
  return new Promise(res => {
    const im = new Image(); im.onload = () => {
      const k = Math.min(1, 1024 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .85));
    }; im.src = src;
  });
}
document.addEventListener('paste', e => {
  if (view !== 'add' || add.item) return;
  const f = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
  if (f) { e.preventDefault(); readImg(f); }
});

function errText(e) {
  const m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  if (m.includes('NO_KEY')) return 'Не задан API-ключ. Откройте «Настройки» и вставьте ключ любой нейросети.';
  return 'Ошибка: ' + esc(m);
}

async function identify() {
  if (!add.image && !add.query.trim()) return toast('Загрузите фото или введите название');
  add.loading = true; add.error = null; rerender();
  try {
    const r = await api.identify({ query: add.query.trim(), image: add.image });
    add.candidates = r.candidates || [];
  } catch (e) { add.error = errText(e); }
  add.loading = false; rerender();
}

// ---------- progressive search: info + direct site search + AI search, all in parallel ----------
// direct: real marketplace pages in a hidden browser window; ai: web search via the chosen model
const GROUPS = [
  ['avito', 'Авито', 'direct'], ['wb', 'Wildberries', 'direct'], ['ozon', 'Ozon', 'direct'], ['ym', 'Яндекс Маркет', 'direct'],
  ['retail', 'Магазины', 'ai'], ['used', 'Б/у и уценка', 'ai'], ['market', 'Мегамаркет и др.', 'ai']
];
const city = () => (data.settings.city || '').trim();
const avitoSlug = () => data.settings.citySlug || 'rossiya';
const CITIES = ['Вся Россия', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Омск',
  'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар', 'Саратов', 'Тюмень', 'Тольятти', 'Ижевск', 'Барнаул',
  'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Томск', 'Оренбург', 'Кемерово', 'Рязань', 'Астрахань', 'Пенза', 'Липецк', 'Тула',
  'Киров', 'Калининград', 'Сочи', 'Севастополь', 'Симферополь', 'Махачкала', 'Ульяновск', 'Тверь', 'Брянск', 'Белгород', 'Курск', 'Сургут', 'Мурманск'];
async function setCity(v) {
  v = (v || '').trim(); if (/^вся россия$/i.test(v)) v = '';
  data.settings.city = v; data.settings.citySlug = await api.citySlug(v); await persist();
}
const SEARCH_LINKS = q => [
  ['Авито', `https://www.avito.ru/${avitoSlug()}?q=${q}`], ['Ozon', `https://www.ozon.ru/search/?text=${q}`],
  ['Wildberries', `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`], ['Яндекс Маркет', `https://market.yandex.ru/search?text=${q}`],
  ['Мегамаркет', `https://megamarket.ru/catalog/?q=${q}`], ['DNS', `https://www.dns-shop.ru/search/?q=${q}`],
  ['М.Видео', `https://www.mvideo.ru/product-list-page?q=${q}`], ['AliExpress', `https://aliexpress.ru/wholesale?SearchText=${q}`]
];

function startSearch(item, onUpdate) {
  item.status = Object.fromEntries(GROUPS.map(([k]) => [k, 'loading']));
  item.infoLoading = !item.description;
  const fresh = [];
  const merge = () => {
    // suspicious (likely fakes) go to the end, everything else cheapest first
    item.offers = annotate(dedupe(fresh)).sort((a, b) => (a.flags.includes('cheap') - b.flags.includes('cheap')) || a.price - b.price);
    const okOffers = item.offers.filter(o => !o.flags.includes('cheap'));
    const prices = okOffers.map(o => o.price), newP = okOffers.filter(o => condOf(o) === 'new').map(o => o.price);
    item.minPrice = newP.length ? Math.min(...newP) : prices.length ? Math.min(...prices) : null;
    if (!item.image) item.image = item.offers.find(o => /^https:\/\/.+/.test(o.image || ''))?.image || '';
    item.maxPrice = prices.length ? Math.max(...prices) : null;
    item.updatedAt = Date.now();
  };
  const jobs = [];
  if (item.infoLoading) jobs.push(api.info({ name: item.name }).then(r => {
    Object.assign(item, { description: r.description, pros: r.pros || [], cons: r.cons || [], specs: r.specs || [] });
    if (!item.image && /^https:\/\//.test(r.image || '')) { item.image = r.image; onUpdate('image'); }
  }).catch(() => {}).finally(() => { item.infoLoading = false; onUpdate('info'); }));
  const cityNow = city();
  item.city = cityNow;
  const addOffers = (g, list) => { fresh.push(...list.filter(o => o.price > 0).map(o => ({ ...o, price: Number(o.price), group: g }))); merge(); };
  const runGroup = (g, kind) => {
    item.status[g] = 'loading';
    if (kind === 'direct') return api.scrape({ site: g, query: item.name, city: cityNow }).then(r => {
      if (r.blocked) { item.status[g] = 'blocked'; return; }
      addOffers(g, r.offers || []); item.status[g] = 'done';
    });
    return api.offers({ name: item.name, group: g, city: cityNow }).catch(() => api.offers({ name: item.name, group: g, city: cityNow }))
      .then(r => { addOffers(g, r.offers || []); item.status[g] = 'done'; });
  };
  item.retry = g => {
    const kind = GROUPS.find(x => x[0] === g)[2];
    const p = runGroup(g, kind).catch(e => { item.status[g] = 'error'; item.lastError = errText(e); }).finally(() => onUpdate('offers'));
    onUpdate('offers'); return p;
  };
  for (const [g, , kind] of GROUPS) jobs.push(runGroup(g, kind)
    .catch(e => { item.status[g] = 'error'; item.lastError = errText(e); }).finally(() => onUpdate('offers')));
  return Promise.all(jobs).then(() => { if (!fresh.length && item.prevOffers) item.offers = item.prevOffers; });
}

function choose(c) {
  const item = { id: crypto.randomUUID(), name: c.name, brand: c.brand, category: c.category, image: c.image || '', userImage: add.image, offers: [], pros: [], cons: [], specs: [] };
  add.item = item; add.filter = add.cond;
  rerender();
  startSearch(item, part => { if (add.item === item && view === 'add') updateDetail($('#view'), item, add); });
}

// detail markup with stable slots so progressive updates never re-render the whole screen
function detailHTML(it) {
  return `<div class="detail">
    <div class="hero frost">
      <div data-slot="media">${media(it.image || it.userImage, it.name)}</div>
      <div class="body">
        <h2>${esc(it.name)}</h2>
        <div class="meta">${esc([it.brand, it.category].filter(Boolean).join(' · '))}</div>
        <div class="meta">${I.pin.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px;fill:none;stroke:currentColor;stroke-width:2"')} ${esc(it.city || city() || 'Вся Россия')}</div>
        <div class="range" data-slot="range"></div>
        <div data-slot="actions"></div>
      </div>
    </div>
    <div>
      <section class="panel frost">
        <div class="panel-h"><h4>Цены</h4><div data-slot="filter"></div></div>
        <div class="sources" data-slot="sources"></div>
        <div class="rows" data-slot="offers"></div>
        <div class="note">${I.shield}<span>Показываем только предложения с оплатой в рублях. Отмечаем незнакомые сайты и подозрительно низкие цены. На Авито пользуйтесь «Авито Доставкой» и не переводите предоплату на карту.</span></div>
      </section>
      <section class="panel frost">
        <div class="panel-h"><h4>Искать самостоятельно</h4></div>
        <div class="links">${SEARCH_LINKS(encodeURIComponent(it.name)).map(([n, u]) => `<button class="btn" data-url="${esc(u)}">${n}</button>`).join('')}</div>
      </section>
      <section class="panel frost" data-slot="info"></section>
    </div>
  </div>`;
}

function updateDetail(root, it, state) {
  const slot = n => root.querySelector(`[data-slot="${n}"]`);
  if (!slot('range')) return;
  const m = slot('media'), src = it.image || it.userImage || '';
  if (m.dataset.src !== src) { m.dataset.src = src; m.innerHTML = media(src, it.name); }
  const ok = (it.offers || []).filter(o => !o.flags?.includes('cheap'));
  const minOf = c => { const p = ok.filter(o => matchCond(o, c)).map(o => o.price); return p.length ? Math.min(...p) : null; };
  const rows = [['new', 'Новый от'], ['used', 'Б/у от'], ['discounted', 'Уценка от']].map(([c, l]) => [l, minOf(c)]).filter(([, v]) => v != null);
  slot('range').innerHTML = (rows.length ? rows : [['Цена от', null]]).map(([l, v], i) =>
    `<div class="r"><span>${l}</span><span class="price big ${i === 0 && v != null ? 'best' : ''}">${rub(v)}</span></div>`).join('')
    + (it.maxPrice != null ? `<div class="r"><span>Самая высокая</span><span class="price">${rub(it.maxPrice)}</span></div>` : '');
  slot('sources').innerHTML = GROUPS.map(([k, l]) => {
    const st = it.status?.[k], n = (it.offers || []).filter(o => o.group === k).length;
    return st === 'loading' ? `<span class="chip"><span class="spinner s"></span>${l}</span>`
      : st === 'error' ? `<button class="chip bad" data-retry="${k}" title="${esc(it.lastError || '')} — нажмите, чтобы повторить">${I.refresh}${l}</button>`
      : st === 'blocked' ? `<button class="chip warn" data-verify="${k}" title="Площадка просит проверку (капча или VPN). Нажмите, пройдите проверку в открывшемся окне и закройте его.">${I.warn}${l}: пройти проверку</button>`
      : st === 'done' ? `<span class="chip ${n ? 'good' : ''}">${n ? I.ok : I.minus}${l} · ${n}</span>` : '';
  }).join('');
  slot('sources').querySelectorAll('[data-retry]').forEach(b => b.onclick = () => it.retry?.(b.dataset.retry));
  slot('sources').querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => {
    toast('Пройдите проверку в окне и закройте его');
    await api.verify({ site: b.dataset.verify, query: it.name, city: it.city || city() });
    it.retry?.(b.dataset.verify);
  });

  // filter control: built once, counts refreshed
  const counts = Object.fromEntries(COND_FILTERS.map(([k]) => [k, (it.offers || []).filter(o => matchCond(o, k)).length]));
  const f = slot('filter');
  if (!f.firstChild) f.append(seg(COND_FILTERS.map(([k, l]) => [k, l]), state.filter || 'any', k => { state.filter = k; drawOffers(); }));
  f.querySelectorAll('.seg button').forEach(b => { const [, l] = COND_FILTERS.find(x => x[0] === b.dataset.k); b.innerHTML = `${l}<small>${counts[b.dataset.k]}</small>`; });
  f.firstChild.place?.();

  function drawOffers() {
    const list = (it.offers || []).filter(o => matchCond(o, state.filter || 'any'));
    const loading = Object.values(it.status || {}).some(s => s === 'loading');
    const el = slot('offers');
    const shown = new Set([...el.querySelectorAll('.offer')].map(r => r.dataset.k));
    el.innerHTML = list.map((o, i) => {
      const k = o.url || o.store + o.price;
      const tags = [`<span class="chip">${COND[condOf(o)]}</span>`];
      if (o.host && !o.flags.includes('unknown')) tags.push(`<span class="chip good">${I.shield}${esc(shortHost(o.host))}</span>`);
      if (o.flags.includes('unknown')) tags.push(`<span class="chip warn">${I.warn}Незнакомый сайт · ${esc(o.host)}</span>`);
      if (o.flags.includes('cheap')) tags.push(`<span class="chip bad">${I.warn}Подозрительно дёшево</span>`);
      if (o.place) {
        const near = it.city && o.place.toLowerCase().includes(it.city.toLowerCase());
        tags.push(`<span class="chip ${near ? 'info' : ''}">${I.pin}<span>${esc(o.place)}</span></span>`);
      }
      if (o.date) tags.push(`<span class="chip"><span>${esc(o.date)}</span></span>`);
      if (o.note) tags.push(`<span class="chip"><span>${esc(o.note)}</span></span>`);
      return `<div class="row offer" style="--i:${shown.has(k) ? 0 : i}; ${shown.has(k) ? 'animation:none' : ''}" data-k="${esc(k)}" data-url="${esc(o.url)}" role="link" tabindex="0">
        <div class="s"><b>${esc(o.store)}${o.seller && o.seller !== o.store && !/не указ|unknown|—/i.test(o.seller) ? ` <span style="color:var(--label2);font-weight:400">· ${esc(o.seller)}</span>` : ''}</b><div class="tags">${tags.join('')}</div></div>
        <span class="price ${i === 0 && !o.flags.includes('cheap') ? 'best' : ''}" ${o.flags.includes('cheap') ? 'style="opacity:.6"' : ''}>${rub(o.price)}</span>${o.url ? I.chev : '<span style="width:14px"></span>'}
      </div>`;
    }).join('') + (loading ? '<div class="skel row"></div>'.repeat(list.length ? 1 : 3) : '')
      + (!loading && !list.length ? `<div class="none">${(it.offers || []).length ? 'Нет предложений в этой категории.' : 'Предложений не нашлось — попробуйте поиск по площадкам ниже.'}</div>` : '');
    el.querySelectorAll('.offer[data-url]').forEach(o => o.onclick = () => o.dataset.url && api.open(o.dataset.url));
  }
  drawOffers();

  const info = slot('info');
  if (it.infoLoading) info.innerHTML = `<div class="panel-h"><h4>О товаре</h4></div>${'<div class="skel line"></div>'.repeat(4)}`;
  else if (it.description || it.pros?.length) info.innerHTML = `<div class="panel-h"><h4>О товаре</h4></div>
    ${it.description ? `<p class="text">${esc(it.description)}</p>` : ''}
    ${it.specs?.length ? `<dl class="specs">${it.specs.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : ''}
    <div class="pc"><div><h5>Плюсы</h5><ul class="pros">${(it.pros || []).map(p => `<li>${I.ok}<span>${esc(p)}</span></li>`).join('')}</ul></div>
      <div><h5>Минусы</h5><ul class="cons">${(it.cons || []).map(p => `<li>${I.minus}<span>${esc(p)}</span></li>`).join('')}</ul></div></div>`;
  else info.style.display = 'none';
}

function wireLinks(root) { root.querySelectorAll('.links [data-url]').forEach(b => b.onclick = () => api.open(b.dataset.url)); }

function renderDetailView(el, tools) {
  tools.innerHTML = btn('', I.back + 'К вариантам');
  tools.firstChild.onclick = () => { add.item = null; rerender(); };
  const it = add.item;
  el.innerHTML = detailHTML(it);
  wireLinks(el);
  updateDetail(el, it, add);
  const exists = data.items.some(i => i.name === it.name);
  const box = el.querySelector('[data-slot="actions"]');
  box.innerHTML = btn('prominent big', exists ? I.ok + 'Уже в хотелках' : I.plus + 'Добавить в хотелки');
  const a = box.firstChild; a.disabled = exists;
  a.onclick = async () => {
    // keep the live object so offers still arriving land in the saved item
    it.addedAt = Date.now(); data.items.push(it); await persist();
    a.disabled = true; a.innerHTML = I.ok + 'Добавлено';
    toast('Добавлено в хотелки — цены продолжают загружаться');
    const save = setInterval(() => { persist(); if (!Object.values(it.status || {}).includes('loading')) clearInterval(save); }, 3000);
  };
}

// ---------- saved item sheet ----------
const sheetState = { filter: 'any' };
function openItem(id) {
  const it = data.items.find(i => i.id === id);
  const s = $('#sheetBody');
  sheetState.filter = 'any'; sheetState.id = id;
  s.innerHTML = `<div class="sheet-head">
      <div class="group lg lg-clear" data-lens="999">
        <button class="icon-btn" id="mRefresh" aria-label="Обновить цены" title="Обновить цены">${I.refresh}</button>
        <button class="icon-btn" id="mDel" aria-label="Удалить" title="Удалить" style="color:var(--red)">${I.trash}</button>
      </div>
      <div class="group lg lg-clear" data-lens="999"><button class="icon-btn" id="mClose" aria-label="Закрыть" title="Закрыть">${I.close}</button></div>
    </div>` + detailHTML(it);
  wireLinks(s);
  if (!it.offers?.[0]?.flags) it.offers = annotate(it.offers || []);
  updateDetail(s, it, sheetState);
  s.querySelector('[data-slot="actions"]').innerHTML = `<div style="color:var(--label2);font-size:12px;text-align:center">Обновлено ${new Date(it.updatedAt || it.addedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>`;
  $('#sheet').classList.add('open');
  $('#mClose').onclick = closeSheet;
  $('#mDel').onclick = async () => { data.items = data.items.filter(i => i.id !== id); await persist(); closeSheet(); rerender(); toast('Удалено'); };
  $('#mRefresh').onclick = async () => {
    it.prevOffers = it.offers; it.offers = [];
    const done = startSearch(it, () => { if (sheetState.id === id) updateDetail(s, it, sheetState); });
    updateDetail(s, it, sheetState);
    await done; delete it.prevOffers; await persist(); render(); toast('Цены обновлены');
  };
}
function closeSheet() { $('#sheet').classList.remove('open'); sheetState.id = null; }
$('#sheet').onclick = e => e.target.id === 'sheet' && closeSheet();

// ---------- settings ----------
const PROV = [
  ['auto', 'Авто (по ключу)', ''],
  ['anthropic', 'Anthropic Claude', 'claude-sonnet-5-5'],
  ['openai', 'OpenAI', 'gpt-5'],
  ['gemini', 'Google Gemini', 'gemini-2.5-flash'],
  ['openrouter', 'OpenRouter', 'google/gemini-2.5-flash'],
  ['perplexity', 'Perplexity', 'sonar-pro'],
  ['codex', 'Codex (codexapi.work)', 'самая быстрая доступная'],
  ['custom', 'Свой (OpenAI-совместимый)', '']
];
function detectProv(k) {
  k = k.trim(); if (!k) return null;
  return k.startsWith('sk-ant-') ? 'anthropic' : k.startsWith('sk-or-') ? 'openrouter' : k.startsWith('pplx-') ? 'perplexity' : k.startsWith('AIza') ? 'gemini' : 'openai';
}
function renderSettings(el) {
  const s = data.settings;
  el.innerHTML = `<div class="form">
    <div class="h-section" style="margin-top:0">Нейросеть для поиска</div>
    <div class="frost" style="margin:10px 0 0">
      <div class="field"><label for="p">Провайдер</label><select id="p">${PROV.map(([v, l]) => `<option value="${v}" ${(s.provider || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="k">API-ключ</label><input id="k" type="password" spellcheck="false" placeholder="sk-…, AIza…, sk-or-…" value="${esc(s.apiKey || '')}"></div>
      <div class="field"><label for="m">Модель</label><input id="m" list="mlist" spellcheck="false" value="${esc(s.provider ? s.model || '' : '')}"></div>
      <div class="field" id="urlRow"><label for="u">Base URL</label><input id="u" spellcheck="false" value="${esc(s.baseUrl || '')}"></div>
    </div>
    <datalist id="mlist"></datalist>
    <p class="hint" id="hint"></p>
    ${btn('prominent', 'Сохранить', 'id="save"')}
  </div>`;
  const P = $('#p'), K = $('#k'), M = $('#m');
  const sync = () => {
    const prov = P.value === 'auto' ? detectProv(K.value) : P.value;
    const def = PROV.find(x => x[0] === prov)?.[2] || '';
    M.placeholder = def ? 'По умолчанию: ' + def : 'Название модели';
    $('#urlRow').style.display = P.value === 'custom' || P.value === 'codex' ? '' : 'none';
    $('#u').placeholder = P.value === 'codex' ? 'https://codexapi.work/backend-api/codex' : 'https://api.example.com/v1';
    $('#hint').innerHTML = (P.value === 'auto' && prov ? `Определён провайдер: <b>${PROV.find(x => x[0] === prov)[1]}</b>. ` : '') +
      ({ custom: 'Любой OpenAI-совместимый API (Groq, DeepSeek, Mistral, LM Studio, Ollama…). Без веб-поиска цены будут неточными.',
         codex: 'Codex backend. Адрес можно не указывать. По умолчанию выбирается самая быстрая доступная модель.',
         perplexity: 'Perplexity ищет в интернете сам — хорошо подходит для цен.',
         openrouter: 'Для поиска цен к модели добавляется :online — веб-поиск.' }[prov] ||
       'Цены ищутся через встроенный веб-поиск провайдера.') + ' Ключ хранится только на этом компьютере.';
  };
  const loadModels = async () => {
    const prov = P.value === 'auto' ? detectProv(K.value) : P.value;
    $('#mlist').innerHTML = '';
    if (prov !== 'codex' || !K.value.trim()) return;
    const list = await api.codexModels({ base: $('#u').value.trim(), key: K.value.trim() });
    $('#mlist').innerHTML = list.map(m => `<option value="${esc(m)}">`).join('');
  };
  P.onchange = () => { sync(); loadModels(); }; K.oninput = sync; K.onchange = loadModels;
  sync(); loadModels();
  $('#save').onclick = async () => {
    data.settings = { provider: P.value, apiKey: K.value.trim(), model: M.value.trim(), baseUrl: $('#u').value.trim() };
    await persist(); toast('Сохранено');
  };
}

// ---------- boot ----------
(async () => {
  data = await api.getData();
  data.items ||= []; data.settings ||= {};
  // a search interrupted by closing the app must not leave spinners forever
  for (const it of data.items) for (const k in it.status || {}) if (it.status[k] === 'loading') delete it.status[k];
  $('#count').textContent = data.items.length || '';
  view = data.settings.apiKey ? 'list' : 'settings';
  document.querySelectorAll('.nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  movePill(); render();
  addEventListener('resize', () => { pillY = null; movePill(); });
})();
