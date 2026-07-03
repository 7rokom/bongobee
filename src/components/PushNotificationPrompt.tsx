import { useEffect, useRef, useState } from 'react';
import { Bell, X, Copy, Check } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { isPushSupported, registerServiceWorker, subscribeUser, isAlreadySubscribed, getPermission } from '@/lib/push-subscribe';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { getPushSectionFromPath, type PushSection } from '@/lib/push-section';

const DISMISS_DAYS = 7;
const THANKYOU_SHOWN_KEY = 'push-thankyou-shown';
const dismissKey = (s: PushSection) => `push-prompt-dismissed-at-${s}`;

// Fallback so old/incomplete DB data never silently disables the prompt.
const SECTION_DEFAULTS: Record<PushSection, { promptEnabled: boolean; promptTitle: string; promptBody: string; promptButtonText: string; couponPopupEnabled: boolean; couponPopupHeading: string; couponCode: string }> = {
  main:     { promptEnabled: true,  promptTitle: 'নতুন অফার ও আপডেট পেতে চান?',          promptBody: '',  promptButtonText: 'হ্যাঁ, পাঠান', couponPopupEnabled: false, couponPopupHeading: '', couponCode: '' },
  digital:  { promptEnabled: true,  promptTitle: 'নতুন ডিজিটাল প্রোডাক্ট আসলে জানতে চান?', promptBody: '',  promptButtonText: 'হ্যাঁ, পাঠান', couponPopupEnabled: false, couponPopupHeading: '', couponCode: '' },
  blog:     { promptEnabled: true,  promptTitle: 'নতুন ব্লগ পোস্ট পড়তে চান?',              promptBody: '',  promptButtonText: 'হ্যাঁ, পাঠান', couponPopupEnabled: false, couponPopupHeading: '', couponCode: '' },
  reseller: { promptEnabled: false, promptTitle: 'নতুন অফার ও আপডেট পেতে চান?',           promptBody: '',  promptButtonText: 'হ্যাঁ, পাঠান', couponPopupEnabled: false, couponPopupHeading: '', couponCode: '' },
};

