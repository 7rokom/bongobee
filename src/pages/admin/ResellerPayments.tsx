import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useResellerStore } from '@/stores/useResellerStore';
import { Check, X, Wallet, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import ImportExportButtons from '@/components/admin/ImportExportButtons';

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-400 text-yellow-950',
  'অনুমোদিত': 'bg-green-500 text-white',
  'বাতিল': 'bg-red-500 text-white',
};

const methodLabels: Record<string, string> = {
  bkash: 'বিকাশ',
  nagad: 'নগদ',
  rocket: 'রকেট',
  bank: 'ব্যাংক ট্রান্সফার',
};

const ResellerPayments = () => {
  const { paymentRequests, updatePaymentRequest, resellers, orders } = useResellerStore();
  const [detailReq, setDetailReq] = useState<string | null>(null);

  const pendingRequests = paymentRequests.filter((p) => p.status === 'পেন্ডিং');
  const approvedRequests = paymentRequests.filter((p) => p.status === 'অনুমোদিত');
  const cancelledRequests = paymentRequests.filter((p) => p.status === 'বাতিল');

  const totalPending = pendingRequests.reduce((s, p) => s + p.amount, 0);
  const totalApproved = approvedRequests.reduce((s, p) => s + p.amount, 0);

  const handleApprove = (id: string) => {
    const req = paymentRequests.find((p) => p.id === id);
    if (!req) return;
    updatePaymentRequest(id, 'অনুমোদিত');
    toast.success(`৳${req.amount} পেমেন্ট অনুমোদিত হয়েছে`);
  };

  const handleCancel = (id: string) => {
    updatePaymentRequest(id, 'বাতিল');
    toast.success('পেমেন্ট রিকুয়েস্ট বাতিল হয়েছে');
  };

  // Get delivered orders for a reseller (orders that contributed to profit)
  const getResellerDeliveredOrders = (resellerId: string) => {
    return orders.filter(o => o.resellerId === resellerId && o.status === 'ডেলিভারড');
  };

  const detailReqData = detailReq ? paymentRequests.find(p => p.id === detailReq) : null;
  const detailOrders = detailReqData ? getResellerDeliveredOrders(detailReqData.resellerId) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">পেমেন্ট রিকুয়েস্ট</h1>
        <ImportExportButtons
          data={paymentRequests}
          filename="payment-requests"
          label="পেমেন্ট রিকুয়েস্ট"
          onImport={() => { toast.info('পেমেন্ট রিকুয়েস্ট ইমপোর্ট সমর্থিত নয়'); }}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-600" /><p className="text-xs text-muted-foreground">পেন্ডিং</p></div>
            <p className="text-xl font-bold text-yellow-600">{pendingRequests.length}টি</p>
            <p className="text-xs text-muted-foreground">৳{totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Check className="w-4 h-4 text-green-600" /><p className="text-xs text-muted-foreground">অনুমোদিত</p></div>
            <p className="text-xl font-bold text-green-600">{approvedRequests.length}টি</p>
            <p className="text-xs text-muted-foreground">৳{totalApproved.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><X className="w-4 h-4 text-destructive" /><p className="text-xs text-muted-foreground">বাতিল</p></div>
            <p className="text-xl font-bold text-destructive">{cancelledRequests.length}টি</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">মোট রিকুয়েস্ট</p></div>
            <p className="text-xl font-bold text-foreground">{paymentRequests.length}টি</p>
          </CardContent>
        </Card>
      </div>

      {/* All Requests */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">সকল পেমেন্ট রিকুয়েস্ট</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">রিসেলার</TableHead>
                  <TableHead className="text-xs text-right">পরিমাণ</TableHead>
                  <TableHead className="text-xs">মেথড</TableHead>
                  <TableHead className="text-xs">অ্যাকাউন্ট</TableHead>
                  <TableHead className="text-xs">তারিখ</TableHead>
                  <TableHead className="text-xs text-center">স্ট্যাটাস</TableHead>
                  <TableHead className="text-xs text-center">একশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট রিকুয়েস্ট নেই</TableCell>
                  </TableRow>
                ) : paymentRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-xs font-medium">{req.resellerName}</TableCell>
                    <TableCell className="text-xs text-right font-bold">৳{req.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{methodLabels[req.method] || req.method}</TableCell>
                    <TableCell className="text-xs font-mono">{req.accountNumber}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{req.date}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[req.status] || ''} variant="secondary">{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        {req.status === 'পেন্ডিং' && (
                          <>
                            <Button size="sm" variant="default" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                              <Check className="w-3 h-3" /> পেইড
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleCancel(req.id)}>
                              <X className="w-3 h-3" /> বাতিল
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setDetailReq(req.id)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Detail Dialog */}
      <Dialog open={!!detailReq} onOpenChange={(open) => { if (!open) setDetailReq(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>পেমেন্ট রিকুয়েস্ট বিবরণ</DialogTitle></DialogHeader>
          {detailReqData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">রিসেলার</p><p className="font-medium">{detailReqData.resellerName}</p></div>
                <div><p className="text-muted-foreground text-xs">পরিমাণ</p><p className="font-bold text-primary">৳{detailReqData.amount.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">মেথড</p><p className="font-medium">{methodLabels[detailReqData.method] || detailReqData.method}</p></div>
                <div><p className="text-muted-foreground text-xs">অ্যাকাউন্ট</p><p className="font-medium font-mono">{detailReqData.accountNumber}</p></div>
                <div><p className="text-muted-foreground text-xs">তারিখ</p><p className="font-medium">{detailReqData.date}</p></div>
                <div><p className="text-muted-foreground text-xs">স্ট্যাটাস</p><Badge className={statusColors[detailReqData.status] || ''} variant="secondary">{detailReqData.status}</Badge></div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">ডেলিভারড অর্ডারের প্রফিট তালিকা</p>
                {detailOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">কোনো ডেলিভারড অর্ডার নেই</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {detailOrders.map(o => (
                      <div key={o.id} className="flex justify-between items-center border rounded-lg p-2 text-xs">
                        <div>
                          <span className="font-bold text-primary">{o.id}</span>
                          <p className="text-muted-foreground">{o.customerName}</p>
                          <p className="text-muted-foreground">{o.items.map(i => i.productTitle).join(', ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">বিক্রি: ৳{o.totalSellingPrice}</p>
                          <p className="text-green-600 font-bold">লাভ: ৳{o.totalProfit}</p>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between text-sm font-bold">
                      <span>মোট লাভ:</span>
                      <span className="text-green-600">৳{detailOrders.reduce((s, o) => s + o.totalProfit, 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResellerPayments;
