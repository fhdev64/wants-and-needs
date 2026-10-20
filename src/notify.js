// Branded price alert popup (a small frameless window in the corner of the screen)
const a = JSON.parse(decodeURIComponent(location.hash.slice(1)));
const $ = id => document.getElementById(id);
const rub = n => n == null ? '—' : Math.round(n).toLocaleString('ru-RU') + ' ₽';

$('kind').textContent = a.kind === 'target' ? '🎯 цель достигнута' : '📉 подешевело';
$('name').textContent = a.name;
$('new').textContent = rub(a.newPrice);
if (a.oldPrice && a.oldPrice !== a.newPrice) $('old').textContent = rub(a.oldPrice); else $('old').remove();
if (a.pct) $('badge').textContent = '−' + a.pct + '%'; else $('badge').remove();
$('store').textContent = [a.store, a.kind === 'target' ? 'цель ' + rub(a.target) : ''].filter(Boolean).join(' · ');
if (/^https:\/\//.test(a.image || '')) {
  const im = new Image(); im.src = a.image; im.referrerPolicy = 'no-referrer';
  im.onerror = () => { $('img').className = 'img none'; $('img').textContent = '✦'; };
  $('img').append(im);
} else { $('img').className = 'img none'; $('img').textContent = '✦'; }

const card = $('card');
requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('in')));
const close = () => { card.classList.replace('in', 'out'); setTimeout(() => window.close(), 420); };
let timer = setTimeout(close, 9000);
card.onmouseenter = () => clearTimeout(timer);
card.onmouseleave = () => { timer = setTimeout(close, 3000); };
$('x').onclick = e => { e.stopPropagation(); close(); };
card.onclick = () => { location.href = 'hotelkino://open/' + a.itemId; };
