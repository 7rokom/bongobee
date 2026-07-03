import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare, Send, Phone, Users, Search, Filter, Calendar, X,
  BookmarkPlus, FileText, Trash2, Bookmark, Settings, Cloud, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrderStore } from '@/stores/useOrderStore';

import { useIncompleteOrderStore } from '@/stores/useIncompleteOrderStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { sendBulkSmsApi, TEMPLATE_VARS_HELP } from '@/lib/bulksms';
import type { Order } from '@/components/admin/OrderDetailDialog';

const BATCH_SIZE = 20;
const TEMPLATES_KEY = 'bulk-sms-templates';

type SmsTemplate = {
  id: string;
  title: string;
  message: string;
  createdAt: number;
};

// Status options that can be filtered
const STATUS_OPTIONS = ['ডেলিভারড', 'ক্যান্সেল', 'রিটার্ন', 'পেইড রিটার্ন'] as const;

type SourceKey = 'orders' | 'cancelled-incomplete';

// Try to extract a comparable yyyy-mm-dd date from an order
const getOrderDateKey = (o: Order): string => {
  if (o.isoDate) {
    const d = new Date(o.isoDate);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (o.date) {
    // try direct parse
    const d = new Date(o.date);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    // try DD/MM/YYYY or DD-MM-YYYY
    const m = o.date.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      let yyyy = m[3];
      if (yyyy.length === 2) yyyy = '20' + yyyy;
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return '';
};

const BulkSMS = () => {
  const settings = useSiteSettingsStore();
  const initialTab = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'auto' ? 'auto' : 'send';
  const [activeTab, setActiveTab] = useState<'send' | 'auto'>(initialTab);
  const [phones, setPhones] = useState('');
  const [message, setMessage] = useState('');
  const [sendingApi, setSendingApi] = useState(false);
  const [selectCustomerOpen, setSelectCustomerOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  // Templates
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');

  // Filters inside customer dialog
  const [customerSearch, setCustomerSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [source, setSource] = useState<SourceKey>('orders');

  const orders = useOrderStore((s) => s.orders);
  const incompleteOrders = useIncompleteOrderStore((s) => s.orders);

  // Load templates from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const persistTemplates = (next: SmsTemplate[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const saveTemplate = () => {
    const title = newTemplateTitle.trim();
    if (!title) {
      toast.error('টেমপ্লেটের নাম দিন');
      return;
    }
    if (!message.trim()) {
      toast.error('মেসেজ লিখুন');
      return;
    }
    const t: SmsTemplate = {
      id: Date.now().toString(),
      title,
      message: message.trim(),
      createdAt: Date.now(),
    };
    persistTemplates([t, ...templates]);
    setNewTemplateTitle('');
    setSaveTemplateOpen(false);
    toast.success('টেমপ্লেট সেভ হয়েছে');
  };

  const loadTemplate = (t: SmsTemplate) => {
    setMessage(t.message);
    setTemplatesOpen(false);
    toast.success(`"${t.title}" লোড হয়েছে`);
  };

  const deleteTemplate = (id: string) => {
    persistTemplates(templates.filter((t) => t.id !== id));
    toast.success('টেমপ্লেট ডিলিট হয়েছে');
  };

  // Filter orders by status + date first
  const filteredOrders = useMemo(() => {
    if (source === 'cancelled-incomplete') {
      // Map cancelled incomplete orders to Order-like shape (status filter ignored — all are "ক্যান্সেল")
      const mapped = incompleteOrders
        .filter((o) => o.status === 'cancelled' && o.phone)
        .map((o) => ({
          id: o.id,
          customer: o.name,
          phone: o.phone,
          status: 'ক্যান্সেল (ইনকমপ্লিট)',
          date: o.date,
          isoDate: o.date,
        } as unknown as Order));
      return mapped.filter((o) => {
        if (dateFrom || dateTo) {
          const key = getOrderDateKey(o);
          if (!key) return false;
          if (dateFrom && key < dateFrom) return false;
          if (dateTo && key > dateTo) return false;
        }
        return true;
      });
    }
    return orders.filter((o) => {
      if (!o.phone) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(o.status)) return false;
      if (dateFrom || dateTo) {
        const key = getOrderDateKey(o);
        if (!key) return false;
        if (dateFrom && key < dateFrom) return false;
        if (dateTo && key > dateTo) return false;
      }
      return true;
    });
  }, [orders, incompleteOrders, source, statusFilters, dateFrom, dateTo]);

  // Aggregate unique customers from filtered orders
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, {
      name: string; phone: string; orderCount: number;
      orderIds: string[]; statuses: Set<string>; lastDate: string;
    }>();
    filteredOrders.forEach((o) => {
      const clean = o.phone.replace(/\D/g, '').replace(/^880/, '0');
      if (clean.length < 11 || !clean.startsWith('0')) return;
      const key = getOrderDateKey(o);
      if (map.has(clean)) {
        const c = map.get(clean)!;
        c.orderCount++;
        c.orderIds.push(o.id);
        c.statuses.add(o.status);
        if (key && key > c.lastDate) c.lastDate = key;
      } else {
        map.set(clean, {
          name: o.customer || '',
          phone: clean,
          orderCount: 1,
          orderIds: [o.id],
          statuses: new Set([o.status]),
          lastDate: key,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.orderCount - a.orderCount);
  }, [filteredOrders]);

  // Apply text search (order id / name / phone)
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return uniqueCustomers;
    const q = customerSearch.toLowerCase().trim();
    return uniqueCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.orderIds.some((id) => id.toLowerCase().includes(q))
    );
  }, [uniqueCustomers, customerSearch]);

  // Parse phone numbers from text
  const phoneList = useMemo(() => {
    return phones
      .split(/[,\n\r;]+/)
      .map((p) => p.trim().replace(/\D/g, '').replace(/^880/, '0'))
      .filter((p) => p.length >= 11 && p.startsWith('0'));
  }, [phones]);

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  const handleOpenSmsApp = () => {
    if (phoneList.length === 0) {
      toast.error('কোনো সঠিক ফোন নম্বর নেই');
      return;
    }
    if (!message.trim()) {
      toast.error('মেসেজ লিখুন');
      return;
    }
    if (!isMobile) {
      toast.warning('এই ফিচারটি শুধু মোবাইল ফোনে কাজ করে। মোবাইল থেকে এই পেজটি খুলুন।');
      return;
    }
    const recipients = phoneList.join(',');
    const encodedMessage = encodeURIComponent(message.trim());
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${recipients}${separator}body=${encodedMessage}`;
    toast.success('SMS অ্যাপ খোলা হচ্ছে...');
  };

  const batches = useMemo(() => {
    if (phoneList.length === 0) return [];
    const result: string[][] = [];
    for (let i = 0; i < phoneList.length; i += BATCH_SIZE) {
      result.push(phoneList.slice(i, i + BATCH_SIZE));
    }
    return result;
  }, [phoneList]);

  const openBatch = (batchPhones: string[]) => {
    if (!message.trim()) {
      toast.error('মেসেজ লিখুন');
      return;
    }
    const recipients = batchPhones.join(',');
    const encodedMessage = encodeURIComponent(message.trim());
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${recipients}${separator}body=${encodedMessage}`;
  };

  const handleSendApi = async () => {
    if (phoneList.length === 0) { toast.error('কোনো সঠিক ফোন নম্বর নেই'); return; }
    if (!message.trim()) { toast.error('মেসেজ লিখুন'); return; }
    if (!settings.bulkSmsApiKey) { toast.error('API কী সেট করা নেই — অটো SMS সেটিংস ট্যাবে যান'); return; }
    setSendingApi(true);
    const msgs = phoneList.map((p) => ({ phone: p, message: message.trim() }));
    const res = await sendBulkSmsApi(msgs);
    setSendingApi(false);
    if (res.success) {
      const okCount = res.results?.filter((r) => r.ok).length ?? phoneList.length;
      toast.success(`${okCount}/${phoneList.length}টি SMS পাঠানো হয়েছে`);
    } else {
      toast.error(res.error || 'SMS পাঠানো ব্যর্থ হয়েছে');
    }
  };

  const addSelectedCustomers = () => {
    const existing = phones ? phones + '\n' : '';
    setPhones(existing + selectedCustomers.join('\n'));
    const count = selectedCustomers.length;
    setSelectedCustomers([]);
    setSelectCustomerOpen(false);
    toast.success(`${count}টি নম্বর যোগ হয়েছে`);
  };

  const toggleCustomer = (phone: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  };

  const toggleStatus = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const selectAllFiltered = () => {
    setSelectedCustomers(filteredCustomers.map((c) => c.phone));
  };

  const clearAllFilters = () => {
    setCustomerSearch('');
    setStatusFilters([]);
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilter =
    customerSearch || statusFilters.length > 0 || dateFrom || dateTo;

  const smsSegments = Math.ceil(message.length / 160) || 0;
  const needsBatching = phoneList.length > BATCH_SIZE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          বাল্ক SMS
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'send' | 'auto')}>
        <TabsList>
          <TabsTrigger value="send"><Send className="h-3.5 w-3.5 mr-1" />SMS পাঠান</TabsTrigger>
          <TabsTrigger value="auto"><Zap className="h-3.5 w-3.5 mr-1" />অটো SMS সেটিংস</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6 mt-4">

      {/* Compose SMS */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              প্রাপক নাম্বার
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              placeholder="ফোন নম্বর লিখুন বা পেস্ট করুন (প্রতি লাইনে একটি, বা কমা দিয়ে আলাদা)&#10;&#10;যেমন:&#10;01712345678&#10;01812345678, 01912345678"
              rows={8}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                সঠিক নম্বর: <strong>{phoneList.length}</strong>টি
              </span>
              <div className="flex gap-2">
                {phones && (
                  <Button variant="ghost" size="sm" onClick={() => setPhones('')}>
                    <X className="h-3.5 w-3.5 mr-1" /> ক্লিয়ার
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectCustomerOpen(true)}>
                  <Users className="h-3.5 w-3.5 mr-1" />
                  কাস্টমার থেকে সিলেক্ট
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                মেসেজ
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplatesOpen(true)}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  টেমপ্লেট ({templates.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveTemplateOpen(true)}
                  disabled={!message.trim()}
                >
                  <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                  সেভ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="এখানে আপনার মেসেজ লিখুন..."
              rows={8}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{message.length} অক্ষর</span>
              <span>{smsSegments} SMS সেগমেন্ট</span>
            </div>

            <div className="pt-2 border-t space-y-2">
              <Button
                onClick={handleSendApi}
                disabled={phoneList.length === 0 || !message.trim() || sendingApi}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Cloud className="h-4 w-4 mr-2" />
                {sendingApi ? 'পাঠানো হচ্ছে...' : `API দিয়ে পাঠান (${phoneList.length}টি)`}
              </Button>
              <Button
                onClick={handleOpenSmsApp}
                disabled={phoneList.length === 0 || !message.trim()}
                className="w-full"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" />
                SMS অ্যাপে খুলুন ({phoneList.length}টি নম্বর)
              </Button>
              {needsBatching && (
                <p className="text-xs text-amber-600 text-center">
                  ⚠️ {phoneList.length}টি নম্বর অনেক বেশি — নিচের batch বাটন ব্যবহার করুন
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch buttons */}
      {needsBatching && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Batch পাঠানো ({batches.length}টি batch, প্রতিটিতে সর্বোচ্চ {BATCH_SIZE}টি)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              অনেক নম্বরে একসাথে পাঠাতে গেলে ফোনের মেসেজ অ্যাপ কাজ নাও করতে পারে। তাই batch করে পাঠান —
              একটা batch পাঠানোর পর ফিরে এসে পরের batch এ ক্লিক করুন।
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {batches.map((batch, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => openBatch(batch)}
                  disabled={!message.trim()}
                >
                  Batch {idx + 1} ({batch.length})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>টিপস:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>সব নম্বরে একই মেসেজ যাবে — কিন্তু আলাদা আলাদা SMS হিসেবে (group SMS নয়)</li>
            <li>SMS পাঠানোর খরচ আপনার সিম প্যাকেজ থেকে কাটবে</li>
            <li>iPhone এ একসাথে অনেক নম্বর দিলে group MMS হিসেবে যেতে পারে</li>
            <li>{BATCH_SIZE}+ নম্বর হলে batch করে পাঠানোর recommendation</li>
          </ul>
        </CardContent>
      </Card>

      {/* Customer Select Dialog */}
      <Dialog open={selectCustomerOpen} onOpenChange={setSelectCustomerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>কাস্টমার সিলেক্ট করুন</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto pr-1">
            {/* Source selector */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Users className="h-3.5 w-3.5" />
                সোর্স
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSource('orders')}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    source === 'orders'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  সব অর্ডার
                </button>
                <button
                  type="button"
                  onClick={() => setSource('cancelled-incomplete')}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    source === 'cancelled-incomplete'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  ক্যান্সেলড ইনকমপ্লিট অর্ডার
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="অর্ডার নম্বর, নাম বা ফোন নম্বর দিয়ে খুঁজুন..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status filter chips */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Filter className="h-3.5 w-3.5" />
                স্ট্যাটাস ফিল্টার
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const active = statusFilters.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date filter */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Calendar className="h-3.5 w-3.5" />
                তারিখ ফিল্টার
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">থেকে</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">পর্যন্ত</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setDateFrom(today); setDateTo(today);
                  }}>আজ</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 7);
                    setDateFrom(d.toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  }}>৭ দিন</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 30);
                    setDateFrom(d.toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  }}>৩০ দিন</Button>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}>
                    <X className="h-3 w-3 mr-1" /> তারিখ ক্লিয়ার
                  </Button>
                )}
              </div>
            </div>

            {hasActiveFilter && (
              <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  ফিল্টার অনুযায়ী <strong>{uniqueCustomers.length}</strong> কাস্টমার পাওয়া গেছে
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAllFilters}>
                  সব ক্লিয়ার
                </Button>
              </div>
            )}

            {/* Result list */}
            <div className="flex items-center justify-between text-sm">
              <span>{selectedCustomers.length}টি সিলেক্টেড</span>
              <Button variant="link" size="sm" onClick={selectAllFiltered}>
                সব সিলেক্ট ({filteredCustomers.length})
              </Button>
            </div>
            <div className="max-h-[35vh] overflow-y-auto border rounded-md">
              {filteredCustomers.map((c) => (
                <label
                  key={c.phone}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                >
                  <Checkbox
                    checked={selectedCustomers.includes(c.phone)}
                    onCheckedChange={() => toggleCustomer(c.phone)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name || 'অজানা'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{c.phone}</span>
                      {c.lastDate && <span>• {c.lastDate}</span>}
                    </div>
                    {c.statuses.size > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.from(c.statuses).slice(0, 3).map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{c.orderCount} অর্ডার</Badge>
                </label>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  কোনো কাস্টমার পাওয়া যায়নি
                  {hasActiveFilter && ' — ফিল্টার পরিবর্তন করে দেখুন'}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setSelectCustomerOpen(false)}>বাতিল</Button>
            <Button onClick={addSelectedCustomers} disabled={selectedCustomers.length === 0}>
              {selectedCustomers.length}টি যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates List Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="h-4 w-4" />
              সেভ করা টেমপ্লেট
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-1">
            {templates.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>এখনো কোনো টেমপ্লেট সেভ করা নেই</p>
                <p className="text-xs mt-1">
                  মেসেজ লিখে "সেভ" বাটনে চাপলে এখানে দেখাবে
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate flex-1">{t.title}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-2">
                      {t.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {t.message.length} অক্ষর
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => loadTemplate(t)}>
                        ব্যবহার করুন
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setTemplatesOpen(false)}>
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-4 w-4" />
              টেমপ্লেট সেভ করুন
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                টেমপ্লেটের নাম
              </label>
              <Input
                placeholder="যেমন: ডেলিভারি কনফার্মেশন"
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTemplate();
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">প্রিভিউ</label>
              <div className="border rounded-md p-3 bg-muted/30 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                {message || (
                  <span className="text-muted-foreground italic">কোনো মেসেজ নেই</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              বাতিল
            </Button>
            <Button onClick={saveTemplate} disabled={!newTemplateTitle.trim() || !message.trim()}>
              সেভ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>

        <TabsContent value="auto" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                bulksmsbd.net API সেটিংস
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">API Key</label>
                  <Input
                    type="password"
                    value={settings.bulkSmsApiKey}
                    placeholder="bulksmsbd.net থেকে পাওয়া key"
                    onChange={(e) => settings.updateSettings({ bulkSmsApiKey: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Sender ID (Approved)</label>
                  <Input
                    value={settings.bulkSmsSenderId}
                    placeholder="যেমন: 8809612XXXXXX"
                    onChange={(e) => settings.updateSettings({ bulkSmsSenderId: e.target.value })}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                {'{courier_link}'} স্বয়ংক্রিয়ভাবে অর্ডারের কুরিয়ার (Steadfast/Carrybee) থেকে ট্র্যাকিং URL নিয়ে আসবে। {'{whatsapp}'} নম্বর শপ সেটিংস থেকে আসবে।
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">টেমপ্লেট ভেরিয়েবল</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                নিচের ভেরিয়েবলগুলো টেমপ্লেটে ব্যবহার করুন — অর্ডারের ডেটা দিয়ে অটোমেটিক রিপ্লেস হবে।
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 text-xs">
                {TEMPLATE_VARS_HELP.map((v) => (
                  <div key={v.key} className="flex items-start gap-2 p-2 bg-muted/40 rounded">
                    <code className="font-mono text-primary shrink-0">{v.key}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>রিসেলার অর্ডারে SMS পাঠানো</span>
                <Switch
                  checked={settings.smsResellerEnabled !== false}
                  onCheckedChange={(checked) => settings.updateSettings({ smsResellerEnabled: checked })}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                বন্ধ থাকলে রিসেলারদের মাধ্যমে আসা অর্ডারের কাস্টমারদের কাছে কোনো অটোমেটিক SMS (কনফার্ম/শিপমেন্ট) যাবে না। মূল সাইটের অর্ডারে SMS যাবে যথারীতি।
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>কনফার্ম অর্ডার SMS</span>
                <Switch
                  checked={settings.smsConfirmedEnabled}
                  onCheckedChange={(checked) => settings.updateSettings({ smsConfirmedEnabled: checked })}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={settings.smsConfirmedTemplate}
                onChange={(e) => settings.updateSettings({ smsConfirmedTemplate: e.target.value })}
                placeholder="অর্ডার কনফার্ম হলে কাস্টমারকে পাঠানো মেসেজ"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {settings.smsConfirmedTemplate.length} অক্ষর • চালু থাকলে অর্ডার "কনফার্মড" করার সাথে সাথে অটোমেটিক SMS যাবে।
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>শিপমেন্ট অর্ডার SMS</span>
                <Switch
                  checked={settings.smsShipmentEnabled}
                  onCheckedChange={(checked) => settings.updateSettings({ smsShipmentEnabled: checked })}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={settings.smsShipmentTemplate}
                onChange={(e) => settings.updateSettings({ smsShipmentTemplate: e.target.value })}
                placeholder="অর্ডার শিপমেন্ট স্ট্যাটাসে গেলে পাঠানো মেসেজ"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {settings.smsShipmentTemplate.length} অক্ষর • চালু থাকলে অর্ডার "শিপমেন্ট" স্ট্যাটাসে গেলে অটোমেটিক SMS যাবে। {'{courier_link}'} ব্যবহার করলে অটো ট্র্যাকিং URL বসবে।
              </p>
            </CardContent>
          </Card>

          <ManualTemplatesCard
            title="ফলোয়াপ অর্ডার SMS (ম্যানুয়াল)"
            description='এই টেমপ্লেটগুলো অর্ডার পেইজ থেকে "SMS পাঠান" বাটনে ক্লিক করলে দেখাবে। অটোমেটিক পাঠানো হবে না।'
            templates={settings.smsFollowupTemplates || []}
            onChange={(list) => settings.updateSettings({ smsFollowupTemplates: list })}
          />

          <ManualTemplatesCard
            title="হোল্ড অর্ডার SMS (ম্যানুয়াল)"
            description='এই টেমপ্লেটগুলো অর্ডার পেইজ থেকে "SMS পাঠান" বাটনে ক্লিক করলে দেখাবে। অটোমেটিক পাঠানো হবে না।'
            templates={settings.smsHoldTemplates || []}
            onChange={(list) => settings.updateSettings({ smsHoldTemplates: list })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function ManualTemplatesCard({ title, description, templates, onChange }: {
  title: string;
  description: string;
  templates: Array<{ name: string; body: string }>;
  onChange: (list: Array<{ name: string; body: string }>) => void;
}) {
  const update = (i: number, patch: Partial<{ name: string; body: string }>) => {
    const next = templates.map((t, idx) => idx === i ? { ...t, ...patch } : t);
    onChange(next);
  };
  const remove = (i: number) => onChange(templates.filter((_, idx) => idx !== i));
  const add = () => onChange([...(templates || []), { name: `টেমপ্লেট ${templates.length + 1}`, body: '' }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(templates || []).map((t, i) => (
          <div key={i} className="border rounded p-2 space-y-2 bg-muted/30">
            <div className="flex gap-2 items-center">
              <Input value={t.name} onChange={(e) => update(i, { name: e.target.value })}
                placeholder="টেমপ্লেট নাম" className="h-8 text-sm" />
              <Button variant="outline" size="sm" className="h-8" onClick={() => remove(i)} title="ডিলিট">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
            <Textarea rows={3} value={t.body} onChange={(e) => update(i, { body: e.target.value })}
              placeholder="মেসেজ লিখুন... শর্ট কোড ব্যবহার করতে পারেন (যেমনঃ {whatsapp})" />
            <p className="text-[10px] text-muted-foreground">{t.body.length} অক্ষর</p>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={add}>
          + নতুন টেমপ্লেট যোগ করুন
        </Button>
      </CardContent>
    </Card>
  );
}

export default BulkSMS;
