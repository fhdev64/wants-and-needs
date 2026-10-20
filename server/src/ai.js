// AI provider calls. The key lives only on the server (server/.env).
const cfg = require('./config');

const DEFAULT_MODEL = {
  anthropic: 'claude-sonnet-5-5', openai: 'gpt-5', gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash', perplexity: 'sonar-pro', codex: '', custom: ''
};
const CODEX_BASE = 'https://codexapi.work/backend-api/codex';

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = {}; }
  if (!res.ok) throw new Error(j.error?.message || j.error || j.message || ('HTTP ' + res.status + ' ' + t.slice(0, 200)));
  return j;
}

// low reasoning effort makes responses several times faster; drop it if the model rejects the param
async function withFastReasoning(fn, fast) {
  if (!fast) return fn({});
  try { return await fn({ reasoning: { effort: 'low' } }); }
  catch (e) { if (/reasoning|effort|unsupported/i.test(e.message)) return fn({}); throw e; }
}

// "luna" models on the Codex proxy answer ~2x faster with equal or better result counts
let codexList = null;
async function codexModels(base, key) {
  if (codexList) return codexList;
  try {
    const r = await fetch(base + '/models', { headers: { authorization: 'Bearer ' + key } });
    const j = await r.json();
    codexList = (j.models || j.data || []).map(m => m.slug || m.id).filter(x => x && !/review|reserve/.test(x));
  } catch { codexList = []; }
  return codexList;
}
const pickFast = list => list.find(m => m === 'gpt-5.6-luna') || list.find(m => /luna/.test(m)) || list[0];

async function codex(base, key, { model, instructions, input, search, reasoning }) {
  const res = await fetch(base + '/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, accept: 'text/event-stream' },
    body: JSON.stringify({ model, instructions, input, stream: true, store: false, ...(reasoning ? { reasoning } : {}), ...(search ? { tools: [{ type: 'web_search' }] } : {}) })
  });
  if (!res.ok) {
    const t = await res.text(); let m; try { const j = JSON.parse(t); m = j.error?.message || j.detail?.message || j.detail; } catch { m = t.slice(0, 200); }
    if (search && /tool|web_search/i.test(m || '')) return codex(base, key, { model, instructions, input, reasoning, search: false });
    throw new Error(m || 'HTTP ' + res.status);
  }
  const raw = await res.text();
  let out = '', done = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
    if (ev.type === 'response.output_text.delta') out += ev.delta;
    else if (ev.type === 'response.completed') done = (ev.response?.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n');
    else if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(ev.error?.message || ev.response?.error?.message || ev.message || JSON.stringify(ev).slice(0, 200));
  }
  return out || done;
}

// image: data URL ("data:image/jpeg;base64,...") or null
async function ask(system, text, image, opts = {}) {
  const { provider: prov, key } = cfg.ai;
  const model = cfg.ai.model || DEFAULT_MODEL[prov];
  const img = image && { mime: image.match(/data:(.*?);/)[1], data: image.split(',')[1], url: image };
  const search = !!opts.search;

  if (prov === 'anthropic') {
    const content = [...(img ? [{ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } }] : []), { type: 'text', text }];
    let msgs = [{ role: 'user', content }];
    for (let i = 0; i < 6; i++) {
      const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, {
        model, max_tokens: 6000, system, messages: msgs,
        ...(search ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] } : {})
      });
      if (j.stop_reason === 'pause_turn') { msgs = [msgs[0], { role: 'assistant', content: j.content }]; continue; }
      return j.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
    throw new Error('Поиск занял слишком много шагов');
  }
  if (prov === 'openai' || prov === 'codex') {
    const input = [{ type: 'message', role: 'user', content: [{ type: 'input_text', text }, ...(img ? [{ type: 'input_image', image_url: img.url }] : [])] }];
    if (prov === 'openai') {
      const body = { model, instructions: system, input, ...(search ? { tools: [{ type: 'web_search' }] } : {}) };
      const j = await withFastReasoning(r => post('https://api.openai.com/v1/responses', { authorization: 'Bearer ' + key }, { ...body, ...r }), opts.fast);
      return j.output_text || (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n');
    }
    const base = (cfg.ai.baseUrl || CODEX_BASE).replace(/\/+$/, '');
    const m = cfg.ai.model || pickFast(await codexModels(base, key)) || 'gpt-5.6-luna';
    const run = mm => withFastReasoning(r => codex(base, key, { model: mm, instructions: system, input, search, ...r }), opts.fast);
    try { return await run(m); }
    catch (e) {
      if (!/model|plan/i.test(e.message)) throw e;
      const alt = (await codexModels(base, key)).find(x => x !== m);
      if (!alt) throw e;
      return run(alt);
    }
  }
  if (prov === 'gemini') {
    const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: system }] }, ...(search ? { tools: [{ google_search: {} }] } : {}),
      ...(opts.fast ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } } : {}),
      contents: [{ role: 'user', parts: [{ text }, ...(img ? [{ inline_data: { mime_type: img.mime, data: img.data } }] : [])] }]
    });
    return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
  }
  const base = prov === 'openrouter' ? 'https://openrouter.ai/api/v1' : prov === 'perplexity' ? 'https://api.perplexity.ai' : cfg.ai.baseUrl.replace(/\/+$/, '');
  const m = prov === 'openrouter' && search && !model.endsWith(':online') ? model + ':online' : model;
  const j = await post(base + '/chat/completions', { authorization: 'Bearer ' + key }, {
    model: m, messages: [{ role: 'system', content: system },
      { role: 'user', content: img ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: img.url } }] : text }]
  });
  return j.choices?.[0]?.message?.content || '';
}

function parseJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = fence ? fence[1] : text;
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0) throw new Error('Не удалось разобрать ответ нейросети');
  return clean(JSON.parse(s.slice(a, b + 1)));
}
// strip inline citations like ([site.com](https://...)) that search-enabled models add
function clean(v) {
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v : v.replace(/\s*\(?\[[^\]]*\]\([^)]*\)\)?/g, '').trim();
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') { for (const k in v) v[k] = clean(v[k]); }
  return v;
}

// ---------- tasks ----------
const SYS = 'Ты — помощник по покупкам для пользователя в России. Отвечаешь ТОЛЬКО валидным JSON без пояснений и без markdown. Тексты — на русском, кратко.';
const SAFE = 'БЕЗОПАСНОСТЬ: бери предложения только с известных надёжных площадок и официальных/крупных магазинов. ' +
  'Не включай подозрительные сайты: незнакомые домены-однодневки, клоны известных магазинов, сайты с ценой сильно ниже рынка, ' +
  'предоплату на карту, оплату криптовалютой. Ссылка должна вести прямо на страницу товара (https). ' +
  'ОПЛАТА: только предложения с оплатой в рублях и доставкой/самовывозом в России. Цены — в рублях.';
const GROUPS = {
  market: 'market.yandex.ru, megamarket.ru и aliexpress.ru (только с ценой в рублях) — ищи отдельно на каждом',
  retail: 'крупные и официальные магазины: DNS, М.Видео, Эльдорадо, Ситилинк, re:Store, МТС, Билайн, онлайн-магазин бренда в РФ, профильные сетевые магазины',
  used: 'объявления б/у на avito.ru (site:avito.ru — конкретные объявления с ценой) и youla.ru, а также уценённые и восстановленные товары (DNS уценка, М.Видео уценка, «как новый»), витринные образцы'
};

async function identify({ query, image }) {
  const text = (image ? 'Определи товар на изображении. ' : `Подбери товары по запросу: "${query}". `) +
    (image && query ? `Подсказка пользователя: "${query}". ` : '') +
    'Верни до 6 наиболее вероятных конкретных моделей (разные модификации/поколения, если уместно) в формате: ' +
    '{"candidates":[{"name":"точное название модели","brand":"","category":"короткая категория, 1-2 слова","summary":"до 8 слов"}]}';
  return (await parseJson(await ask(SYS, text, image, { fast: true }))).candidates || [];
}

async function info(name) {
  const text = `Товар: "${name}". Верни JSON: {"description":"2-3 предложения","pros":["4-5 пунктов, до 6 слов"],"cons":["3-4 пункта, до 6 слов"],` +
    '"specs":[["характеристика","значение"]] (4-6 ключевых),"image":"прямой https URL официального фото товара (jpg/png/webp) или пусто"}';
  return parseJson(await ask(SYS, text, null, { fast: true }));
}

async function offers(name, group, city) {
  const where = city ? `Пользователь в городе ${city}: в первую очередь предложения с самовывозом или быстрой доставкой в ${city}, для объявлений — в этом городе и рядом. ` : '';
  const text = `Найди актуальные предложения товара "${name}" на площадках: ${GROUPS[group]}. ${where}${SAFE} ` +
    'Верни JSON: {"offers":[{"store":"название магазина/площадки","seller":"продавец, если известен","price":число_в_рублях,' +
    '"condition":"new|used|discounted|refurbished","note":"до 6 слов: цвет, комплект, состояние","place":"город продавца, если известен","url":"https://...","image":"прямой URL фото товара, если есть"}]}. ' +
    '4-8 лучших предложений, без дублей. Если на площадке товара нет — просто не включай её.';
  return (await parseJson(await ask(SYS, text, null, { search: true, fast: true }))).offers || [];
}

module.exports = { identify, info, offers, AI_GROUPS: Object.keys(GROUPS) };
