import { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Product, VariationPrice, ProductReview } from '@/data/store-data';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useProductStore } from '@/stores/useProductStore';
import { useVariationStore } from '@/stores/useVariationStore';
import { useStockStore } from '@/stores/useStockStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, Link, X, Image, Video, Save, Eye, FileText, Star, Plus, Trash2, Store } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { toast } from 'sonner';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = lazy(() => import('react-quill-new'));

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
};

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { products, addProduct, updateProduct, fetchProductById } = useProductStore();
  const { items: variationItems } = useVariationStore();
  const { categories } = useCategoryStore();
  const { stockEntries } = useStockStore();

  const editingProduct = id ? products.find(p => p.id === id) : null;

  const [status, setStatus] = useState<'published' | 'draft'>(editingProduct?.status || 'published');
  const [stockType, setStockType] = useState<'self' | 'vendor'>(editingProduct?.stockType || 'self');
  const [stockProductName, setStockProductName] = useState(editingProduct?.stockProductName || '');
  const [freeDelivery, setFreeDelivery] = useState(editingProduct?.freeDelivery || false);
  const [isAffiliate, setIsAffiliate] = useState(editingProduct?.isAffiliate || false);
  const [affiliateUrl, setAffiliateUrl] = useState(editingProduct?.affiliateUrl || '');
  const [affiliateButtonText, setAffiliateButtonText] = useState(editingProduct?.affiliateButtonText || '');

  const generateSlug = (title: string) => title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0980-\u09FF-]+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const [formData, setFormData] = useState({
    title: editingProduct?.title || '',
    slug: editingProduct?.slug || '',
    price: editingProduct?.price ? String(editingProduct.price) : '',
    originalPrice: editingProduct?.originalPrice ? String(editingProduct.originalPrice) : '',
    buyPrice: editingProduct?.buyPrice ? String(editingProduct.buyPrice) : '',
    resellerPrice: editingProduct?.resellerPrice ? String(editingProduct.resellerPrice) : '',
    shortDescription: editingProduct?.shortDescription || '',
    longDescription: editingProduct?.longDescription || '',
    metaDescription: editingProduct?.metaDescription || '',
    metaKeywords: editingProduct?.metaKeywords || '',
    featuredVideo: editingProduct?.featuredVideo || '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!editingProduct?.slug);
  // True once we have the full row (incl. long_description) from DB.
  // Until then, do NOT include description fields in save payload, otherwise
  // we'd overwrite DB long_description with the empty string from the list cache.
  const [fullRowLoaded, setFullRowLoaded] = useState(
    !id || !!(editingProduct?.longDescription && editingProduct.longDescription.trim() !== '')
  );

  // Fetch full row (with long_description) on edit mount
  useEffect(() => {
    if (!id) return;
    if (fullRowLoaded) return;
    let cancelled = false;
    fetchProductById(id).then((p) => {
      if (cancelled || !p) return;
      setFormData((prev) => ({
        ...prev,
        shortDescription: p.shortDescription || prev.shortDescription,
        longDescription: p.longDescription || prev.longDescription,
      }));
      setFullRowLoaded(true);
    });
    return () => { cancelled = true; };
  }, [id]);

  const stockProductNames = useMemo(() => {
    const names = new Set(stockEntries.map(e => e.productName));
    return Array.from(names) as string[];
  }, [stockEntries]);

  // ওজনযুক্ত গড় কেনা দাম নির্ণয় করুন নির্বাচিত স্টক প্রোডাক্টের জন্য
  const avgBuyPriceForSelected = useMemo(() => {
    if (!stockProductName) return null;
    const entries = stockEntries.filter(e => e.productName === stockProductName && (e.quantity ?? 0) > 0 && (e.buyPrice ?? 0) > 0);
    if (entries.length === 0) return null;
    const totalQty = entries.reduce((s, e) => s + (e.quantity || 0), 0);
    const totalCost = entries.reduce((s, e) => s + (e.quantity || 0) * (e.buyPrice || 0), 0);
    if (totalQty === 0) return null;
    return Math.round(totalCost / totalQty);
  }, [stockEntries, stockProductName]);

  // সেলফ স্টক হলে এভারেজ কেনা দাম অটো বসিয়ে দিন
  useEffect(() => {
    if (stockType === 'self' && avgBuyPriceForSelected != null) {
      setFormData(prev => (prev.buyPrice === String(avgBuyPriceForSelected) ? prev : { ...prev, buyPrice: String(avgBuyPriceForSelected) }));
    }
  }, [stockType, avgBuyPriceForSelected]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    editingProduct?.category ? editingProduct.category.split(', ') : []
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(editingProduct?.colors || []);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(editingProduct?.sizes || []);
  const [selectedWeights, setSelectedWeights] = useState<string[]>(editingProduct?.weights || []);
  const [variationPrices, setVariationPrices] = useState<VariationPrice[]>(editingProduct?.variationPrices || []);
  const [reviews, setReviews] = useState<ProductReview[]>(editingProduct?.reviews || []);
  const [newReview, setNewReview] = useState({ name: '', rating: 5, comment: '', date: '', images: '' });

  const [featuredImage, setFeaturedImage] = useState<string>(editingProduct?.featuredImage || '');
  const [featuredImageMode, setFeaturedImageMode] = useState<'upload' | 'link'>('upload');
  const [featuredImageLink, setFeaturedImageLink] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>(editingProduct?.images ? [...editingProduct.images] : []);
  const [galleryMode, setGalleryMode] = useState<'upload' | 'link'>('upload');
  const [galleryLink, setGalleryLink] = useState('');

  const featuredInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [varSearch, setVarSearch] = useState('');
  const [longDescMode, setLongDescMode] = useState<'visual' | 'code'>('visual');

  const availableColors = variationItems.filter(i => i.type === 'color');
  const availableSizes = variationItems.filter(i => i.type === 'size');
  const availableWeights = variationItems.filter(i => i.type === 'weight');

  const handleFileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(file); });

  const handleFeaturedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFeaturedImage(await handleFileToBase64(file));
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const imgs: string[] = [];
      for (let i = 0; i < files.length; i++) imgs.push(await handleFileToBase64(files[i]));
      setGalleryImages(prev => [...prev, ...imgs]);
    }
  };

  const addFeaturedFromLink = () => { if (featuredImageLink.trim()) { setFeaturedImage(featuredImageLink.trim()); setFeaturedImageLink(''); } };
  const addGalleryFromLink = () => { if (galleryLink.trim()) { setGalleryImages(prev => [...prev, galleryLink.trim()]); setGalleryLink(''); } };
  const removeGalleryImage = (i: number) => setGalleryImages(prev => prev.filter((_, idx) => idx !== i));

  const toggleVariation = (type: 'color' | 'size' | 'weight', name: string) => {
    const setter = type === 'color' ? setSelectedColors : type === 'size' ? setSelectedSizes : setSelectedWeights;
    setter(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const setVarPrice = (type: 'color' | 'size' | 'weight', name: string, price: string) => {
    setVariationPrices(prev => {
      const filtered = prev.filter(v => !(v.variationType === type && v.variationName === name));
      return price ? [...filtered, { variationType: type, variationName: name, price: Number(price) }] : filtered;
    });
  };

  const getVarPrice = (type: 'color' | 'size' | 'weight', name: string) => {
    return variationPrices.find(v => v.variationType === type && v.variationName === name)?.price?.toString() || '';
  };

  const updateField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = (saveStatus: 'published' | 'draft') => {
    if (!formData.title || !formData.price) { toast.error('পণ্যের নাম ও মূল্য আবশ্যক'); return; }
    if (stockType === 'self' && !stockProductName) { toast.error('সেল্ফ স্টকের জন্য স্টক প্রোডাক্ট সিলেক্ট করুন'); return; }
    if (editingProduct && !fullRowLoaded) {
      toast.error('বিস্তারিত বিবরণ লোড হচ্ছে, একটু অপেক্ষা করুন');
      return;
    }

    const productData: Partial<Product> = {
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      price: Number(formData.price),
      originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
      buyPrice: formData.buyPrice ? Number(formData.buyPrice) : undefined,
      resellerPrice: formData.resellerPrice ? Number(formData.resellerPrice) : undefined,
      shortDescription: formData.shortDescription,
      longDescription: formData.longDescription,
      category: selectedCategories.join(', '),
      stockType,
      stockProductName: stockType === 'self' ? stockProductName : undefined,
      status: saveStatus,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      weights: selectedWeights.length > 0 ? selectedWeights : undefined,
      variationPrices: variationPrices.length > 0 ? variationPrices : undefined,
      metaDescription: formData.metaDescription || undefined,
      metaKeywords: formData.metaKeywords || undefined,
      featuredImage: featuredImage || undefined,
      featuredVideo: formData.featuredVideo || undefined,
      images: galleryImages.length > 0 ? galleryImages : (featuredImage ? [featuredImage] : ['/placeholder.svg']),
      reviews: reviews.length > 0 ? reviews : undefined,
      reviewCount: reviews.length,
      freeDelivery,
      isAffiliate,
      affiliateUrl: isAffiliate ? affiliateUrl.trim() : undefined,
      affiliateButtonText: isAffiliate ? (affiliateButtonText.trim() || undefined) : undefined,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, productData);
      toast.success('পণ্য আপডেট করা হয়েছে');
    } else {
      addProduct({ ...productData as Product, id: Date.now().toString(), inStock: true, rating: 0, reviewCount: 0 });
      toast.success(saveStatus === 'draft' ? 'পণ্য ড্রাফট হিসেবে সেভ হয়েছে' : 'পণ্য পাবলিশ করা হয়েছে');
    }
    navigate('/admin/products');
  };

  const renderVariationSection = (
    type: 'color' | 'size' | 'weight',
    label: string,
    available: typeof availableColors,
    selected: string[],
  ) => {
    const filteredVars = available.filter(v => v.name.toLowerCase().includes(varSearch.toLowerCase()));
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">ভেরিয়েশন সেকশন থেকে আগে {label} যোগ করুন</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/20">
              {filteredVars.map(v => (
                <label key={v.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs cursor-pointer border transition-colors ${selected.includes(v.name) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'}`}>
                  <Checkbox checked={selected.includes(v.name)} onCheckedChange={() => toggleVariation(type, v.name)} className="hidden" />
                  {v.name}
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-xs font-medium text-muted-foreground">আলাদা দাম (ঐচ্ছিক):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selected.map(name => (
                    <div key={name} className="flex items-center gap-1">
                      <span className="text-xs min-w-[50px]">{name}:</span>
                      <Input type="number" placeholder="৳" className="h-7 text-xs" value={getVarPrice(type, name)} onChange={(e) => setVarPrice(type, name, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {editingProduct ? 'পণ্য এডিট করুন' : 'নতুন পণ্য যোগ করুন'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editingProduct ? 'পণ্যের তথ্য পরিবর্তন করুন' : 'পণ্যের সকল তথ্য পূরণ করুন'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handleSave('draft')}>
            <FileText className="w-4 h-4" /> ড্রাফট সেভ
          </Button>
          <Button className="gap-2" onClick={() => handleSave('published')}>
            <Eye className="w-4 h-4" /> পাবলিশ করুন
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">মৌলিক তথ্য</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>পণ্যের নাম <span className="text-destructive">*</span></Label>
                <Input placeholder="পণ্যের নাম লিখুন" value={formData.title} onChange={(e) => {
                  updateField('title', e.target.value);
                  if (!slugManuallyEdited) {
                    updateField('slug', generateSlug(e.target.value));
                  }
                }} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">পোস্ট লিংক (স্লাগ) <span className="text-xs text-muted-foreground">অটো-জেনারেটেড</span></Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">/product/</span>
                  <Input placeholder="product-slug" value={formData.slug} onChange={(e) => {
                    setSlugManuallyEdited(true);
                    updateField('slug', e.target.value);
                  }} className="font-mono text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-2"><Label>মূল্য (৳) <span className="text-destructive">*</span></Label><Input type="number" placeholder="0" value={formData.price} onChange={(e) => updateField('price', e.target.value)} /></div>
                <div className="space-y-2"><Label>পূর্বের মূল্য (৳)</Label><Input type="number" placeholder="0" value={formData.originalPrice} onChange={(e) => updateField('originalPrice', e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>কেনা দাম (৳){stockType === 'self' && stockProductName ? <span className="ml-1 text-[10px] text-muted-foreground">(অটো)</span> : null}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.buyPrice}
                    onChange={(e) => updateField('buyPrice', e.target.value)}
                    readOnly={stockType === 'self' && !!stockProductName}
                    className={stockType === 'self' && !!stockProductName ? 'bg-muted cursor-not-allowed' : ''}
                  />
                  {stockType === 'self' && stockProductName && avgBuyPriceForSelected != null && (
                    <p className="text-[10px] text-muted-foreground">স্টকের এভারেজ কেনা দাম থেকে অটো সেট</p>
                  )}
                </div>
                <div className="space-y-2"><Label>রিসেলার দাম (৳)</Label><Input type="number" placeholder="0" value={formData.resellerPrice} onChange={(e) => updateField('resellerPrice', e.target.value)} /></div>
              </div>
              <div className="flex items-center gap-3 mt-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                <Switch checked={freeDelivery} onCheckedChange={setFreeDelivery} />
                <div>
                  <Label className="font-medium">ফ্রি ডেলিভারি</Label>
                  <p className="text-xs text-muted-foreground">এই প্রডাক্টের জন্য কাস্টমারকে ডেলিভারি চার্জ দিতে হবে না</p>
                </div>
              </div>

              {/* Affiliate Product */}
              <div className="space-y-3 mt-3 p-3 bg-amber-500/5 border border-amber-500/30 rounded-md">
                <div className="flex items-center gap-3">
                  <Switch checked={isAffiliate} onCheckedChange={setIsAffiliate} />
                  <div className="flex-1">
                    <Label className="font-medium">এফিলিয়েট প্রডাক্ট (Amazon ইত্যাদি)</Label>
                    <p className="text-xs text-muted-foreground">অর্ডার বাটনে ক্লিক করলে এক্সটার্নাল লিংকে নিয়ে যাবে। এই প্রডাক্ট শুধু "Affiliate Products" ক্যাটাগরিতে দেখাবে এবং রিসেলার ড্যাশবোর্ডে শো করবে না।</p>
                  </div>
                </div>
                {isAffiliate && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">এফিলিয়েট লিংক <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="https://www.amazon.com/dp/XXXXXX?tag=..."
                        value={affiliateUrl}
                        onChange={(e) => setAffiliateUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">অর্ডার বাটনের টেক্সট</Label>
                      <Input
                        placeholder="যেমনঃ Amazon থেকে অর্ডার করুন"
                        value={affiliateButtonText}
                        onChange={(e) => setAffiliateButtonText(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader><CardTitle className="text-base">বিবরণ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>সংক্ষিপ্ত বিবরণ</Label>
                <Suspense fallback={<div className="h-24 bg-muted animate-pulse rounded-md" />}>
                  <ReactQuill theme="snow" value={formData.shortDescription} onChange={(v: string) => updateField('shortDescription', v)} modules={quillModules} placeholder="পণ্যের সংক্ষিপ্ত বিবরণ লিখুন..." className="bg-background rounded-md [&_.ql-editor]:min-h-[100px]" />
                </Suspense>
              </div>
              <div className="space-y-2">
                <Label>বিস্তারিত বিবরণ</Label>
                <div className="flex gap-2 mb-2">
                  <Button type="button" variant={longDescMode === 'visual' ? 'default' : 'outline'} size="sm" className="text-xs gap-1" onClick={() => setLongDescMode('visual')}>
                    <Eye className="w-3 h-3" /> ভিজ্যুয়াল
                  </Button>
                  <Button type="button" variant={longDescMode === 'code' ? 'default' : 'outline'} size="sm" className="text-xs gap-1" onClick={() => setLongDescMode('code')}>
                    <FileText className="w-3 h-3" /> HTML কোড
                  </Button>
                </div>
                {longDescMode === 'visual' ? (
                  <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded-md" />}>
                    <ReactQuill theme="snow" value={formData.longDescription} onChange={(v: string) => updateField('longDescription', v)} modules={quillModules} placeholder="পণ্যের বিস্তারিত বিবরণ লিখুন..." className="bg-background rounded-md [&_.ql-editor]:min-h-[200px]" />
                  </Suspense>
                ) : (
                  <textarea
                    value={formData.longDescription}
                    onChange={(e) => updateField('longDescription', e.target.value)}
                    placeholder="HTML কোড লিখুন..."
                    className="w-full min-h-[250px] p-3 rounded-md border border-input bg-background font-mono text-sm"
                    spellCheck={false}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader><CardTitle className="text-base">মিডিয়া</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Featured Image */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Image className="w-4 h-4" /> ফিচার ইমেজ</Label>
                <Tabs value={featuredImageMode} onValueChange={(v) => setFeaturedImageMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="w-3 h-3" /> আপলোড</TabsTrigger>
                    <TabsTrigger value="link" className="text-xs gap-1"><Link className="w-3 h-3" /> লিংক</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-2">
                    <input ref={featuredInputRef} type="file" accept="image/*" className="hidden" onChange={handleFeaturedUpload} />
                    <Button type="button" variant="outline" className="w-full gap-2 border-dashed h-20" onClick={() => featuredInputRef.current?.click()}>
                      <Upload className="w-5 h-5" /> ফিচার ইমেজ আপলোড করুন
                    </Button>
                  </TabsContent>
                  <TabsContent value="link" className="mt-2">
                    <div className="flex gap-2">
                      <Input placeholder="ইমেজ লিংক পেস্ট করুন" value={featuredImageLink} onChange={(e) => setFeaturedImageLink(e.target.value)} />
                      <Button type="button" onClick={addFeaturedFromLink} size="sm">যোগ</Button>
                    </div>
                  </TabsContent>
                </Tabs>
                {featuredImage && (
                  <div className="relative inline-block mt-2">
                    <img src={featuredImage} alt="Featured" referrerPolicy="no-referrer" className="w-32 h-32 rounded-lg object-cover border" />
                    <button onClick={() => setFeaturedImage('')} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>

              {/* Gallery */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Image className="w-4 h-4" /> গ্যালারি ইমেজ</Label>
                <Tabs value={galleryMode} onValueChange={(v) => setGalleryMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="w-3 h-3" /> আপলোড</TabsTrigger>
                    <TabsTrigger value="link" className="text-xs gap-1"><Link className="w-3 h-3" /> লিংক</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-2">
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    <Button type="button" variant="outline" className="w-full gap-2 border-dashed h-20" onClick={() => galleryInputRef.current?.click()}>
                      <Upload className="w-5 h-5" /> একাধিক ইমেজ আপলোড করুন
                    </Button>
                  </TabsContent>
                  <TabsContent value="link" className="mt-2">
                    <div className="flex gap-2">
                      <Input placeholder="ইমেজ লিংক পেস্ট করুন" value={galleryLink} onChange={(e) => setGalleryLink(e.target.value)} />
                      <Button type="button" onClick={addGalleryFromLink} size="sm">যোগ</Button>
                    </div>
                  </TabsContent>
                </Tabs>
                {galleryImages.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">টিপ: ইমেজগুলো টেনে এনে ক্রম সাজান।</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {galleryImages.map((img, i) => (
                        <div
                          key={`${img}-${i}`}
                          className="relative cursor-move group"
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = Number(e.dataTransfer.getData('text/plain'));
                            const to = i;
                            if (Number.isNaN(from) || from === to) return;
                            setGalleryImages(prev => {
                              const next = [...prev];
                              const [moved] = next.splice(from, 1);
                              next.splice(to, 0, moved);
                              return next;
                            });
                          }}
                          title="টেনে সরান"
                        >
                          <img src={img} alt={`Gallery ${i + 1}`} referrerPolicy="no-referrer" className="w-20 h-20 rounded-lg object-cover border group-hover:ring-2 group-hover:ring-primary transition" draggable={false} />
                          <span className="absolute bottom-0 left-0 bg-background/80 text-foreground text-[10px] px-1 rounded-tr rounded-bl">{i + 1}</span>
                          <button type="button" onClick={() => removeGalleryImage(i)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Video */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Video className="w-4 h-4" /> ফিচার ভিডিও লিংক</Label>
                <Input placeholder="YouTube বা ভিডিও লিংক দিন" value={formData.featuredVideo} onChange={(e) => updateField('featuredVideo', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Customer Reviews */}
          <Card>
            <CardHeader><CardTitle className="text-base">কাস্টমার রিভিউ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.map((review, idx) => (
                    <div key={review.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20">
                      <div className="flex-1 space-y-1">
                        <span className="text-sm font-medium">{review.name}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{review.comment}</p>
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {review.images.map((img, i) => (
                              <img key={i} src={img} alt="" referrerPolicy="no-referrer" className="w-10 h-10 object-cover rounded border border-border" />
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setReviews(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">নতুন রিভিউ যোগ করুন</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="কাস্টমারের নাম" value={newReview.name} onChange={(e) => setNewReview(prev => ({ ...prev, name: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="ইমেজ লিংক (কমা দিয়ে একাধিক)" value={newReview.images} onChange={(e) => setNewReview(prev => ({ ...prev, images: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">রেটিং:</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setNewReview(prev => ({ ...prev, rating: s }))}>
                      <Star className={`w-5 h-5 cursor-pointer ${s <= newReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
                <Input placeholder="রিভিউ কমেন্ট লিখুন..." value={newReview.comment} onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))} className="h-8 text-sm" />
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => {
                  if (!newReview.name || !newReview.comment) { toast.error('নাম ও কমেন্ট আবশ্যক'); return; }
                  const images = newReview.images ? newReview.images.split(',').map(s => s.trim()).filter(Boolean) : undefined;
                  setReviews(prev => [...prev, { ...newReview, id: Date.now().toString(), date: new Date().toISOString().split('T')[0], images }]);
                  setNewReview({ name: '', rating: 5, comment: '', date: '', images: '' });
                  toast.success('রিভিউ যোগ হয়েছে');
                }}>
                  <Plus className="w-3 h-3" /> রিভিউ যোগ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Variations */}
          <Card>
            <CardHeader><CardTitle className="text-base">ভেরিয়েশন</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {variationItems.length > 6 && (
                <Input placeholder="ভেরিয়েশন সার্চ করুন..." value={varSearch} onChange={(e) => setVarSearch(e.target.value)} className="h-8 text-xs" />
              )}
              {renderVariationSection('color', 'কালার', availableColors, selectedColors)}
              {renderVariationSection('size', 'সাইজ', availableSizes, selectedSizes)}
              {renderVariationSection('weight', 'কেজি/ওজন', availableWeights, selectedWeights)}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader><CardTitle className="text-base">স্ট্যাটাস</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'published' ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">পাবলিশড</Badge>
                  ) : (
                    <Badge variant="secondary">ড্রাফট</Badge>
                  )}
                </div>
                <Switch checked={status === 'published'} onCheckedChange={(checked) => setStatus(checked ? 'published' : 'draft')} />
              </div>
              <p className="text-xs text-muted-foreground">
                {status === 'published' ? 'পণ্যটি ওয়েবসাইটে দেখা যাবে' : 'পণ্যটি ওয়েবসাইটে দেখা যাবে না'}
              </p>
            </CardContent>
          </Card>

          {/* Stock Type */}
          <Card>
            <CardHeader><CardTitle className="text-base">স্টক টাইপ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${stockType === 'self' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'}`}>
                  <input type="radio" name="stockType" className="hidden" checked={stockType === 'self'} onChange={() => setStockType('self')} />
                  সেল্ফ স্টক
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${stockType === 'vendor' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'}`}>
                  <input type="radio" name="stockType" className="hidden" checked={stockType === 'vendor'} onChange={() => { setStockType('vendor'); setStockProductName(''); }} />
                  ভেন্ডর স্টক
                </label>
              </div>
              {stockType === 'self' && (
                <div className="space-y-2">
                  <Label className="text-xs">স্টক প্রোডাক্ট সিলেক্ট করুন</Label>
                  <Select value={stockProductName} onValueChange={setStockProductName}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="স্টক প্রোডাক্ট বাছুন..." /></SelectTrigger>
                    <SelectContent>
                      {stockProductNames.length === 0 ? (
                        <SelectItem value="_none" disabled>আগে স্টক ম্যানেজে প্রোডাক্ট যোগ করুন</SelectItem>
                      ) : stockProductNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader><CardTitle className="text-base">ক্যাটাগরি</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {categories.map(cat => (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded text-sm">
                    <Checkbox
                      checked={selectedCategories.includes(cat.name)}
                      onCheckedChange={(checked) => {
                        setSelectedCategories(prev => checked ? [...prev, cat.name] : prev.filter(c => c !== cat.name));
                      }}
                    />
                    <CategoryIcon name={cat.lucideIcon} fallback={Store} className="h-4 w-4 shrink-0" />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t">
                  {selectedCategories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{cat}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader><CardTitle className="text-base">SEO সেটিংস</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">মেটা ডিস্ক্রিপশন</Label>
                <Input placeholder="সার্চ ইঞ্জিনে দেখানোর জন্য বিবরণ" value={formData.metaDescription} onChange={(e) => updateField('metaDescription', e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">মেটা কিওয়ার্ড</Label>
                <Input placeholder="কিওয়ার্ড ১, কিওয়ার্ড ২" value={formData.metaKeywords} onChange={(e) => updateField('metaKeywords', e.target.value)} className="h-9 text-sm" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 bg-background border-t p-4 -mx-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/admin/products')}>বাতিল</Button>
        <Button variant="outline" className="gap-2" onClick={() => handleSave('draft')}>
          <FileText className="w-4 h-4" /> ড্রাফট সেভ
        </Button>
        <Button className="gap-2" onClick={() => handleSave('published')}>
          <Save className="w-4 h-4" /> পাবলিশ করুন
        </Button>
      </div>
    </div>
  );
};

export default ProductForm;
