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
const ARROW = '<span class="arr"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
const btn = (cls, html, attrs = '') => `<button class="btn lg lg-clear ${cls}" data-lens="999" ${attrs}>${html}</button>`;

let data = { items: [], settings: {} };
let view = 'list', sortMode = 'date', filter = '', doneFilter = 'active';
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


// nav selection: a droplet that stretches toward its target, then settles
// tab selection: the pill slides under the active tab
function movePill() {
  const a = document.querySelector('.nav .nav-btn.active'), pill = $('.nav-pill');
  if (!a) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1;
  pill.style.transform = `translateX(${a.offsetLeft}px)`;
  pill.style.width = a.offsetWidth + 'px';
}
let pillY = null;

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

// ---------- server: all wishlist data, search and AI live there ----------
async function srv(method, path, body) {
  const r = await api.srv({ method, path, body, token: data.settings.token });
  if (r.status === 401 && path !== '/auth/poll') { await logout(true); throw new Error('Сессия истекла, войдите снова'); }
  if (r.status >= 400 || r.status === 0) throw new Error(r.body?.error || 'Сервер недоступен');
  return r.body;
}
async function loadItems() {
  try { data.items = await srv('GET', '/items'); await persist(); } catch (e) { if (!data.settings.token) return; toast(errText(e)); }
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
  if (view === 'list') { $('#title').innerHTML = '<span class="eyebrow gold">хотелкино ✦</span>Мои хотелки'; renderList(el, tools); }
  else if (view === 'add') { $('#title').textContent = add.item ? 'Товар' : 'Новая хотелка'; renderAdd(el, tools); }
  else { $('#title').textContent = 'Профиль'; renderSettings(el); }
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
    el.innerHTML = `<div class="empty">${I.heart}<h2>Хотелок пока нет</h2><p>Добавьте товар по фото или по названию —<br>найдём цены в российских магазинах и на Авито.</p>${btn('prominent big arrow', 'Добавить хотелку' + ARROW)}</div>`;
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

// headline numbers: total of active wishes (cheapest offer each), fulfilled count
function summaryHTML() {
  const active = data.items.filter(i => !i.done), done = data.items.length - active.length;
  const total = active.reduce((s, i) => s + (i.minPrice || 0), 0);
  return `<div class="summary">
    <div><span class="eyebrow">всё вместе от</span><b>${rub(total)}</b></div>
    <div><span class="eyebrow">активных</span><b class="w">${active.length}</b></div>
    <div><span class="eyebrow">исполнено</span><b class="w">${done} <span class="ok">✓</span></b></div>
  </div>`;
}

function drawGrid(el) {
  const q = filter.trim().toLowerCase();
  const items = data.items.filter(i => (!q || (i.name + ' ' + (i.brand || '')).toLowerCase().includes(q))
    && (doneFilter === 'all' || (doneFilter === 'done') === !!i.done));
  if (sortMode === 'cheap') items.sort((a, b) => (a.minPrice ?? 1e15) - (b.minPrice ?? 1e15));
  else if (sortMode === 'exp') items.sort((a, b) => (b.minPrice ?? -1) - (a.minPrice ?? -1));
  else items.sort((a, b) => b.addedAt - a.addedAt);
  el.innerHTML = summaryHTML() + '<div id="doneSeg" class="done-seg"></div>' + (items.length ? `<div class="grid">${items.map((it, i) => `
    <article class="card frost ${it.done ? 'is-done' : ''}" style="--i:${i}" data-id="${it.id}" tabindex="0">
      <div style="position:relative">${media(it.image || it.userImage, it.name)}${it.done ? '<span class="count done">✓ ИСПОЛНЕНО</span>' : it.offers?.length ? `<span class="count">${it.offers.length} ПРЕДЛ.</span>` : ''}</div>
      <div class="body">
        <span class="eyebrow ebrand">${esc(it.brand || 'товар')}</span>
        <h3>${esc(it.name)}</h3>
        <div class="foot"><span class="price"><small>от&nbsp;</small>${rub(it.minPrice)}</span></div>
      </div>
    </article>`).join('')}</div>`
    : `<div class="empty">${I.search}<h2>${doneFilter === 'done' && !q ? 'Пока ничего не исполнено' : 'Ничего не найдено'}</h2><p>${doneFilter === 'done' && !q ? 'Отмечайте хотелки исполненными в карточке товара.' : `Нет хотелок по запросу «${esc(filter)}»`}</p></div>`);
  const cnt = k => data.items.filter(i => k === 'all' || (k === 'done') === !!i.done).length;
  $('#doneSeg').append(seg([['active', `Активные<small>${cnt('active')}</small>`], ['done', `Исполненные<small>${cnt('done')}</small>`], ['all', `Все<small>${cnt('all')}</small>`]], doneFilter, k => { doneFilter = k; drawGrid(el); }));
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
      add.candidates.map((c, i) => `<article class="card frost" style="--i:${i}" data-i="${i}" tabindex="0">${media(c.image, c.name)}<div class="body"><span class="eyebrow ebrand">${esc([c.brand, c.category].filter(Boolean).join(' · ') || 'товар')}</span><h3>${esc(c.name)}</h3><div class="sub">${esc(c.summary || '')}</div><div class="foot"><span class="chip"><span>${esc(c.category || c.brand || 'Товар')}</span></span></div></div></article>`).join('') +
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
  return 'Ошибка: ' + esc(m);
}

async function identify() {
  if (!add.image && !add.query.trim()) return toast('Загрузите фото или введите название');
  add.loading = true; add.error = null; rerender();
  try {
    const r = await srv('POST', '/identify', { query: add.query.trim(), image: add.image });
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
  srv('PUT', '/me', { city: v }).catch(() => {});
}
const SEARCH_LINKS = q => [
  ['Авито', `https://www.avito.ru/${avitoSlug()}?q=${q}`], ['Ozon', `https://www.ozon.ru/search/?text=${q}`],
  ['Wildberries', `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`], ['Яндекс Маркет', `https://market.yandex.ru/search?text=${q}`],
  ['Мегамаркет', `https://megamarket.ru/catalog/?q=${q}`], ['DNS', `https://www.dns-shop.ru/search/?q=${q}`],
  ['М.Видео', `https://www.mvideo.ru/product-list-page?q=${q}`], ['AliExpress', `https://aliexpress.ru/wholesale?SearchText=${q}`]
];

// the server runs the search (direct marketplaces + AI); we poll its job and mirror it into the item
function applyJob(item, j) {
  Object.assign(item, { jobId: j.id, status: j.status, offers: j.offers, city: j.city,
    minPrice: j.minPrice, minNew: j.minNew, minUsed: j.minUsed, minDiscounted: j.minDiscounted, maxPrice: j.maxPrice, infoLoading: !j.infoDone });
  if (j.info) Object.assign(item, { description: j.info.description, pros: j.info.pros || [], cons: j.info.cons || [], specs: j.info.specs || [] });
  if (!item.image && j.image) item.image = j.image;
}
async function pollJob(item, job, onUpdate) {
  applyJob(item, job); onUpdate();
  while (!job.done) {
    await new Promise(r => setTimeout(r, 1500));
    try { job = await srv('GET', '/search/' + job.id); } catch (e) { item.lastError = errText(e); break; }
    applyJob(item, job); onUpdate();
  }
  return job;
}
async function startSearch(item, onUpdate) {
  item.status = Object.fromEntries(GROUPS.map(([k]) => [k, 'loading']));
  item.infoLoading = !item.description;
  onUpdate();
  try { return await pollJob(item, await srv('POST', '/search', { name: item.name, city: city() }), onUpdate); }
  catch (e) { item.status = Object.fromEntries(GROUPS.map(([k]) => [k, 'error'])); item.lastError = errText(e); item.infoLoading = false; onUpdate(); }
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
        <div class="meta">${esc([it.brand, it.category].filter(Boolean).join(' · ') || 'товар')}</div>
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
    `<div class="r"><span>${l}</span><span class="price big">${rub(v)}</span></div>`).join('')
    + (it.maxPrice != null ? `<div class="r"><span>Самая высокая</span><span class="price">${rub(it.maxPrice)}</span></div>` : '');
  slot('sources').innerHTML = GROUPS.map(([k, l]) => {
    const st = it.status?.[k], n = (it.offers || []).filter(o => o.group === k).length;
    return st === 'loading' ? `<span class="chip"><span class="spinner s"></span>${l}</span>`
      : st === 'error' ? `<span class="chip bad" title="${esc(it.lastError || '')}">${I.warn}${l}</span>`
      : st === 'blocked' ? `<span class="chip warn" title="Площадка не пустила сервер (капча/антибот). Откройте её кнопкой ниже.">${I.warn}${l}: недоступно</span>`
      : st === 'done' ? `<span class="chip ${n ? 'good' : ''}">${n ? I.ok : I.minus}${l} · ${n}</span>` : '';
  }).join('');
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
  box.innerHTML = exists ? btn('light big', I.ok + 'Уже в хотелках') : btn('prominent big arrow', 'Добавить в хотелки' + ARROW);
  const a = box.firstChild; a.disabled = exists;
  a.onclick = async () => {
    if (!it.jobId) return toast('Подождите, поиск ещё запускается');
    a.disabled = true;
    try {
      // the server keeps filling the saved item while the search is still running
      const saved = await srv('POST', '/items', { jobId: it.jobId, brand: it.brand, category: it.category, image: it.image });
      data.items.unshift(saved); await persist();
      a.innerHTML = I.ok + 'Добавлено'; a.className = a.className.replace('prominent', 'light').replace(' arrow', '');
      toast('Добавлено в хотелки — цены продолжают загружаться');
    } catch (e) { a.disabled = false; toast(errText(e)); }
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
        <button class="icon-btn" id="mDone" aria-label="${it.done ? 'Вернуть в хотелки' : 'Отметить исполненной'}" title="${it.done ? 'Вернуть в хотелки' : 'Исполнено!'}" style="${it.done ? 'color:var(--green)' : ''}">${I.ok}</button>
        <button class="icon-btn" id="mRefresh" aria-label="Обновить цены" title="Обновить цены">${I.refresh}</button>
        <button class="icon-btn" id="mDel" aria-label="Удалить" title="Удалить" style="color:var(--red)">${I.trash}</button>
      </div>
      <div class="group lg lg-clear" data-lens="999"><button class="icon-btn" id="mClose" aria-label="Закрыть" title="Закрыть">${I.close}</button></div>
    </div>` + detailHTML(it);
  wireLinks(s);
  updateDetail(s, it, sheetState);
  s.querySelector('[data-slot="actions"]').innerHTML = `<div style="color:var(--label2);font-size:12px;text-align:center">Обновлено ${new Date(it.updatedAt || it.addedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>`;
  $('#sheet').classList.add('open');
  $('#mClose').onclick = closeSheet;
  $('#mDone').onclick = async () => {
    try {
      const upd = await srv('PUT', '/items/' + id, { done: !it.done });
      Object.assign(it, { done: upd.done, doneAt: upd.doneAt }); await persist();
      closeSheet(); rerender(); toast(upd.done ? 'Исполнено! ✦' : 'Вернул в хотелки');
    } catch (e) { toast(errText(e)); }
  };
  $('#mDel').onclick = async () => {
    try { await srv('DELETE', '/items/' + id); } catch (e) { return toast(errText(e)); }
    data.items = data.items.filter(i => i.id !== id); await persist(); closeSheet(); rerender(); toast('Удалено');
  };
  $('#mRefresh').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.style.animation = 'spin 1s linear infinite';
    try {
      const job = await srv('POST', `/items/${id}/refresh`);
      await pollJob(it, job, () => { if (sheetState.id === id) updateDetail(s, it, sheetState); });
      await loadItems(); render(); toast('Цены обновлены');
    } catch (err) { toast(errText(err)); }
    b.disabled = false; b.style.animation = '';
  };
}
function closeSheet() { $('#sheet').classList.remove('open'); sheetState.id = null; }
$('#sheet').onclick = e => e.target.id === 'sheet' && closeSheet();

// ---------- account ----------
function renderSettings(el) {
  const u = data.settings.user || {};
  el.innerHTML = `<div class="form">
    <div class="frost account">
      <div class="avatar">${esc((u.name || u.username || '?').trim()[0]?.toUpperCase())}</div>
      <div class="who"><b>${esc(u.name || 'Пользователь')}</b><span>${u.username ? '@' + esc(u.username) + ' · ' : ''}Telegram</span></div>
      ${btn('', 'Выйти', 'id="logout"')}
    </div>
    <div class="h-section">Поиск</div>
    <div class="frost" style="margin-top:10px">
      <div class="field"><label for="c2">Город</label><input id="c2" list="cities2" placeholder="Вся Россия" value="${esc(city())}" spellcheck="false"></div>
    </div>
    <datalist id="cities2">${CITIES.map(c => `<option value="${c}">`).join('')}</datalist>
    <p class="hint">Объявления Авито ищутся в этом городе, а нейросеть учитывает самовывоз и доставку. Город общий с ботом.</p>
    <div class="h-section">Телеграм-бот</div>
    <p class="hint" style="margin-top:8px">Хотелки общие для бота, Windows и Android. В боте можно просто написать название товара или прислать фото.</p>
    ${btn('', 'Открыть @' + esc(data.settings.bot || 'hotelkinobot'), 'id="openBot"')}
  </div>`;
  $('#c2').onchange = e => setCity(e.target.value).then(() => toast(city() ? 'Город: ' + city() : 'Поиск по всей России'));
  $('#logout').onclick = () => logout();
  $('#openBot').onclick = () => api.open('https://t.me/' + (data.settings.bot || 'hotelkinobot'));
}

// ---------- login via Telegram bot ----------
let loginPoll = null;
function showLogin() {
  document.body.classList.add('signed-out');
  $('#login').innerHTML = `<div class="login-card frost">
      <div class="login-logo"><span class="mark">✦</span></div>
      <h1>хотелкино ✦︎</h1>
      <p>Список желаний и лучшие цены<br>на Авито, Ozon, WB и в магазинах</p>
      <button class="tg-btn" id="tgLogin"><svg viewBox="0 0 24 24"><path d="M21.5 4.5 2.9 11.7c-1 .4-1 1.7.1 2l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.9 3.6c.7.5 1.7.1 1.9-.7l3.2-15c.2-1.1-.8-1.9-1.8-1.5zM9.6 14.6l-.6 4-1.5-4.7 10.3-6.5z"/></svg><span>Войти через Telegram</span><span class="arr"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
      <div class="login-wait" id="wait" hidden><span class="spinner s"></span><span>Подтвердите вход в боте — Telegram уже открыт</span></div>
      <small>Откроется бот <b>@${esc(data.settings.bot || 'hotelkinobot')}</b> — нажмите в нём «Войти».<br>Хотелки будут общими для бота, компьютера и телефона.</small>
    </div>`;
  $('#tgLogin').onclick = startLogin;
}
async function startLogin() {
  const b = $('#tgLogin'); b.disabled = true;
  try {
    const r = await srv('POST', '/auth/start', { device: 'Windows' });
    data.settings.bot = r.bot;
    api.open(r.url);
    $('#wait').hidden = false;
    clearInterval(loginPoll);
    const until = Date.now() + r.expiresIn * 1000;
    loginPoll = setInterval(async () => {
      if (Date.now() > until) { clearInterval(loginPoll); b.disabled = false; $('#wait').hidden = true; return toast('Время вышло, попробуйте ещё раз'); }
      const p = await srv('GET', '/auth/poll?code=' + r.code).catch(() => null);
      if (p?.status === 'ok') {
        clearInterval(loginPoll);
        Object.assign(data.settings, { token: p.token, user: p.user, city: p.user.city || '' });
        data.settings.citySlug = await api.citySlug(data.settings.city);
        await persist(); enterApp(); toast('Привет, ' + (p.user.name || 'друг') + '!');
      }
    }, 2000);
  } catch (e) { b.disabled = false; toast(errText(e)); }
}
async function logout(expired) {
  if (!expired) await srv('POST', '/auth/logout').catch(() => {});
  data = { items: [], settings: { bot: data.settings.bot } };
  await persist(); showLogin();
  if (expired) toast('Войдите снова');
}
async function enterApp() {
  document.body.classList.remove('signed-out');
  view = 'list';
  document.querySelectorAll('.nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  movePill(); render();
  await loadItems(); if (view === 'list') render();
  srv('GET', '/me').then(u => { data.settings.user = u; data.settings.bot = u.bot; if ((u.city || '') !== city()) setCity(u.city); }).catch(() => {});
}

// ---------- boot ----------
(async () => {
  data = await api.getData();
  data.items ||= []; data.settings ||= {};
  $('#count').textContent = data.items.length || '';
  addEventListener('resize', () => { pillY = null; movePill(); });
  if (data.settings.token) enterApp(); else showLogin();
})();
