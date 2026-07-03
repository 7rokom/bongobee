import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Truck, PhoneCall, CheckCircle, Loader2 } from "lucide-react";
import { useFraudSettingsStore } from "@/stores/useFraudSettingsStore";
import WhatsAppContactButton from "@/components/WhatsAppContactButton";

type Step = "choose" | "direct_success" | "call_success";

interface PostOrderPopupProps {
  orderId: string;
  isOpen: boolean;
  onComplete: (choice?: 'direct' | 'call') => void;
}

const PostOrderPopup = ({ orderId, isOpen, onComplete }: PostOrderPopupProps) => {
  const [step, setStep] = useState<Step>("choose");
  const [choice, setChoice] = useState<'direct' | 'call' | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  const chooseTitle = useFraudSettingsStore((s) => s.postOrderChooseTitle);
  const chooseMessage = useFraudSettingsStore((s) => s.postOrderChooseMessage);
  const directBtnText = useFraudSettingsStore((s) => s.postOrderDirectBtnText);
  const callBtnText = useFraudSettingsStore((s) => s.postOrderCallBtnText);
  const directSuccessTitle = useFraudSettingsStore((s) => s.postOrderDirectSuccessTitle);
  const directSuccessMessage = useFraudSettingsStore((s) => s.postOrderDirectSuccessMessage);
  const callSuccessTitle = useFraudSettingsStore((s) => s.postOrderCallSuccessTitle);
  const callSuccessMessage = useFraudSettingsStore((s) => s.postOrderCallSuccessMessage);

  const handleDirectShip = async () => {
    setChoice('direct');
    setUpdating(true);
    try {
      const isReseller = orderId.startsWith('RO');
      // Auto-confirmed by customer's "direct ship" choice — mark confirmer as
      // "অটোমেটিক". The endpoint only sets confirmed_by if not already set, so a
      // manual confirmer is not overwritten, and returns the resulting order.
      const { api } = await import('@/lib/api');
      const row = await api.post('/public/confirm-order', { code: orderId });

      // Auto-fire confirm SMS to customer — ONLY if the order is now কনফার্মড.
      try {
        if (row && row.status === 'কনফার্মড') {
          const { maybeSendStatusSms, buildMainOrderVars, buildResellerOrderVars } = await import('@/lib/bulksms');
          if (isReseller) {
            const order = {
              id: row.id,
              customerName: row.customer_name,
              customerPhone: row.customer_phone,
              customerAddress: row.customer_address,
              items: row.items || [],
              totalSellingPrice: row.total_selling_price ?? row.total ?? 0,
              deliveryCharge: row.delivery_charge,
              status: row.status,
            };
            maybeSendStatusSms('কনফার্মড', order.customerPhone, buildResellerOrderVars(order), {
              orderId: order.id, orderType: 'reseller', resellerId: row.reseller_id, smsSent: row.sms_sent || {},
            });
          } else {
            const order = {
              id: row.id,
              customer: row.customer,
              phone: row.phone,
              address: row.address,
              items: row.items || [],
              total: row.total ?? 0,
              deliveryCharge: row.delivery_charge,
              status: row.status,
            };
            maybeSendStatusSms('কনফার্মড', order.phone, buildMainOrderVars(order), {
              orderId: order.id, orderType: 'main', smsSent: row.sms_sent || {},
            });
          }
        } else {
          console.log('[PostOrderPopup auto-sms] skipped — order status is', row?.status);
        }
      } catch (e) {
        console.warn('[PostOrderPopup auto-sms] skipped:', e);
      }
    } catch {
      // proceed anyway
    }
    setUpdating(false);
    setStep("direct_success");
  };

  const handleCallFirst = () => {
    setChoice('call');
    setStep("call_success");
  };

  const renderMultiline = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onComplete(choice); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" hideClose onOpenAutoFocus={(e) => e.preventDefault()}>
        {step === "choose" && (
          <div className="py-6 space-y-5">
            <h2 className="text-xl font-bold text-black text-center">{chooseTitle}</h2>
            <p className="text-[17px] leading-relaxed text-black px-2 text-left">
              {renderMultiline(chooseMessage)}
            </p>
            <div className="space-y-3 px-2">
              <Button
                onClick={handleDirectShip}
                disabled={updating}
                size="lg"
                className="w-full text-[17px] h-14 gap-2"
              >
                {updating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Truck className="h-5 w-5" />
                )}
                {directBtnText}
              </Button>
              <Button
                onClick={handleCallFirst}
                disabled={updating}
                variant="outline"
                size="lg"
                className="w-full text-[17px] h-14 gap-2 border-2"
              >
                <PhoneCall className="h-5 w-5" />
                {callBtnText}
              </Button>
            </div>
          </div>
        )}

        {step === "direct_success" && (
          <div className="py-6 space-y-5">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold text-black text-center">{directSuccessTitle}</h2>
            <p className="text-[17px] leading-relaxed text-black px-2 text-left">
              {renderMultiline(directSuccessMessage)}
            </p>
            <div className="px-2">
              <WhatsAppContactButton message="যেকোন প্রয়োজনে যোগাযোগ করছি" />
            </div>
            <Button onClick={() => onComplete('direct')} size="lg" className="text-[17px]">
              আচ্ছা, ঠিক আছে
            </Button>
          </div>
        )}

        {step === "call_success" && (
          <div className="py-6 space-y-5">
            <PhoneCall className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold text-black text-center">{callSuccessTitle}</h2>
            <p className="text-[17px] leading-relaxed text-black px-2 text-left">
              {renderMultiline(callSuccessMessage)}
            </p>
            <Button onClick={() => onComplete('call')} size="lg" className="text-[17px]">
              আচ্ছা, ঠিক আছে
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PostOrderPopup;
