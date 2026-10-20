// Pure marketplace-search logic shared by every runtime: URLs, in-page extractor, relevance filter.
const AVITO_CITY = {
  'вся россия': 'rossiya', 'россия': 'rossiya', 'москва': 'moskva', 'санкт-петербург': 'sankt-peterburg', 'спб': 'sankt-peterburg', 'питер': 'sankt-peterburg',
  'новосибирск': 'novosibirsk', 'екатеринбург': 'ekaterinburg', 'казань': 'kazan', 'нижний новгород': 'nizhniy_novgorod', 'челябинск': 'chelyabinsk',
  'самара': 'samara', 'омск': 'omsk', 'ростов-на-дону': 'rostov-na-donu', 'уфа': 'ufa', 'красноярск': 'krasnoyarsk', 'воронеж': 'voronezh', 'пермь': 'perm',
  'волгоград': 'volgograd', 'краснодар': 'krasnodar', 'саратов': 'saratov', 'тюмень': 'tyumen', 'тольятти': 'tolyatti', 'ижевск': 'izhevsk',
  'барнаул': 'barnaul', 'иркутск': 'irkutsk', 'хабаровск': 'habarovsk', 'ярославль': 'yaroslavl', 'владивосток': 'vladivostok', 'томск': 'tomsk',
  'оренбург': 'orenburg', 'кемерово': 'kemerovo', 'рязань': 'ryazan', 'астрахань': 'astrahan', 'пенза': 'penza', 'липецк': 'lipetsk', 'тула': 'tula',
  'киров': 'kirov', 'калининград': 'kaliningrad', 'сочи': 'sochi', 'севастополь': 'sevastopol', 'симферополь': 'simferopol', 'махачкала': 'mahachkala',
  'набережные челны': 'naberezhnye_chelny', 'ульяновск': 'ulyanovsk', 'тверь': 'tver', 'брянск': 'bryansk', 'иваново': 'ivanovo', 'белгород': 'belgorod',
  'курск': 'kursk', 'владимир': 'vladimir', 'калуга': 'kaluga', 'смоленск': 'smolensk', 'чебоксары': 'cheboksary', 'сургут': 'surgut', 'якутск': 'yakutsk',
  'мурманск': 'murmansk', 'архангельск': 'arhangelsk', 'вологда': 'vologda', 'псков': 'pskov', 'великий новгород': 'velikiy_novgorod', 'петрозаводск': 'petrozavodsk',
  'улан-удэ': 'ulan-ude', 'чита': 'chita', 'новокузнецк': 'novokuznetsk', 'ставрополь': 'stavropol', 'пятигорск': 'pyatigorsk', 'грозный': 'groznyy'
};
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ' ': '_' };
const avitoCity = c => { const k = (c || '').trim().toLowerCase(); return !k ? 'rossiya' : AVITO_CITY[k] || [...k].map(ch => TR[ch] ?? ch).join(''); };

const SITES = {
  avito: { url: (q, city) => `https://www.avito.ru/${avitoCity(city)}?q=${q}`, link: '/[a-z_-]+/[a-z_]+/[^/?]+_\\d{6,}', cond: 'used', name: 'Авито' },
  wb:    { url: q => `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`, link: '/catalog/\\d+/detail\\.aspx', cond: 'new', name: 'Wildberries' },
  ozon:  { url: q => `https://www.ozon.ru/search/?text=${q}&from_global=true`, link: '/product/[^/?]+', cond: 'new', name: 'Ozon' },
  ym:    { url: q => `https://market.yandex.ru/search?text=${q}`, link: '/(product--|card/)[^?]+', cond: 'new', name: 'Яндекс Маркет' }
};

const BLOCK = /доступ ограничен|проблема с ip|капч|captcha|выключите vpn|нет соединения|подтвердите,? что вы|вы не робот|are you human|access denied|too many requests|проверка браузера/i;

