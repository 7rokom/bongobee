import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Truck } from 'lucide-react';

export interface FreeDeliveryOrderInfo {
  orderId: string;       // Display ID (e.g. #45)
  storeKey: string;      // Key used in follow_up_data (e.g. #45 or reseller-#45)
  customerName?: string;
}

interface Props {
  open: boolean;
  orders: FreeDeliveryOrderInfo[];                    // 1+ free-delivery orders awaiting charge
  defaultCharge?: number;                              // Pre-fill (e.g. 80)
  onCancel: () => void;
  onSubmit: (charges: Record<string, number>) => void; // Map storeKey -> charge
}

const CourierDeliveryChargePopup = ({ open, orders, defaultCharge = 80, onCancel, onSubmit }: Props) => {
  const [charges, setCharges] = useState<Record<string, string>>({});
  const [applyAll, setApplyAll] = useState<string>(String(defaultCharge));

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      orders.forEach((o) => { init[o.storeKey] = String(defaultCharge); });
      setCharges(init);
      setApplyAll(String(defaultCharge));
    }
  }, [open, orders, defaultCharge]);

  const handleApplyAll = () => {
    const v = applyAll;
    const next: Record<string, string> = {};
    orders.forEach((o) => { next[o.storeKey] = v; });
    setCharges(next);
  };

  const handleSubmit = () => {
    const out: Record<string, number> = {};
    for (const o of orders) {
      const n = parseFloat(charges[o.storeKey] || '0');
      if (isNaN(n) || n < 0) return;
      out[o.storeKey] = n;
    }
    onSubmit(out);
  };

  const allValid = orders.every((o) => {
    const n = parseFloat(charges[o.storeKey] || '');
    return !isNaN(n) && n >= 0;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            ফ্রি ডেলিভারি অর্ডার — কুরিয়ার চার্জ দিন
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-900">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>এই অর্ডারে কাস্টমার ডেলিভারি চার্জ দেননি। কুরিয়ারে পাঠানোর আগে আপনার <strong>আসল ডেলিভারি খরচ</strong> দিন। এই খরচ প্রফিট থেকে কাটা হবে।</p>
          </div>

          {orders.length > 1 && (
            <div className="flex items-end gap-2 pb-2 border-b">
              <div className="flex-1">
                <Label className="text-xs">সবগুলোর জন্য একই চার্জ</Label>
                <Input
                  type="number"
                  min={0}
                  value={applyAll}
                  onChange={(e) => setApplyAll(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleApplyAll}>প্রয়োগ</Button>
            </div>
          )}

          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {orders.map((o) => (
              <div key={o.storeKey} className="flex items-center gap-2 p-2 border rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{o.orderId}</div>
                  {o.customerName && (
                    <div className="text-xs text-muted-foreground truncate">{o.customerName}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs">৳</span>
                  <Input
                    type="number"
                    min={0}
                    value={charges[o.storeKey] ?? ''}
                    onChange={(e) => setCharges((p) => ({ ...p, [o.storeKey]: e.target.value }))}
                    className="h-9 w-24 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>বাতিল</Button>
          <Button onClick={handleSubmit} disabled={!allValid}>সেভ করে এগিয়ে যান</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CourierDeliveryChargePopup;
