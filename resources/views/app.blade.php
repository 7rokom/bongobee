<!doctype html>
<html lang="bn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="google-adsense-account" content="ca-pub-8950141796820035" />
    <title>BongoBee</title>
    <!-- Static injection: instantly applies saved header/body/footer code & Google verification BEFORE React boot. -->
    <script>
      (function () {
        try {
          var raw = localStorage.getItem('static-inject-cache');
          if (!raw) return;
          var c = JSON.parse(raw);
          var path = location.pathname || '';
          // Skip on admin/reseller pages
          if (path.indexOf('/admin') === 0 || path.indexOf('/reseller') === 0) return;
          // Digital section has its own pixel — swap to digital codes on digital routes
          var isDigital = (
            path.indexOf('/digital-product') === 0 ||
            path.indexOf('/digital-products') === 0 ||
            path.indexOf('/digital/') === 0
          );
          if (isDigital) {
            c.headerCode = c.digitalHeaderCode || '';
            c.bodyCode = c.digitalBodyCode || '';
            c.footerCode = c.digitalFooterCode || '';
          }

          // Google Search Console verification meta — must exist in <head> on first paint
          if (c.googleVerificationCode) {
            var m = document.createElement('meta');
            m.name = 'google-site-verification';
            m.content = c.googleVerificationCode;
            m.setAttribute('data-static-inject', '1');
            document.head.appendChild(m);
          }

          function cloneExecutableScript(old) {
            var s = document.createElement('script');
            for (var j = 0; j < old.attributes.length; j++) {
              s.setAttribute(old.attributes[j].name, old.attributes[j].value);
            }
            s.text = old.textContent || '';
            return s;
          }

          function execScripts(container) {
            var scripts = container.querySelectorAll('script');
            for (var i = 0; i < scripts.length; i++) {
              var old = scripts[i];
              old.parentNode.replaceChild(cloneExecutableScript(old), old);
            }
          }

          function injectHeadCode(html) {
            var tpl = document.createElement('template');
            tpl.innerHTML = html;
            var nodes = Array.prototype.slice.call(tpl.content.childNodes);
            for (var i = 0; i < nodes.length; i++) {
              var node = nodes[i];
              if (node.nodeType === 3 && !(node.textContent || '').trim()) continue;
              var next = node.nodeName && node.nodeName.toLowerCase() === 'script'
                ? cloneExecutableScript(node)
                : node.cloneNode(true);
              if (next.setAttribute) next.setAttribute('data-static-inject-section', 'header');
              document.head.appendChild(next);
            }
          }

          // Header code → end of <head>
          if (c.headerCode) injectHeadCode(c.headerCode);

          // Body & footer code need <body> to exist — defer until DOM is ready.
          function injectBodyAndFooter() {
            if (c.bodyCode) {
              var bWrap = document.createElement('div');
              bWrap.id = 'static-body-code';
              bWrap.setAttribute('data-static-inject', '1');
              bWrap.innerHTML = c.bodyCode;
              document.body.insertBefore(bWrap, document.body.firstChild);
              execScripts(bWrap);
            }
            if (c.footerCode) {
              var fWrap = document.createElement('div');
              fWrap.id = 'static-footer-code';
              fWrap.setAttribute('data-static-inject', '1');
              fWrap.innerHTML = c.footerCode;
              document.body.appendChild(fWrap);
              execScripts(fWrap);
            }
          }
          if (document.body) {
            injectBodyAndFooter();
          } else {
            document.addEventListener('DOMContentLoaded', injectBodyAndFooter, { once: true });
          }
        } catch (e) {
          // Fail silent — React app will still inject after boot.
        }
      })();
    </script>
    <link rel="icon" href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEghk55H-iFGUJTIWZzVH7eh0lC-2AOUJT7Oe5CZKX0LJMzPbdjK4pz5CPZBrCcfFpj5SLwf0jPvdxYJFwQ3p-7gNYNCreK7s4YkigMw90eOiRMenqiY6ztlAqZemzTPAnnevaLy0f3hoss-mhS1olAfTBI8BuN4m9bZkqPl94zTGmJK85BAhwkcmfx4l-AF/s1080/BongoBey%20logo%20png.png" type="image/png" />
    <meta name="description" content="BongoBe — বাংলাদেশের বিশ্বস্ত অনলাইন শপিং প্ল্যাটফর্ম। সেরা মানের পণ্য, দ্রুত ডেলিভারি এবং ক্যাশ অন ডেলিভারি সুবিধা।" />
    <meta name="author" content="BongoBe" />
    <meta property="og:title" content="BongoBee" />
    <meta property="og:description" content="সেরা মানের পণ্য, দ্রুত ডেলিভারি এবং ক্যাশ অন ডেলিভারি সুবিধা।" />
    <meta property="og:type" content="website" />
    <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
    <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
    <link rel="dns-prefetch" href="https://blogger.googleusercontent.com" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://blogger.googleusercontent.com" />
    <!-- Only essential font weights (400, 600, 700). Noto Serif Bengali loaded only on product pages via component. -->
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'" />
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" /></noscript>
    <link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700&display=swap" />

    <style>
      #root { min-height: 100vh; }
      .loading-skeleton { background: #f3f4f6; animation: pulse 1.5s ease-in-out infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    </style>

    @vite(['src/main.tsx'])
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
