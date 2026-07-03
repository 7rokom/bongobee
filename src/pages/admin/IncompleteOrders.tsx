import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldBan, AlertCircle, Trash2, Phone, MapPin, ShoppingBag, CheckCircle, XCircle, Truck, Globe, BarChart3, Loader2, Copy, MessageCircle, StickyNote } from 'lucide-react';
import { useIncompleteOrderStore, type IncompleteOrder } from '@/stores/useIncompleteOrderStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useAdminStore } from '@/stores/useAdminStore';
import { toast } from 'sonner';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { useCourierRatioStore } from '@/stores/useCourierRatioStore';
import { normalizePhone } from '@/lib/order-validation';
import { useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const IncompleteOrders = () => {
  const { orders, removeOrder, removeOrders, cancelOrder, updateNote } = useIncompleteOrderStore();
  const mainOrders = useOrderStore((s) => s.orders);
  const confirmedFromIncompleteCount = mainOrders.filter((o) => o.source === 'incomplete').length;
  const { createOrderFromCheckout } = useOrderStore();
  const { employees } = useEmployeeStore();
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const currentEmployee = employees.find(e => e.email === adminEmail);
  const confirmerName = currentEmployee?.name || 'অ্যাডমিন';
  const [tab, setTab] = useState('incomplete');
  const courierData = useCourierRatioStore((s) => s.data);
  const loadCourierCache = useCourierRatioStore((s) => s.loadCache);
  const checkCourierRatioAction = useCourierRatioStore((s) => s.checkRatio);
  const fraudSettings = useFraudSettingsStore();
  useEffect(() => { loadCourierCache(); }, [loadCourierCache]);
  const [selectedCancelled, setSelectedCancelled] = useState<Set<string>>(new Set());
  const [noteOrderId, setNoteOrderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const blockedOrders = orders.filter((o) => o.type === 'blocked' && o.status !== 'cancelled');
  const incompleteOrders = orders.filter((o) => o.type === 'incomplete' && o.status !== 'cancelled');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  const checkCourierRatio = (phone: string) => {
    checkCourierRatioAction(phone, fraudSettings.bdcourierApiKey || undefined);
  };

  const handleDelete = (id: string) => { removeOrder(id); toast.success('মুছে ফেলা হয়েছে'); };
  const handleCancel = (id: string) => { cancelOrder(id); toast.info('অর্ডার ক্যান্সেল করা হয়েছে'); };
  const handleConfirm = async (order: IncompleteOrder) => {
    try {
      const invoiceId = await createOrderFromCheckout({ name: order.name, phone: order.phone, address: order.address, items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, price: i.price, image: i.image, variations: i.variations })), deliveryCharge: order.deliveryCharge || 70, subtotal: order.totalPrice, confirmedBy: confirmerName, customerIp: order.customerIp, customerFingerprint: order.customerFingerprint, orderNote: order.note, source: 'incomplete' });
      await removeOrder(order.id);
      toast.success(`অর্ডার কনফার্ম হয়েছে ${invoiceId} (${confirmerName})`);
    } catch (err) {
      toast.error('অর্ডার কনফার্ম করতে সমস্যা হয়েছে');
    }
  };

  const toggleCancelledSelect = (id: string) => {
    setSelectedCancelled(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAllCancelled = () => {
    if (selectedCancelled.size === cancelledOrders.length) setSelectedCancelled(new Set());
    else setSelectedCancelled(new Set(cancelledOrders.map(o => o.id)));
  };
  const handleBulkDelete = () => {
    removeOrders(selectedCancelled);
    toast.success(`${selectedCancelled.size}টি অর্ডার মুছে ফেলা হয়েছে`);
    setSelectedCancelled(new Set());
  };

  const CourierRatio = ({ phone }: { phone: string }) => {
    const data = courierData[normalizePhone(phone) || phone];
    if (data && !data.loading) return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] font-medium">
          <span className="text-muted-foreground">all:</span><span className="text-primary font-bold">{data.all}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">delivered:</span><span className="text-green-600 font-bold">{data.delivered}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">return:</span><span className="text-red-600 font-bold">{data.returned}</span>
        </div>
        {data.all > 0 && (
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${(data.delivered / data.all) * 100}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${(data.returned / data.all) * 100}%` }} />
          </div>
        )}
      </div>
    );
    if (data?.loading) return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
    return (
      <Button variant="outline" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5" onClick={() => checkCourierRatio(phone)}>
        <BarChart3 className="w-2.5 h-2.5" /> রেশিও দেখুন
      </Button>
    );
  };

  const renderOrderRow = (order: IncompleteOrder, showActions: boolean) => (
    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
      <td className="py-3 px-4">
        <span className="font-bold text-primary text-xs">{order.id}</span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(order.date).toLocaleDateString('bn-BD')}</p>
        {order.type === 'blocked' && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 mt-1">
            <ShieldBan className="w-2.5 h-2.5" /> ব্লকড
          </span>
        )}
        {order.customerIp && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <Globe className="w-2.5 h-2.5" /> {order.customerIp}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <p className="font-semibold text-foreground text-sm">{order.name}</p>
        <button onClick={() => checkCourierRatio(order.phone)} className="text-xs text-blue-600 hover:underline cursor-pointer">{order.phone}</button>
        <CourierRatio phone={order.phone} />
        <p className="text-xs text-muted-foreground">{order.address}</p>
        {order.blockReason && (
          <p className="text-[10px] text-destructive mt-0.5">কারণ: {order.blockReason}</p>
        )}
        <div className="flex gap-1 mt-1.5">
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`tel:${order.phone}`)}><Phone className="w-3 h-3 text-green-600" /></Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(order.phone); toast.success('নাম্বার কপি হয়েছে'); }}><Copy className="w-3 h-3 text-blue-600" /></Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`https://wa.me/88${order.phone}`, '_blank')}><MessageCircle className="w-3 h-3 text-emerald-600" /></Button>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.image && <img src={item.image} alt={item.title} className="w-10 h-10 rounded object-cover border" />}
              <div>
                <p className="text-xs font-medium leading-tight">{item.title}</p>
                {item.variations && Object.entries(item.variations).map(([key, val]) => (
                  <p key={key} className="text-[10px] text-muted-foreground">{key}: {val}</p>
                ))}
                <p className="text-[10px] text-muted-foreground">× {item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">সাবটোটাল:</span><span>৳ {order.totalPrice.toLocaleString()}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">ডেলিভারি:</span><span>৳ {order.deliveryCharge || 0}</span></div>
          <div className="flex justify-between gap-4 pt-1 border-t font-bold text-sm"><span>টোটাল:</span><span className="text-primary">৳ {(order.grandTotal || order.totalPrice).toLocaleString()}</span></div>
        </div>
      </td>
      <td className="py-3 px-4">
        {showActions ? (
          <div className="space-y-1.5">
            <Button variant="default" size="sm" className="h-7 w-full gap-1 text-xs" onClick={() => handleConfirm(order)}>
              <CheckCircle className="w-3 h-3" /> কনফার্ম
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs" onClick={() => { setNoteOrderId(order.id); setNoteText(order.note || ''); }}>
              <StickyNote className="w-3 h-3" /> নোট
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs text-orange-600 hover:text-orange-700" onClick={() => handleCancel(order.id)}>
              <XCircle className="w-3 h-3" /> ক্যান্সেল
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(order.id)}>
              <Trash2 className="w-3 h-3" /> মুছুন
            </Button>
            {order.note && <p className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">📝 {order.note}</p>}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium"><XCircle className="w-3 h-3" /> ক্যান্সেলড</span>
        )}
      </td>
    </tr>
  );

  const renderMobileCard = (order: IncompleteOrder, showActions: boolean, selectable?: boolean) => (
    <Card key={order.id} className={`border shadow-sm ${selectable && selectedCancelled.has(order.id) ? 'border-primary/40 bg-primary/5' : ''}`}>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          {selectable && <Checkbox checked={selectedCancelled.has(order.id)} onCheckedChange={() => toggleCancelledSelect(order.id)} className="h-3.5 w-3.5 mt-1" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-bold text-primary text-sm">{order.id}</span>
                <p className="text-[10px] text-muted-foreground">{new Date(order.date).toLocaleDateString('bn-BD')}</p>
                {order.type === 'blocked' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 mt-0.5"><ShieldBan className="w-2.5 h-2.5" /> ব্লকড</span>
                )}
                {order.blockReason && (
                  <p className="text-[10px] text-destructive mt-0.5">কারণ: {order.blockReason}</p>
                )}
                {order.customerIp && <p className="text-[10px] text-muted-foreground"><Globe className="w-2.5 h-2.5 inline" /> {order.customerIp}</p>}
                
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">{order.name}</p>
                <button onClick={() => checkCourierRatio(order.phone)} className="text-[11px] text-blue-600 hover:underline cursor-pointer">{order.phone}</button>
                <CourierRatio phone={order.phone} />
                <p className="text-[10px] text-muted-foreground">{order.address}</p>
                <div className="flex gap-1 mt-1 justify-end">
                  <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`tel:${order.phone}`)}><Phone className="w-2.5 h-2.5 text-green-600" /></Button>
                  <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => { navigator.clipboard.writeText(order.phone); toast.success('কপি হয়েছে'); }}><Copy className="w-2.5 h-2.5 text-blue-600" /></Button>
                  <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`https://wa.me/88${order.phone}`, '_blank')}><MessageCircle className="w-2.5 h-2.5 text-emerald-600" /></Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Products */}
        <div className="border-t pt-2 space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.image && <img src={item.image} alt={item.title} className="w-8 h-8 rounded object-cover border" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.title}</p>
                {item.variations && Object.entries(item.variations).map(([key, val]) => (
                  <p key={key} className="text-[10px] text-muted-foreground">{key}: {val}</p>
                ))}
                <p className="text-[10px] text-muted-foreground">× {item.quantity}</p>
              </div>
              <span className="text-xs font-medium shrink-0">৳ {(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1 border-t">
            <span className="text-muted-foreground">সাবটোটাল: ৳{order.totalPrice} | ডেলিভারি: ৳{order.deliveryCharge || 0}</span>
            <span className="font-bold text-primary">৳{(order.grandTotal || order.totalPrice).toLocaleString()}</span>
          </div>
        </div>
        {/* Actions */}
        {showActions ? (
          <>
            <div className="border-t pt-2 flex items-center gap-2 flex-wrap">
              <Button variant="default" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => handleConfirm(order)}><CheckCircle className="w-2.5 h-2.5" /> কনফার্ম</Button>
              <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => { setNoteOrderId(order.id); setNoteText(order.note || ''); }}><StickyNote className="w-2.5 h-2.5" /> নোট</Button>
              <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] text-orange-600" onClick={() => handleCancel(order.id)}><XCircle className="w-2.5 h-2.5" /> ক্যান্সেল</Button>
              <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] text-destructive" onClick={() => handleDelete(order.id)}><Trash2 className="w-2.5 h-2.5" /> মুছুন</Button>
            </div>
            {order.note && <p className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">📝 {order.note}</p>}
          </>
        ) : (
          <div className="border-t pt-2"><span className="text-xs text-orange-600 font-medium"><XCircle className="w-3 h-3 inline" /> ক্যান্সেলড</span></div>
        )}
      </CardContent>
    </Card>
  );

  const renderTable = (list: IncompleteOrder[], showActions: boolean) => (
    <>
      {/* Desktop */}
      <Card className="border-0 shadow-sm hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[120px]">ইনভয়েজ</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[200px]">কাস্টমার</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[180px]">প্রোডাক্ট</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[140px]">মূল্য</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[120px]">একটিভিটি</th>
                </tr>
              </thead>
              <tbody>{list.map(o => renderOrderRow(o, showActions))}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Mobile */}
      <div className="lg:hidden space-y-3">{list.map(o => renderMobileCard(o, showActions))}</div>
    </>
  );

  const renderCancelledTable = () => (
    <>
      <div className="bg-muted/40 border rounded-md p-3 mb-3 text-xs text-muted-foreground">
        ⚠️ ক্যান্সেলড অর্ডার ডিলিট করা যাবে না — Bulk SMS এ এই নাম্বারগুলো ব্যবহার করতে পারবেন।
      </div>
      {/* Desktop */}
      <Card className="border-0 shadow-sm hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[120px]">ইনভয়েজ</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[200px]">কাস্টমার</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[180px]">প্রোডাক্ট</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[140px]">মূল্য</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-[80px]">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {cancelledOrders.map(order => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                    <td className="py-3 px-4">
                      <span className="font-bold text-primary text-xs">{order.id}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(order.date).toLocaleDateString('bn-BD')}</p>
                      {order.type === 'blocked' && <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 mt-1"><ShieldBan className="w-2.5 h-2.5" /> ব্লকড</span>}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-foreground text-sm">{order.name}</p>
                      <p className="text-xs text-muted-foreground">{order.phone}</p>
                      <p className="text-xs text-muted-foreground">{order.address}</p>
                    </td>
                    <td className="py-3 px-4">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1">
                          {item.image && <img src={item.image} alt={item.title} className="w-8 h-8 rounded object-cover border" />}
                          <div><p className="text-xs font-medium">{item.title}</p><p className="text-[10px] text-muted-foreground">× {item.quantity}</p></div>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-primary text-sm">৳ {(order.grandTotal || order.totalPrice).toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium"><XCircle className="w-3 h-3" /> ক্যান্সেলড</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Mobile */}
      <div className="lg:hidden space-y-3">{cancelledOrders.map(o => renderMobileCard(o, false, false))}</div>
    </>
  );

  const EmptyState = ({ icon: Icon, text }: { icon: typeof ShoppingBag; text: string }) => (
    <div className="py-8 text-center text-muted-foreground"><Icon className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>{text}</p></div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-orange-500" /> ইনকমপ্লিট অর্ডার
        </h1>
        <p className="text-sm text-muted-foreground">মোট {orders.length}টি এন্ট্রি</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="incomplete" className="gap-1.5">
            <ShoppingBag className="w-4 h-4" /> ইনকমপ্লিট
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">{incompleteOrders.length}</span>
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-1.5">
            <ShieldBan className="w-4 h-4" /> ব্লক ইউজার
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">{blockedOrders.length}</span>
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-1.5">
            <CheckCircle className="w-4 h-4" /> কনফার্ম অর্ডার
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{confirmedFromIncompleteCount}</span>
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5">
            <XCircle className="w-4 h-4" /> ক্যান্সেলড
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">{cancelledOrders.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incomplete">
          {incompleteOrders.length === 0 ? <EmptyState icon={ShoppingBag} text="কোনো ইনকমপ্লিট অর্ডার নেই" /> : renderTable(incompleteOrders, true)}
        </TabsContent>

        <TabsContent value="blocked">
          {blockedOrders.length === 0 ? <EmptyState icon={ShieldBan} text="কোনো ব্লকড ইউজার অর্ডার নেই" /> : renderTable(blockedOrders, true)}
        </TabsContent>

        <TabsContent value="confirmed">
          <div className="py-10 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-600 opacity-80" />
            <p className="text-2xl font-bold text-foreground">{confirmedFromIncompleteCount}</p>
            <p className="text-sm text-muted-foreground mt-1">টি অর্ডার ইনকমপ্লিট থেকে কনফার্ম হয়েছে</p>
          </div>
        </TabsContent>

        <TabsContent value="cancelled">
          {cancelledOrders.length === 0 ? <EmptyState icon={XCircle} text="কোনো ক্যান্সেলড অর্ডার নেই" /> : renderCancelledTable()}
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={!!noteOrderId} onOpenChange={(v) => { if (!v) setNoteOrderId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>নোট — {noteOrderId}</DialogTitle>
          </DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="নোট লিখুন..." rows={4} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setNoteOrderId(null)}>বাতিল</Button>
            <Button onClick={() => {
              if (noteOrderId) {
                updateNote(noteOrderId, noteText.trim());
                toast.success('নোট সেভ হয়েছে');
                setNoteOrderId(null);
              }
            }}>সেভ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncompleteOrders;
