// Telegram bot (long polling — no domain or webhook needed).
// Text or photo → product candidates → pick → wishlist item with live price search.
const cfg = require('./config');
const { users, items } = require('./db');
const ai = require('./ai');
const search = require('./search');
const api = require('./api');
const watch = require('./watch');

const TG = `https://api.telegram.org/bot${cfg.botToken}`;
async function tg(method, params = {}) {
  const r = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) });
  const j = await r.json();
  if (!j.ok && !/message is not modified/.test(j.description || '')) throw new Error(`${method}: ${j.description}`);
  return j.result;
}
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rub = n => n == null ? '—' : Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';

const B = { add: '➕ Добавить хотелку', list: '❤️ Мои хотелки', prices: '🔎 Узнать цены', city: '📍 Город', app: '📱 Приложение' };
const MENU = { keyboard: [[{ text: B.add }], [{ text: B.list }, { text: B.prices }], [{ text: B.city }, { text: B.app }]], resize_keyboard: true, is_persistent: true };
const CITIES = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Краснодар', 'Самара', 'Ростов-на-Дону', 'Уфа', 'Челябинск', 'Воронеж'];
const COND = { new: 'новый', used: 'б/у', discounted: 'уценка', refurbished: 'восстановл.' };
const FILTERS = [['all', 'Все'], ['new', 'Новые'], ['used', 'Б/у'], ['discounted', 'Уценка']];

// per-user conversation state (in memory; harmless to lose on restart)
const state = new Map(); // userId → { mode, picks: {key: {candidates, mode, image}} }
const st = id => { if (!state.has(id)) state.set(id, { mode: null, picks: {} }); return state.get(id); };
const shortKey = () => Math.random().toString(36).slice(2, 8);

// ---------- rendering ----------
function progressLine(status) {
  const labels = Object.fromEntries(search.GROUPS.map(([k, l]) => [k, l]));
  return Object.entries(status || {}).map(([k, s]) => `${s === 'loading' ? '⏳' : s === 'done' ? '✅' : s === 'blocked' ? '🚫' : '⚠️'} ${labels[k] || k}`).join(' · ');
}
function card(src, { filter = 'all', saved = false } = {}) {
  const offers = (src.offers || []).filter(o => filter === 'all' || o.condition === filter || (filter === 'discounted' && o.condition === 'refurbished'));
  const loading = Object.values(src.status || {}).some(s => s === 'loading');
  const lines = [`<b>${esc(src.name)}</b>`];
  if (src.city) lines.push(`📍 ${esc(src.city)}`);
  const mins = [['🟢 Новый', src.minNew], ['♻️ Б/у', src.minUsed], ['🏷 Уценка', src.minDiscounted]].filter(([, v]) => v != null);
  if (mins.length) lines.push(mins.map(([l, v]) => `${l} от <b>${rub(v)}</b>`).join('\n'));
  lines.push('');
  if (loading) lines.push(`<i>Ищу цены… ${progressLine(src.status)}</i>`, '');
  if (offers.length) {
    lines.push(`<b>${filter === 'all' ? 'Предложения' : FILTERS.find(f => f[0] === filter)[1]}</b> (${offers.length}), от дешёвых:`);
    offers.slice(0, 12).forEach((o, i) => {
      const flags = [o.flags?.includes('cheap') ? '⚠️ подозрительно дёшево' : '', o.flags?.includes('unknown') ? '⚠️ незнакомый сайт' : ''].filter(Boolean).join(', ');
      const name = o.url ? `<a href="${esc(o.url)}">${esc(o.store)}</a>` : esc(o.store);
      lines.push(`${i + 1}. ${name} — <b>${rub(o.price)}</b> · ${COND[o.condition] || ''}${o.place ? ' · ' + esc(o.place) : ''}${o.delivery ? '\n    🚚 ' + esc(o.delivery) : ''}${flags ? '\n    ' + flags : ''}`);
    });
  } else if (!loading) lines.push(filter === 'all' ? 'Предложений не нашлось 😔' : 'В этой категории предложений нет.');
  if (src.history?.length) {
    const ins = watch.insights(src);
    const parts = [];
    if (ins.min30 != null) parts.push(`📈 За месяц: ${rub(ins.min30)}–${rub(ins.max30)}`);
    if (src.target) parts.push(`🎯 Цель: ${rub(src.target)}${ins.atTarget ? ' ✓' : ''}`);
    if (parts.length) lines.push(parts.join(' · '));
    if (ins.hint) lines.push(`💡 <i>${esc(ins.hint)}</i>`);
  }
  const info = src.info || (src.description ? src : null);
  if (info?.description && !loading) {
    lines.push('', esc(info.description));
    const pc = [...(info.pros || []).slice(0, 3).map(p => '✅ ' + esc(p)), ...(info.cons || []).slice(0, 3).map(p => '➖ ' + esc(p))];
    if (pc.length) lines.push(pc.join('\n'));
  }
  if (!loading && saved) lines.push('', src.done ? '✅ <i>Исполнено!</i>' : '❤️ <i>В ваших хотелках</i>');
  let text = lines.join('\n');
  if (text.length > 4000) text = text.slice(0, 3990) + '…';
  return text;
}
function cardKeyboard(ref, { filter = 'all', saved = false, loading = false, done = false } = {}) {
  const rows = [FILTERS.map(([k, l]) => ({ text: (k === filter ? '• ' : '') + l, callback_data: `f:${ref}:${k}` }))];
  const act = [];
  if (!saved) act.push({ text: '❤️ В хотелки', callback_data: `s:${ref}` });
  if (saved && !loading) act.push({ text: '🔄 Обновить цены', callback_data: `r:${ref}` });
  if (saved) act.push({ text: done ? '↩️ Вернуть' : '✅ Исполнено', callback_data: `x2:${ref}` });
  if (saved) rows.push([{ text: '🎯 Целевая цена', callback_data: `tg:${ref}` }]);
  if (saved) act.push({ text: '🗑 Удалить', callback_data: `d:${ref}` });
  rows.push(act);
  if (saved) rows.push([{ text: '⬅️ Мои хотелки', callback_data: 'p:0' }]);
  return { inline_keyboard: rows };
}
const preview = image => /^https:\/\//.test(image || '') ? { url: image, prefer_large_media: true, show_above_text: true } : { is_disabled: true };

