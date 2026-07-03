import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, CheckCircle, Truck, Clock, MapPin, Phone, MessageCircle, AlertCircle, Printer, PackageCheck, RotateCcw, XCircle, BoxIcon } from "lucide-react";

import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { api } from "@/lib/api";
import { printOrderInvoice } from "@/lib/invoice-print";

const statusFlow = ['পেন্ডিং', 'কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'ডেলিভারির পথে', 'ডেলিভারড'];

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  'পেন্ডিং': { label: 'পেন্ডিং', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, description: 'আপনার অর্ডারটি গৃহীত হয়েছে এবং প্রক্রিয়াধীন রয়েছে' },
  'কনফার্মড': { label: 'কনফার্মড', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle, description: 'আপনার অর্ডারটি কনফার্ম করা হয়েছে' },
  'প্যাকেজিং': { label: 'প্যাকেজিং', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: BoxIcon, description: 'আপনার পণ্য প্যাকেজিং করা হচ্ছে' },
  'শিপমেন্ট': { label: 'শিপমেন্ট', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Truck, description: 'আপনার পণ্য কুরিয়ারে হস্তান্তর করা হয়েছে' },
  'ডেলিভারির পথে': { label: 'ডেলিভারির পথে', color: 'bg-cyan-100 text-cyan-800 border-cyan-300', icon: MapPin, description: 'আপনার পণ্য ডেলিভারির জন্য বের হয়েছে' },
  'ডেলিভারড': { label: 'ডেলিভারড', color: 'bg-green-100 text-green-800 border-green-300', icon: PackageCheck, description: 'আপনার পণ্য সফলভাবে ডেলিভারি সম্পন্ন হয়েছে' },
  'রিটার্ন': { label: 'রিটার্ন', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: RotateCcw, description: 'আপনার পণ্য রিটার্ন করা হয়েছে' },
  'ক্যান্সেল': { label: 'ক্যান্সেল', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, description: 'আপনার অর্ডারটি বাতিল করা হয়েছে' },
};

const buildTimeline = (status: string) => {
  if (status === 'ক্যান্সেল') {
    return [
      { label: 'পেন্ডিং', done: true },
      { label: 'ক্যান্সেল', done: true },
    ];
  }
  if (status === 'রিটার্ন') {
    return [
      ...statusFlow.map((s) => ({ label: s, done: true })),
      { label: 'রিটার্ন', done: true },
    ];
  }
  const currentIndex = statusFlow.indexOf(status);
  return statusFlow.map((s, i) => ({ label: s, done: i <= currentIndex }));
};

/** Unified shape used for display, normalized from either regular or reseller order. */
type TrackedOrder = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  items: { name: string; qty: number; price: number; image?: string }[];
  deliveryCharge: number;
  total: number;
  status: string;
  date: string;
  source: 'customer' | 'reseller';
  resellerShopName?: string;
  resellerAddress?: string;
  resellerPhone?: string;
  resellerLogoUrl?: string;
};


