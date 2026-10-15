// Liquid Glass engine: real edge lensing via per-element SVG displacement maps
// applied through backdrop-filter, plus pointer-driven specular light.
(() => {
  const defs = document.getElementById('lensDefs');
  const NS = 'http://www.w3.org/2000/svg';
  const reduceT = matchMedia('(prefers-reduced-transparency: reduce)');
  let uid = 0;

  // signed distance to a rounded box (centered), returns [dist, nx, ny]
  function sdf(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const outside = Math.hypot(ox, oy), inside = Math.min(Math.max(qx, qy), 0);
    let nx, ny;
    if (qx > 0 && qy > 0) { nx = ox / (outside || 1); ny = oy / (outside || 1); }
    else if (qx > qy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
    return [outside + inside - r, nx * Math.sign(px || 1), ny * Math.sign(py || 1)];
  }

  function buildMap(w, h, r, bezel) {
    const s = 0.5; // half-res map, upscaled by feImage
    const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const hw = w / 2, hh = h / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x / s - hw, py = y / s - hh;
      const [dist, nx, ny] = sdf(px, py, hw, hh, r);
      const t = Math.min(1, Math.max(0, -dist / bezel));        // 0 at edge → 1 inside bezel
      const mag = t >= 1 ? 0 : Math.pow(1 - t, 2.2);            // convex squircle-ish profile
      const i = (y * W + x) * 4;
      d[i] = 128 - nx * mag * 127;   // sample inward → content bends at the rim
      d[i + 1] = 128 - ny * mag * 127;
      d[i + 2] = 128; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function lens(el) {
    const rect = el.getBoundingClientRect();
    const w = Math.round(el.offsetWidth || rect.width), h = Math.round(el.offsetHeight || rect.height);
    if (w < 4 || h < 4) return;
    const key = w + 'x' + h;
    if (el._lensKey === key) return;
    el._lensKey = key;
    const r = Math.min(parseFloat(el.dataset.lens) || 20, w / 2, h / 2);
    const bezel = Math.min(r * 0.9 + 6, w / 2, h / 2, 26);
    const id = el._lensId || (el._lensId = 'lens' + (++uid));
    let f = document.getElementById(id);
    if (!f) {
      f = document.createElementNS(NS, 'filter');
      f.id = id; f.setAttribute('color-interpolation-filters', 'sRGB');
      f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse');
      f.innerHTML = '<feImage result="m" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="m" xChannelSelector="R" yChannelSelector="G"/>';
      defs.appendChild(f);
    }
    ['x', 'y'].forEach(a => f.setAttribute(a, 0));
    f.setAttribute('width', w); f.setAttribute('height', h);
    const im = f.querySelector('feImage');
    im.setAttribute('href', buildMap(w, h, r, bezel));
    im.setAttribute('x', 0); im.setAttribute('y', 0); im.setAttribute('width', w); im.setAttribute('height', h);
    f.querySelector('feDisplacementMap').setAttribute('scale', el.classList.contains('lg-clear') ? 46 : 36);
    el.style.setProperty('--lens', `url(#${id})`);
  }

  const ro = new ResizeObserver(es => es.forEach(e => lens(e.target)));
  const seen = new WeakSet();
  function scan(root = document) {
    if (reduceT.matches) return;
    root.querySelectorAll?.('.lg').forEach(el => { if (!seen.has(el)) { seen.add(el); ro.observe(el); lens(el); } });
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.classList.contains('lg')) scan(n.parentNode); else scan(n);
  }))).observe(document.body, { childList: true, subtree: true });
  window.Glass = { scan, refresh: el => { el._lensKey = null; lens(el); } };
  addEventListener('DOMContentLoaded', () => scan());
  scan();

  // Specular light follows the pointer (desktop analogue of device-motion highlights)
  addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--px', e.clientX + 'px');
    document.documentElement.style.setProperty('--py', e.clientY + 'px');
    const t = e.target.closest?.('.lg, .btn');
    if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
  }, { passive: true });

  // Interactive glass: grows & illuminates from within while pressed
  addEventListener('pointerdown', e => {
    const t = e.target.closest('.btn, .icon-btn, .nav-btn, .seg button');
    if (!t) return;
    t.classList.add('pressed');
    const up = () => { t.classList.remove('pressed'); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
})();
