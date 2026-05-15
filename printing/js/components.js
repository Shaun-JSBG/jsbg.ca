(function () {
  function define(name, renderFn) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() { renderFn(this); }
    });
  }

  define('jsbg-banner', function (el) {
    el.innerHTML = '<div class="banner">🚀 Good News: Local Pickup is available in Peace River! 🚀</div>';
  });

  define('jsbg-header', function (el) {
    var p = window.location.pathname;
    var shopActive = p === '/printing/products.html' || p.startsWith('/printing/products/');
    var customActive = p === '/printing/custom.html';
    var faqActive = p === '/printing/faq.html';
    el.innerHTML = `
      <header class="site-header">
        <a href="/printing/" class="brand">
          <img src="/printing/images/site/icon-noBG.png" alt="JSBG Bulb Logo" class="header-icon" />
          JSBG Printing
        </a>
        <nav class="nav-links">
          <a href="/printing/products.html"${shopActive ? ' class="nav-active"' : ''}>Shop Collection</a>
          <a href="/printing/custom.html"${customActive ? ' class="nav-active"' : ''}>Custom Prints</a>
          <a href="/printing/faq.html"${faqActive ? ' class="nav-active"' : ''}>FAQ</a>
          <a href="mailto:printing@jsbg.ca">Contact</a>
        </nav>
      </header>`;
  });

  define('jsbg-footer', function (el) {
    el.innerHTML = `
      <footer class="site-footer">
        <div class="footer-content">
          <h2>Let's Make Something Cool</h2>
          <p style="font-size: 24px; font-weight: 700;">Email <a href="mailto:printing@jsbg.ca">printing@jsbg.ca</a> to order.</p>
          <p style="font-weight: 700; margin-top: 32px; color: var(--on-surface-variant);">© ${new Date().getFullYear()} JSBG | Peace River Local Pickup Available</p>
        </div>
      </footer>`;
  });

  define('jsbg-how-to-order', function (el) {
    el.innerHTML = `
      <div class="how-to-order">
        <h2>How to Order</h2>
        <ol class="order-steps">
          <li class="order-step">
            <div class="order-step-num">1</div>
            <div class="order-step-body"><strong>Email your order</strong> — When you click the "EMAIL TO ORDER" button, a pre-filled email opens with the details I need. Fill in the blanks, add any additional information and send.</div>
          </li>
          <li class="order-step">
            <div class="order-step-num">2</div>
            <div class="order-step-body"><strong>I'll confirm and quote</strong> — I'll reply to confirm the details, answer any questions, and give you a total and estimated turnaround time.</div>
          </li>
          <li class="order-step">
            <div class="order-step-num">3</div>
            <div class="order-step-body"><strong>Pay and receive</strong> — Payment by e-transfer or cash at pickup. I'll let you know when your order is ready for local pickup in Peace River or shipped out. If it's a custom item you'll be asked to pay up front since I can't resell if you change your mind.</div>
          </li>
        </ol>
      </div>`;
  });

  define('jsbg-quality-notice', function (el) {
    el.innerHTML = `
      <div class="info-section">
        <h2>3D Printing Quality</h2>
        <ul>
          <li>There is some variability in 3D printing, and while I'm constantly striving to improve the finish and consistency on my prints, there are occasional slight imperfections. These will always be minimal and won't impact functionality.</li>
        </ul>
      </div>`;
  });
})();

// Mailto fallback toast — shows when the email client doesn't open
(function () {
  function showToast(email) {
    var old = document.getElementById('mailto-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'mailto-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML =
      '<span class="mailto-toast-msg">No email client? Copy the address:</span>' +
      '<strong class="mailto-toast-addr">' + email + '</strong>' +
      '<button type="button" id="mailto-copy-btn">Copy</button>' +
      '<button type="button" id="mailto-dismiss-btn" aria-label="Dismiss">×</button>';
    document.body.appendChild(toast);

    var copyBtn = document.getElementById('mailto-copy-btn');
    var dismissBtn = document.getElementById('mailto-dismiss-btn');
    var timer = setTimeout(function () { if (toast.parentNode) toast.remove(); }, 8000);

    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(email).then(function () {
        copyBtn.textContent = 'Copied!';
        clearTimeout(timer);
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 1500);
      }).catch(function () {
        copyBtn.textContent = 'Copy failed';
      });
    });

    dismissBtn.addEventListener('click', function () {
      clearTimeout(timer);
      toast.remove();
    });
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="mailto:"]');
    if (!link) return;
    var email = link.href.split('?')[0].replace('mailto:', '');
    setTimeout(function () {
      if (document.hasFocus()) showToast(email);
    }, 900);
  });
})();
