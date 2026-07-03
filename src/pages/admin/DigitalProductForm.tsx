import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDigitalProductStore, type DigitalProduct } from '@/stores/useDigitalProductStore';
import { useDigitalCategoryStore } from '@/stores/useDigitalCategoryStore';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `product-${Date.now()}`;

const DigitalProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { products, add, update, fetch } = useDigitalProductStore();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<DigitalProduct>>({
    title: '', slug: '', shortDescription: '', longDescription: '',
    price: 0, originalPrice: undefined, featuredImage: '',
    images: [], productType: 'file', downloadFilePath: '',
    accessLink: '', accessCode: '', status: 'published', categories: [],
  });
  const [newCategory, setNewCategory] = useState('');

  const { categories: masterCategories, fetch: fetchCategories, add: addCategory } = useDigitalCategoryStore();

  // Merge master list + any categories already used by products (for backfill)
  const allCategories = Array.from(
    new Set([
      ...masterCategories,
      ...products.flatMap((p) => p.categories || []),
    ].map((c) => c.trim()).filter(Boolean))
  ).sort();

  useEffect(() => {
    if (!products.length) fetch({ force: true, includeAll: true });
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isEdit) {
      const p = products.find((x) => x.id === id);
      if (p) setForm(p);
    }
  }, [id, products, isEdit]);

  const toggleCategory = (name: string) => {
    const current = form.categories || [];
    setForm({
      ...form,
      categories: current.includes(name)
        ? current.filter((c) => c !== name)
        : [...current, name],
    });
  };

  const handleAddNewCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    await addCategory(name);
    const current = form.categories || [];
    if (!current.includes(name)) {
      setForm({ ...form, categories: [...current, name] });
    }
    setNewCategory('');
    toast.success('ক্যাটাগরি যোগ হয়েছে');
  };

  const upload = async (file: File, prefix: string) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `digital-products/${prefix}`);
      const res = await api.post('/public/digital-fe/upload', fd);
      return res?.path || null;
    } catch (e: any) { toast.error('আপলোড ব্যর্থ: ' + (e?.message || '')); return null; }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const path = await upload(f, 'files');
    if (path) { setForm({ ...form, downloadFilePath: path }); toast.success('ফাইল আপলোড হয়েছে'); }
    setUploading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const path = await upload(f, 'images');
    if (path) {
      // Laravel public-disk upload returns a directly-usable URL ('/storage/...').
      setForm({ ...form, featuredImage: path });
      toast.success('ছবি আপলোড হয়েছে');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error('টাইটেল লাগবে'); return; }
    if (!form.price || form.price <= 0) { toast.error('সঠিক প্রাইস লাগবে'); return; }
    const slug = form.slug?.trim() || slugify(form.title);
    setSaving(true);
    if (isEdit && id) {
      await update(id, { ...form, slug });
      toast.success('আপডেট হয়েছে');
    } else {
      const created = await add({ ...(form as any), slug });
      if (!created) { toast.error('সেভ ব্যর্থ'); setSaving(false); return; }
      toast.success('তৈরি হয়েছে');
    }
    setSaving(false);
    navigate('/admin/digital/products');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">{isEdit ? 'প্রডাক্ট এডিট' : 'নতুন ডিজিটাল প্রডাক্ট'}</h1>

      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>টাইটেল *</Label>
          <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} />
        </div>
        <div>
          <Label>স্লাগ (URL)</Label>
          <Input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" />
        </div>
        <div>
          <Label>ক্যাটাগরি (একাধিক সিলেক্ট করতে পারবেন)</Label>
          {allCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {allCategories.map((c) => {
                const selected = (form.categories || []).includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted hover:bg-muted/70 border-border'
                    }`}
                  >
                    {selected ? '✓ ' : ''}{c}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">এখনও কোনো ক্যাটাগরি নেই — নিচে নতুন যোগ করুন।</p>
          )}
          <div className="flex gap-2 mt-3">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewCategory(); } }}
              placeholder="নতুন ক্যাটাগরি লিখুন"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleAddNewCategory}>
              যোগ করুন
            </Button>
          </div>
          {(form.categories || []).length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              সিলেক্টেড: {(form.categories || []).join(', ')}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>প্রাইস *</Label>
            <Input type="number" value={form.price || 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>আগের প্রাইস</Label>
            <Input type="number" value={form.originalPrice || ''} onChange={(e) => setForm({ ...form, originalPrice: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
        <div>
          <Label>শর্ট ডেসক্রিপশন</Label>
          <Suspense fallback={<div className="h-24 bg-muted rounded animate-pulse" />}>
            <ReactQuill theme="snow" value={form.shortDescription || ''} onChange={(v: string) => setForm({ ...form, shortDescription: v })} modules={quillModules} placeholder="সংক্ষিপ্ত বিবরণ লিখুন..." className="bg-background rounded-md [&_.ql-editor]:min-h-[100px]" />
          </Suspense>
        </div>
        <div>
          <Label>বিস্তারিত</Label>
          <Suspense fallback={<div className="h-48 bg-muted rounded animate-pulse" />}>
            <ReactQuill theme="snow" value={form.longDescription || ''} onChange={(v: string) => setForm({ ...form, longDescription: v })} modules={quillModules} placeholder="বিস্তারিত বিবরণ লিখুন..." className="bg-background rounded-md [&_.ql-editor]:min-h-[200px]" />
          </Suspense>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <Label>ফিচার্ড ইমেজ</Label>
        {form.featuredImage && <img src={form.featuredImage} alt="" className="w-32 h-32 object-cover rounded" />}
        <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
        <Input placeholder="অথবা ইমেজ URL" value={form.featuredImage || ''} onChange={(e) => setForm({ ...form, featuredImage: e.target.value })} />
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>প্রডাক্ট টাইপ</Label>
          <Select value={form.productType || 'file'} onValueChange={(v) => setForm({ ...form, productType: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="file">ফাইল ডাউনলোড</SelectItem>
              <SelectItem value="link">অ্যাক্সেস লিংক/কোড</SelectItem>
              <SelectItem value="both">উভয়</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(form.productType === 'file' || form.productType === 'both') && (
          <div>
            <Label>ডাউনলোড ফাইল</Label>
            <Input type="file" onChange={handleFileUpload} disabled={uploading} />
            {form.downloadFilePath && <p className="text-xs text-muted-foreground mt-1">আপলোডেড: {form.downloadFilePath}</p>}
            {uploading && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
          </div>
        )}

        {(form.productType === 'link' || form.productType === 'both') && (
          <>
            <div>
              <Label>অ্যাক্সেস লিংক</Label>
              <Input value={form.accessLink || ''} onChange={(e) => setForm({ ...form, accessLink: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>অ্যাক্সেস কোড / লাইসেন্স কী</Label>
              <Input value={form.accessCode || ''} onChange={(e) => setForm({ ...form, accessCode: e.target.value })} />
            </div>
          </>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>স্ট্যাটাস</Label>
          <Select value={form.status || 'published'} onValueChange={(v) => setForm({ ...form, status: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="published">পাবলিশড</SelectItem>
              <SelectItem value="draft">ড্রাফট</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>মেটা ডেসক্রিপশন (SEO)</Label>
          <Input value={form.metaDescription || ''} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
        </div>
        <div>
          <Label>মেটা কীওয়ার্ড</Label>
          <Input value={form.metaKeywords || ''} onChange={(e) => setForm({ ...form, metaKeywords: e.target.value })} />
        </div>
      </CardContent></Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || uploading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'আপডেট করুন' : 'তৈরি করুন'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/digital/products')}>বাতিল</Button>
      </div>
    </div>
  );
};

export default DigitalProductForm;
