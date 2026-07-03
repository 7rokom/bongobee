import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCouponStore } from "@/stores/useCouponStore";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ExitIntentPopupProps {
  productId: string;
  productSlug: string;
  productTitle: string;
}

const SESSION_KEY_PREFIX = "exitPopupShown:";
const PURCHASED_KEY = "userPurchased";

const ExitIntentPopup = ({ productId, productSlug, productTitle }: ExitIntentPopupProps) => {
  const location = useLocation();
  const coupons = useCouponStore((s) => s.coupons);
  const fetchCoupons = useCouponStore((s) => s.fetchCoupons);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggeredRef = useRef(false);
  const historyPushedRef = useRef(false);

  // Find an active coupon assigned to this product
  const coupon = (() => {
    const now = new Date();
    return coupons.find((c) => {
      if (!c.isActive) return false;
      if (!c.productIds || c.productIds.length === 0) return false;
      if (!c.productIds.includes(productId)) return false;
      if (new Date(c.startDate) > now) return false;
      if (new Date(c.endDate) < now) return false;
      if (c.maxUsage > 0 && c.usedCount >= c.maxUsage) return false;
      return true;
    });
  })();

  useEffect(() => {
    if (coupons.length === 0) fetchCoupons();
  }, []);

  useEffect(() => {
    if (!coupon) return;

    // Already purchased — never show
    if (typeof window !== "undefined" && localStorage.getItem(PURCHASED_KEY) === "1") return;

    // Already shown for this product in this session
    const sessionKey = SESSION_KEY_PREFIX + productId;
    if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey) === "1") return;

    const markShown = () => {
      try { sessionStorage.setItem(sessionKey, "1"); } catch {}
    };

    const trigger = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      markShown();
      setOpen(true);
    };

    // Push a dummy history state so back-button fires popstate while staying on page
    try {
      window.history.pushState({ exitIntent: true }, "");
      historyPushedRef.current = true;
    } catch {}

    const handlePopState = () => {
      // Back button pressed
      trigger();
      // Re-push so user can still go back after closing the popup
      try { window.history.pushState({ exitIntent: true }, ""); } catch {}
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // Desktop exit intent: cursor leaves through the top
      if (e.clientY <= 0) trigger();
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("mouseleave", handleMouseLeave);
      // Clean up the dummy history entry when leaving page (only if still pending)
      if (historyPushedRef.current && !triggeredRef.current) {
        try {
          if (window.history.state && (window.history.state as any).exitIntent) {
            window.history.back();
          }
        } catch {}
      }
    };
  }, [coupon?.id, productId]);

  // Reset when route changes to a different product
  useEffect(() => {
    triggeredRef.current = false;
    historyPushedRef.current = false;
  }, [location.pathname]);

  if (!coupon) return null;

  const discountDisplay =
    coupon.discountType === "percentage"
      ? `${coupon.discountValue}%`
      : `৳${coupon.discountValue}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast({ title: "কুপন কোড কপি হয়েছে!", description: coupon.code });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "কপি করা যায়নি", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-[10px] p-6 text-center">
        <div className="space-y-3">
          <div className="text-2xl font-bold text-foreground">প্রিয় গ্রাহক!</div>
          <p className="text-foreground leading-relaxed" style={{ fontSize: "15px" }}>
            আপনি আমাদের লাকি কাস্টমার🥰
          </p>
          <p className="text-base text-foreground leading-relaxed">
            তাই আপনাকে{" "}
            <Link
              to={`/product/${productSlug}`}
              onClick={() => setOpen(false)}
              className="text-primary font-semibold underline underline-offset-2"
            >
              {productTitle}
            </Link>{" "}
            প্রডাক্টের উপর{" "}
            <span className="font-bold" style={{ fontSize: "17px" }}>
              {discountDisplay}
            </span>{" "}
            {coupon.discountType === "percentage" ? "পার্সেন্ট" : "টাকা"} ডিস্কাউন্ট দেওয়া হচ্ছে।
          </p>
          <div className="pt-1">
            <p className="text-base text-foreground mb-2">কুপন কোডঃ</p>
            <div className="flex items-center justify-center gap-2">
              <div className="flex-1 max-w-[180px] border-2 border-dashed border-primary rounded-md py-2 px-3 bg-primary/5">
                <span className="font-bold text-lg tracking-wider text-primary">
                  {coupon.code}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={copied ? "secondary" : "default"}
                onClick={handleCopyCode}
                className="gap-1"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> কপি হয়েছে
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> কপি
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitIntentPopup;