// Runs inside the page: finds product tiles by their link pattern and reads title/price/place/image
function extractor(linkRe) {
  const re = new RegExp(linkRe);
  const seen = new Set(), out = [];
  const priceOf = t => { const m = t.replace(/ | /g, ' ').match(/(\d{1,3}(?:[ ]\d{3})+|\d{3,7})\s?₽/); return m ? +m[1].replace(/ /g, '') : 0; };
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.href.split('?')[0];
    if (!re.test(new URL(a.href).pathname) || seen.has(href)) continue;
    // climb to the tile: smallest ancestor that contains a price
    let el = a, tile = null;
    for (let i = 0; i < 7 && el; i++, el = el.parentElement) if (/₽/.test(el.innerText || '')) { tile = el; break; }
    if (!tile || (tile.innerText || '').length > 1500) continue;
    seen.add(href);
    const text = tile.innerText;
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const title = (a.getAttribute('title') || a.innerText || '').trim().length > 8 ? (a.getAttribute('title') || a.innerText).trim()
      : lines.filter(l => !/₽|%|★|отзыв|оцен/i.test(l)).sort((x, y) => y.length - x.length)[0] || '';
    const img = tile.querySelector('img');
    const place = tile.querySelector('[data-marker="item-address"], [class*="geo"], [class*="address"]')?.innerText?.trim() || '';
    const date = tile.querySelector('[data-marker="item-date"]')?.innerText?.trim() || '';
    out.push({ title: title.slice(0, 160), price: priceOf(text), url: href, image: img?.currentSrc || img?.src || '', place: place.split('\n')[0].slice(0, 80), date, text: text.slice(0, 400) });
    if (out.length >= 60) break;
  }
  return out;
}

// relevance: the listing must mention the model's key tokens and not be an accessory
const STOP = new Set(['с', 'и', 'в', 'для', 'на', 'без', 'the', 'and', 'with', 'активным', 'шумоподавлением', 'беспроводные', 'наушники', 'смартфон', 'новый', 'оригинал']);
const ACCESSORY = /чех(ол|лы)|кейс\b|case\b|накладк|для\s|совместим|аналог|копия|replica|реплик|ремеш|плёнк|пленк|стекл|кабел|зарядн|адаптер|амбушюр|насадк|подставк|держател|сумк|футляр\s+для|запчаст|корпус для/i;
function relevant(title, query) {
  const t = title.toLowerCase().replace(/ё/g, 'е');
  const toks = query.toLowerCase().replace(/ё/g, 'е').replace(/[()«»"',.]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 0);
  const key = toks.filter(w => /[a-z0-9]/.test(w) || w.length > 3);
  if (!key.length) return true;
  const hit = key.filter(w => t.includes(w)).length;
  if (/\d/.test(query) && !key.filter(w => /\d/.test(w)).every(w => new RegExp(`(^|[^\\d])${w}([^\\d]|$)`).test(t))) return false;
  if (ACCESSORY.test(t) && !ACCESSORY.test(query.toLowerCase())) return false;
  // "без шумоподавления" contradicts a query that asks for it
  const ql = query.toLowerCase();
  for (const m of t.matchAll(/без\s+([а-яa-z]+)\s*([а-яa-z]+)?/g)) {
    const w = (m[2] && m[1].length < 5 ? m[2] : m[1]).slice(0, 6);
    if (ql.includes(w) && !ql.includes('без ' + m[1])) return false;
  }
  return hit / key.length >= 0.6;
}

const condFromText = (t, def) => /уценк|уценён|витрин/i.test(t) ? 'discounted' : /восстановл|refurb/i.test(t) ? 'refurbished'
  : /\bб\/у\b|\bбу\b|был в употреб|подержан/i.test(t) ? 'used' : /\bнов(ый|ые|ая)\b|запечат|не вскрыв/i.test(t) ? 'new' : def;


module.exports = { SITES, BLOCK, extractor, relevant, condFromText, avitoCity };