// ---------- live card bound to a search job ----------
function liveCard(chatId, messageId, job, userId, { itemId = null, filter = 'all' } = {}) {
  let last = 0, timer = null;
  const render = async () => {
    last = Date.now(); timer = null;
    const saved = itemId ? items.get(userId, itemId) : null;
    const src = saved ? { ...saved, info: job.info } : search.view(job);
    const ref = itemId ? `i:${itemId}` : `j:${job.id}`;
    await tg('editMessageText', {
      chat_id: chatId, message_id: messageId, text: card(src, { filter, saved: !!saved }), parse_mode: 'HTML',
      link_preview_options: preview(src.image), reply_markup: cardKeyboard(ref, { filter, saved: !!saved, loading: !job.done })
    }).catch(e => console.error('edit', e.message));
  };
  const onUpdate = j => {
    if (j.done) { clearTimeout(timer); job.listeners.delete(onUpdate); return render(); }
    if (!timer) timer = setTimeout(render, Math.max(0, 2500 - (Date.now() - last)));
  };
  job.listeners.add(onUpdate);
  onUpdate(job);
}

// ---------- flows ----------
async function identifyAndOffer(chatId, user, { query = '', image = null }) {
  const s = st(user.id);
  const mode = s.mode === 'prices' ? 'prices' : 'add';
  s.mode = null;
  const msg = await tg('sendMessage', { chat_id: chatId, text: image ? '🔍 Распознаю товар на фото…' : `🔍 Ищу «${esc(query)}»…`, parse_mode: 'HTML' });
  try {
    const candidates = await ai.identify({ query, image });
    if (!candidates.length) return tg('editMessageText', { chat_id: chatId, message_id: msg.message_id, text: 'Не понял, что это за товар 🤔 Попробуйте описать точнее.' });
    const key = shortKey();
    s.picks[key] = { candidates, mode };
    const kb = candidates.slice(0, 6).map((c, i) => [{ text: c.name.slice(0, 60), callback_data: `c:${key}:${i}` }]);
    kb.push([{ text: '✖️ Отмена', callback_data: `x:${key}` }]);
    await tg('editMessageText', { chat_id: chatId, message_id: msg.message_id, text: mode === 'add' ? 'Какой именно товар добавить в хотелки?' : 'Для какого товара узнать цены?', reply_markup: { inline_keyboard: kb } });
  } catch (e) {
    await tg('editMessageText', { chat_id: chatId, message_id: msg.message_id, text: '😔 Ошибка распознавания: ' + e.message.slice(0, 300) });
  }
}

