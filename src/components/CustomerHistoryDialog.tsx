import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { HistoryOrder } from '@/lib/customer-history';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  orders: HistoryOrder[];
  statusColors?: Record<string, string>;
}

export function CustomerHistoryDialog({ open, onOpenChange, title, orders, statusColors = {} }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{title || 'পূর্ববর্তী অর্ডার'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি</p>
          ) : (
            orders.map((o) => (
              <div key={`${o.type}-${o.id}`} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{o.id}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o.type === 'reseller' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                      {o.type === 'reseller' ? 'রিসেলার' : 'মেইন'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[o.status] || 'bg-muted text-foreground'}`}>{o.status}</span>
                </div>
                <p className="text-muted-foreground text-xs">{o.date} • {o.customer} • {o.phone}</p>
                {o.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate pr-2">{item.name} ×{item.qty}</span>
                    <span>৳{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-xs border-t pt-1">
                  <span>মোট:</span>
                  <span>৳{o.total.toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
