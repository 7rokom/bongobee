import { useSearchParams, useLocation, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, ShoppingBag, Home } from "lucide-react";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import PageAudioPlayer from "@/components/PageAudioPlayer";
import WhatsAppContactButton from "@/components/WhatsAppContactButton";
import { trackPurchase } from "@/lib/dataLayer";

const ThankYou = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const thankYouAudioUrl = useSiteSettingsStore((s) => s.thankYouAudioUrl);
  const thankYouAudioEnabled = useSiteSettingsStore((s) => s.thankYouAudioEnabled);
  const thankYouDirectAudioUrl = useSiteSettingsStore((s) => s.thankYouDirectAudioUrl);
  const thankYouDirectAudioEnabled = useSiteSettingsStore((s) => s.thankYouDirectAudioEnabled);
  const orderNumber = (location.state as any)?.orderId || searchParams.get("order") || "BB000000";
  const postOrderChoice = (location.state as any)?.postOrderChoice as 'direct' | 'call' | undefined;
  const purchasePayload = (location.state as any)?.purchasePayload as
    | { orderId: string; items: any[]; value: number; shipping: number; discount: number; currency?: string; valueOverride?: number; customer?: any }
    | undefined;

  // Fire Purchase event on this page when navigation provided a payload
  // (used by LandingPage flow so the pixel reliably fires on the thank-you page).
  const firedRef = useRef(false);
  useEffect(() => {
    if (!purchasePayload || firedRef.current) return;
    firedRef.current = true;
    try {
      trackPurchase(
        purchasePayload.orderId,
        purchasePayload.items,
        purchasePayload.value,
        purchasePayload.shipping,
        purchasePayload.discount,
        purchasePayload.currency || 'BDT',
        purchasePayload.valueOverride,
        purchasePayload.customer,
      );
    } catch { /* non-fatal */ }
  }, [purchasePayload]);

  // "সরাসরি পাঠিয়ে দিন" → direct audio (যদি সেট থাকে)। অন্যথায় (call/undefined) → বর্তমান audio।
  const useDirect = postOrderChoice === 'direct' && thankYouDirectAudioEnabled && !!thankYouDirectAudioUrl;
  const audioUrl = useDirect ? thankYouDirectAudioUrl : thankYouAudioUrl;
  const audioEnabled = useDirect ? thankYouDirectAudioEnabled : thankYouAudioEnabled;
  const audioPageKey = useDirect ? 'thankyou-direct' : 'thankyou-call';

  return (
    <div className="bg-background">
      <div className="max-w-lg mx-auto">
        <div className="bg-card overflow-hidden">
          {/* Success Header */}
          <div className="bg-primary/5 border-b border-primary/10 px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-9 w-9 text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">অর্ডার সফল হয়েছে!</h1>
            <p className="text-[16px] text-muted-foreground mt-1.5">
              আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে
            </p>
          </div>

          {/* Order Details */}
          <div className="px-6 py-6 space-y-5">
            {/* Order Number */}
            <div className="bg-primary/5 border border-primary/15 rounded-[5px] p-0 text-center">
              <p className="text-sm text-muted-foreground mb-1">অর্ডার নম্বর</p>
              <p className="text-2xl font-bold text-primary tracking-wide">{orderNumber}</p>
            </div>

            {/* Info */}
            <div className="bg-muted/50 rounded-[5px] p-4 text-center space-y-3">
              <p className="text-[16px] text-foreground leading-relaxed">
                প্রিয় গ্রাহক! আমরা আপনার অর্ডারটি গ্রহণ করেছি। যেকোনো প্রয়োজনে আমাদের সাথে হোয়াটসঅ্যাপে যোগাযোগ করুন। ধন্যবাদ ❤️
              </p>
              <WhatsAppContactButton />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <Link to="/shop">
                <Button className="w-full rounded-[5px] h-11 gap-2 text-[15px]">
                  <ShoppingBag className="h-4 w-4" /> আরো শপিং করুন
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full rounded-[5px] h-11 gap-2 text-[15px]">
                  <Home className="h-4 w-4" /> হোম পেজ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <PageAudioPlayer
        audioUrl={audioUrl}
        enabled={audioEnabled}
        pageKey={audioPageKey}
      />
    </div>
  );
};

export default ThankYou;