async function pick(cb, user, key, i) {
  const p = st(user.id).picks[key];
  const chatId = cb.message.chat.id, mid = cb.message.message_id;
  if (!p) return tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Выбор устарел, отправьте товар заново' });
  const c = p.candidates[+i];
  delete st(user.id).picks[key];
  const city = users.get(user.id)?.city || '';
  const job = search.start(c.name, city);
  let itemId = null;
  if (p.mode === 'add') {
    if (items.hasName(user.id, c.name)) itemId = items.list(user.id).find(x => x.name === c.name).id;
    else {
      const item = items.save(user.id, api.itemFromJob(job, c));
      api.attachJob(user.id, item, job);
      itemId = item.id;
    }
  }
  await tg('answerCallbackQuery', { callback_query_id: cb.id, text: p.mode === 'add' ? '❤️ Добавлено в хотелки' : 'Ищу цены…' });
  liveCard(chatId, mid, job, user.id, { itemId });
}

async function showList(chatId, user, page = 0, editId = null) {
  const list = items.list(user.id);
  const per = 8, pages = Math.max(1, Math.ceil(list.length / per));
  page = Math.min(Math.max(0, page), pages - 1);
  const text = list.length
    ? `❤️ <b>Мои хотелки</b> — ${list.length}\n\nВыберите товар, чтобы посмотреть цены:`
    : '❤️ Хотелок пока нет.\n\nПросто напишите название товара или пришлите его фото — я найду его и добавлю.';
  const kb = list.slice(page * per, page * per + per).map(it => [{ text: `${it.done ? '✅ ' : ''}${it.name.slice(0, 40)} · от ${rub(it.minPrice)}`, callback_data: `v:${it.id}` }]);
  if (pages > 1) kb.push([
    ...(page > 0 ? [{ text: '◀️', callback_data: `p:${page - 1}` }] : []),
    { text: `${page + 1} / ${pages}`, callback_data: 'noop' },
    ...(page < pages - 1 ? [{ text: '▶️', callback_data: `p:${page + 1}` }] : [])
  ]);
  const params = { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } };
  return editId ? tg('editMessageText', { ...params, message_id: editId }) : tg('sendMessage', params);
}

async function showItem(chatId, user, id, { editId = null, filter = 'all' } = {}) {
  const it = items.get(user.id, id);
  if (!it) return tg('sendMessage', { chat_id: chatId, text: 'Эта хотелка уже удалена.' });
  const params = { chat_id: chatId, text: card(it, { filter, saved: true }), parse_mode: 'HTML', link_preview_options: preview(it.image), reply_markup: cardKeyboard(`i:${id}`, { filter, saved: true, done: !!it.done }) };
  return editId ? tg('editMessageText', { ...params, message_id: editId }) : tg('sendMessage', params);
}

