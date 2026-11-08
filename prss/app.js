/* Highland Cow designer (jsbg.ca/prss/). Static page; logins and designs live in an Apps Script web app (config.js). */
(function () {
  'use strict';
  var API = window.PRSS.api;
  var $ = function (id) { return document.getElementById(id); };
  var PARTS = [
    { t: 'Body', p: 'Body', s: 'body, head, tail' },
    { t: 'Trim', p: 'Trim', s: 'horns, hooves, muzzle' },
    { t: 'Eyes', p: 'Eyes', s: 'the eyes' },
    { t: 'Eye shine', p: 'Shine', s: 'little dots in the eyes' }
  ];
  var DEFAULT_SEL = [62, 55, 70, 61];
  var S = { user: '', token: '', phase: 'closed', max: 3, maxDrafts: 20, notice: '', deadline: '', drafts: [], tab: 'design', active: 0, sel: DEFAULT_SEL.slice(),
            editId: null, tartan: '', lights: false, votes: 0, swatches: [], byN: {}, lastSync: 0 };

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
    banner(e.message || 'Something went wrong. Please try again.');
    if (e.code === 'closed') refresh(true);
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
    // sparkle glints: sparse flecks, each with a random facing (g2o / g3o) so only some catch the light at a given spot
    var r2 = mulberry(77), g2m = new Uint8Array(N), g2o = new Uint8Array(N), g3m = new Uint8Array(N), g3o = new Uint8Array(N);
    function fleck(m, o, count, plus) {
      for (var k = 0; k < count; k++) {
        var x = (r2() * w) | 0, y = (r2() * h) | 0, a = (r2() * 256) | 0, pts = plus ? [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [2, 0], [-2, 0], [0, 2], [0, -2]] : [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (var q = 0; q < pts.length; q++) { var xx = x + pts[q][0], yy = y + pts[q][1]; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { m[yy * w + xx] = 1; o[yy * w + xx] = a; } }
      }
    }
    fleck(g2m, g2o, N * 0.014, false); fleck(g3m, g3o, N * 0.0013, true);
    return { small: small, mid: mid, big: big, mot: mot, g2m: g2m, g2o: g2o, g3m: g3m, g3o: g3o };
  }
  // a fleck is lit when its facing lines up with the light at that spot (the light is fixed, so the pattern is fixed)
  function lit(fo, sh, wd) { var d = fo + 77 - sh * 190; d -= Math.floor(d / 256) * 256; if (d > 128) d = 256 - d; return d < wd ? 1 - d / wd : 0; }
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
      case 'silk':
        if (sl.k === 'silk') {                    // deep gloss: darker shadows, a color-tinted highlight and a white core
          var hv = spS / 255, mm = Math.pow(sh, 1.35) * 0.88 + 0.04, wh = 255 * hv * hv * hv * 0.65, rm = rim * 30;
          o[0] = r * mm + (r * 0.5 + 125) * hv * 1.3 + wh + rm * (0.4 + r / 400); o[1] = g * mm + (g * 0.5 + 125) * hv * 1.3 + wh + rm * (0.4 + g / 400); o[2] = b * mm + (b * 0.5 + 125) * hv * 1.3 + wh + rm * (0.4 + b / 400);
        } else { m = 0.8 * sh + 0.1; o[0] = r * m + spS * 1.7 + rim * 34; o[1] = g * m + spS * 1.7 + rim * 34; o[2] = b * m + spS * 1.7 + rim * 34; }   // two-color silk keeps the smooth look
        break;
      case 'metal': m = 0.42 * sh + 0.1; f = spM * 1.8 / 255;
        o[0] = r * m + (r * 0.55 + 140) * f + spB * 0.5 + rim * 22 * r / 255; o[1] = g * m + (g * 0.55 + 140) * f + spB * 0.5 + rim * 22 * g / 255; o[2] = b * m + (b * 0.55 + 140) * f + spB * 0.5 + rim * 22 * b / 255; break;
      case 'translucent': m = 0.66 + 0.34 * sh;
        o[0] = (r + (255 - r) * 0.3) * m + spB * 3 + rim * 70; o[1] = (g + (255 - g) * 0.3) * m + spB * 3 + rim * 70; o[2] = (b + (255 - b) * 0.3) * m + spB * 3 + rim * 70; break;
      case 'neon': m = 0.66 + 0.34 * sh; o[0] = r * m; o[1] = g * m; o[2] = b * m; break;                  // matte pop: the plain color, never blown out
      case 'glow': m = 0.6 + 0.4 * sh; o[0] = (r + (255 - r) * 0.25) * m + spB * 1.6; o[1] = (g + (255 - g) * 0.25) * m + spB * 1.6; o[2] = (b + (255 - b) * 0.25) * m + spB * 1.6; break;
      case 'sparkle': case 'galaxy': case 'glitter': case 'marble': {
        var hl = k === 'marble' ? 0 : spB;
        o[0] = r * sh + hl; o[1] = g * sh + hl; o[2] = b * sh + hl;
        var mot = T.mot[i] / 255;
        if (k === 'galaxy') {                     // dark nebula with tiny stars
          var n = 0.78 + 0.5 * mot; o[0] *= n; o[1] *= n; o[2] *= n;
          if ((f = T.small[i]) && i % 20 !== 7) { a = 0.55 + f / 255 * 0.45; fc = sl.fl.length ? sl.fl[f % sl.fl.length] : [255, 255, 255]; o[0] += (fc[0] - o[0]) * a; o[1] += (fc[1] - o[1]) * a; o[2] += (fc[2] - o[2]) * a; }
          if ((f = T.mid[i]) && i % 20 !== 7) { o[0] += 150 + f * 0.4; o[1] += 150 + f * 0.4; o[2] += 150 + f * 0.4; }
        } else if (k === 'sparkle') {             // glints: sparse flecks that flash only where they face the light
          var hs = spB * 0.7; o[0] = r * sh * 0.92 + hs; o[1] = g * sh * 0.92 + hs; o[2] = b * sh * 0.92 + hs;
          if (T.g2m[i]) {
            var fo = T.g2o[i], l = lit(fo, sh, 52); fc = sl.fl.length ? sl.fl[fo % sl.fl.length] : [255, 255, 255];
            if (l > 0) { a = 0.4 + 0.6 * l; o[0] += (fc[0] * 0.5 + 128 - o[0]) * a + l * 70; o[1] += (fc[1] * 0.5 + 128 - o[1]) * a + l * 70; o[2] += (fc[2] * 0.5 + 128 - o[2]) * a + l * 70; }
            else { o[0] += (fc[0] * 0.5 * sh - o[0]) * 0.45; o[1] += (fc[1] * 0.5 * sh - o[1]) * 0.45; o[2] += (fc[2] * 0.5 * sh - o[2]) * 0.45; }
          }
          if (T.g3m[i]) { if (lit(T.g3o[i], sh, 70) > 0) { o[0] = 255; o[1] = 255; o[2] = 255; } else { o[0] += (255 - o[0]) * 0.25; o[1] += (255 - o[1]) * 0.25; o[2] += (255 - o[2]) * 0.25; } }
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
  function drawMain() { paint(mainCtx, S.sel, S.lights); $('cvLoading').hidden = !!L; $('stage').classList.toggle('dark', S.lights); if (L && !BOX) measureBox(); layoutCanvas(); }
  /* ---------- zoom and pan on the cow window only (pinch, double-tap, drag, ctrl+wheel; double-tap again to fit) ---------- */
  var Z = { s: 1, x: 0, y: 0 }, ptrs = {}, pinch = null, lastTap = null, view = $('view'), pan = $('pan'), cvEl = $('cv'), BOX = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /* The cow only fills the middle band of its square picture, so the window is cropped to the cow's own box and fills the available width. */
  function measureBox() {
    try {
      var W = cvEl.width, H = cvEl.height, d = mainCtx.getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 <= x0 || y1 <= y0) return;
      var pad = Math.round(W * 0.03); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W, x1 + pad); y1 = Math.min(H, y1 + pad);
      BOX = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      $('stage').style.setProperty('--ar', (BOX.w / BOX.h).toFixed(3));
    } catch (e) {}
  }
  function layoutCanvas() {
    var vw = view.clientWidth; if (!vw) return;
    var b = BOX || { x: 60, y: 150, w: 580, h: 400 }, W = cvEl.width, D = vw / b.w * W;
    cvEl.style.width = cvEl.style.height = D + 'px'; cvEl.style.left = -(b.x / W * D) + 'px'; cvEl.style.top = -(b.y / W * D) + 'px';
  }
  function zApply() {
    var w = view.clientWidth, h = view.clientHeight;
    Z.s = clamp(Z.s, 1, 3.5); Z.x = clamp(Z.x, w - w * Z.s, 0); Z.y = clamp(Z.y, h - h * Z.s, 0);
    pan.style.transform = Z.s === 1 ? '' : 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')';
    view.classList.toggle('zoomed', Z.s > 1);
  }
  function zoomAt(px, py, ns) { ns = clamp(ns, 1, 3.5); var k = ns / Z.s; Z.x = px - (px - Z.x) * k; Z.y = py - (py - Z.y) * k; Z.s = ns; zApply(); }
  function localPt(e) { var r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function two() { var k = Object.keys(ptrs); return k.length === 2 ? [ptrs[k[0]], ptrs[k[1]]] : null; }
  view.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = localPt(e); try { view.setPointerCapture(e.pointerId); } catch (x) {}
    var t = two(); if (t) { pinch = { d: Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]), s: Z.s }; lastTap = null; return; }
    var p = ptrs[e.pointerId], now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(p[0] - lastTap.x, p[1] - lastTap.y) < 30) { zoomAt(p[0], p[1], Z.s > 1 ? 1 : 2.5); lastTap = null; }
    else lastTap = { t: now, x: p[0], y: p[1] };
  });
  view.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    var prev = ptrs[e.pointerId], p = localPt(e); ptrs[e.pointerId] = p;
    var t = two();
    if (t && pinch) { var d = Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]); zoomAt((t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2, pinch.s * d / (pinch.d || 1)); }
    else if (Z.s > 1) { Z.x += p[0] - prev[0]; Z.y += p[1] - prev[1]; zApply(); lastTap = null; }
  });
  function ptrUp(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; }
  view.addEventListener('pointerup', ptrUp); view.addEventListener('pointercancel', ptrUp);
  view.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey && Z.s === 1) return; e.preventDefault(); var p = localPt(e); zoomAt(p[0], p[1], Z.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  window.addEventListener('resize', function () { layoutCanvas(); zApply(); }); zApply();

  var thumbQ = [], thumbBusy = false;
  function queueThumb(cv, spec) { thumbQ.push([cv, spec]); if (!thumbBusy) { thumbBusy = true; requestAnimationFrame(pumpThumbs); } }
  function pumpThumbs() { var n = 0; while (thumbQ.length && n < 3) { var t = thumbQ.shift(); if (L && t[0].isConnected) drawThumb(t[0], t[1]); n++; } if (thumbQ.length) requestAnimationFrame(pumpThumbs); else thumbBusy = false; }
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
  function nm(v) { var s = S.byN[v]; return s ? s.name : ''; }
  function describe(spec) { return nm(spec[0]) + ' body, ' + nm(spec[1]) + ' trim, ' + nm(spec[2]) + ' eyes'; }
  function refreshDesign() {
    var parts = $('parts'); parts.innerHTML = '';
    PARTS.forEach(function (p, i) {
      var b = el('button', 'part'); b.type = 'button'; b.setAttribute('aria-pressed', i === S.active);
      var d = el('span', 'dot'); var sw = S.byN[S.sel[i]]; if (sw) d.style.background = swatchBg(sw);
      var t = el('span'); t.appendChild(el('small', null, p.s)); t.appendChild(el('b', null, p.t));
      b.appendChild(d); b.appendChild(t); b.addEventListener('click', function () { S.active = i; refreshDesign(); });
      parts.appendChild(b);
    });
    var pin = $('pinParts'); pin.innerHTML = '';
    PARTS.forEach(function (p, i) {
      var b = el('button', 'pinbtn'); b.type = 'button'; b.setAttribute('aria-pressed', i === S.active); b.setAttribute('aria-label', p.t + ': ' + lbl(S.sel[i]));
      var d = el('span', 'dot'); var sw = S.byN[S.sel[i]]; if (sw) d.style.background = swatchBg(sw);
      b.appendChild(d); b.appendChild(el('span', 'pl', p.p)); b.addEventListener('click', function () { S.active = i; refreshDesign(); });
      pin.appendChild(b);
    });
    var cur = S.sel[S.active];
    Array.prototype.forEach.call($('grid').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.n) === String(cur)); });
    $('summary').textContent = S.sel.map(function (v, i) { return PARTS[i].t + ': ' + lbl(v); }).join('  ·  ');
    $('cv').setAttribute('aria-label', 'Your coo: ' + describe(S.sel));
    var editing = !!S.editId && S.drafts.some(function (d) { return d.id === S.editId; });
    if (!editing) S.editId = null;
    $('editTitle').textContent = editing ? 'Editing your design' : COPY.designTitle;
    $('saveBtn').textContent = editing ? 'Save changes' : 'Save design';
    $('saveNewBtn').hidden = !editing; $('newBtn').hidden = !editing;
    var subs = S.drafts.filter(function (d) { return d.submitted; }).length;
    $('saveBtn').disabled = !editing && S.drafts.length >= S.maxDrafts;
    $('saveNote').textContent = 'Saved ' + S.drafts.length + ' of ' + S.maxDrafts + ' · Submitted ' + subs + ' of ' + S.max + '. Open ' + COPY.herd + ' to submit your favorites.' + (editing && S.drafts.some(function (d) { return d.id === S.editId && d.submitted; }) ? ' This one is submitted, so saving changes updates your submission.' : '');
    drawMain();
  }
  function saveDraft(asNew) {
    var btn = asNew ? $('saveNewBtn') : $('saveBtn'), old = btn.textContent; btn.disabled = true; btn.textContent = 'Saving...';
    var payload = { parts: S.sel, name: $('cowName').value };
    if (S.editId && !asNew) payload.id = S.editId;
    api('save', payload, false).then(function (j) {
      S.editId = j.savedId; applyState(j); banner('Saved to ' + COPY.herd + '.', true);
    }).catch(handleError).then(function () { btn.textContent = old; refreshDesign(); });
  }
  $('saveBtn').addEventListener('click', function () { saveDraft(false); });
  $('saveNewBtn').addEventListener('click', function () { saveDraft(true); });
  $('newBtn').addEventListener('click', function () { S.editId = null; $('cowName').value = ''; refreshDesign(); });
  $('lightsOff').addEventListener('change', function (e) { S.lights = e.target.checked; drawMain(); });

  /* ---------- tartan: every member designs their own; it hangs as a ribbon on their coos and on the show badge ---------- */
  var THREADS = [['Navy', '#27307F'], ['Midnight', '#12163D'], ['Royal blue', '#2F5FD0'], ['Sky blue', '#7FB8F0'], ['Teal', '#12A0B8'], ['Forest green', '#14452E'], ['Green', '#2F9E5B'], ['Lime', '#A5D63F'], ['Gold', '#E8C65A'], ['Orange', '#F08A2E'],
                 ['Red', '#C8323F'], ['Crimson', '#8E1B2B'], ['Pink', '#E2557E'], ['Blush', '#F0A8C0'], ['Purple', '#7B66D9'], ['Plum', '#4A1F55'], ['Brown', '#6B4423'], ['Silver', '#B9BFD0'], ['White', '#F4F2FF'], ['Black', '#14141C']];   // keep in step with TARTAN_HEX in Code.gs
  var ROLES = [['Ground', 'the main color'], ['Wide stripe', 'the big stripes'], ['Second stripe', 'the other stripes'], ['Thin line', 'the thin lines']];
  var PATTERNS = ['Classic', 'Bold', 'Fine'];
  var SETTS = [                                   // [thread, width] pairs; thread 0 to 3 = ground, wide stripe, second stripe, thin line
    [[0, 12], [1, 3], [0, 3], [2, 9], [0, 3], [3, 1.5], [0, 3], [2, 9], [0, 3], [1, 3], [0, 12], [3, 1.5]],
    [[0, 16], [1, 6], [0, 4], [2, 12], [0, 4], [3, 2], [0, 4], [2, 12], [0, 4], [1, 6], [0, 16], [3, 2]],
    [[0, 6], [1, 2], [0, 2], [2, 4], [0, 2], [3, 1], [0, 2], [2, 4], [0, 2], [1, 2], [0, 6], [3, 1], [0, 3], [1, 1], [0, 3], [2, 1]]
  ];
  var DEFAULT_TARTAN = '0:#27307F,#C8323F,#7B66D9,#F4F2FF';
  var TWILL = 'repeating-linear-gradient(45deg,rgba(255,255,255,.1) 0 1px,rgba(0,0,0,.17) 1px 2px)';
  function parseTartan(s) {
    var m = /^([0-2]):(#[0-9a-f]{6}),(#[0-9a-f]{6}),(#[0-9a-f]{6}),(#[0-9a-f]{6})$/i.exec(String(s || '')) || /^(.):(.*),(.*),(.*),(.*)$/.exec(DEFAULT_TARTAN);
    return { p: +m[1], c: [m[2], m[3], m[4], m[5]].map(function (x) { return x.toUpperCase(); }) };
  }
  function tartanStr(t) { return t.p + ':' + t.c.join(','); }
  var clothMemo = {};
  function cloth(s) {                             // CSS background for a tartan: twill grain over a woven tile (warp full strength, weft half, so crossings blend like real cloth)
    var t = parseTartan(s), key = tartanStr(t); if (clothMemo[key]) return clothMemo[key];
    var set = SETTS[t.p], T = 0; set.forEach(function (x) { T += x[1]; });
    function bars(vert) { var pos = 0, out = ''; set.forEach(function (x) { out += '<rect ' + (vert ? 'x' : 'y') + '="' + pos + '" ' + (vert ? 'width' : 'height') + '="' + x[1] + '" ' + (vert ? 'height' : 'width') + '="' + T + '" fill="' + t.c[x[0]] + '"/>'; pos += x[1]; }); return out; }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + T + '" height="' + T + '" viewBox="0 0 ' + T + ' ' + T + '"><rect width="' + T + '" height="' + T + '" fill="' + t.c[0] + '"/>' + bars(false) + '<g opacity=".5">' + bars(true) + '</g></svg>';
    return (clothMemo[key] = TWILL + ',url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
  }
  function ownTartan() { return S.tartan || DEFAULT_TARTAN; }
  function ribbon() { var r = el('span', 'rib'); r.appendChild(el('i', 'tab')); r.appendChild(el('i', 'rivet')); return r; }
  function setRib(r, t) { if (t === undefined || t === null) { r.hidden = true; return; } r.hidden = false; r.style.setProperty('--cloth', cloth(t)); }
  var ROS_TXT = { pending: 'In the<br>show', approved: 'Picked', rejected: 'Not<br>picked' };
  function rosette(t, state, inline, label) {      // the show badge: pleated tartan ring and tails around a navy centre
    var r = el('span', 'ros s-' + state + (inline ? ' inline' : '')); r.setAttribute('role', 'img'); r.setAttribute('aria-label', label || state);
    r.appendChild(el('i', 'tl a')); r.appendChild(el('i', 'tl b')); r.appendChild(el('i', 'pl'));
    var d = el('span', 'dc'); d.innerHTML = ROS_TXT[state] || ROS_TXT.pending; r.appendChild(d);
    r.style.setProperty('--cloth', cloth(t)); return r;
  }
  var TD = { cur: null, role: 0 };
  function renderTartanDlg() {
    var c = TD.cur, th = $('tThreads'), pal = $('tPalette'), pat = $('tPat');
    th.innerHTML = ''; ROLES.forEach(function (r, i) {
      var b = el('button', 'thread'); b.type = 'button'; b.setAttribute('aria-pressed', i === TD.role);
      var d = el('span', 'dot'); d.style.background = c.c[i]; var tx = el('span'); tx.appendChild(document.createTextNode(r[0])); tx.appendChild(el('small', null, nameOf(c.c[i])));
      b.appendChild(d); b.appendChild(tx); b.addEventListener('click', function () { TD.role = i; renderTartanDlg(); }); th.appendChild(b);
    });
    pal.innerHTML = ''; THREADS.forEach(function (x) {
      var b = el('button'); b.type = 'button'; b.style.background = x[1]; b.setAttribute('aria-label', x[0]); b.title = x[0]; b.setAttribute('aria-pressed', c.c[TD.role] === x[1]);
      b.addEventListener('click', function () { c.c[TD.role] = x[1]; renderTartanDlg(); }); pal.appendChild(b);
    });
    pat.innerHTML = ''; pat.appendChild(el('b', null, 'Pattern'));
    PATTERNS.forEach(function (n, i) { var b = el('button', null, n); b.type = 'button'; b.setAttribute('aria-pressed', c.p === i); b.addEventListener('click', function () { c.p = i; renderTartanDlg(); }); pat.appendChild(b); });
    var s = tartanStr(c); $('tBig').style.setProperty('--cloth', cloth(s));
    var mini = $('tMini'); mini.innerHTML = ''; var rb = ribbon(); setRib(rb, s); mini.appendChild(rb); mini.appendChild(rosette(s, 'pending', true, 'Show badge preview'));
  }
  function nameOf(hex) { for (var i = 0; i < THREADS.length; i++) if (THREADS[i][1] === hex) return THREADS[i][0]; return hex; }
  function openTartan() {
    var t = parseTartan(ownTartan()); TD.cur = { p: t.p, c: t.c.slice() }; TD.role = 0; renderTartanDlg();
    var d = $('tartanDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closeTartan() { var d = $('tartanDlg'); if (d.close) d.close(); else d.removeAttribute('open'); }
  $('tartanBtn').addEventListener('click', openTartan);
  $('tCancel').addEventListener('click', closeTartan);
  $('tRand').addEventListener('click', function () {
    var dark = [0, 1, 5, 11, 15, 16, 19, 2], pick = function (n) { return Math.floor(Math.random() * n); }, ids = [dark[pick(dark.length)]];
    while (ids.length < 4) { var k = pick(THREADS.length); if (ids.indexOf(k) < 0) ids.push(k); }
    TD.cur = { p: pick(3), c: ids.map(function (k) { return THREADS[k][1]; }) }; renderTartanDlg();
  });
  $('tSave').addEventListener('click', function () {
    var btn = $('tSave'), old = btn.textContent; btn.disabled = true; btn.textContent = 'Saving...';
    api('tartan', { tartan: tartanStr(TD.cur) }, false).then(function (j) { applyState(j); closeTartan(); banner('Tartan saved.', true); })
      .catch(handleError).then(function () { btn.disabled = false; btn.textContent = old; });
  });

  /* ---------- my designs (gallery) ---------- */
  var COPY = Object.assign({ unnamed: 'Unnamed coo', pending: 'Entered in the show', approved: 'Picked for the vote', rejected: 'Not picked this time', cows: 'coos', seenAll: "You've seen every coo!", designTitle: 'Design your coo', herd: 'My herd' }, window.PRSS.copy || {});
  var STATUS = { pending: COPY.pending, approved: COPY.approved, rejected: COPY.rejected };
  function editDraft(d) {
    S.editId = d.id; S.sel = d.spec.slice(); $('cowName').value = d.name; saveSel(); showTab('design');
  }
  function card(d, compact, canEdit) {
    var c = el('div', 'mini' + (d.submitted ? ' picked' : '')), cv = el('canvas'); cv.width = compact ? 260 : 320; cv.height = cv.width; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Design ' + (d.name || ''));
    var win = el('div', 'cwin'); win.appendChild(cv); c.appendChild(win);
    if (d.submitted) {                                // picked for the show: the member's tartan ribbon on the card, and the show badge on the picture
      var rb = ribbon(); setRib(rb, ownTartan()); c.insertBefore(rb, win);
      win.appendChild(rosette(ownTartan(), d.status, false, STATUS[d.status] || d.status));
    }
    c.appendChild(el('h2', null, d.name || COPY.unnamed));
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
        sb.addEventListener('click', function () { act(sb, 'submit', d, 'Entered in the show!'); });
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
    queueThumb(cv, d.spec);
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
    $('picksNote').textContent = open ? 'These coos are entered in the show. You can still change or swap them until the design phase ends.' : 'These coos were entered in the show.';
    var pk = $('picks'); pk.innerHTML = '';
    subs.forEach(function (d) { pk.appendChild(card(d, true, open)); });
    for (var i = subs.length; i < S.max; i++) { var e = el('div', 'mini empty'); e.appendChild(el('p', null, open ? 'Empty. Pick a design below and tap Submit.' : 'Empty')); pk.appendChild(e); }
    var box = $('cards'); box.innerHTML = '';
    $('galIntro').textContent = S.drafts.length ? '' : (open ? 'No designs yet. Go to Design, make one and tap Save design.' : 'You did not save any designs.');
    S.drafts.forEach(function (d) { box.appendChild(card(d, false, open)); });
  }

  /* ---------- views and state ---------- */
  function showTab(t) { S.tab = t; renderAll(); window.scrollTo(0, 0); }
  function renderAll() {
    $('whoName').textContent = S.user; $('tartanSw').style.setProperty('--cloth', cloth(ownTartan()));
    var open = S.phase === 'submissions', voting = S.phase === 'voting';
    var n = $('notice'); n.textContent = S.notice; n.hidden = !S.notice;
    var dl = $('deadline'); dl.textContent = S.deadline; dl.hidden = !S.deadline || !(open || voting);
    if (open && S.tab === 'vote') S.tab = 'design';
    if (voting && S.tab === 'design') S.tab = 'vote';
    if (S.tab === 'rankings' && !(voting && S.vote.complete)) S.tab = voting ? 'vote' : 'design';
    $('tabs').hidden = !(open || voting);
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) {
      b.hidden = (b.dataset.tab === 'design' && !open) || (b.dataset.tab === 'vote' && !voting) || (b.dataset.tab === 'rankings' && !(voting && S.vote.complete));
      b.setAttribute('aria-pressed', b.dataset.tab === S.tab);
    });
    $('designView').hidden = !(open && S.tab === 'design');
    var showVote = voting && S.tab === 'vote' && !S.vote.done;
    $('voteView').hidden = !showVote; $('doneView').hidden = !(voting && S.tab === 'vote' && S.vote.done);
    $('rankView').hidden = !(voting && S.tab === 'rankings');
    $('galleryView').hidden = (open || voting) ? S.tab !== 'gallery' : S.drafts.length === 0;
    var wait = $('waitView'); wait.hidden = open || voting;
    if (!open && !voting) { $('waitTitle').textContent = 'Closed for now'; $('waitText').textContent = 'Nothing is open right now. Check back later.'; }
    renderGallery(); refreshDesign();
    if (showVote) startVoting();
    if (voting && S.tab === 'rankings') loadRankings();
  }
  function applyState(j) {
    if (j.phase === 'voting') takeVoting(j);
    S.phase = j.phase; S.max = j.max; S.maxDrafts = j.maxDrafts || 20; S.notice = j.notice || ''; S.deadline = j.deadline || ''; S.drafts = j.drafts || []; if (typeof j.tartan === 'string') S.tartan = j.tartan; S.lastSync = Date.now();
    store('prss_state', JSON.stringify({ u: S.user, phase: S.phase, max: S.max, maxDrafts: S.maxDrafts, notice: S.notice, deadline: S.deadline, drafts: S.drafts, tartan: S.tartan }));
    renderAll();
  }
  function showLogin() { $('appView').hidden = true; $('loginView').hidden = false; $('loginWait').hidden = true; $('loginBtn').disabled = false; }
  function showApp() { $('loginView').hidden = true; $('appView').hidden = false; renderAll(); }
  function logout() {
    S.token = ''; S.user = ''; S.tartan = ''; S.drafts = []; S.editId = null; S.votes = 0; S.vote.buf = []; S.vote.queue = []; S.vote.current = null; S.vote.started = false; S.vote.done = false; S.vote.empty = false; S.vote.seen = []; S.vote.seenSet = {}; S.vote.total = 0; S.vote.complete = false; S.vote.rankFor = -1; $('rankList').innerHTML = ''; store('prss_token', null); store('prss_user', null); store('prss_state', null);
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
  S.vote = { seenSet: {}, total: 0, complete: false, rankFor: -1, buf: [], queue: [], seen: [], current: null, fetching: false, flushing: false, timer: null, started: false, done: false, empty: false };
  function takeVoting(j) {
    var V = S.vote;
    if (typeof j.votes === 'number') S.votes = Math.max(j.votes, S.votes);
    syncSeen(j);
    if (j.pairs && j.pairs.length && !V.buf.length && !V.current) addPairs(j.pairs);
  }
  function syncSeen(j) {                                  // cows this member has voted on, and how many they can be shown
    var V = S.vote;
    if (typeof j.total === 'number') V.total = j.total;
    if (j.seenIds) j.seenIds.forEach(function (id) { V.seenSet[id] = 1; });
    V.complete = V.total > 0 && Object.keys(V.seenSet).length >= V.total;
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
  function updateVoteUi() {
    var V = S.vote, n = Math.min(Object.keys(V.seenSet).length, V.total);
    $('voteCount').textContent = V.complete ? COPY.seenAll : "You've seen " + n + " of " + V.total + " " + COPY.cows;
    $('rankLink').hidden = !V.complete;
  }
  function nextPair() {
    var V = S.vote; updateVoteUi();
    if (V.buf.length < 5) fetchMore();
    if (!V.buf.length) { V.current = null; $('voteLoading').hidden = false; $('voteLoading').textContent = (V.total < 2 && !V.fetching) ? "There aren't enough coos to vote on yet. Check back soon." : 'Getting the next coos...'; $('optA').disabled = $('optB').disabled = true;
      if (V.empty) { finishVoting("You have seen every pair there is. Thank you!"); } return; }
    var p = V.buf.shift(); V.current = p;
    $('optA').setAttribute('aria-label', 'Pick the coo on the left: ' + describe(p.a.spec)); $('optB').setAttribute('aria-label', 'Pick the coo on the right: ' + describe(p.b.spec)); $('voteLoading').hidden = true; $('optA').disabled = $('optB').disabled = false; setRib($('ribA'), p.a.t); setRib($('ribB'), p.b.t);
    $('optA').classList.remove('won'); $('optB').classList.remove('won');
    if (L) { paint($('cvA').getContext('2d'), p.a.spec, false); paint($('cvB').getContext('2d'), p.b.spec, false); }
  }
  function fetchMore() {
    var V = S.vote; if (V.fetching || V.empty) return; V.fetching = true;
    api('pairs', { seen: V.seen }).then(function (j) {
      V.fetching = false; if (typeof j.votes === 'number') S.votes = Math.max(j.votes, S.votes); syncSeen(j);
      if (!j.pairs.length) { V.empty = true; } else addPairs(j.pairs);
      if (!V.current) nextPair();
    }).catch(function (e) { V.fetching = false; if (e.code === 'closed') { refresh(); return; } if (e.code === 'no_pool') { $('voteLoading').hidden = false; $('voteLoading').textContent = e.message; return; } handleError(e); if (!V.current) setTimeout(function () { if (!V.current && S.phase === 'voting') nextPair(); }, 4000); });
  }
  function choose(side) {
    var V = S.vote, p = V.current; if (!p) return;
    V.current = null;
    var win = side === 'a' ? p.a : p.b, lose = side === 'a' ? p.b : p.a, v = { w: win.id, l: lose.id, k: p.k };
    V.queue.push(v); S.votes++;
    var wasComplete = V.complete; V.seenSet[win.id] = 1; V.seenSet[lose.id] = 1; V.complete = V.total > 0 && Object.keys(V.seenSet).length >= V.total;
    $(side === 'a' ? 'optA' : 'optB').classList.add('won'); $('optA').disabled = $('optB').disabled = true;
    updateVoteUi(); scheduleFlush(V.queue.length >= 5 ? 0 : 3000);
    setTimeout(nextPair, 230);
    if (!wasComplete && V.complete) { scheduleFlush(0); setTimeout(showAllSeen, 700); renderAll(); }
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
    $('doneText').textContent = msg || ('You voted ' + S.votes + (S.votes === 1 ? ' time' : ' times') + ' and saw ' + Math.min(Object.keys(S.vote.seenSet).length, S.vote.total) + ' of ' + S.vote.total + ' ' + COPY.cows + '. Your votes are saved. Come back whenever you like.');
    renderAll();
  }
  $('optA').addEventListener('click', function () { choose('a'); });
  $('optB').addEventListener('click', function () { choose('b'); });
  $('skipBtn').addEventListener('click', function () { var V = S.vote; if (V.current) { V.current = null; nextPair(); } });
  $('doneBtn').addEventListener('click', function () { finishVoting(); });
  $('moreBtn').addEventListener('click', function () { var V = S.vote; V.done = false; V.empty = false; V.current = null; V.started = false; renderAll(); });
  document.addEventListener('keydown', function (e) {
    if ($('voteView').hidden || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') choose('a'); else if (e.key === 'ArrowRight') choose('b');
  });
  window.addEventListener('pagehide', flushOnLeave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushOnLeave(); });


  /* ---------- all-seen pop-up and my rankings ---------- */
  function showAllSeen() {
    var d = $('allSeen'); if (S.phase !== 'voting' || !S.token) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    $('seenRank').focus();
  }
  function closeAllSeen() { var d = $('allSeen'); if (d.close) d.close(); else d.removeAttribute('open'); }
  $('seenMore').addEventListener('click', closeAllSeen);
  $('seenRank').addEventListener('click', function () { closeAllSeen(); showTab('rankings'); });
  $('rankLink').addEventListener('click', function () { showTab('rankings'); });

  function whenSaved(cb, tries) {                         // make sure the server has every vote before it works out rankings
    var V = S.vote; tries = tries || 0;
    if (V.queue.length && !V.flushing) flush();
    if ((V.queue.length || V.flushing) && tries < 40) { setTimeout(function () { whenSaved(cb, tries + 1); }, 400); return; }
    cb();
  }
  function loadRankings() {
    var V = S.vote; if (V.rankFor === S.votes && $('rankList').children.length) return;
    $('rankLoading').hidden = false;
    whenSaved(function () {
      api('rankings').then(function (j) {
        $('rankLoading').hidden = true; V.rankFor = S.votes;
        var ol = $('rankList'); ol.innerHTML = ''; var todo = [];
        j.list.forEach(function (x) {
          var li = el('li', x.rank <= 3 ? 'top' : ''), cv = el('canvas'); cv.width = 260; cv.height = 260; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Coo ranked number ' + x.rank + ': ' + describe(x.spec));
          if (x.t !== undefined) { var rb = ribbon(); setRib(rb, x.t); li.appendChild(rb); }
          li.appendChild(el('span', 'no', String(x.rank))); li.appendChild(cv);
          var n = x.w + x.l; li.appendChild(el('span', 'rec', n === 1 ? (x.w ? 'You picked it' : 'You picked the other one') : 'Picked ' + x.w + ' of ' + n + ' times'));
          ol.appendChild(li); todo.push([cv, x.spec]);
        });
        var i = 0; (function step() { var end = Math.min(i + 6, todo.length); for (; i < end; i++) drawThumb(todo[i][0], todo[i][1]); if (i < todo.length) requestAnimationFrame(step); })();
      }).catch(function (e) { $('rankLoading').hidden = true; if (e.code === 'locked') { S.vote.complete = false; renderAll(); } handleError(e); });
    });
  }

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
        try { var c = JSON.parse(load('prss_state') || 'null'); if (c && c.u === S.user) { S.phase = c.phase; S.max = c.max; S.maxDrafts = c.maxDrafts || 20; S.notice = c.notice; S.deadline = c.deadline || ''; S.drafts = c.drafts || []; S.tartan = c.tartan || ''; } } catch (e) {}
        showApp(); refresh(true);
      } else { showLogin(); }
    }).catch(function () { banner('The page could not load. Reload it.'); showLogin(); });
  }
  init();
})();