const OrderTracking = () => {
  const [query, setQuery] = useState("");
  const [searchedOrders, setSearchedOrders] = useState<TrackedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const { siteName, address: shopAddress, phone: shopPhone, whatsappNumber, logoUrl } = useSiteSettingsStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearchedOrders([]);
    setSelectedOrder(null);
    setNotFound(false);

    try {
      const params = new URLSearchParams({ phone: q });
      const data: any = await api.get(`/public/order-tracking?${params}`);
      const found: TrackedOrder[] = (data?.orders ?? []).map((o: any) => ({
        id: o.id,
        customer: o.customer,
        phone: o.phone,
        address: o.address,
        items: (o.items ?? []).map((it: any) => ({
          name: it.name,
          qty: Number(it.qty),
          price: Number(it.price),
          image: it.image ?? undefined,
        })),
        deliveryCharge: Number(o.delivery_charge),
        total: Number(o.total),
        status: o.status,
        date: o.date,
        source: o.source as "customer" | "reseller",
        resellerShopName: o.reseller_shop_name ?? undefined,
        resellerAddress: o.reseller_address ?? undefined,
        resellerPhone: o.reseller_phone ?? undefined,
        resellerLogoUrl: o.reseller_logo_url ?? undefined,
      }));
      if (found.length > 0) {
        setSearchedOrders(found);
        setSelectedOrder(found.length === 1 ? found[0] : null);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }

    setLoading(false);
  };

  const order = selectedOrder;
  const timeline = order ? buildTimeline(order.status) : [];
  const si = order ? statusConfig[order.status] || statusConfig['পেন্ডিং'] : null;
  const completedSteps = timeline.filter((s) => s.done).length;
  const totalSteps = timeline.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const waNumber = (whatsappNumber || shopPhone || '').replace(/^0/, '88');

  const handlePrint = () => {
    if (!order) return;
    const isReseller = order.source === 'reseller';
    printOrderInvoice(order, {
      siteName: isReseller ? (order.resellerShopName || siteName) : siteName,
      address:  isReseller ? (order.resellerAddress  || shopAddress) : shopAddress,
      phone:    isReseller ? (order.resellerPhone    || shopPhone)   : shopPhone,
      logoUrl:  isReseller ? (order.resellerLogoUrl  || logoUrl)     : logoUrl,
    });
  };

  return (
    <div className="py-8 bg-background min-h-screen">
      <div className="container-box max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">অর্ডার ট্র্যাকিং</h1>
          <p className="text-[17px] text-muted-foreground">ফোন নম্বর দিয়ে আপনার অর্ডারের অবস্থা জানুন</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="ফোন নম্বর লিখুন (যেমন: 01712345678)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 text-[17px] rounded-[5px] border-2 border-primary/30 focus:border-primary"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-12 px-6 gap-2 text-[17px] rounded-[5px]">
            <Search className="h-4 w-4" /> {loading ? 'খুঁজছে...' : 'খুঁজুন'}
          </Button>
        </form>

        {/* Not Found */}
        {notFound && (
          <div className="border-2 border-destructive/30 bg-destructive/5 rounded-[5px] p-6 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-[17px] font-semibold text-destructive">অর্ডার পাওয়া যায়নি</p>
            <p className="text-[15px] text-muted-foreground">সঠিক ফোন নম্বর দিয়ে আবার চেষ্টা করুন।</p>
            <div className="flex justify-center gap-3 pt-2">
              {shopPhone && <a href={`tel:${shopPhone}`}><Button size="sm" variant="outline" className="gap-1 rounded-[5px] text-[15px]"><Phone className="h-4 w-4" /> কল করুন</Button></a>}
              {waNumber && <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1 rounded-[5px] text-[15px]"><MessageCircle className="h-4 w-4" /> WhatsApp</Button></a>}
            </div>
          </div>
        )}

        {/* Multiple Results */}
        {searchedOrders.length > 1 && !selectedOrder && (
          <div className="space-y-3">
            <p className="text-[17px] font-semibold">{searchedOrders.length}টি অর্ডার পাওয়া গেছে:</p>
            {searchedOrders.map((o) => {
              const cfg = statusConfig[o.status] || statusConfig['পেন্ডিং'];
              return (
                <button key={`${o.source}-${o.id}`} onClick={() => setSelectedOrder(o)} className="w-full border-2 border-primary/20 rounded-[5px] p-4 flex items-center justify-between hover:border-primary transition-colors text-left">
                  <div>
                    <p className="text-[16px] font-bold text-primary">{o.id} {o.source === 'reseller' && <span className="text-[12px] font-normal text-muted-foreground">(রিসেলার)</span>}</p>
                    <p className="text-[14px] text-muted-foreground">{o.date} — {o.customer}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-[5px] text-[13px] font-semibold border ${cfg.color}`}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Order Detail */}
        {order && si && (
          <div className="space-y-5" ref={invoiceRef}>
            {searchedOrders.length > 1 && (
              <Button variant="outline" size="sm" className="rounded-[5px] text-[15px]" onClick={() => setSelectedOrder(null)}>← সব অর্ডার দেখুন</Button>
            )}

            {/* Status Badge & Progress */}
            <div className="border-2 border-primary/20 rounded-[5px] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] text-muted-foreground">অর্ডার নম্বর {order.source === 'reseller' && <span className="text-[12px]">(রিসেলার অর্ডার)</span>}</p>
                  <p className="text-xl font-bold text-primary">{order.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-[5px] text-[15px] font-semibold border ${si.color}`}>{si.label}</span>
                  <Button variant="outline" size="sm" className="gap-1 rounded-[5px] text-[15px]" onClick={handlePrint}>
                    <Printer className="h-4 w-4" /> ইনভয়েস
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[13px] text-muted-foreground mb-1.5">
                  <span>অগ্রগতি</span>
                  <span>{completedSteps}/{totalSteps} ধাপ সম্পন্ন</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[15px]">
                <div>
                  <p className="text-muted-foreground">গ্রাহকের নাম</p>
                  <p className="font-medium">{order.customer}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">অর্ডারের তারিখ</p>
                  <p className="font-medium">{order.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ফোন নম্বর</p>
                  <p className="font-medium">{order.phone}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-2 border-primary/20 rounded-[5px] p-5">
              <h3 className="text-[17px] font-bold mb-5">ট্র্যাকিং টাইমলাইন</h3>
              <div className="relative">
                {timeline.map((step, i) => {
                  const cfg = statusConfig[step.label] || statusConfig['পেন্ডিং'];
                  const StepIcon = cfg.icon;
                  return (
                    <div key={i} className="flex gap-4 pb-6 last:pb-0 relative">
                      {i < timeline.length - 1 && (
                        <div className={`absolute left-[19px] top-10 w-[2px] h-[calc(100%-24px)] ${step.done && timeline[i + 1]?.done ? "bg-primary" : "bg-muted"}`} />
                      )}
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center z-10 transition-all ${
                        step.done ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                      }`}>
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-[16px] font-semibold ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{cfg.label}</p>
                        <p className={`text-[14px] mt-0.5 ${step.done ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{cfg.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Items & Shipping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="border-2 border-primary/20 rounded-[5px] p-5">
                <h3 className="text-[17px] font-bold mb-3">পণ্যসমূহ</h3>
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        {item.image && <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover" />}
                        <div>
                          <p className="text-[15px] font-medium">{item.name}</p>
                          <p className="text-[13px] text-muted-foreground">পরিমাণ: {item.qty}</p>
                        </div>
                      </div>
                      <p className="text-[15px] font-bold text-primary">৳{item.price}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-3 mt-3 border-t border-border space-y-1 text-[15px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>৳{order.items.reduce((s, i) => s + i.price * i.qty, 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span>৳{order.deliveryCharge}</span></div>
                </div>
                <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-primary/20">
                  <p className="text-[16px] font-bold">সর্বমোট</p>
                  <p className="text-[18px] font-bold text-primary">৳{order.total}</p>
                </div>
              </div>

              <div className="border-2 border-primary/20 rounded-[5px] p-5 space-y-4">
                <h3 className="text-[17px] font-bold">ডেলিভারি ঠিকানা</h3>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[15px] text-foreground">{order.address}</p>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-[15px] font-semibold mb-2">সাহায্য দরকার?</p>
                  <div className="flex gap-2">
                    {shopPhone && (
                      <a href={`tel:${shopPhone}`} className="flex-1">
                        <Button className="w-full gap-2 rounded-[5px] text-[15px]" size="sm"><Phone className="h-4 w-4" /> কল করুন</Button>
                      </a>
                    )}
                    {waNumber && (
                      <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button className="w-full gap-2 rounded-[5px] text-[15px]" variant="outline" size="sm"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Default state */}
        {searchedOrders.length === 0 && !notFound && (
          <div className="text-center text-muted-foreground space-y-2 py-8">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-[17px]">উপরে আপনার ফোন নম্বর লিখে সার্চ করুন</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
