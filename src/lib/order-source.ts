// Detects and persists where a visitor came from, so the order can later show
// the source (Google, Facebook, TikTok, etc.) in the admin panel.

const STORAGE_KEY = 'order_source';

function classify(url: URL, referrer: string): string {
  const q = url.searchParams;
  const utm = (q.get('utm_source') || '').toLowerCase();
  const ref = (referrer || '').toLowerCase();

  // Click IDs are the most reliable signal
  if (q.get('gclid') || q.get('gad_source') || q.get('gbraid') || q.get('wbraid')) return 'Google';
  if (q.get('fbclid')) return 'Facebook';
  if (q.get('ttclid')) return 'TikTok';
  if (q.get('msclkid')) return 'Bing';

  // UTM source
  if (utm) {
    if (/google/.test(utm)) return 'Google';
    if (/facebook|fb|meta|instagram|ig/.test(utm)) return 'Facebook';
    if (/tiktok/.test(utm)) return 'TikTok';
    if (/youtube|yt/.test(utm)) return 'YouTube';
    if (/bing/.test(utm)) return 'Bing';
    if (/whatsapp|wa/.test(utm)) return 'WhatsApp';
    return utm.charAt(0).toUpperCase() + utm.slice(1);
  }

  // Referrer host
  if (ref) {
    if (/google\./.test(ref)) return 'Google';
    if (/facebook\.|fb\.|instagram\./.test(ref)) return 'Facebook';
    if (/tiktok\./.test(ref)) return 'TikTok';
    if (/youtube\.|youtu\.be/.test(ref)) return 'YouTube';
    if (/bing\./.test(ref)) return 'Bing';
    if (/whatsapp\.|wa\.me/.test(ref)) return 'WhatsApp';
    if (/t\.co|twitter\.|x\.com/.test(ref)) return 'Twitter';
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      // Same-site referrer = direct navigation within the site
      if (host && host !== window.location.hostname) return host;
    } catch { /* ignore */ }
  }

  return 'Direct';
}

/**
 * Captures the source on first page load of the session.
 * Once set, it is preserved for the whole session so the source isn't lost
 * when the user navigates to /checkout from another internal page.
 */
export function captureOrderSource(): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    const url = new URL(window.location.href);
    const ref = document.referrer || '';

    // Always overwrite if URL carries an explicit attribution signal
    const hasExplicit = url.searchParams.get('utm_source')
      || url.searchParams.get('gclid') || url.searchParams.get('fbclid')
      || url.searchParams.get('ttclid') || url.searchParams.get('gad_source');

    if (existing && !hasExplicit) return;
    const source = classify(url, ref);
    sessionStorage.setItem(STORAGE_KEY, source);
  } catch { /* ignore */ }
}

export function getOrderSource(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return sessionStorage.getItem(STORAGE_KEY) || undefined;
  } catch { return undefined; }
}
