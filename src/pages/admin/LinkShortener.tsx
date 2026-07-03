import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Link2, Copy, Check, Search, ExternalLink, BarChart3, ShieldAlert, Pencil, Trash2, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useProductStore } from '@/stores/useProductStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

interface ShortLink {
  id: string;
  slug: string;
  target_url: string;
  product_id: string | null;
  title: string | null;
  click_count: number;
  created_at: string;
}

// Reserved slugs that conflict with app routes — even though we use /s/ prefix,
// keep this list small and informational.
const RESERVED_SLUGS = new Set<string>(['admin', 'login', 'cart', 'checkout', 'product', 's']);

const slugify = (raw: string) => {
  return raw
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF\s-]/g, '') // keep latin, bengali, space, hyphen
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
};

const randomSlug = (len = 6) => {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const LinkShortener = () => {
  const { products } = useProductStore();
  const settings = useSiteSettingsStore();
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  // Form
  const [mode, setMode] = useState<'product' | 'url'>('product');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // List filter
  const [listSearch, setListSearch] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Edit / delete
  const [editLink, setEditLink] = useState<ShortLink | null>(null);
  const [editForm, setEditForm] = useState({ slug: '', target_url: '', title: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteLink, setDeleteLink] = useState<ShortLink | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/mk/short-links');
      setLinks((Array.isArray(data) ? data : []) as ShortLink[]);
      setTableMissing(false);
    } catch {
      setLinks([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products.slice(0, 8);
    return products
      .filter(p => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      .slice(0, 12);
  }, [products, productSearch]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const filteredLinks = useMemo(() => {
    const q = listSearch.toLowerCase().trim();
    if (!q) return links;
    return links.filter(l =>
      l.slug.toLowerCase().includes(q) ||
      (l.title || '').toLowerCase().includes(q) ||
      l.target_url.toLowerCase().includes(q)
    );
  }, [links, listSearch]);

  const totalClicks = useMemo(() => links.reduce((s, l) => s + (l.click_count || 0), 0), [links]);

  const buildTargetUrl = (): { url: string; title: string; productId: string | null } | null => {
    if (mode === 'product') {
      if (!selectedProduct) {
        toast({ title: 'একটি প্রোডাক্ট সিলেক্ট করুন', variant: 'destructive' });
        return null;
      }
      return {
        url: `${origin}/product/${selectedProduct.slug}`,
        title: selectedProduct.title,
        productId: selectedProduct.id,
      };
    }
    const u = customUrl.trim();
    if (!u) {
      toast({ title: 'একটি URL দিন', variant: 'destructive' });
      return null;
    }
    try {
      // Allow relative paths starting with /
      if (u.startsWith('/')) {
        return { url: `${origin}${u}`, title: u, productId: null };
      }
      const parsed = new URL(u);
      return { url: parsed.toString(), title: u, productId: null };
    } catch {
      toast({ title: 'সঠিক URL দিন (https://... দিয়ে শুরু)', variant: 'destructive' });
      return null;
    }
  };

  const resolveSlug = async (preferred: string, fallbackSeed: string): Promise<string | null> => {
    const cleaned = slugify(preferred);
    if (cleaned) {
      if (RESERVED_SLUGS.has(cleaned)) {
        toast({ title: 'এই স্লাগটি সংরক্ষিত — অন্য নাম দিন', variant: 'destructive' });
        return null;
      }
      // Check uniqueness
      const res = await api.get(`/admin/mk/short-links/check?slug=${encodeURIComponent(cleaned)}`).catch(() => ({ exists: false }));
      if (res?.exists) {
        toast({ title: 'এই স্লাগটি আগে থেকেই আছে — অন্য একটি দিন', variant: 'destructive' });
        return null;
      }
      return cleaned;
    }
    // Auto generate from seed + random suffix; retry if collision
    const base = slugify(fallbackSeed) || 'link';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base.slice(0, 24)}-${randomSlug(5)}`.replace(/^-/, '');
      const res = await api.get(`/admin/mk/short-links/check?slug=${encodeURIComponent(candidate)}`).catch(() => ({ exists: false }));
      if (!res?.exists) return candidate;
    }
    // Last-resort pure random
    return `lnk-${randomSlug(8)}`;
  };

  const handleCreate = async () => {
    const target = buildTargetUrl();
    if (!target) return;
    setSubmitting(true);
    try {
      const slug = await resolveSlug(customSlug, target.title);
      if (!slug) { setSubmitting(false); return; }

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const payload: any = {
        slug,
        target_url: target.url,
        title: target.title,
      };
      if (target.productId && UUID_RE.test(target.productId)) {
        payload.product_id = target.productId;
      }
      let error: any = null;
      try { await api.post('/admin/mk/short-links', payload); } catch (e) { error = e; }
      if (error) {
        const msg = String(error.message || '');
        if (msg.toLowerCase().includes('duplicate')) {
          toast({ title: 'এই স্লাগটি আগে থেকেই আছে', variant: 'destructive' });
        } else if (msg.toLowerCase().includes('short_links')) {
          setTableMissing(true);
          toast({ title: 'short_links টেবিল তৈরি করতে হবে', variant: 'destructive' });
        } else {
          toast({ title: 'সেভ হয়নি: ' + msg, variant: 'destructive' });
        }
        return;
      }
      toast({ title: 'শর্ট লিংক তৈরি হয়েছে!' });
      setCustomSlug('');
      setCustomUrl('');
      setSelectedProductId(null);
      setProductSearch('');
      await fetchLinks();
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${origin}/s/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlug(slug);
      toast({ title: 'লিংক কপি হয়েছে!' });
      setTimeout(() => setCopiedSlug(null), 1800);
    });
  };

  const openEdit = (l: ShortLink) => {
    setEditLink(l);
    setEditForm({ slug: l.slug, target_url: l.target_url, title: l.title || '' });
  };

  const saveEdit = async () => {
    if (!editLink) return;
    const newSlug = slugify(editForm.slug);
    const newTarget = editForm.target_url.trim();
    if (!newSlug) { toast({ title: 'স্লাগ দিন', variant: 'destructive' }); return; }
    if (!newTarget) { toast({ title: 'টার্গেট URL দিন', variant: 'destructive' }); return; }
    if (RESERVED_SLUGS.has(newSlug)) { toast({ title: 'এই স্লাগটি সংরক্ষিত', variant: 'destructive' }); return; }
    if (!newTarget.startsWith('/')) {
      try { new URL(newTarget); } catch { toast({ title: 'সঠিক URL দিন', variant: 'destructive' }); return; }
    }
    setEditSaving(true);
    try {
      if (newSlug !== editLink.slug) {
        const res = await api.get(`/admin/mk/short-links/check?slug=${encodeURIComponent(newSlug)}`).catch(() => ({ exists: false }));
        if (res?.exists) { toast({ title: 'এই স্লাগটি অন্য লিংকে আছে', variant: 'destructive' }); setEditSaving(false); return; }
      }
      let error: any = null;
      try { await api.put(`/admin/mk/short-links/${editLink.id}`, { slug: newSlug, target_url: newTarget, title: editForm.title || null }); } catch (e) { error = e; }
      if (error) { toast({ title: 'আপডেট হয়নি: ' + error.message, variant: 'destructive' }); return; }
      toast({ title: 'লিংক আপডেট হয়েছে' });
      setEditLink(null);
      await fetchLinks();
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteLink) return;
    let error: any = null;
    try { await api.del(`/admin/mk/short-links/${deleteLink.id}`); } catch (e) { error = e; }
    if (error) { toast({ title: 'ডিলিট হয়নি: ' + (error.message || ''), variant: 'destructive' }); return; }
    toast({ title: 'লিংক ডিলিট হয়েছে' });
    setDeleteLink(null);
    await fetchLinks();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" />
          লিংক শর্টনার
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="outline" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            মোট লিংক: {links.length}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ExternalLink className="h-3.5 w-3.5" />
            মোট ক্লিক: {totalClicks}
          </Badge>
        </div>
      </div>

      {tableMissing && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-destructive">ডাটাবেজে <code>short_links</code> টেবিল পাওয়া যায়নি</p>
              <p className="text-muted-foreground">
                লিংক শর্টনার চালু করতে Lovable Cloud এ মাইগ্রেশন রান করতে হবে। আপনার এডমিন/ডেভেলপারকে নিচের SQL দিয়ে দিন বা পরবর্তী মেসেজে আমাকে বলুন "মাইগ্রেশন চালু করো"।
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন শর্ট লিংক</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'product' | 'url')}>
            <TabsList>
              <TabsTrigger value="product">প্রোডাক্ট সিলেক্ট</TabsTrigger>
              <TabsTrigger value="url">কাস্টম URL</TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="space-y-3 mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="প্রোডাক্টের নাম খুঁজুন..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto pr-1">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                    কোনো প্রোডাক্ট পাওয়া যায়নি
                  </p>
                )}
                {filteredProducts.map((p) => {
                  const active = selectedProductId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProductId(p.id)}
                      className={`flex items-center gap-3 text-left p-2 rounded-md border transition-colors ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <img
                        src={p.featuredImage || p.images?.[0] || '/placeholder.svg'}
                        alt={p.title}
                        className="w-10 h-10 rounded object-cover bg-muted shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">/product/{p.slug}</p>
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {selectedProduct && (
                <p className="text-xs text-muted-foreground">
                  টার্গেট: <span className="font-mono">{origin}/product/{selectedProduct.slug}</span>
                </p>
              )}
            </TabsContent>

            <TabsContent value="url" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label>লং URL (নিজের সাইট বা বাইরের যেকোনো)</Label>
                <Input
                  placeholder="https://example.com/some/long/path?utm=..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  নিজের সাইটের জন্য <code>/product/abc</code> এর মত relative path ও দেওয়া যাবে।
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <Label>কাস্টম স্লাগ (অপশনাল)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
                {origin}/s/
              </span>
              <Input
                placeholder="getoffer (খালি রাখলে অটো তৈরি হবে)"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              একটি স্লাগ একবারই ব্যবহার হবে। তৈরির পর এডিট ও ডিলিট করা যাবে।
            </p>
          </div>

          <Button onClick={handleCreate} disabled={submitting} className="w-full sm:w-auto">
            <Link2 className="h-4 w-4 mr-2" />
            {submitting ? 'তৈরি হচ্ছে...' : 'শর্ট লিংক তৈরি করুন'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex flex-wrap gap-3">
          <CardTitle className="text-base">সমস্ত শর্ট লিংক</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="স্লাগ, টাইটেল বা URL দিয়ে খুঁজুন"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>
          ) : filteredLinks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {listSearch ? 'কোনো লিংক পাওয়া যায়নি' : 'এখনো কোনো শর্ট লিংক তৈরি হয়নি'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredLinks.map((l) => {
                const shortUrl = `${origin}/s/${l.slug}`;
                return (
                  <div
                    key={l.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 border rounded-md hover:bg-accent/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium line-clamp-1">
                        {l.title || l.target_url}
                      </p>
                      <a
                        href={shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline font-mono break-all"
                      >
                        {shortUrl}
                      </a>
                      <p className="text-xs text-muted-foreground line-clamp-1 break-all">
                        → {l.target_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {l.click_count} ক্লিক
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(l.slug)}
                      >
                        {copiedSlug === l.slug ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={shortUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(l)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteLink(l)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gateway settings (applies to custom-URL short links) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            গেটওয়ে সেটিংস (কাস্টম URL এর জন্য)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
            <div>
              <p className="font-medium text-sm">গেটওয়ে চালু</p>
              <p className="text-xs text-muted-foreground">
                অন থাকলে কাস্টম URL শর্ট লিংকে ক্লিকের পর ৪ ধাপের গেটওয়ে ফ্লো শো হবে। প্রোডাক্ট লিংক সব সময় সরাসরি যাবে।
              </p>
            </div>
            <Switch
              checked={settings.linkGatewayEnabled}
              onCheckedChange={(v) => settings.updateSettings({ linkGatewayEnabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>গেটওয়ে ব্লগ পোস্টের স্লাগ (অপশনাল)</Label>
              <Input
                placeholder="খালি রাখলে সব পোস্ট থেকে র‍্যান্ডম — অথবা কমা দিয়ে একাধিক স্লাগ"
                value={settings.linkGatewayPostSlug}
                onChange={(e) => settings.updateSettings({ linkGatewayPostSlug: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">প্রতিবার গেটওয়েতে র‍্যান্ডম একটি পোস্ট দেখানো হবে, যাতে সব পোস্টে ভিজিট পড়ে। নির্দিষ্ট কয়েকটি পোস্টে সীমাবদ্ধ রাখতে কমা দিয়ে স্লাগ দিন।</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">টাইমার ১ (সেকেন্ড)</Label>
                <Input type="number" min={0} value={settings.linkGatewayTimer1}
                  onChange={(e) => settings.updateSettings({ linkGatewayTimer1: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">টাইমার ২</Label>
                <Input type="number" min={0} value={settings.linkGatewayTimer2}
                  onChange={(e) => settings.updateSettings({ linkGatewayTimer2: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">টাইমার ৩</Label>
                <Input type="number" min={0} value={settings.linkGatewayTimer3}
                  onChange={(e) => settings.updateSettings({ linkGatewayTimer3: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>বাটন ১ টেক্সট (ব্লগ পেজ → পোস্ট)</Label>
              <Input value={settings.linkGatewayBtn1Text}
                onChange={(e) => settings.updateSettings({ linkGatewayBtn1Text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>বাটন ২ টেক্সট (পোস্টের শুরু → শেষ)</Label>
              <Input value={settings.linkGatewayBtn2Text}
                onChange={(e) => settings.updateSettings({ linkGatewayBtn2Text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>বাটন ৩ টেক্সট (পোস্টের শেষ → পপআপ)</Label>
              <Input value={settings.linkGatewayBtn3Text}
                onChange={(e) => settings.updateSettings({ linkGatewayBtn3Text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>ফাইনাল বাটন টেক্সট (পপআপ → মূল লিংক)</Label>
              <Input value={settings.linkGatewayBtnFinalText}
                onChange={(e) => settings.updateSettings({ linkGatewayBtnFinalText: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>পপআপ টাইটেল</Label>
              <Input value={settings.linkGatewayPopupTitle}
                onChange={(e) => settings.updateSettings({ linkGatewayPopupTitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>পপআপ টেক্সট</Label>
              <Input value={settings.linkGatewayPopupText}
                onChange={(e) => settings.updateSettings({ linkGatewayPopupText: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>অ্যাডসেন্স কোড — টাইমারের উপরে</Label>
            <Textarea rows={4} placeholder='<ins class="adsbygoogle" ...></ins><script>...</script>'
              value={settings.linkGatewayAdTop}
              onChange={(e) => settings.updateSettings({ linkGatewayAdTop: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>অ্যাডসেন্স কোড — টাইমারের নিচে</Label>
            <Textarea rows={4} placeholder='<ins class="adsbygoogle" ...></ins><script>...</script>'
              value={settings.linkGatewayAdBottom}
              onChange={(e) => settings.updateSettings({ linkGatewayAdBottom: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              প্রতিটি টাইমারের উপরে ও নিচে এই অ্যাড কোড অটোমেটিক শো করবে।
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-shorten embed snippet — for putting on third-party sites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            অটো লিংক শর্টনার স্ক্রিপ্ট (অন্য সাইটে বসানোর জন্য)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            নিচের কোডটি অন্য কারো সাইটের <code>&lt;head&gt;</code> ট্যাগের ভেতরে বা <code>&lt;/body&gt;</code> এর ঠিক আগে বসিয়ে দিন। তারপর সেই সাইটের সকল বাইরের (external) লিংক অটোমেটিক আপনার গেটওয়ে দিয়ে যাবে — ভিজিটর ক্লিক করলে প্রথমে আপনার সাইটে গেটওয়ে দেখবে, তারপর মূল লিংকে পৌঁছাবে।
          </p>
          <Textarea
            rows={2}
            readOnly
            className="font-mono text-xs"
            value={`<script src="${origin}/embed/bongobee-shorten.js" defer></script>`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const code = `<script src="${origin}/embed/bongobee-shorten.js" defer></script>`;
              navigator.clipboard.writeText(code).then(() => toast({ title: 'কোড কপি হয়েছে!' }));
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-2" />
            কোড কপি করুন
          </Button>
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p className="font-medium">দ্রষ্টব্য:</p>
            <p>• আপনার নিজের সাইটের লিংক (একই হোস্ট) স্কিপ হবে — শুধু external লিংক রি-রাইট হবে।</p>
            <p>• কোনো নির্দিষ্ট লিংক বাদ দিতে চাইলে সেই <code>&lt;a&gt;</code> ট্যাগে <code>data-no-shorten</code> অ্যাট্রিবিউট দিন।</p>
            <p>• গেটওয়ে সেটিংস (টাইমার, অ্যাড, পপআপ) উপরের সেটিংস থেকেই নিয়ন্ত্রিত হবে।</p>
          </div>
        </CardContent>
      </Card>


      {/* Edit dialog */}
      <Dialog open={!!editLink} onOpenChange={(o) => !o && setEditLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>শর্ট লিংক এডিট</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>স্লাগ</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono">{origin}/s/</span>
                <Input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>টার্গেট URL</Label>
              <Input value={editForm.target_url} onChange={(e) => setEditForm({ ...editForm, target_url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>টাইটেল (অপশনাল)</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLink(null)}>বাতিল</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteLink} onOpenChange={(o) => !o && setDeleteLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>শর্ট লিংক ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{deleteLink ? `/s/${deleteLink.slug}` : ''}</span> এই লিংকটি ডিলিট হলে আর কাজ করবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LinkShortener;
