/*!
 * BongoBee Auto Link Shortener
 * Embed in your site's <head> or before </body>:
 *   <script src="https://bongobee.store/embed/bongobee-shorten.js" defer></script>
 *
 * What it does:
 *   - Finds every external <a href="..."> on your page
 *   - Rewrites the href to go through BongoBee's gateway
 *   - Visitor clicks link → lands on BongoBee gateway → sees timer + ads → reaches destination
 */
(function () {
  'use strict';

  var GATEWAY_ORIGIN = 'https://bongobee.store';
  var GATEWAY_PATH = '/go';
  var PROCESSED_ATTR = 'data-bb-shortened';

  // Hosts that should never be rewritten (your own site + common safe origins).
  // Auto-detects the host the script runs on as well.
  var EXCLUDE_HOSTS = [
    location.hostname,
    'bongobee.store',
    'www.bongobee.store',
  ];

  function isExcluded(host) {
    host = (host || '').toLowerCase();
    if (!host) return true;
    for (var i = 0; i < EXCLUDE_HOSTS.length; i++) {
      var ex = (EXCLUDE_HOSTS[i] || '').toLowerCase();
      if (!ex) continue;
      if (host === ex || host.endsWith('.' + ex)) return true;
    }
    return false;
  }

  function shouldRewrite(a) {
    if (!a || a.getAttribute(PROCESSED_ATTR)) return false;
    var href = a.getAttribute('href');
    if (!href) return false;
    // Skip anchors, mailto, tel, javascript, etc.
    if (/^(#|mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(href)) return false;
    // Skip download links
    if (a.hasAttribute('download')) return false;
    // Skip explicit opt-out
    if (a.hasAttribute('data-no-shorten')) return false;

    try {
      var u = new URL(href, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      if (isExcluded(u.hostname)) return false;
      return u.toString();
    } catch (e) {
      return false;
    }
  }

  function rewrite(a) {
    var full = shouldRewrite(a);
    if (!full) return;
    var newHref = GATEWAY_ORIGIN + GATEWAY_PATH + '?url=' + encodeURIComponent(full);
    a.setAttribute(PROCESSED_ATTR, '1');
    a.setAttribute('data-bb-original', full);
    a.setAttribute('href', newHref);
    // Force same-tab navigation so gateway loads cleanly (optional — keep target if present)
  }

  function rewriteAll(root) {
    var anchors = (root || document).querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) rewrite(anchors[i]);
  }

  function init() {
    rewriteAll(document);

    // Watch for dynamically added links (SPA, infinite scroll, etc.)
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'A') rewrite(node);
            else if (node.querySelectorAll) rewriteAll(node);
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
