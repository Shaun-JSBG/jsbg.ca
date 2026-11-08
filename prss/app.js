/* Highland Cow designer (jsbg.ca/prss/). Static page; logins and designs live in an Apps Script web app (config.js). */
(function () {
  'use strict';
  var API = window.PRSS.api;
  var $ = function (id) { return document.getElementById(id); };
  var PARTS = [
    { t: 'Body', s: 'body, head, tail' },
    { t: 'Trim', s: 'horns, hooves, muzzle' },
    { t: 'Eyes', s: 'the eyes' },
    { t: 'Eye shine', s: 'little dots in the eyes' }
  ];
  var DEFAULT_SEL = [62, 55, 70, 61];
  var S = { user: '', token: '', phase: 'closed', max: 3, maxDrafts: 20, notice: '', deadline: '', drafts: [], tab: 'design', active: 0, sel: DEFAULT_SEL.slice(),
            editId: null, lights: false, votes: 0, swatches: [], byN: {}, lastSync: 0 };

  /* ---------- small helpers ---------- */
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var bannerTimer;
  function banner(msg, info) {
    var b = $('banner'); b.textContent = msg; b.className = info ? 'info' : ''; b.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(function () { b.hidden = true; }, info ? 4000 : 9000);
  }
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgba(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---------- server calls ---------- */
  function api(action, extra, retry) {
    var body = JSON.stringify(Object.assign({ action: action, t: S.token }, extra || {}));
    var tries = retry === false ? 1 : 2;
    function once(n) {
      var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 30000);
      return (window.PRSS.fetch || fetch)(API, { method: 'POST', body: body, signal: ctl.signal, redirect: 'follow' })
        .then(function (r) { clearTimeout(to); return r.json(); })
        .then(function (j) {
          if (!j.ok) { var e = new Error(j.message || 'Something went wrong.'); e.code = j.error || 'server'; throw e; }
          return j;
        }, function () {
          clearTimeout(to);
          if (n < tries) return once(n + 1);
          var e = new Error("Can't reach the server. Check your connection and try again."); e.code = 'network'; throw e;
        });
    }
    return once(1);
  }
  function handleError(e) {
    if (e.code === 'auth') { logout(); banner('Please log in again.'); return; }
    banner(e.message || 'Something went wrong.');
  }

  /* ---------- cow drawing: recolor pre-rendered layers in the browser, with a look per filament type ---------- */
  var L = null;                                   // layer images as pixel arrays, plus noise textures
  var outData = null;
  function loadLayers(dir) {
    var names = ['ids_a', 'ids_b', 'diffuse', 'spec_basic', 'spec_silk', 'fx'], got = {};
    return Promise.all(names.map(function (n) {
      return new Promise(function (res, rej) {
        var im = new Image(); im.onload = function () {
          var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          var x = c.getContext('2d'); x.drawImage(im, 0, 0); got[n] = x.getImageData(0, 0, im.width, im.height).data; got.w = im.width; got.h = im.height; res();
        }; im.onerror = function () { rej(new Error('layer ' + n)); }; im.src = dir + '/' + n + '.png';
      });
    })).then(function () { got.tex = makeTex(got.w, got.h); return got; });
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeTex(w, h) {                        // fixed random fleck patterns (same every time)
    var rnd = mulberry(20261107), N = w * h, small = new Uint8Array(N), mid = new Uint8Array(N), big = new Uint8Array(N), mot = new Uint8Array(N);
    function put(a, x, y, v) { if (x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = v; }
    function dots(a, count, shape) {
      for (var k = 0; k < count; k++) {
        var x = (rnd() * w) | 0, y = (rnd() * h) | 0, v = 130 + ((rnd() * 126) | 0);
        put(a, x, y, v);
        if (shape >= 1) { put(a, x + 1, y, v); put(a, x, y + 1, v); put(a, x + 1, y + 1, v); }
        if (shape >= 2) { put(a, x - 1, y, v); put(a, x, y - 1, v); put(a, x + 2, y, v); put(a, x, y + 2, v); }
      }
    }
    dots(small, N * 0.016, 0); dots(mid, N * 0.0042, 1); dots(big, N * 0.0013, 2);
    var G = 22, g = [], i, j;
    for (i = 0; i <= G; i++) { g.push([]); for (j = 0; j <= G; j++) g[i].push(rnd()); }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var u = x / w * G, v2 = y / h * G, iu = u | 0, iv = v2 | 0, fu = u - iu, fv = v2 - iv;
      fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
      var a0 = g[iv][iu] * (1 - fu) + g[iv][iu + 1] * fu, a1 = g[iv + 1][iu] * (1 - fu) + g[iv + 1][iu + 1] * fu;
      mot[y * w + x] = (a0 * (1 - fv) + a1 * fv) * 255;
    }
    return { small: small, mid: mid, big: big, mot: mot };
  }
  function prep(sel) {
    return sel.map(function (v) {
      var s = S.byN[v] || { kind: 'basic', hex: '#888888' };
      return { k: s.kind, c: rgb(s.hex), c2: s.hex2 ? rgb(s.hex2) : null, fl: (s.flakes || []).map(rgb) };
    });
  }
  // colour of one slot at one pixel; writes into o
  function slotColor(sl, sh, spB, spS, t, rim, spM, i, T, o, off) {
    var c = sl.c, r = c[0], g = c[1], b = c[2], k = sl.k, m, f, a, fc, ix;
    if (off) {                                    // lights off: only glow-in-the-dark parts shine
      if (k === 'glow') { m = 0.5 + 0.5 * sh * (1 - rim * 0.3); o[0] = (r * 0.3 + 90 * 0.7) * m; o[1] = (g * 0.3 + 245 * 0.7) * m; o[2] = (b * 0.3 + 208 * 0.7) * m; }
      else { o[0] = r * sh * 0.09 + rim * 8; o[1] = g * sh * 0.09 + rim * 8; o[2] = b * sh * 0.09 + rim * 10; }
      return;
    }
    if (k === 'dual') { var c2 = sl.c2; r = c2[0] + (r - c2[0]) * t; g = c2[1] + (g - c2[1]) * t; b = c2[2] + (b - c2[2]) * t; k = 'silk'; }
    switch (k) {
      case 'matte': o[0] = r * sh; o[1] = g * sh; o[2] = b * sh; break;
      case 'silk': m = 0.8 * sh + 0.1; o[0] = r * m + spS * 1.7 + rim * 34; o[1] = g * m + spS * 1.7 + rim * 34; o[2] = b * m + spS * 1.7 + rim * 34; break;
      case 'metal': m = 0.42 * sh + 0.1; f = spM * 2.1 / 255;
        o[0] = r * m + (r * 0.55 + 140) * f + spB * 0.5 + rim * 22 * r / 255; o[1] = g * m + (g * 0.55 + 140) * f + spB * 0.5 + rim * 22 * g / 255; o[2] = b * m + (b * 0.55 + 140) * f + spB * 0.5 + rim * 22 * b / 255; break;
      case 'translucent': m = 0.66 + 0.34 * sh;
        o[0] = (r + (255 - r) * 0.3) * m + spB * 3 + rim * 70; o[1] = (g + (255 - g) * 0.3) * m + spB * 3 + rim * 70; o[2] = (b + (255 - b) * 0.3) * m + spB * 3 + rim * 70; break;
      case 'neon': m = 0.84 + 0.16 * sh; o[0] = r * m * 1.08 + rim * 36 + spB; o[1] = g * m * 1.08 + rim * 36 + spB; o[2] = b * m * 1.08 + rim * 36 + spB; break;
      case 'glow': m = 0.6 + 0.4 * sh; o[0] = (r + (255 - r) * 0.25) * m + spB * 1.6; o[1] = (g + (255 - g) * 0.25) * m + spB * 1.6; o[2] = (b + (255 - b) * 0.25) * m + spB * 1.6; break;
      case 'sparkle': case 'galaxy': case 'glitter': case 'marble': {
        var hl = k === 'marble' ? 0 : spB;
        o[0] = r * sh + hl; o[1] = g * sh + hl; o[2] = b * sh + hl;
        var mot = T.mot[i] / 255;
        if (k === 'galaxy') {                     // dark nebula with tiny stars
          var n = 0.78 + 0.5 * mot; o[0] *= n; o[1] *= n; o[2] *= n;
          if ((f = T.small[i])) { a = 0.55 + f / 255 * 0.45; fc = sl.fl.length ? sl.fl[f % sl.fl.length] : [255, 255, 255]; o[0] += (fc[0] - o[0]) * a; o[1] += (fc[1] - o[1]) * a; o[2] += (fc[2] - o[2]) * a; }
          if ((f = T.mid[i])) { o[0] += 150 + f * 0.4; o[1] += 150 + f * 0.4; o[2] += 150 + f * 0.4; }
        } else if (k === 'sparkle') {             // fine metallic flecks
          if ((f = T.small[i] || T.mid[i])) { a = 0.9; fc = sl.fl.length ? sl.fl[f % sl.fl.length] : [255, 255, 255]; var q = 0.7 + 0.5 * sh; o[0] += (fc[0] * q - o[0]) * a; o[1] += (fc[1] * q - o[1]) * a; o[2] += (fc[2] * q - o[2]) * a; }
          if (T.big[i]) { o[0] = 255; o[1] = 255; o[2] = 255; }
        } else if (k === 'glitter') {             // bigger, brighter flakes
          if ((f = T.mid[i] || T.big[i])) {
            var vv = f % 3;                       // mix of white, pale and deep flakes so they show on any base color
            if (vv === 0) { o[0] = 255; o[1] = 255; o[2] = 255; }
            else if (vv === 1) { fc = sl.fl.length ? sl.fl[f % sl.fl.length] : [255, 255, 255]; o[0] = fc[0]; o[1] = fc[1]; o[2] = fc[2]; }
            else { o[0] = r * 0.45; o[1] = g * 0.45; o[2] = b * 0.45; }
            var z = 0.85 + 0.3 * sh; o[0] *= z; o[1] *= z; o[2] *= z;
          }
          if (T.small[i] > 215) { o[0] += 70; o[1] += 70; o[2] += 70; }
        } else {                                  // marble: soft veins and dark specks
          var v = 0.93 + 0.14 * mot; o[0] *= v; o[1] *= v; o[2] *= v;
          if ((f = T.small[i]) && f > 150) { a = 0.78; var sp = 80 * (0.8 + 0.4 * sh); o[0] += (sp - o[0]) * a; o[1] += (sp - o[1]) * a; o[2] += (sp + 6 - o[2]) * a; }
          else if (T.mid[i]) { o[0] *= 0.55; o[1] *= 0.55; o[2] *= 0.55; }
        }
        break; }
      default: o[0] = r * sh + spB; o[1] = g * sh + spB; o[2] = b * sh + spB;      // basic
    }
  }
  var tmp = [0, 0, 0];
  function paint(ctx, sel, off) {
    if (!L) return;
    var sl = prep(sel), A = L.ids_a, B = L.ids_b, D = L.diffuse, SB = L.spec_basic, SS = L.spec_silk, FX = L.fx, T = L.tex, N = L.w * L.h;
    if (!outData || outData.width !== L.w) outData = ctx.createImageData(L.w, L.h);
    var o = outData.data, w = [0, 0, 0, 0];
    for (var i = 0; i < N; i++) {
      var p = i * 4;
      w[0] = A[p] / 255; w[1] = A[p + 1] / 255; w[2] = A[p + 2] / 255; w[3] = B[p] / 255;
      var sum = w[0] + w[1] + w[2] + w[3];
      if (sum < 0.02) { o[p + 3] = 0; continue; }
      var sh = D[p] / (204 * sum); if (sh > 1.3) sh = 1.3;
      var cs = sum > 1 ? sum : 1, spB = SB[p] / cs, spS = SS[p] / cs, t = FX[p] / 255, rim = FX[p + 1] / 255, spM = FX[p + 2] / cs;
      var r = 0, g = 0, b = 0;
      for (var s = 0; s < 4; s++) {
        if (w[s] < 0.004) continue;
        slotColor(sl[s], sh, spB, spS, t, rim, spM, i, T, tmp, off);
        var q = w[s] / sum; r += tmp[0] * q; g += tmp[1] * q; b += tmp[2] * q;
      }
      o[p] = r > 255 ? 255 : r; o[p + 1] = g > 255 ? 255 : g; o[p + 2] = b > 255 ? 255 : b; o[p + 3] = (sum > 1 ? 1 : sum) * 255;
    }
    ctx.putImageData(outData, 0, 0);
  }
  var mainCtx = $('cv').getContext('2d'), off = document.createElement('canvas'), offCtx;
  function drawMain() { paint(mainCtx, S.sel, S.lights); $('cvLoading').hidden = !!L; $('stage').classList.toggle('dark', S.lights); }
  function drawThumb(canvas, sel) {
    if (!L) return;
    if (!offCtx) { off.width = L.w; off.height = L.h; offCtx = off.getContext('2d'); }
    paint(offCtx, sel, false);
    var c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- swatch looks and symbols ---------- */
  var KINDS = {
    sparkle:     { name: 'Sparkle', hint: 'fine glittery flecks', icon: '<path d="M12 2.5l2.3 6.7 6.7 2.3-6.7 2.3-2.3 6.7-2.3-6.7L3 11.5l6.7-2.3z"/>' },
    galaxy:      { name: 'Galaxy', hint: 'dark with tiny stars', icon: '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-28 12 12)"/><circle cx="12" cy="12" r="3.2" fill="#fff"/><circle cx="5" cy="5.5" r=".9" fill="#fff"/><circle cx="19" cy="18" r=".9" fill="#fff"/>' },
    glitter:     { name: 'Glitter', hint: 'bigger shiny flakes', icon: '<path d="M7 4l2 2-2 2-2-2z M16 9l2.5 2.5L16 14l-2.5-2.5z M8 15l2 2-2 2-2-2z M18 17l1.5 1.5L18 20l-1.5-1.5z"/>' },
    marble:      { name: 'Marble', hint: 'speckled', icon: '<path d="M3 8c3-5 6-3 8 1s6 3 10-1M3 16c3-4 6-2 8 1s6 3 10-1"/>' },
    glow:        { name: 'Glows in the dark', hint: 'try “Lights off”', icon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>' },
    silk:        { name: 'Silk', hint: 'smooth and shiny', icon: '<path d="M3 15c4-7 8 6 12-2s5-3 6-1"/><path d="M3 9c3-3 6 2 9 0"/>' },
    dual:        { name: 'Two-color silk', hint: 'shifts between two colors', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="#fff"/>' },
    metal:       { name: 'Metallic', hint: 'shiny like metal', icon: '<path d="M12 3l8 6-8 12L4 9z M4 9h16 M9 9l3 12 3-12"/>' },
    translucent: { name: 'See-through', hint: 'clear like glass', icon: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12z"/>' },
    neon:        { name: 'Neon bright', hint: 'super bright', icon: '<path d="M13 2L4 14h7l-1 8 10-13h-7z"/>' }
  };
  function iconSvg(kind, size) {
    var k = KINDS[kind]; if (!k) return '';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + k.icon + '</svg>';
  }
  var DOTS = function (pts, col, r) { return pts.map(function (p) { return 'radial-gradient(circle at ' + p[0] + '% ' + p[1] + '%,' + col + ' 0 ' + r + 'px,transparent ' + (r + .7) + 'px)'; }).join(','); };
  function swatchBg(s) {
    var h = s.hex;
    switch (s.kind) {
      case 'sparkle': return DOTS([[20, 25], [68, 18], [45, 60], [82, 72], [18, 80], [60, 38]], '#fff', 1.3) + ',' + h;
      case 'galaxy': return DOTS([[20, 25], [70, 20], [45, 55], [85, 70], [15, 78], [58, 82], [35, 40], [88, 35]], '#fff', .9) + ',radial-gradient(ellipse at 35% 40%,' + rgba('#ffffff', .22) + ',transparent 70%),' + h;
      case 'glitter': return DOTS([[22, 28], [70, 24], [48, 62], [80, 74], [20, 80]], '#fff', 2) + ',' + DOTS([[40, 20], [58, 78], [85, 45]], '#cfefff', 1.4) + ',' + h;
      case 'marble': return DOTS([[22, 30], [64, 22], [44, 66], [80, 70], [18, 78], [86, 38], [52, 40]], '#5a5a60', 1.3) + ',linear-gradient(120deg,rgba(0,0,0,.06),transparent 40%,rgba(0,0,0,.08)),' + h;
      case 'glow': return 'radial-gradient(circle at 50% 45%,#fff 0,' + rgba(h, 1) + ' 85%)';
      case 'silk': return 'linear-gradient(120deg,rgba(255,255,255,0) 22%,rgba(255,255,255,.7) 46%,rgba(255,255,255,0) 64%),' + h;
      case 'dual': return 'linear-gradient(120deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.45) 48%,rgba(255,255,255,0) 62%),linear-gradient(135deg,' + h + ' 10%,' + (s.hex2 || h) + ' 90%)';
      case 'metal': return 'linear-gradient(135deg,' + h + ' 0%,rgba(255,255,255,.75) 32%,' + h + ' 52%,rgba(0,0,0,.35) 100%),' + h;
      case 'translucent': return 'linear-gradient(' + rgba(h, .72) + ',' + rgba(h, .72) + '),conic-gradient(#bbb 25%,#fff 0 50%,#bbb 0 75%,#fff 0) 0 0/10px 10px';
      case 'neon': return 'radial-gradient(circle at 50% 50%,rgba(255,255,255,.35),transparent 70%),' + h;
      default: return h;
    }
  }

  /* ---------- design view ---------- */
  function buildGrid() {
    var g = $('grid'); g.innerHTML = '';
    S.swatches.forEach(function (s) {
      var b = el('button', 'sw' + (s.special ? ' special' : '')); b.type = 'button'; b.style.background = swatchBg(s); b.title = s.label + (KINDS[s.kind] ? ' · ' + KINDS[s.kind].name : '');
      b.setAttribute('aria-label', s.label); b.dataset.n = s.n;
      if (KINDS[s.kind]) { var bd = el('span', 'badge'); bd.innerHTML = iconSvg(s.kind, 13); b.appendChild(bd); }
      if (s.kind === 'neon') b.style.boxShadow = '0 0 9px 1px ' + s.hex;
      b.addEventListener('click', function () { S.sel[S.active] = s.n; saveSel(); refreshDesign(); });
      g.appendChild(b);
    });
    var lg = $('legend'); lg.innerHTML = '';
    var seen = {}; S.swatches.forEach(function (s) { seen[s.kind] = 1; });
    Object.keys(KINDS).forEach(function (k) {
      if (!seen[k]) return;
      var chip = el('span', 'chip'); var ic = el('span', 'badge'); ic.innerHTML = iconSvg(k, 13); chip.appendChild(ic); chip.appendChild(document.createTextNode(KINDS[k].name)); chip.title = KINDS[k].hint; lg.appendChild(chip);
    });
  }
  function saveSel() { store('prss_sel', JSON.stringify(S.sel)); }
  function lbl(v) { var s = S.byN[v]; return s ? s.label : 'Unknown'; }
  function refreshDesign() {
    var parts = $('parts'); parts.innerHTML = '';
    PARTS.forEach(function (p, i) {
      var b = el('button', 'part'); b.type = 'button'; b.setAttribute('aria-pressed', i === S.active);
      var d = el('span', 'dot'); var sw = S.byN[S.sel[i]]; if (sw) d.style.background = swatchBg(sw);
      var t = el('span'); t.appendChild(el('small', null, p.s)); t.appendChild(el('b', null, p.t));
      b.appendChild(d); b.appendChild(t); b.addEventListener('click', function () { S.active = i; refreshDesign(); });
      parts.appendChild(b);
    });
    var cur = S.sel[S.active];
    Array.prototype.forEach.call($('grid').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.n) === String(cur)); });
    $('summary').textContent = S.sel.map(function (v, i) { return PARTS[i].t + ': ' + lbl(v); }).join('  ·  ');
    var editing = !!S.editId && S.drafts.some(function (d) { return d.id === S.editId; });
    if (!editing) S.editId = null;
    $('editTitle').textContent = editing ? 'Editing your design' : 'Design your cow';
    $('saveBtn').textContent = editing ? 'Save changes' : 'Save design';
    $('saveNewBtn').hidden = !editing; $('newBtn').hidden = !editing;
    var subs = S.drafts.filter(function (d) { return d.submitted; }).length;
    $('saveBtn').disabled = !editing && S.drafts.length >= S.maxDrafts;
    $('saveNote').textContent = 'You have saved ' + S.drafts.length + ' of ' + S.maxDrafts + ' designs and submitted ' + subs + ' of ' + S.max + '. Submit your favorites in My designs.' + (editing && S.drafts.some(function (d) { return d.id === S.editId && d.submitted; }) ? ' This one is submitted, so saving changes updates your submission.' : '');
    drawMain();
  }
  function saveDraft(asNew) {
    var btn = asNew ? $('saveNewBtn') : $('saveBtn'), old = btn.textContent; btn.disabled = true; btn.textContent = 'Saving...';
    var payload = { parts: S.sel, name: $('cowName').value };
    if (S.editId && !asNew) payload.id = S.editId;
    api('save', payload, false).then(function (j) {
      S.editId = j.savedId; applyState(j); banner('Saved to My designs.', true);
    }).catch(handleError).then(function () { btn.textContent = old; refreshDesign(); });
  }
  $('saveBtn').addEventListener('click', function () { saveDraft(false); });
  $('saveNewBtn').addEventListener('click', function () { saveDraft(true); });
  $('newBtn').addEventListener('click', function () { S.editId = null; $('cowName').value = ''; refreshDesign(); });
  $('lightsOff').addEventListener('change', function (e) { S.lights = e.target.checked; drawMain(); });

  /* ---------- my designs (gallery) ---------- */
  var STATUS = { pending: 'Submitted', approved: 'Picked for voting', rejected: 'Not picked this time' };
  function editDraft(d) {
    S.editId = d.id; S.sel = d.spec.slice(); $('cowName').value = d.name; saveSel(); showTab('design');
  }
  function card(d, compact, canEdit) {
    var c = el('div', 'mini' + (d.submitted ? ' picked' : '')), cv = el('canvas'); cv.width = compact ? 260 : 320; cv.height = cv.width; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Design ' + (d.name || ''));
    c.appendChild(cv);
    c.appendChild(el('h2', null, d.name || 'Unnamed design'));
    if (d.submitted) c.appendChild(el('span', 'st ' + d.status, STATUS[d.status] || d.status));
    if (!compact) { var ul = el('ul'); d.spec.forEach(function (v, i) { ul.appendChild(el('li', null, PARTS[i].t + ': ' + lbl(v))); }); c.appendChild(ul); }
    if (canEdit) {
      var row = el('div', 'btns');
      var eb = el('button', 'small', 'Edit'); eb.type = 'button'; eb.addEventListener('click', function () { editDraft(d); }); row.appendChild(eb);
      var sb;
      if (d.submitted) {
        sb = el('button', 'small', 'Remove from picks'); sb.type = 'button';
        sb.addEventListener('click', function () { act(sb, 'unsubmit', d, 'Removed from your picks.'); });
      } else {
        sb = el('button', 'small go', 'Submit'); sb.type = 'button';
        var full = S.drafts.filter(function (x) { return x.submitted; }).length >= S.max;
        sb.disabled = full; if (full) sb.title = 'Remove one of your picks first';
        sb.addEventListener('click', function () { act(sb, 'submit', d, 'Submitted!'); });
      }
      row.appendChild(sb);
      if (!compact) {
        var db = el('button', 'small danger', 'Delete'); db.type = 'button';
        db.addEventListener('click', function () {
          if (!window.confirm('Delete this design' + (d.submitted ? ' and take it out of your picks' : '') + '?')) return;
          act(db, 'delete', d, 'Deleted.');
        });
        row.appendChild(db);
      }
      c.appendChild(row);
    }
    if (L) drawThumb(cv, d.spec); else c._cv = cv;
    return c;
  }
  function act(btn, action, d, msg) {
    var old = btn.textContent; btn.disabled = true; btn.textContent = '...';
    api(action, { id: d.id }, false).then(function (j) { if (S.editId === d.id && action === 'delete') S.editId = null; applyState(j); banner(msg, true); })
      .catch(function (e) { btn.disabled = false; btn.textContent = old; handleError(e); });
  }
  function renderGallery() {
    var open = S.phase === 'submissions', subs = S.drafts.filter(function (d) { return d.submitted; });
    $('galCount').textContent = '(' + S.drafts.length + ')';
    $('picksCount').textContent = '(' + subs.length + ' of ' + S.max + ')';
    $('picksNote').textContent = open ? 'These are the designs you have submitted. You can still change them or swap them until sending closes.' : 'These are the designs you submitted.';
    var pk = $('picks'); pk.innerHTML = '';
    subs.forEach(function (d) { pk.appendChild(card(d, true, open)); });
    for (var i = subs.length; i < S.max; i++) { var e = el('div', 'mini empty'); e.appendChild(el('p', null, open ? 'Empty. Pick a design below and tap Submit.' : 'Empty')); pk.appendChild(e); }
    var box = $('cards'); box.innerHTML = '';
    $('galIntro').textContent = S.drafts.length ? '' : (open ? 'You have not saved a design yet. Go to Design, make one and tap Save design.' : 'You did not save any designs.');
    S.drafts.forEach(function (d) { box.appendChild(card(d, false, open)); });
  }

  /* ---------- views and state ---------- */
  function showTab(t) { S.tab = t; renderAll(); window.scrollTo(0, 0); }
  function renderAll() {
    $('whoName').textContent = S.user;
    var open = S.phase === 'submissions', voting = S.phase === 'voting', pill = $('phasePill');
    pill.textContent = open ? 'Sending designs is open' : voting ? 'Voting is open' : 'Closed';
    pill.className = 'pill' + (open || voting ? ' open' : '');
    var n = $('notice'); n.textContent = S.notice; n.hidden = !S.notice;
    var dl = $('deadline'); dl.textContent = S.deadline; dl.hidden = !S.deadline || !(open || voting);
    if (open && S.tab === 'vote') S.tab = 'design';
    if (voting && S.tab === 'design') S.tab = 'vote';
    $('tabs').hidden = !(open || voting);
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) {
      b.hidden = (b.dataset.tab === 'design' && !open) || (b.dataset.tab === 'vote' && !voting);
      b.setAttribute('aria-pressed', b.dataset.tab === S.tab);
    });
    $('designView').hidden = !(open && S.tab === 'design');
    var showVote = voting && S.tab === 'vote' && !S.vote.done;
    $('voteView').hidden = !showVote; $('doneView').hidden = !(voting && S.tab === 'vote' && S.vote.done);
    $('galleryView').hidden = (open || voting) ? S.tab !== 'gallery' : S.drafts.length === 0;
    var wait = $('waitView'); wait.hidden = open || voting;
    if (!open && !voting) { $('waitTitle').textContent = 'Closed for now'; $('waitText').textContent = 'Nothing is open right now. Check back later.'; }
    renderGallery(); refreshDesign();
    if (showVote) startVoting();
  }
  function applyState(j) {
    if (j.phase === 'voting') takeVoting(j);
    S.phase = j.phase; S.max = j.max; S.maxDrafts = j.maxDrafts || 20; S.notice = j.notice || ''; S.deadline = j.deadline || ''; S.drafts = j.drafts || []; S.lastSync = Date.now();
    store('prss_state', JSON.stringify({ u: S.user, phase: S.phase, max: S.max, maxDrafts: S.maxDrafts, notice: S.notice, deadline: S.deadline, drafts: S.drafts }));
    renderAll();
  }
  function showLogin() { $('appView').hidden = true; $('loginView').hidden = false; $('loginWait').hidden = true; $('loginBtn').disabled = false; }
  function showApp() { $('loginView').hidden = true; $('appView').hidden = false; renderAll(); }
  function logout() {
    S.token = ''; S.user = ''; S.drafts = []; S.editId = null; S.votes = 0; S.vote.buf = []; S.vote.queue = []; S.vote.current = null; S.vote.started = false; S.vote.done = false; S.vote.empty = false; S.vote.seen = []; store('prss_token', null); store('prss_user', null); store('prss_state', null);
    $('c').value = ''; $('cowName').value = ''; showLogin();
  }
  $('logoutBtn').addEventListener('click', logout);
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });

  /* ---------- mock-up pop-up shown after each login ---------- */
  function showMockup() {
    var d = $('mockup');
    function go() { paint($('mockCv').getContext('2d'), [61, 16, 70, 61], false); }
    if (L) go(); else layersReady.then(go);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    $('gotIt').focus();
  }
  $('gotIt').addEventListener('click', function () { var d = $('mockup'); if (d.close) d.close(); else d.removeAttribute('open'); });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('loginBtn'); btn.disabled = true; $('loginWait').hidden = false;
    api('login', { u: $('u').value, c: $('c').value }).then(function (j) {
      S.token = j.token; S.user = j.user; store('prss_token', S.token); store('prss_user', S.user);
      applyState(j); showApp(); showMockup();
    }).catch(function (err) { $('loginWait').hidden = true; btn.disabled = false; banner(err.message); });
  });

  function refresh(quiet) {
    if (!S.token) return Promise.resolve();
    return api('state').then(applyState).catch(function (e) { if (!quiet || e.code === 'auth') handleError(e); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.token && Date.now() - S.lastSync > 60000) refresh(true); });


  /* ---------- voting (this or that) ---------- */
  S.vote = { buf: [], queue: [], seen: [], current: null, prev: null, fetching: false, flushing: false, timer: null, undoTimer: null, started: false, done: false, empty: false };
  function takeVoting(j) {
    var V = S.vote;
    if (typeof j.votes === 'number') S.votes = Math.max(j.votes, S.votes);
    if (j.pairs && j.pairs.length && !V.buf.length && !V.current) addPairs(j.pairs);
  }
  function addPairs(list) {
    var V = S.vote, have = {}; V.buf.forEach(function (p) { have[p.k] = 1; }); if (V.current) have[V.current.k] = 1;
    list.forEach(function (p) { if (!have[p.k]) { V.buf.push(p); V.seen.push(p.k); have[p.k] = 1; } });
    if (V.seen.length > 200) V.seen = V.seen.slice(-200);
  }
  function startVoting() {
    var V = S.vote;
    if (V.started) { updateVoteUi(); if (V.current && L) { paint($('cvA').getContext('2d'), V.current.a.spec, false); paint($('cvB').getContext('2d'), V.current.b.spec, false); } return; }
    V.started = true; nextPair();
  }
  function updateVoteUi() { $('voteCount').textContent = S.votes === 1 ? '1 vote so far' : S.votes + ' votes so far'; }
  function nextPair() {
    var V = S.vote; updateVoteUi();
    if (V.buf.length < 5) fetchMore();
    if (!V.buf.length) { V.current = null; $('voteLoading').hidden = false; $('optA').disabled = $('optB').disabled = true;
      if (V.empty) { finishVoting("You have seen every pair there is. Thank you!"); } return; }
    var p = V.buf.shift(); V.current = p; $('voteLoading').hidden = true; $('optA').disabled = $('optB').disabled = false;
    $('optA').classList.remove('won'); $('optB').classList.remove('won');
    if (L) { paint($('cvA').getContext('2d'), p.a.spec, false); paint($('cvB').getContext('2d'), p.b.spec, false); }
  }
  function fetchMore() {
    var V = S.vote; if (V.fetching || V.empty) return; V.fetching = true;
    api('pairs', { seen: V.seen }).then(function (j) {
      V.fetching = false; if (typeof j.votes === 'number') S.votes = Math.max(j.votes, S.votes);
      if (!j.pairs.length) { V.empty = true; } else addPairs(j.pairs);
      if (!V.current) nextPair();
    }).catch(function (e) { V.fetching = false; if (e.code === 'closed') { refresh(); return; } handleError(e); if (!V.current) setTimeout(function () { if (!V.current && S.phase === 'voting') nextPair(); }, 4000); });
  }
  function choose(side) {
    var V = S.vote, p = V.current; if (!p) return;
    V.current = null;
    var win = side === 'a' ? p.a : p.b, lose = side === 'a' ? p.b : p.a, v = { w: win.id, l: lose.id, k: p.k };
    V.queue.push(v); V.prev = { pair: p, vote: v }; S.votes++;
    $(side === 'a' ? 'optA' : 'optB').classList.add('won'); $('optA').disabled = $('optB').disabled = true;
    $('undoBtn').hidden = false; clearTimeout(V.undoTimer); V.undoTimer = setTimeout(function () { $('undoBtn').hidden = true; V.prev = null; }, 6000);
    updateVoteUi(); scheduleFlush(V.queue.length >= 6 ? 0 : 6500);
    setTimeout(nextPair, 230);
  }
  function scheduleFlush(ms) { clearTimeout(S.vote.timer); S.vote.timer = setTimeout(flush, ms); }
  function flush() {
    var V = S.vote; if (V.flushing || !V.queue.length || !S.token) return;
    V.flushing = true; var batch = V.queue.splice(0, 30);
    api('vote', { votes: batch.map(function (v) { return { w: v.w, l: v.l }; }) }).then(function () { V.flushing = false; if (V.queue.length) scheduleFlush(1500); })
      .catch(function (e) { V.flushing = false; V.queue = batch.concat(V.queue); if (e.code === 'auth' || e.code === 'closed') { handleError(e); if (e.code === 'closed') refresh(); return; } scheduleFlush(8000); });
  }
  function flushOnLeave() {
    var V = S.vote; if (!V.queue.length || !S.token) return;
    var batch = V.queue.splice(0, 30);
    try { fetch(API, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'vote', t: S.token, votes: batch.map(function (v) { return { w: v.w, l: v.l }; }) }) }); } catch (e) { V.queue = batch.concat(V.queue); }
  }
  function finishVoting(msg) {
    var V = S.vote; flush(); V.done = true;
    $('doneText').textContent = msg || ('You voted ' + S.votes + (S.votes === 1 ? ' time.' : ' times.') + ' Your votes are saved. Come back whenever you like.');
    renderAll();
  }
  $('optA').addEventListener('click', function () { choose('a'); });
  $('optB').addEventListener('click', function () { choose('b'); });
  $('skipBtn').addEventListener('click', function () { var V = S.vote; if (V.current) { V.current = null; nextPair(); } });
  $('doneBtn').addEventListener('click', function () { finishVoting(); });
  $('moreBtn').addEventListener('click', function () { var V = S.vote; V.done = false; V.empty = false; V.current = null; V.started = false; renderAll(); });
  $('undoBtn').addEventListener('click', function () {
    var V = S.vote, pr = V.prev; if (!pr) return;
    var at = V.queue.indexOf(pr.vote); if (at < 0) { $('undoBtn').hidden = true; return; }
    V.queue.splice(at, 1); S.votes--; V.prev = null; $('undoBtn').hidden = true;
    if (V.current) V.buf.unshift(V.current);
    V.current = pr.pair; $('optA').disabled = $('optB').disabled = false; $('optA').classList.remove('won'); $('optB').classList.remove('won');
    paint($('cvA').getContext('2d'), pr.pair.a.spec, false); paint($('cvB').getContext('2d'), pr.pair.b.spec, false); updateVoteUi();
  });
  document.addEventListener('keydown', function (e) {
    if ($('voteView').hidden || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') choose('a'); else if (e.key === 'ArrowRight') choose('b');
  });
  window.addEventListener('pagehide', flushOnLeave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushOnLeave(); });

  /* ---------- start ---------- */
  var layersReady;
  function init() {
    try { var sv = JSON.parse(load('prss_sel') || 'null'); if (Array.isArray(sv) && sv.length === 4) S.sel = sv; } catch (e) {}
    S.token = load('prss_token') || ''; S.user = load('prss_user') || '';
    if (!S.token) { fetch(API, { mode: 'no-cors' }).catch(function () {}); }     // wake the server while they type
    var sw = fetch('swatches.json').then(function (r) { return r.json(); }).then(function (list) {
      S.swatches = list; list.forEach(function (s) { S.byN[s.n] = s; });
      S.sel = S.sel.map(function (v, i) { return (typeof v === 'number' && S.byN[v]) ? v : DEFAULT_SEL[i]; });
      buildGrid();
    });
    layersReady = loadLayers('layers').then(function (l) { L = l; renderAll(); }).catch(function () { banner('The cow picture could not load. Reload the page.'); });
    sw.then(function () {
      if (S.token) {
        try { var c = JSON.parse(load('prss_state') || 'null'); if (c && c.u === S.user) { S.phase = c.phase; S.max = c.max; S.maxDrafts = c.maxDrafts || 20; S.notice = c.notice; S.deadline = c.deadline || ''; S.drafts = c.drafts || []; } } catch (e) {}
        showApp(); refresh(true);
      } else { showLogin(); }
    }).catch(function () { banner('The page could not load. Reload it.'); showLogin(); });
  }
  init();
})();
