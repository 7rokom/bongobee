// Web Push Service Worker
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'নতুন নোটিফিকেশন', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'নতুন নোটিফিকেশন';
  const options = {
    body: data.body || '',
    icon: data.icon || '/notification-icon.png',
    image: data.image || undefined,
    badge: data.badge || '/notification-icon.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'bongobee-push',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { try { c.navigate(targetUrl); } catch {} return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
