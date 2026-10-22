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
  truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
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
    <div><span class="eyebrow">всё вместе от</span><b class="count-up" data-to="${total}">${rub(0)}</b></div>
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
      <div style="position:relative">${media(it.image || it.userImage, it.name)}${it.done ? '<span class="count done">✓ ИСПОЛНЕНО</span>' : it.insights?.atTarget ? '<span class="count done">🎯 ЦЕЛЬ</span>' : it.offers?.length ? `<span class="count">${it.offers.length} ПРЕДЛ.</span>` : ''}</div>
      <div class="body">
        <span class="eyebrow ebrand">${esc(it.brand || 'товар')}</span>
        <h3>${esc(it.name)}</h3>
        <div class="foot"><span class="price"><small>от&nbsp;</small>${rub(it.minPrice)}</span></div>
      </div>
    </article>`).join('')}</div>`
    : `<div class="empty">${I.search}<h2>${doneFilter === 'done' && !q ? 'Пока ничего не исполнено' : 'Ничего не найдено'}</h2><p>${doneFilter === 'done' && !q ? 'Отмечайте хотелки исполненными в карточке товара.' : `Нет хотелок по запросу «${esc(filter)}»`}</p></div>`);
  const cnt = k => data.items.filter(i => k === 'all' || (k === 'done') === !!i.done).length;
  el.querySelectorAll('.count-up').forEach(b => countUp(b, +b.dataset.to));
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
          <label class="cityf" title="Город для объявлений и самовывоза">${I.pin}<input id="city" placeholder="Вся Россия" value="${esc(city())}" spellcheck="false" autocomplete="off"></label>
          <div id="condSeg"></div>
        </div>

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
    cityPicker($('#city'));
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
  ['avito', 'Авито', 'direct'], ['wb', 'Wildberries', 'direct'], ['ozon', 'Ozon', 'direct'], ['ym', 'Яндекс Маркет', 'direct'], ['ali', 'AliExpress', 'direct'],
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
  // long poll: the server holds the request until there is news, one round trip per update
  let fails = 0;
  while (!job.done) {
    try { job = await srv('GET', `/search/${job.id}?after=${job.rev || 0}&wait=20`); fails = 0; }
    catch (e) {
      if (++fails >= 3) { item.lastError = errText(e); break; }
      await new Promise(r => setTimeout(r, 2000)); continue;
    }
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
        <div data-slot="insights"></div>
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
    `<div class="r"><span>${l}</span><span class="price big" ${i === 0 && v != null ? `data-to="${v}"` : ''}>${i === 0 && v != null ? (slot('range').querySelector('[data-to]')?.textContent || rub(0)) : rub(v)}</span></div>`).join('')
    + (it.maxPrice != null ? `<div class="r"><span>Самая высокая</span><span class="price">${rub(it.maxPrice)}</span></div>` : '');
  const mainPrice = slot('range').querySelector('[data-to]');
  if (mainPrice) { mainPrice.dataset.v = slot('range').dataset.v || 0; countUp(mainPrice, +mainPrice.dataset.to); slot('range').dataset.v = mainPrice.dataset.to; }
  // don't wipe the target input while the user is typing in it
  if (slot('insights') && it.id && data.items.some(i => i.id === it.id) && !slot('insights').contains(document.activeElement)) slot('insights').innerHTML = insightsHTML(it);
  slot('insights')?.querySelector('#tSave')?.addEventListener('click', () => saveTarget(it, root, state));
  slot('insights')?.querySelector('#tInput')?.addEventListener('focus', e => e.target.select());
  slot('insights')?.querySelector('#tInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveTarget(it, root, state); });
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
      if (o.delivery) tags.push(`<span class="chip ship">${I.truck}<span>${esc(o.delivery)}</span></span>`);
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
  else if (it.description || it.pros?.length) {
    if (info.dataset.sig === (it.description || '') + (it.specs || []).length) return;
    info.dataset.sig = (it.description || '') + (it.specs || []).length;
    info.innerHTML = `<div class="panel-h"><span class="eyebrow gold">о товаре</span></div>
    ${it.description ? `<p class="lead">${esc(it.description)}</p>` : ''}
    ${it.specs?.length ? `<div class="spec-grid">${it.specs.map(([a, b], i) => `<div class="spec" style="--i:${i}"><span class="eyebrow">${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>` : ''}
    <div class="pc2">
      <div class="pc-card pros"><div class="pc-h"><span class="pc-ic">${I.ok}</span>Плюсы<em>${(it.pros || []).length}</em></div>
        <ul>${(it.pros || []).map((p, i) => `<li style="--i:${i}">${esc(p)}</li>`).join('')}</ul></div>
      <div class="pc-card cons"><div class="pc-h"><span class="pc-ic">${I.minus}</span>Минусы<em>${(it.cons || []).length}</em></div>
        <ul>${(it.cons || []).map((p, i) => `<li style="--i:${i}">${esc(p)}</li>`).join('')}</ul></div>
    </div>`;
  }
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

// ---------- city picker: glass popover with search, keyboard and spring animation ----------
function cityPicker(input) {
  const pop = document.createElement('div'); pop.className = 'cpop';
  document.body.append(pop);
  let items = [], idx = 0;
  const place = () => { const r = input.closest('.cityf, .field')?.getBoundingClientRect() || input.getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 8) + 'px'; pop.style.width = Math.max(260, r.width) + 'px'; };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    items = CITIES.filter(c => !q || c.toLowerCase().includes(q) || q === city().toLowerCase()).slice(0, 8);
    if (q && !CITIES.some(c => c.toLowerCase() === q)) items.push(input.value.trim());
    idx = Math.min(idx, items.length - 1);
    pop.innerHTML = items.map((c, i) => `<button data-i="${i}" class="${i === idx ? 'hl' : ''} ${(c === 'Вся Россия' ? !city() : c === city()) ? 'on' : ''}">${I.pin}<span>${esc(c)}${!CITIES.includes(c) ? ' <small style="color:var(--label3)">— свой город</small>' : ''}</span>${(c === 'Вся Россия' ? !city() : c === city()) ? I.ok : ''}</button>`).join('');
    pop.querySelectorAll('button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(items[b.dataset.i]); });
  };
  const open = () => { place(); idx = 0; draw(); pop.classList.add('open'); };
  const close = () => pop.classList.remove('open');
  const pick = async c => {
    close(); input.value = /^вся россия$/i.test(c) ? '' : c; input.blur();
    await setCity(c); toast(city() ? 'Город: ' + city() : 'Поиск по всей России');
  };
  input.addEventListener('focus', () => { input.select(); open(); });
  input.addEventListener('input', () => { idx = 0; draw(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[idx]) pick(items[idx]);
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  new MutationObserver(() => { if (!document.body.contains(input)) { pop.remove(); } }).observe(document.body, { childList: true, subtree: true });
}

// ---------- smooth number count-up ----------
function countUp(el, to, ms = 900) {
  if (!el || to == null) return;
  const from = +(el.dataset.v || 0); el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = rub(to); return; }
  const t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 4);
  const step = now => { const t = Math.min(1, (now - t0) / ms); el.textContent = rub(from + (to - from) * ease(t)); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ---------- price history, hint, target price ----------
function chartSVG(points) {
  if (!points || points.length < 2) return '<div class="chart-empty">История появится после следующей проверки цены</div>';
  const w = 280, h = 74, ps = points.map(p => p.p), mn = Math.min(...ps), mx = Math.max(...ps), span = mx - mn || 1;
  const xy = points.map((p, i) => [i / (points.length - 1) * w, h - 8 - (p.p - mn) / span * (h - 16)]);
  const line = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const [lx, ly] = xy.at(-1);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5bff" stop-opacity=".45"/><stop offset="1" stop-color="#2f5bff" stop-opacity="0"/></linearGradient></defs>
    <path d="${line} L ${w} ${h} L 0 ${h} Z" fill="url(#cg)"/><path class="ln" pathLength="1000" d="${line}" fill="none" stroke="#a9cbff" stroke-width="2.2" stroke-linejoin="round"/>
    <circle class="dot" cx="${lx}" cy="${ly}" r="4" fill="#a9cbff"/><circle class="pulse" cx="${lx}" cy="${ly}" r="4" fill="#a9cbff"/></svg>`;
}
function insightsHTML(it) {
  const ins = it.insights || {};
  return `<div class="ins">
    <div class="ins-h"><span class="eyebrow gold">история цены</span>${ins.min30 != null ? `<span class="ins-range">${rub(ins.min30)} – ${rub(ins.max30)}</span>` : ''}</div>
    ${chartSVG(ins.points)}
    ${ins.hint ? `<div class="hint ${ins.tone || 'info'}">💡 ${esc(ins.hint)}</div>` : ''}
    <div class="target"><span class="eyebrow">🎯 целевая цена</span>
      <div class="target-row"><input id="tInput" inputmode="numeric" placeholder="${it.minPrice ? Math.round(it.minPrice * .9 / 100) * 100 : 'например, 30000'}" value="${it.target || ''}"><span>₽</span><button class="btn prominent" id="tSave">${it.target ? 'Изменить' : 'Следить'}</button></div>
      <small>Пришлём уведомление, когда цена опустится до этой суммы</small></div>
  </div>`;
}
async function saveTarget(it, root, state) {
  const v = Math.round(+String(root.querySelector('#tInput').value).replace(/[^\d]/g, '')) || null;
  try {
    const upd = await srv('PUT', '/items/' + it.id, { target: v });
    Object.assign(it, { target: upd.target, insights: upd.insights }); await persist();
    updateDetail(root, it, state); toast(v ? `🎯 Следим за ценой: ${rub(v)}` : 'Цель убрана');
  } catch (e) { toast(errText(e)); }
}

// ---------- branded price alerts ----------
async function checkAlerts() {
  if (!data.settings.token) return;
  const first = !data.settings.alertsSince;
  try {
    const list = await srv('GET', '/alerts?since=' + (data.settings.alertsSince || 0));
    data.settings.alertsSince = Math.max(data.settings.alertsSince || 0, Date.now() - 1000, ...list.map(a => a.created));
    await persist();
    if (first || !list.length) return; // don't replay old alerts on the first run
    list.slice(0, 3).reverse().forEach((a, i) => setTimeout(() => api.notify(a), i * 600));
    await loadItems(); if (view === 'list') render();
  } catch {}
}
setInterval(checkAlerts, 5 * 60e3);
api.onOpenItem(id => { go('list'); setTimeout(() => openItem(id), 350); });

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
const PROVIDERS = {
  vk: { label: 'Войти с VK ID', icon: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.714-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/></svg>' },
  google: { label: 'Войти через Google', icon: '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.4 7.2-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"/></svg>' },
  apple: { label: 'Войти с Apple ID', icon: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M16.4 1.4c0 1.1-.5 2.3-1.2 3.1-.7.9-2 1.6-3 1.6h-.3l-.1-.4c0-1.2.6-2.3 1.2-3 .8-.9 2.2-1.6 3.3-1.7v.4zm4.5 15.7c0 .1-.5 1.6-1.5 3.1-.9 1.3-1.9 2.7-3.4 2.7s-1.9-.9-3.6-.9c-1.7 0-2.3.9-3.7.9s-2.3-1.3-3.4-2.8c-1.3-1.8-2.3-4.6-2.3-7.3 0-4.3 2.8-6.5 5.6-6.5 1.4 0 2.7.9 3.6.9.9 0 2.2-1 3.9-1 .6 0 2.9.1 4.4 2.2-.1.1-2.4 1.4-2.4 4.2 0 3.3 2.9 4.4 2.8 4.5z"/></svg>' }
};
const providerName = p => ({ vk: 'VK ID', google: 'Google', apple: 'Apple ID', tg: 'Telegram' })[p] || 'Telegram';

function renderSettings(el) {
  const u = data.settings.user || {}, tg = u.telegram;
  const bot = data.settings.bot || 'hotelkinobot';
  el.innerHTML = `<div class="form">
    <div class="frost account">
      <div class="avatar">${esc((u.name || u.username || '?').replace(/^@/, '').trim()[0]?.toUpperCase())}</div>
      <div class="who"><b>${esc(u.name || 'Пользователь')}</b><span>${u.provider === 'tag' ? 'вход по тегу · только на этом компьютере' : esc(providerName(u.provider)) + (u.email ? ' · ' + esc(u.email) : '')}</span></div>
      ${btn('', 'Выйти', 'id="logout"')}
    </div>
    <div class="h-section">Поиск</div>
    <div class="frost" style="margin-top:10px">
      <div class="field"><label for="c2">Город</label><input id="c2" placeholder="Вся Россия" value="${esc(city())}" spellcheck="false" autocomplete="off"></div>
    </div>

    <p class="hint">Объявления Авито ищутся в этом городе, а нейросеть учитывает самовывоз и доставку. Город общий с ботом.</p>
    <div class="h-section">Телеграм-бот</div>
    ${tg ? `<div class="frost tg-linked"><span class="tg-ic">${TG_ICON}</span><div class="who"><b>Привязан${tg.username ? ' @' + esc(tg.username) : ''}</b><span>Пишите боту @${esc(bot)} название или фото товара — хотелки общие с приложением</span></div></div>
    <div class="row-btns">${btn('', 'Открыть бота', 'id="openBot"')}${btn('', 'Отвязать', 'id="unlinkTg"')}</div>`
    : `<p class="hint" style="margin-top:8px">Привяжите бота — сможете добавлять хотелки прямо из Telegram и получать туда уведомления о скидках.</p>
    ${btn('', 'Привязать Telegram', 'id="linkTg"')}
    <div class="login-wait" id="tgWait" hidden><span class="spinner s"></span><span>Нажмите «Старт» в боте — привязка завершится сама</span></div>`}
  </div>`;
  cityPicker($('#c2'));
  $('#logout').onclick = () => logout();
  if (tg) {
    $('#openBot').onclick = () => api.open('https://t.me/' + bot);
    $('#unlinkTg').onclick = async () => {
      try { await srv('DELETE', '/link/telegram'); u.telegram = null; await persist(); rerender(); toast('Telegram отвязан'); } catch (e) { toast(errText(e)); }
    };
  } else $('#linkTg').onclick = linkTelegram;
}
const TG_ICON = '<svg viewBox="0 0 24 24"><path d="M21.5 4.5 2.9 11.7c-1 .4-1 1.7.1 2l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.9 3.6c.7.5 1.7.1 1.9-.7l3.2-15c.2-1.1-.8-1.9-1.8-1.5zM9.6 14.6l-.6 4-1.5-4.7 10.3-6.5z"/></svg>';

// link the bot: open t.me/<bot>?start=link_<code>, then watch /me until the bot reports back
let linkPoll = null;
async function linkTelegram() {
  const b = $('#linkTg'); b.disabled = true;
  try {
    const r = await srv('POST', '/link/telegram');
    data.settings.bot = r.bot;
    api.open(r.url);
    $('#tgWait').hidden = false;
    clearInterval(linkPoll);
    const until = Date.now() + r.expiresIn * 1000;
    linkPoll = setInterval(async () => {
      if (Date.now() > until || view !== 'settings') { clearInterval(linkPoll); if ($('#linkTg')) { $('#linkTg').disabled = false; $('#tgWait').hidden = true; } return; }
      const u = await srv('GET', '/me').catch(() => null);
      if (!u?.telegram) return;
      clearInterval(linkPoll);
      data.settings.user = u; await persist();
      api.raise(); rerender(); toast('Telegram привязан');
    }, 2500);
  } catch (e) { b.disabled = false; toast(errText(e)); }
}

// ---------- sign-in: a tag bound to this computer; VK ID / Google / Apple are put away for now ----------
const OAUTH_LOGIN = false;
const TAG_MIN = 5;
function showTagLogin() {
  $('#login').innerHTML = `<div class="login-card frost">
      <div class="login-logo"><span class="mark">✦</span></div>
      <h1>хотелкино ✦︎</h1>
      <p>Список желаний и лучшие цены<br>на Авито, Ozon, WB и в магазинах</p>
      <form class="tag-form" id="tagForm">
        <label class="tag-field"><span>@</span><input id="tag" placeholder="придумайте тег" maxlength="32" spellcheck="false" autocomplete="off"><em id="tagLeft"></em></label>
        ${btn('prominent', 'Войти', 'id="tagGo" type="submit" disabled')}
      </form>
      <small>Тег привязывается к этому компьютеру —<br>с другого устройства по нему не войти.</small>
    </div>`;
  const inp = $('#tag'), go = $('#tagGo'), left = $('#tagLeft');
  // latin letters and digits only, kept lowercase: @Anton1 and @anton1 are the same tag
  inp.oninput = () => {
    inp.value = inp.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
    const n = inp.value.length;
    go.disabled = n < TAG_MIN;
    left.textContent = !n ? '' : n < TAG_MIN ? 'ещё ' + (TAG_MIN - n) : '✓';
    left.classList.toggle('ok', n >= TAG_MIN);
  };
  $('#tagForm').onsubmit = async e => {
    e.preventDefault();
    if (inp.value.length < TAG_MIN || go.disabled) return;
    go.disabled = true;
    try {
      const r = await srv('POST', '/auth/tag', { tag: inp.value, deviceId: await api.deviceId(), device: 'Windows' });
      Object.assign(data.settings, { token: r.token, user: r.user, city: r.user.city || '' });
      data.settings.citySlug = await api.citySlug(data.settings.city);
      await persist(); enterApp(); toast('Привет, ' + r.user.name + '!');
    } catch (e) { go.disabled = false; toast(errText(e)); }
  };
  setTimeout(() => inp.focus(), 50);
}

// VK ID / Google / Apple in the browser, the app polls the server
let loginPoll = null;
function showLogin() {
  document.body.classList.add('signed-out');
  if (!OAUTH_LOGIN) return showTagLogin();
  const on = data.settings.providers || Object.keys(PROVIDERS);
  $('#login').innerHTML = `<div class="login-card frost">
      <div class="login-logo"><span class="mark">✦</span></div>
      <h1>хотелкино ✦︎</h1>
      <p>Список желаний и лучшие цены<br>на Авито, Ozon, WB и в магазинах</p>
      <div class="sso">${Object.entries(PROVIDERS).map(([k, p]) => `<button class="sso-btn ${k}" data-p="${k}" ${on.includes(k) ? '' : 'hidden'}>${p.icon}<span>${p.label}</span></button>`).join('')}</div>
      <div class="login-wait" id="wait" hidden><span class="spinner s"></span><span>Завершите вход в браузере — приложение откроется само</span></div>
      <small>Хотелки общие для компьютера и телефона.<br>Телеграм-бота можно привязать после входа.</small>
    </div>`;
  $('#login').querySelectorAll('.sso-btn').forEach(b => b.onclick = () => startLogin(b.dataset.p));
  // show only the providers the server has keys for
  srv('GET', '/health').then(h => {
    if (!h.providers?.length) return;
    data.settings.providers = h.providers;
    $('#login').querySelectorAll('.sso-btn').forEach(b => b.hidden = !h.providers.includes(b.dataset.p));
  }).catch(() => {});
}
async function startLogin(provider) {
  const btns = [...$('#login').querySelectorAll('.sso-btn')];
  const busy = on => btns.forEach(b => b.disabled = on);
  busy(true);
  try {
    const r = await srv('POST', '/auth/start', { provider, device: 'Windows' });
    api.open(r.url);
    $('#wait').hidden = false;
    busy(false);
    clearInterval(loginPoll);
    const until = Date.now() + r.expiresIn * 1000;
    const stop = msg => { clearInterval(loginPoll); $('#wait').hidden = true; if (msg) toast(msg); };
    loginPoll = setInterval(async () => {
      if (Date.now() > until) return stop('Время вышло, попробуйте ещё раз');
      const p = await srv('GET', '/auth/poll?code=' + r.code).catch(() => null);
      if (p?.status === 'error' || p?.status === 'expired') return stop(p.error || 'Вход не завершён, попробуйте ещё раз');
      if (p?.status !== 'ok') return;
      stop();
      Object.assign(data.settings, { token: p.token, user: p.user, city: p.user.city || '' });
      data.settings.citySlug = await api.citySlug(data.settings.city);
      await persist(); api.raise(); enterApp(); toast('Привет, ' + (p.user.name || 'друг') + '!');
    }, 2000);
  } catch (e) { busy(false); toast(errText(e)); }
}
async function logout(expired) {
  if (!expired) await srv('POST', '/auth/logout').catch(() => {});
  data = { items: [], settings: { bot: data.settings.bot, providers: data.settings.providers } };
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
  checkAlerts();
}

// ---------- boot ----------
(async () => {
  data = await api.getData();
  data.items ||= []; data.settings ||= {};
  $('#count').textContent = data.items.length || '';
  addEventListener('resize', () => { pillY = null; movePill(); });
  if (data.settings.token) enterApp(); else showLogin();
})();
