import { useState, useEffect, useMemo } from 'react';
import { useLandingPageStore, type LandingPage } from '@/stores/useLandingPageStore';
import { useProductStore } from '@/stores/useProductStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ExternalLink, Search, ChevronDown, ChevronUp, Eye, Link2, Check, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿]+/g, '-')
    .replace(/^-|-$/g, '') || `lp-${Date.now()}`;

const PLACEHOLDERS = [
  { token: '{{product_name}}', desc: 'প্রডাক্টের নাম' },
  { token: '{{price}}', desc: 'বিক্রয় মূল্য' },
  { token: '{{regular_price}}', desc: 'নিয়মিত মূল্য (স্ট্রাইকথ্রু)' },
  { token: '{{discount}}', desc: 'ছাড়ের পরিমাণ' },
  { token: '{{short_description}}', desc: 'সংক্ষিপ্ত বিবরণ (HTML)' },
  { token: '{{image}}', desc: 'প্রধান ছবির URL' },
  { token: '{{gallery}}', desc: 'সব ছবির HTML' },
  { token: '{{stock}}', desc: 'স্টক পরিমাণ' },
  { token: '{{category}}', desc: 'ক্যাটাগরি' },
  { token: '{{sku}}', desc: 'SKU' },
  { token: '{{brand}}', desc: 'ব্র্যান্ড' },
  { token: '{{checkout}}', desc: 'চেকআউট সেকশন (এখানে ইনজেক্ট হবে)' },
];

