(function () {
  function define(name, renderFn) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() { renderFn(this); }
    });
  }

  var NAV = [
    { href: '/prss/about.html', label: 'About Us' },
    { href: '/prss/our-studio.html', label: 'Our Studio' },
    { href: '/prss/guide-to-success.html', label: 'Guide to Success' },
    { href: '/prss/registration.html', label: 'Registration' },
    { href: '/prss/news.html', label: 'PRSS News' },
    { href: '/prss/travel-group.html', label: 'Travel Group' }
  ];

  define('prss-banner', function (el) {
    el.innerHTML =
      '<div class="proto-banner">Cost/build prototype, not the official club site — ' +
      'see <a href="https://www.peaceriverscottishsociety.ca/" target="_blank" rel="noopener">peaceriverscottishsociety.ca</a> ' +
      'for current registration, schedules and contact info.</div>';
  });

  define('prss-header', function (el) {
    var p = window.location.pathname;
    var links = NAV.map(function (item) {
      var active = p === item.href || p.endsWith(item.href.replace('/prss/', ''));
      return '<a href="' + item.href + '"' + (active ? ' class="nav-active"' : '') + '>' + item.label + '</a>';
    }).join('');
    el.innerHTML =
      '<header class="site-header"><div class="header-inner">' +
      '<a href="/prss/" class="brand"><span class="brand-mark">PR</span>Peace River Scottish Society</a>' +
      '<nav class="nav-links">' + links + '</nav>' +
      '</div></header><div class="tartan-rule"></div>';
  });

  define('prss-footer', function (el) {
    el.innerHTML =
      '<footer class="site-footer"><div class="footer-inner">' +
      '<div><p><strong>Peace River Scottish Society</strong></p>' +
      '<p>Peace River, Alberta</p>' +
      '<p>Email: <a href="mailto:prscottishsociety@gmail.com">prscottishsociety@gmail.com</a></p></div>' +
      '<div><p>Club content and program details from <a href="https://www.peaceriverscottishsociety.ca/" target="_blank" rel="noopener">peaceriverscottishsociety.ca</a>.</p>' +
      '<p>This prototype: <a href="https://jsbg.ca/" target="_blank" rel="noopener">jsbg.ca</a></p></div>' +
      '</div></footer>';
  });
})();