const PushNotificationPrompt = () => {
  const pushSections = useSiteSettingsStore((s) => s.pushSections);
  const location = useLocation();
  const section: PushSection = getPushSectionFromPath(location.pathname);
  // Merge with defaults so missing/null fields from old DB blobs don't
  // silently set promptEnabled to undefined (falsy → popup never shows).
  const cfg = { ...SECTION_DEFAULTS[section], ...pushSections?.[section] };

  const [show, setShow] = useState(false);
  const [showFloatingBell, setShowFloatingBell] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const eligibleRef = useRef(false);

  const checkSubscribed = async () => {
    const perm = await getPermission();
    if (perm === 'granted') {
      const subbed = await isAlreadySubscribed(section);
      if (subbed) return true;
    }
    if (perm === 'denied') return true;
    return false;
  };

  useEffect(() => {
    if (!cfg?.promptEnabled) { setShow(false); setShowFloatingBell(false); return; }
    if (!isPushSupported()) return;
    registerServiceWorker();

    let timer: any;
    let cancelled = false;

    const triggerNow = () => {
      if (!eligibleRef.current || cancelled) return;
      setShow(true);
    };

    const onPopState = () => {
      try { window.history.pushState({ pushPrompt: true }, ''); } catch {}
      triggerNow();
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) triggerNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') triggerNow();
    };

    const init = async () => {
      const perm = await getPermission();
      if (perm === 'denied') return;
      if (perm === 'granted') {
        const subbed = await isAlreadySubscribed(section);
        if (!subbed) await subscribeUser(section);
        return;
      }

      const isThankYou = location.pathname.startsWith('/thank-you');
      const orderKey = `${section}:${location.search || location.pathname}`;
      const thankYouAlreadyShown = sessionStorage.getItem(THANKYOU_SHOWN_KEY) === orderKey;

      const dismissedAt = localStorage.getItem(dismissKey(section));
      let dismissedRecently = false;
      if (dismissedAt) {
        const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        dismissedRecently = days < DISMISS_DAYS;
      }

      if (cancelled) return;

      if (isThankYou && !thankYouAlreadyShown) {
        sessionStorage.setItem(THANKYOU_SHOWN_KEY, orderKey);
        eligibleRef.current = true;
        timer = setTimeout(triggerNow, 2000);
        return;
      }

      if (dismissedRecently) {
        setShowFloatingBell(true);
        return;
      }

      eligibleRef.current = true;
      try { window.history.pushState({ pushPrompt: true }, ''); } catch {}
      timer = setTimeout(triggerNow, 3000);

      window.addEventListener('popstate', onPopState);
      document.addEventListener('mouseout', onMouseOut);
      document.addEventListener('visibilitychange', onVisibility);
    };
    init();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cfg?.promptEnabled, location.pathname, section]);

  const handleAllow = async () => {
    setLoading(true);
    const ok = await subscribeUser(section);
    setLoading(false);
    if (ok) {
      setShow(false);
      setShowFloatingBell(false);
      if (cfg?.couponPopupEnabled && (cfg.couponPopupHeading || cfg.couponCode)) {
        setShowSuccess(true);
      }
    } else handleDismiss();
  };

  const handleCopyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(cfg?.couponCode || '');
      setCopied(true);
      toast({ title: 'কুপন কোড কপি হয়েছে' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'কপি ব্যর্থ', variant: 'destructive' });
    }
  };
  const handleDismiss = () => {
    localStorage.setItem(dismissKey(section), String(Date.now()));
    eligibleRef.current = false;
    setShow(false);
    setShowFloatingBell(true);
  };

  const handleBellClick = async () => {
    const subbed = await checkSubscribed();
    if (subbed) { setShowFloatingBell(false); return; }
    setShow(true);
  };

  if (!cfg?.promptEnabled) return null;

  return (
    <>
      {/* Floating bell for dismissed users */}
      {showFloatingBell && !show && (
        <button
          onClick={handleBellClick}
          aria-label="নোটিফিকেশন চালু করুন"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[55] w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 shadow-[0_8px_24px_-4px_rgba(251,146,60,0.55)] flex items-center justify-center hover:scale-110 transition-transform ring-4 ring-white/60 dark:ring-zinc-800 animate-in zoom-in duration-300"
        >
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white" />
          </span>
          <Bell className="h-5 w-5 text-white animate-[wiggle_1.6s_ease-in-out_infinite]" strokeWidth={2.5} />
        </button>
      )}

      {show && (
        <div className="fixed top-4 left-4 right-4 md:top-auto md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-[60] animate-in slide-in-from-top-4 md:slide-in-from-bottom-4 fade-in duration-500">
          <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 shadow-[0_20px_50px_-12px_rgba(251,146,60,0.55)]">
            <div className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 rounded-[14px] flex flex-col gap-1.5 overflow-hidden" style={{ padding: '8px' }}>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-300/40 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-pink-300/40 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex items-center gap-2">
                <div className="relative shrink-0">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-md shadow-orange-500/40 ring-2 ring-white/60 dark:ring-zinc-800">
                    <Bell className="h-3 w-3 text-white drop-shadow animate-[wiggle_1.2s_ease-in-out_infinite]" strokeWidth={2.5} />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500 border border-white" />
                  </span>
                </div>

                <p className="font-bold text-zinc-900 dark:text-zinc-50 leading-snug text-left flex-1" style={{ fontSize: '16px' }}>{cfg.promptTitle}</p>
              </div>

              <div className="relative flex gap-1.5 justify-end">
                <Button
                  size="sm"
                  className="rounded-full h-7 px-3 text-xs bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white font-semibold shadow-md shadow-orange-500/30 border-0"
                  onClick={handleAllow}
                  disabled={loading}
                >
                  {loading ? 'অপেক্ষা...' : cfg.promptButtonText}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full h-7 px-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800" onClick={handleDismiss}>
                  পরে
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success popup with coupon after subscribe */}
      {showSuccess && cfg?.couponPopupEnabled && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" onClick={() => setShowSuccess(false)}>
          <div
            className="relative w-full max-w-sm rounded-2xl p-[2px] bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 rounded-[14px] overflow-hidden" style={{ padding: '7px' }}>
              <button
                onClick={() => setShowSuccess(false)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/70 dark:bg-zinc-800 flex items-center justify-center hover:bg-white"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
              </button>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-300/40 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-pink-300/40 rounded-full blur-2xl pointer-events-none" />

              {cfg.couponPopupHeading && (
                <h3
                  className="relative font-bold text-zinc-900 dark:text-zinc-50 leading-snug mt-2 mb-3"
                  style={{ fontSize: '17px', textAlign: 'right' }}
                >
                  {cfg.couponPopupHeading}
                </h3>
              )}

              {cfg.couponCode && (
                <div className="relative flex items-center gap-2 rounded-xl border-2 border-dashed border-orange-400 bg-white/80 dark:bg-zinc-800 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">কুপন কোড</p>
                    <p className="font-mono font-bold text-lg text-orange-600 dark:text-orange-400 truncate">{cfg.couponCode}</p>
                  </div>
                  <button
                    onClick={handleCopyCoupon}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white text-xs font-semibold px-3 py-2 shadow-md"
                  >
                    {copied ? <><Check className="h-3.5 w-3.5" /> কপি হয়েছে</> : <><Copy className="h-3.5 w-3.5" /> কপি করুন</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-14deg); }
          30% { transform: rotate(12deg); }
          45% { transform: rotate(-8deg); }
          60% { transform: rotate(6deg); }
          75% { transform: rotate(-3deg); }
        }
      `}</style>
    </>
  );
};

export default PushNotificationPrompt;