const LandingPages = () => {
  const { pages, fetchPages, addPage, updatePage, deletePage, loading } = useLandingPageStore();
  const products = useProductStore((s) => s.products);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [productSearch, setProductSearch] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customOriginalPrice, setCustomOriginalPrice] = useState('');
  const [customHtml, setCustomHtml] = useState('');
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<LandingPage | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { fetchPages(); }, []);

  const filteredProducts = useMemo(() => {
    const published = products.filter((p) => p.status === 'published');
    if (!productSearch.trim()) return published;
    const q = productSearch.toLowerCase();
    return published.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, productSearch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [pages, search]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setProductId('');
    setSlug('');
    setStatus('published');
    setProductSearch('');
    setCustomPrice('');
    setCustomOriginalPrice('');
    setCustomHtml('');
    setShowPlaceholders(false);
    setShowEditor(true);
  };

  const openEdit = (page: LandingPage) => {
    setEditing(page);
    setTitle(page.title);
    setProductId(page.productId);
    setSlug(page.slug);
    setStatus(page.status);
    setProductSearch('');
    setCustomPrice(page.customPrice ? String(page.customPrice) : '');
    setCustomOriginalPrice(page.customOriginalPrice ? String(page.customOriginalPrice) : '');
    setCustomHtml(page.customHtml ?? '');
    setShowPlaceholders(false);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !productId) {
      toast({ title: 'হেডিং এবং প্রডাক্ট সিলেক্ট করুন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const finalSlug = slug.trim() || generateSlug(title);
    const priceData = {
      customPrice: customPrice ? Number(customPrice) : null,
      customOriginalPrice: customOriginalPrice ? Number(customOriginalPrice) : null,
    };
    const htmlData = { customHtml: customHtml.trim() || null };
    try {
      if (editing) {
        await updatePage(editing.id, { title, productId, slug: finalSlug, status, ...priceData, ...htmlData });
        toast({ title: 'ল্যান্ডিং পেজ আপডেট হয়েছে' });
      } else {
        await addPage({ id: crypto.randomUUID(), title, productId, slug: finalSlug, status, ...priceData, ...htmlData });
        toast({ title: 'ল্যান্ডিং পেজ তৈরি হয়েছে' });
      }
      setShowEditor(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPreview = async () => {
    if (!title.trim() || !productId) {
      toast({ title: 'হেডিং এবং প্রডাক্ট সিলেক্ট করুন', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const finalSlug = slug.trim() || generateSlug(title);
    const priceData = {
      customPrice: customPrice ? Number(customPrice) : null,
      customOriginalPrice: customOriginalPrice ? Number(customOriginalPrice) : null,
    };
    const htmlData = { customHtml: customHtml.trim() || null };
    try {
      if (editing) {
        await updatePage(editing.id, { title, productId, slug: finalSlug, status, ...priceData, ...htmlData });
      } else {
        await addPage({ id: crypto.randomUUID(), title, productId, slug: finalSlug, status, ...priceData, ...htmlData });
        setSlug(finalSlug);
      }
      window.open(`/lp/${finalSlug}`, '_blank');
    } finally {
      setSaving(false);
    }
  };

  const insertPlaceholder = (token: string) => {
    setCustomHtml((prev) => prev + token);
  };

  const openDelete = (page: LandingPage) => { setDeleteConfirm(page); setDeleteStep(1); };
  const handleDeleteStep = async () => {
    if (deleteStep === 1) { setDeleteStep(2); return; }
    if (deleteStep === 2 && deleteConfirm) {
      await deletePage(deleteConfirm.id);
      toast({ title: 'ডিলিট হয়েছে' });
      setDeleteConfirm(null); setDeleteStep(0);
    }
  };

  const handleCopy = (slug: string, id: string) => {
    const link = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      toast({ title: 'লিংক কপি হয়েছে!' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">ল্যান্ডিং পেজ</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="সার্চ করুন..."
              className="pl-8"
            />
          </div>
          <Button onClick={openNew} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> নতুন পেজ
          </Button>
        </div>
      </div>

      {loading && pages.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            কোনো ল্যান্ডিং পেজ নেই। নতুন তৈরি করুন।
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((page) => {
            const product = products.find((p) => p.id === page.productId);
            const link = `${window.location.origin}/lp/${page.slug}`;
            const img = product?.featuredImage || product?.images?.[0] || '/placeholder.svg';
            return (
              <Card key={page.id} className="overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3">
                    <img src={img} alt={page.title} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-md shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{page.title}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {page.customHtml && (
                            <Badge variant="outline" className="text-[10px] px-1.5 text-blue-600 border-blue-300">HTML</Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${page.status === 'published' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                          >
                            {page.status === 'published' ? 'পাবলিশড' : 'ড্রাফট'}
                          </Badge>
                        </div>
                      </div>
                      {product && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ৳{page.customPrice ?? product.price}
                          {product.title && <span className="ml-1 opacity-70">— {product.title}</span>}
                        </p>
                      )}
                      <div className="mt-2 bg-muted/50 rounded px-2 py-1.5 text-[11px] sm:text-xs break-all font-mono text-muted-foreground">
                        {link}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCopy(page.slug, page.id)}
                          className="h-8 text-xs"
                        >
                          {copiedId === page.id
                            ? <><Check className="h-3.5 w-3.5 mr-1" />কপি হয়েছে</>
                            : <><Link2 className="h-3.5 w-3.5 mr-1" />লিংক কপি</>}
                        </Button>
                        <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />ভিউ
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(page)} className="h-8 text-xs">
                          <Pencil className="h-3.5 w-3.5 mr-1" />এডিট
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDelete(page)}
                          className="h-8 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />ডিলিট
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'পেজ এডিট করুন' : 'নতুন ল্যান্ডিং পেজ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-1.5 block">হেডিং টেক্সট *</Label>
              <Input value={title} onChange={(e) => { setTitle(e.target.value); if (!editing) setSlug(generateSlug(e.target.value)); }} placeholder="যেমন: সুপার অফার! মাত্র ৳৯৯৯ তে..." />
            </div>

            <div>
              <Label className="mb-1.5 block">প্রডাক্ট সিলেক্ট করুন *</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="প্রডাক্ট সার্চ করুন..." className="pl-10" />
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-[5px] divide-y">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">কোনো প্রডাক্ট পাওয়া যায়নি</p>
                )}
                {filteredProducts.map((p) => (
                  <button key={p.id} type="button" onClick={() => setProductId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-muted/50 transition-colors ${productId === p.id ? 'bg-primary/10 font-semibold' : ''}`}>
                    {p.featuredImage && <img src={p.featuredImage} alt="" className="w-7 h-7 object-cover rounded" />}
                    <span className="truncate flex-1">{p.title}</span>
                    {productId === p.id && <span className="text-primary text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
              {productId && <p className="text-xs text-primary mt-1">সিলেক্টেড: {products.find((p) => p.id === productId)?.title || 'N/A'}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">কাস্টম মূল্য (ঐচ্ছিক)</Label>
                <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="৳" type="number" />
              </div>
              <div>
                <Label className="mb-1.5 block">কাস্টম রেগুলার মূল্য</Label>
                <Input value={customOriginalPrice} onChange={(e) => setCustomOriginalPrice(e.target.value)} placeholder="৳" type="number" />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">স্লাগ (URL)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated" />
              <p className="text-xs text-muted-foreground mt-1">URL: /lp/{slug || '...'}</p>
            </div>

            <div>
              <Label className="mb-1.5 block">স্ট্যাটাস</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">পাবলিশড</SelectItem>
                  <SelectItem value="draft">ড্রাফট</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>কাস্টম Landing HTML (ঐচ্ছিক)</Label>
                <button
                  type="button"
                  onClick={() => setShowPlaceholders((v) => !v)}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  {showPlaceholders ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  প্লেসহোল্ডার গাইড
                </button>
              </div>

              {showPlaceholders && (
                <div className="mb-2 border rounded-[5px] bg-muted/30 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">HTML-এ এই প্লেসহোল্ডারগুলো ব্যবহার করুন — লাইভ তথ্য দিয়ে রিপ্লেস হবে:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {PLACEHOLDERS.map(({ token, desc }) => (
                      <button key={token} type="button" onClick={() => insertPlaceholder(token)}
                        className="flex items-start gap-2 text-left px-2 py-1.5 rounded hover:bg-muted transition-colors group">
                        <code className="text-[11px] bg-background border px-1.5 py-0.5 rounded font-mono text-blue-600 group-hover:bg-primary/10 shrink-0">{token}</code>
                        <span className="text-xs text-muted-foreground leading-tight">{desc}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    💡 প্লেসহোল্ডারে ক্লিক করলে textarea-তে ইনসার্ট হবে।
                    <br />
                    <strong>{"{{checkout}}"}</strong> — চেকআউট সেকশন ঠিক এই জায়গায় দেখাবে। না দিলে HTML-এর নিচে অটো যোগ হবে।
                  </p>
                </div>
              )}

              <textarea
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                placeholder={`এখানে ChatGPT-generated HTML/CSS পেস্ট করুন।\n\nউদাহরণ:\n<section style="background:#fff3cd;padding:40px 20px;text-align:center;">\n  <h1 style="font-size:2rem;color:#333;">{{product_name}}</h1>\n  <p style="font-size:1.5rem;color:red;">মাত্র ৳{{price}}</p>\n  {{checkout}}\n</section>`}
                rows={16}
                className="w-full font-mono text-xs rounded-[5px] border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                খালি রাখলে → অটো-জেনারেটেড লেআউট দেখাবে (বিদ্যমান পেজের মতো)।
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'সেভ হচ্ছে...' : editing ? 'আপডেট করুন' : 'তৈরি করুন'}
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={handleSaveAndPreview} disabled={saving}>
                <Eye className="h-4 w-4" />
                সেভ ও প্রিভিউ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) { setDeleteConfirm(null); setDeleteStep(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> ল্যান্ডিং পেজ ডিলিট
            </DialogTitle>
          </DialogHeader>
          {deleteStep === 1 && (
            <p className="text-sm">আপনি কি <span className="font-bold">{deleteConfirm?.title}</span> পেজটি ডিলিট করতে চান?</p>
          )}
          {deleteStep === 2 && (
            <p className="text-sm text-destructive font-medium">⚠️ শেষ সতর্কতা! সত্যিই কি "{deleteConfirm?.title}" চিরতরে ডিলিট করতে চান? এটি ফেরানো যাবে না।</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteStep(0); }}>বাতিল</Button>
            <Button variant="destructive" onClick={handleDeleteStep}>
              {deleteStep === 1 ? 'হ্যাঁ, ডিলিট করুন' : 'নিশ্চিত ডিলিট'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPages;