async function photoToDataUrl(photos) {
  const best = photos.filter(p => p.width <= 1280).at(-1) || photos.at(-1);
  const f = await tg('getFile', { file_id: best.file_id });
  const buf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${cfg.botToken}/${f.file_path}`)).arrayBuffer());
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

// ---------- handlers ----------
async function onMessage(m) {
  const chatId = m.chat.id;
  const user = users.upsert({ id: m.from.id, name: [m.from.first_name, m.from.last_name].filter(Boolean).join(' '), username: m.from.username });
  const s = st(user.id);
  const text = (m.text || '').trim();

  if (text.startsWith('/start')) {
    const arg = text.split(' ')[1] || '';
    if (arg.startsWith('login_')) {
      const code = arg.slice(6), l = api.loginInfo(code);
      if (!l || l.exp < Date.now()) return tg('sendMessage', { chat_id: chatId, text: '⌛ Ссылка для входа устарела. Нажмите «Войти через Telegram» в приложении ещё раз.', reply_markup: MENU });
      return tg('sendMessage', { chat_id: chatId, text: `🔐 Войти в «хотелкино ✦︎»${l.device ? ' на устройстве <b>' + esc(l.device) + '</b>' : ''}?\n\nВаши хотелки синхронизируются между ботом и приложением.`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '✅ Войти', callback_data: `a:${code}` }, { text: '✖️ Это не я', callback_data: `n:${code}` }]] } });
    }
    return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', reply_markup: MENU, text:
      `Привет, ${esc(m.from.first_name || '')}! ✨ Я — <b>хотелкино ✦︎</b>.\n\n` +
      'Напишите название товара или пришлите его фото — я пойму, что это, добавлю в ваши хотелки и найду лучшие цены на Авито, Ozon, WB, Яндекс Маркете и в магазинах.\n\n' +
      `📍 Город: <b>${esc(user.city || 'вся Россия')}</b> — поменять можно кнопкой «Город».` });
  }
  if (text === '/add' || text === B.add) { s.mode = 'add'; return tg('sendMessage', { chat_id: chatId, text: '✍️ Напишите название товара или пришлите фото.', reply_markup: MENU }); }
  if (text === '/prices' || text === B.prices) { s.mode = 'prices'; return tg('sendMessage', { chat_id: chatId, text: '🔎 Что ищем? Напишите название или пришлите фото — покажу цены, не добавляя в хотелки.', reply_markup: MENU }); }
  if (text === '/list' || text === B.list) return showList(chatId, user);
  if (text === '/city' || text === B.city) {
    s.mode = 'city';
    const rows = [['Вся Россия'], ...CITIES.reduce((a, c, i) => (i % 3 ? a[a.length - 1].push(c) : a.push([c]), a), [])].map(r => r.map(t => ({ text: t })));
    return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text: `📍 Сейчас: <b>${esc(user.city || 'вся Россия')}</b>\nВыберите город или напишите свой — буду искать объявления рядом с вами.`, reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: true } });
  }
  if (text === '/app' || text === B.app) return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', reply_markup: MENU, text:
    '📱 <b>Приложения «хотелкино ✦︎»</b> — для Windows и Android.\n\nВойти просто: нажмите в приложении «Войти через Telegram» и подтвердите вход здесь. Хотелки общие для бота и приложений.\n\nСкачать: https://github.com/fhdev64/wants-and-needs/releases' });

  if (s.mode?.startsWith('target:') && text) {
    const id = s.mode.slice(7); s.mode = null;
    const n = Math.round(+text.replace(/[^\d]/g, ''));
    const it = items.get(user.id, id);
    if (!it) return tg('sendMessage', { chat_id: chatId, text: 'Хотелка не найдена.', reply_markup: MENU });
    it.target = n > 0 ? n : null; items.save(user.id, it);
    await tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', reply_markup: MENU,
      text: it.target ? `🎯 Готово! Напишу, как только <b>${esc(it.name)}</b> подешевеет до <b>${rub(it.target)}</b>.` : 'Цель убрана.' });
    return showItem(chatId, user, id);
  }
  if (s.mode === 'city' && text) {
    const city = /^вся россия$/i.test(text) ? '' : text.slice(0, 60);
    users.setCity(user.id, city); s.mode = null;
    return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text: `📍 Готово: <b>${esc(city || 'вся Россия')}</b>`, reply_markup: MENU });
  }
  if (m.photo) return identifyAndOffer(chatId, user, { image: await photoToDataUrl(m.photo), query: m.caption || '' });
  if (text && !text.startsWith('/')) return identifyAndOffer(chatId, user, { query: text });
}

async function onCallback(cb) {
  const user = users.upsert({ id: cb.from.id, name: [cb.from.first_name, cb.from.last_name].filter(Boolean).join(' '), username: cb.from.username });
  const chatId = cb.message.chat.id, mid = cb.message.message_id;
  const [kind, a, b, c] = cb.data.split(':');
  const ack = text => tg('answerCallbackQuery', { callback_query_id: cb.id, ...(text ? { text } : {}) });
  switch (kind) {
    case 'a': {
      const ok = api.confirmLogin(a, { id: cb.from.id, name: user.name, username: user.username });
      await ack(ok ? 'Вход выполнен' : 'Ссылка устарела');
      return tg('editMessageText', { chat_id: chatId, message_id: mid, text: ok ? '✅ Готово! Возвращайтесь в приложение — вход выполнен.' : '⌛ Ссылка устарела, попробуйте войти ещё раз.' });
    }
    case 'n': await ack(); return tg('editMessageText', { chat_id: chatId, message_id: mid, text: '🛡 Вход отменён.' });
    case 'c': return pick(cb, user, a, b);
    case 'x': delete st(user.id).picks[a]; await ack(); return tg('editMessageText', { chat_id: chatId, message_id: mid, text: 'Отменено.' });
    case 'p': await ack(); return showList(chatId, user, +a, mid);
    case 'v': await ack(); return showItem(chatId, user, a);
    case 'f': {
      // f:i:<id>:<filter> or f:j:<job>:<filter>
      await ack();
      if (a === 'i') return showItem(chatId, user, b, { editId: mid, filter: c });
      const job = search.get(b);
      if (!job) return tg('editMessageText', { chat_id: chatId, message_id: mid, text: 'Поиск устарел, отправьте товар заново.' });
      return tg('editMessageText', { chat_id: chatId, message_id: mid, text: card(search.view(job), { filter: c }), parse_mode: 'HTML', link_preview_options: preview(job.image), reply_markup: cardKeyboard(`j:${b}`, { filter: c, loading: !job.done }) });
    }
    case 's': {
      const job = search.get(b);
      if (!job) return ack('Поиск устарел');
      if (items.hasName(user.id, job.name)) return ack('Уже в хотелках');
      const item = items.save(user.id, api.itemFromJob(job));
      api.attachJob(user.id, item, job);
      await ack('❤️ Добавлено');
      if (job.done) return showItem(chatId, user, item.id, { editId: mid });
      return liveCard(chatId, mid, job, user.id, { itemId: item.id });
    }
    case 'r': {
      const it = items.get(user.id, b);
      if (!it) return ack('Не найдено');
      const job = watch.recheck(user.id, it);
      await ack('Обновляю цены…');
      return liveCard(chatId, mid, job, user.id, { itemId: it.id });
    }
    case 'tg': {
      const it = items.get(user.id, b);
      if (!it) return ack('Не найдено');
      st(user.id).mode = 'target:' + b;
      await ack();
      return tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text:
        `🎯 Какая цена для <b>${esc(it.name)}</b> вас устроит?\n\nСейчас от <b>${rub(it.minPrice)}</b>. Напишите число, например <code>${Math.round((it.minPrice || 10000) * 0.9 / 100) * 100}</code>. Чтобы убрать цель — отправьте 0.`,
        reply_markup: { force_reply: true, input_field_placeholder: 'Например, 30000' } });
    }
    case 'x2': {
      const it = items.get(user.id, b);
      if (!it) return ack('Не найдено');
      it.done = !it.done; it.doneAt = it.done ? Date.now() : null; items.save(user.id, it);
      await ack(it.done ? '✅ Исполнено!' : 'Вернул в хотелки');
      return showItem(chatId, user, b, { editId: mid });
    }
    case 'd':
      items.remove(user.id, b); await ack('Удалено');
      return showList(chatId, user, 0, mid);
    default: return ack();
  }
}

watch.onAlert(async (userId, a) => {
  const head = a.kind === 'target' ? '🎯 <b>Цена дошла до вашей цели!</b>' : `📉 <b>Подешевело на ${a.pct}%</b>`;
  const priceLine = a.oldPrice && a.oldPrice !== a.newPrice ? `<s>${rub(a.oldPrice)}</s>  →  <b>${rub(a.newPrice)}</b>` : `<b>${rub(a.newPrice)}</b>`;
  const caption = [head, '', `<b>${esc(a.name)}</b>`, priceLine, a.store ? `🏪 ${esc(a.store)}` : '', '', '<i>хотелкино ✦︎</i>'].filter((x, i, arr) => x || arr[i - 1]).join('\n');
  const kb = { inline_keyboard: [
    ...(a.url ? [[{ text: '🛒 Открыть предложение', url: a.url }]] : []),
    [{ text: '📋 Все цены', callback_data: `v:${a.itemId}` }]
  ] };
  try {
    if (/^https:\/\//.test(a.image || '')) await tg('sendPhoto', { chat_id: userId, photo: a.image, caption, parse_mode: 'HTML', reply_markup: kb });
    else throw new Error('no photo');
  } catch {
    await tg('sendMessage', { chat_id: userId, text: caption, parse_mode: 'HTML', reply_markup: kb }).catch(e => console.error('alert', e.message));
  }
});

async function run() {
  const me = await tg('getMe');
  api.setBotUsername(me.username);
  await tg('deleteWebhook', { drop_pending_updates: false });
  await tg('setMyCommands', { commands: [
    { command: 'add', description: 'Добавить хотелку' }, { command: 'list', description: 'Мои хотелки' },
    { command: 'prices', description: 'Узнать цены' }, { command: 'city', description: 'Мой город' }, { command: 'app', description: 'Приложения' }
  ] });
  await tg('setMyDescription', { description: 'Пришлите название или фото товара — я добавлю его в ваши хотелки и найду лучшие цены на Авито, Ozon, WB, Яндекс Маркете и в магазинах.' }).catch(() => {});
  console.log(`Бот: @${me.username}`);
  let offset = 0;
  for (;;) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
      for (const u of ups) {
        offset = u.update_id + 1;
        const h = u.message ? onMessage(u.message) : u.callback_query ? onCallback(u.callback_query) : null;
        h?.catch(e => console.error('update', e.message));
      }
    } catch (e) { console.error('poll', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}

module.exports = { run };
