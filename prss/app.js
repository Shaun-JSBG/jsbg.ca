/* Highland Cow designer (jsbg.ca/prss/). Static page; logins and cows live in an Apps Script web app (config.js). */
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
  var S = { user: '', token: '', phase: 'closed', max: 3, notice: '', mine: [], tab: 'design', active: 0, sel: DEFAULT_SEL.slice(), swatches: [], byN: {}, lastSync: 0 };

  /* ---------- small helpers ---------- */
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var bannerTimer;
  function banner(msg, info) {
    var b = $('banner'); b.textContent = msg; b.className = info ? 'info' : ''; b.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(function () { b.hidden = true; }, info ? 4000 : 9000);
  }
  function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

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
        }, function (err) {
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

  /* ---------- cow drawing (recolor pre-rendered layers in the browser) ---------- */
  var px = null, off = document.createElement('canvas'), offCtx = off.getContext('2d'), outData = null;
  function loadLayers() {
    var names = ['ids_a', 'ids_b', 'diffuse', 'spec_basic', 'spec_silk'], got = {};
    return Promise.all(names.map(function (n) {
      return new Promise(function (res, rej) {
        var im = new Image(); im.onload = function () {
          var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          var x = c.getContext('2d'); x.drawImage(im, 0, 0); got[n] = x.getImageData(0, 0, im.width, im.height).data; got.w = im.width; got.h = im.height; res();
        }; im.onerror = function () { rej(new Error('layer ' + n)); }; im.src = 'layers/' + n + '.png';
      });
    })).then(function () { px = got; off.width = got.w; off.height = got.h; });
  }
  function toPart(v) {
    if (typeof v === 'number') { var s = S.byN[v]; return s ? { hex: s.hex, spec: s.spec, label: s.label, approx: s.approx } : { hex: '#888888', spec: 'basic', label: 'Unknown', approx: true }; }
    return { hex: v, spec: 'basic', label: 'Wish color', approx: true };
  }
  function paint(ctx, sel) {
    if (!px) return;
    var parts = sel.map(toPart), col = parts.map(function (p) { return hexToRgb(p.hex); });
    var kb = parts.map(function (p) { return p.spec === 'basic' ? 1 : 0; }), ks = parts.map(function (p) { return p.spec === 'silk' ? 1 : 0; });
    var A = px.ids_a, B = px.ids_b, D = px.diffuse, SB = px.spec_basic, SS = px.spec_silk, N = px.w * px.h;
    if (!outData || outData.width !== px.w) outData = ctx.createImageData(px.w, px.h);
    var o = outData.data;
    for (var i = 0; i < N; i++) {
      var p = i * 4, w0 = A[p] / 255, w1 = A[p + 1] / 255, w2 = A[p + 2] / 255, w3 = B[p] / 255, sum = w0 + w1 + w2 + w3;
      if (sum < 0.02) { o[p + 3] = 0; continue; }
      var r = (w0 * col[0][0] + w1 * col[1][0] + w2 * col[2][0] + w3 * col[3][0]) / sum,
          g = (w0 * col[0][1] + w1 * col[1][1] + w2 * col[2][1] + w3 * col[3][1]) / sum,
          b = (w0 * col[0][2] + w1 * col[1][2] + w2 * col[2][2] + w3 * col[3][2]) / sum;
      var sh = D[p] / (204 * sum); if (sh > 1.3) sh = 1.3;
      var sb = (w0 * kb[0] + w1 * kb[1] + w2 * kb[2] + w3 * kb[3]) / sum, ss = (w0 * ks[0] + w1 * ks[1] + w2 * ks[2] + w3 * ks[3]) / sum;
      var sp = (sb * SB[p] + ss * SS[p]) / (sum > 1 ? sum : 1);
      o[p] = Math.min(255, r * sh + sp); o[p + 1] = Math.min(255, g * sh + sp); o[p + 2] = Math.min(255, b * sh + sp); o[p + 3] = Math.min(1, sum) * 255;
    }
    ctx.putImageData(outData, 0, 0);
  }
  var mainCtx = $('cv').getContext('2d');
  function drawMain() { paint(mainCtx, S.sel); $('cvLoading').hidden = !!px; }
  function drawThumb(canvas, sel) {
    paint(offCtx, sel);
    var c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- design view ---------- */
  function buildGrid() {
    var g = $('grid'); g.innerHTML = '';
    S.swatches.forEach(function (s) {
      var b = el('button', 'sw' + (s.approx ? ' approx' : '')); b.type = 'button'; b.style.background = s.hex; b.title = s.label;
      b.setAttribute('aria-label', s.label + (s.approx ? ', approximate' : '')); b.dataset.n = s.n;
      b.addEventListener('click', function () { S.sel[S.active] = s.n; saveSel(); refreshDesign(); });
      g.appendChild(b);
    });
  }
  function saveSel() { store('prss_sel', JSON.stringify(S.sel)); }
  function refreshDesign() {
    var parts = $('parts'); parts.innerHTML = '';
    PARTS.forEach(function (p, i) {
      var b = el('button', 'part'); b.type = 'button'; b.setAttribute('aria-pressed', i === S.active);
      var d = el('span', 'dot'); d.style.background = toPart(S.sel[i]).hex;
      var t = el('span'); var sm = el('small', null, p.s); var bb = el('b', null, p.t); t.appendChild(sm); t.appendChild(bb);
      b.appendChild(d); b.appendChild(t); b.addEventListener('click', function () { S.active = i; refreshDesign(); });
      parts.appendChild(b);
    });
    var cur = S.sel[S.active];
    Array.prototype.forEach.call($('grid').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.n) === String(cur)); });
    $('summary').textContent = S.sel.map(function (v, i) { return PARTS[i].t + ': ' + toPart(v).label; }).join('  ·  ');
    if (typeof cur === 'string') $('wish').value = cur;
    drawMain();
    refreshSend();
  }
  function refreshSend() {
    var left = S.max - S.mine.length, btn = $('sendBtn');
    btn.disabled = left <= 0;
    $('sendNote').textContent = left > 0
      ? 'You have sent ' + S.mine.length + ' of ' + S.max + ' cows.'
      : 'You have sent all ' + S.max + ' of your cows. To send a different one, withdraw one in My cows first.';
  }
  $('wish').addEventListener('input', function (e) { S.sel[S.active] = e.target.value.toLowerCase(); saveSel(); refreshDesign(); });
  $('sendBtn').addEventListener('click', function () {
    var btn = $('sendBtn'); btn.disabled = true; btn.textContent = 'Sending...';
    api('submit', { parts: S.sel, name: $('cowName').value }, false).then(function (j) {
      applyState(j); $('cowName').value = ''; banner('Your cow was sent!', true); showTab('mine');
    }).catch(handleError).then(function () { btn.textContent = 'Send my cow'; refreshSend(); });
  });

  /* ---------- my cows ---------- */
  var STATUS = { pending: 'Sent. Waiting to be looked at', approved: 'Picked for voting', rejected: 'Not picked this time' };
  function renderMine() {
    var box = $('cards'); box.innerHTML = '';
    $('mineCount').textContent = '(' + S.mine.length + '/' + S.max + ')';
    $('mineIntro').textContent = S.mine.length ? '' : (S.phase === 'submissions' ? 'You have not sent a cow yet. Go to Design to make one.' : 'You did not send any cows.');
    S.mine.slice().sort(function (a, b) { return a.sent - b.sent; }).forEach(function (c) {
      var card = el('div', 'mini'), cv = el('canvas'); cv.width = 320; cv.height = 320; cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'Your cow ' + (c.name || ''));
      card.appendChild(cv);
      card.appendChild(el('h2', null, c.name || 'Unnamed cow'));
      var ul = el('ul'); c.spec.forEach(function (v, i) { ul.appendChild(el('li', null, PARTS[i].t + ': ' + toPart(v).label)); }); card.appendChild(ul);
      card.appendChild(el('span', 'st ' + c.status, STATUS[c.status] || c.status));
      if (S.phase === 'submissions' && c.status !== 'approved') {
        var w = el('button', 'small', 'Withdraw'); w.type = 'button';
        w.addEventListener('click', function () {
          if (!window.confirm('Withdraw this cow? You can send a different one after.')) return;
          w.disabled = true; w.textContent = 'Withdrawing...';
          api('withdraw', { id: c.id }, false).then(function (j) { applyState(j); banner('Withdrawn.', true); }).catch(function (e) { w.disabled = false; w.textContent = 'Withdraw'; handleError(e); });
        });
        card.appendChild(w);
      }
      box.appendChild(card);
      if (px) drawThumb(cv, c.spec);
    });
  }

  /* ---------- views and state ---------- */
  function showTab(t) { S.tab = t; renderAll(); window.scrollTo(0, 0); }
  function renderAll() {
    $('whoName').textContent = S.user;
    var open = S.phase === 'submissions', pill = $('phasePill');
    pill.textContent = open ? 'Sending cows is open' : S.phase === 'voting' ? 'Voting' : 'Closed';
    pill.className = 'pill' + (open ? ' open' : '');
    var n = $('notice'); n.textContent = S.notice; n.hidden = !S.notice;
    $('tabs').hidden = !open;
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.tab === S.tab); });
    $('designView').hidden = !(open && S.tab === 'design');
    $('mineView').hidden = open ? S.tab !== 'mine' : S.mine.length === 0;
    var wait = $('waitView');
    wait.hidden = open;
    if (S.phase === 'voting') { $('waitTitle').textContent = 'Voting is coming'; $('waitText').textContent = 'Sending cows is finished. When voting opens you will pick your favorites here.'; }
    else if (!open) { $('waitTitle').textContent = 'Closed for now'; $('waitText').textContent = 'Nothing is open right now. Check back later.'; }
    renderMine(); refreshDesign();
  }
  function applyState(j) {
    S.phase = j.phase; S.max = j.max; S.notice = j.notice || ''; S.mine = j.mine || []; S.lastSync = Date.now();
    store('prss_state', JSON.stringify({ u: S.user, phase: S.phase, max: S.max, notice: S.notice, mine: S.mine }));
    renderAll();
  }
  function showLogin() { $('appView').hidden = true; $('loginView').hidden = false; $('loginWait').hidden = true; $('loginBtn').disabled = false; }
  function showApp() { $('loginView').hidden = true; $('appView').hidden = false; renderAll(); }
  function logout() {
    S.token = ''; S.user = ''; S.mine = []; store('prss_token', null); store('prss_user', null); store('prss_state', null);
    $('c').value = ''; showLogin();
  }
  $('logoutBtn').addEventListener('click', logout);
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('loginBtn'); btn.disabled = true; $('loginWait').hidden = false;
    api('login', { u: $('u').value, c: $('c').value }).then(function (j) {
      S.token = j.token; S.user = j.user; store('prss_token', S.token); store('prss_user', S.user);
      applyState(j); showApp();
    }).catch(function (err) { $('loginWait').hidden = true; btn.disabled = false; banner(err.message); });
  });

  function refresh(quiet) {
    if (!S.token) return Promise.resolve();
    return api('state').then(applyState).catch(function (e) { if (!quiet || e.code === 'auth') handleError(e); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.token && Date.now() - S.lastSync > 60000) refresh(true); });

  /* ---------- start ---------- */
  function init() {
    try { var sv = JSON.parse(load('prss_sel') || 'null'); if (Array.isArray(sv) && sv.length === 4) S.sel = sv; } catch (e) {}
    S.token = load('prss_token') || ''; S.user = load('prss_user') || '';
    if (!S.token) { fetch(API, { mode: 'no-cors' }).catch(function () {}); }     // wake the server while they type
    var sw = fetch('swatches.json').then(function (r) { return r.json(); }).then(function (list) {
      S.swatches = list; list.forEach(function (s) { S.byN[s.n] = s; });
      // drop saved colors that are no longer allowed
      S.sel = S.sel.map(function (v, i) { return (typeof v === 'number' && !S.byN[v]) ? DEFAULT_SEL[i] : v; });
      buildGrid();
    });
    var ly = loadLayers().then(function () { renderAll(); }).catch(function () { banner('The cow picture could not load. Reload the page.'); });
    sw.then(function () {
      if (S.token) {
        try { var c = JSON.parse(load('prss_state') || 'null'); if (c && c.u === S.user) { S.phase = c.phase; S.max = c.max; S.notice = c.notice; S.mine = c.mine || []; } } catch (e) {}
        showApp(); refresh(true);
      } else { showLogin(); }
    }).catch(function () { banner('The page could not load. Reload it.'); showLogin(); });
    return ly;
  }
  init();
})();
