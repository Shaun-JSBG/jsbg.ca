(function () {
  const SVG_PREV = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:block"><path d="M0,12 L10,0 L10,8 L24,8 L24,16 L10,16 L10,24Z"/></svg>';
  const SVG_NEXT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:block"><path d="M24,12 L14,0 L14,8 L0,8 L0,16 L14,16 L14,24Z"/></svg>';
  const SVG_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true" style="display:block"><path d="M3 3 L21 21 M21 3 L3 21"/></svg>';

  document.body.insertAdjacentHTML('beforeend', `
    <div class="zoom-overlay" id="zoomOverlay" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div class="zoom-sheet">
        <div class="zoom-topbar">
          <div class="zoom-title" id="zoomTitle">Image</div>
          <span class="zoom-counter" id="zoomCounter" aria-live="polite"></span>
          <button type="button" id="zoomCloseBtn" aria-label="Close image viewer">${SVG_CLOSE}</button>
        </div>
        <div class="zoom-content-wrap">
          <button type="button" id="zoomPrevBtn" class="zoom-nav" aria-label="Previous photo">${SVG_PREV}</button>
          <div class="zoom-body">
            <div class="inner"><img id="zoomImg" alt="" /></div>
          </div>
          <button type="button" id="zoomNextBtn" class="zoom-nav" aria-label="Next photo">${SVG_NEXT}</button>
        </div>
      </div>
    </div>
  `);

  const overlay   = document.getElementById('zoomOverlay');
  const zoomImg   = document.getElementById('zoomImg');
  const zoomTitle = document.getElementById('zoomTitle');
  const zoomCounter = document.getElementById('zoomCounter');
  const closeBtn  = document.getElementById('zoomCloseBtn');
  const prevBtn   = document.getElementById('zoomPrevBtn');
  const nextBtn   = document.getElementById('zoomNextBtn');

  let _navigate = null;
  let _openerEl = null;

  function openOverlay(src, alt, title) {
    _openerEl = document.activeElement;
    zoomImg.src = src;
    zoomImg.alt = alt || '';
    zoomTitle.textContent = title || 'Image';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeZoom() {
    overlay.setAttribute('aria-hidden', 'true');
    zoomImg.src = '';
    document.body.style.overflow = '';
    if (_openerEl && typeof _openerEl.focus === 'function') {
      _openerEl.focus();
      _openerEl = null;
    }
  }

  closeBtn.addEventListener('click', closeZoom);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeZoom(); });

  document.addEventListener('keydown', function (e) {
    if (overlay.getAttribute('aria-hidden') !== 'false') return;
    if (e.key === 'Escape') { closeZoom(); return; }
    if (e.key === 'ArrowLeft'  && _navigate) { _navigate(-1); return; }
    if (e.key === 'ArrowRight' && _navigate) { _navigate(1);  return; }
    if (e.key === 'Tab') {
      const focusable = Array.from(overlay.querySelectorAll('button:not([hidden])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Gallery pages: pass thumbData array, receive openZoom function back.
  window.initZoom = function (thumbData) {
    let currentIndex = 0;

    function openZoom(index) {
      currentIndex = ((index % thumbData.length) + thumbData.length) % thumbData.length;
      const d = thumbData[currentIndex];
      prevBtn.hidden = false;
      nextBtn.hidden = false;
      zoomCounter.textContent = (currentIndex + 1) + ' / ' + thumbData.length;
      openOverlay(d.src, d.alt, d.title);
    }

    _navigate = function (dir) { openZoom(currentIndex + dir); };

    prevBtn.addEventListener('click', function () { openZoom(currentIndex - 1); });
    nextBtn.addEventListener('click', function () { openZoom(currentIndex + 1); });

    return openZoom;
  };

  // Single-image zoom (custom page, leftover stock, etc.) — no prev/next.
  window.openZoomImage = function (src, alt, title) {
    _navigate = null;
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    zoomCounter.textContent = '';
    openOverlay(src, alt, title);
  };
})();
