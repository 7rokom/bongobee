import { useSearchParams, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ShoppingBag, Home } from "lucide-react";
import WhatsAppContactButton from "@/components/WhatsAppContactButton";

/**
 * Fake Thank You page — looks identical to the real ThankYou page
 * but does NOT fire any purchase/conversion tags.
 * Used when courier ratio check fails.
 */
const FakeThankYou = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const orderNumber = (location.state as any)?.orderId || searchParams.get("order") || "BB000000";

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
                শীঘ্রই আমাদের প্রতিনিধি আপনার সাথে যোগাযোগ করবে অর্ডার কনফার্ম করতে।
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
    </div>
  );
};

export default FakeThankYou;
