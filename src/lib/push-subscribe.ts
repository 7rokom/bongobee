import { api } from '@/lib/api';
import type { PushSection } from '@/lib/push-section';

// VAPID public key (safe to expose in frontend)
export const VAPID_PUBLIC_KEY = 'BNLCe176-HaKqkpL6pu7OdD0V2CXxdD20eYoz8NXcS3qo1R1lvpXP4PScc1GLU5j5DGnbEXiDxajNMMJ8NOs200';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) { console.warn('[push] sw register failed', e); return null; }
}

export async function getPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

export async function subscribeUser(section: PushSection = 'main'): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    // getRegistration() resolves immediately (doesn't hang on HTTP); .ready hangs
    // forever when SW registration failed (e.g. non-HTTPS dev environment).
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = (await registerServiceWorker()) ?? undefined;
      if (!reg) return false;
    }
    // Wait for the SW to become active (max 8 s)
    if (!reg.active) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 8000)),
      ]);
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json: any = sub.toJSON();
    await api.post('/public/push-subscribe', {
      endpoint: json.endpoint,
      p256dh_key: json.keys?.p256dh,
      auth_key: json.keys?.auth,
      section: section || 'general',
    });
    return true;
  } catch (e) { console.warn('[push] subscribe failed', e); return false; }
}

export async function isAlreadySubscribed(section?: PushSection): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  try {
    // Use getRegistration() — resolves immediately with undefined if no SW is
    // registered, avoiding the infinite hang that .ready causes on HTTP origins.
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    if (!section) return true;
    // Check DB to see if this endpoint has a row for the given section
    const json: any = sub.toJSON();
    const res = await api.post('/public/push-check', { endpoint: json.endpoint, section }).catch(() => ({ subscribed: false }));
    return !!res?.subscribed;
  } catch { return false; }
}
