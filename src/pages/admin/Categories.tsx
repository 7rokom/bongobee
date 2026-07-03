import { useState, useMemo } from 'react';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useProductStore } from '@/stores/useProductStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import CategoryIcon, { CATEGORY_ICON_OPTIONS } from '@/components/CategoryIcon';

const Categories = () => {
  const { categories: cats, addCategory, deleteCategory, updateCategory } = useCategoryStore();
  const { products } = useProductStore();
  const countFor = (slug: string) => products.filter(p => p.category === slug).length;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [lucideIcon, setLucideIcon] = useState('');
  const [iconSearch, setIconSearch] = useState('');
  const [type, setType] = useState<'main' | 'sub'>('main');
  const [parentId, setParentId] = useState<string>('');
  const [customLink, setCustomLink] = useState('');

  const mainCategories = cats.filter(c => c.isMain !== false);

  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return CATEGORY_ICON_OPTIONS;
    return CATEGORY_ICON_OPTIONS.filter(n => n.toLowerCase().includes(q));
  }, [iconSearch]);

  const resetForm = () => {
    setName(''); setIcon(''); setLucideIcon(''); setIconSearch('');
    setType('main'); setParentId(''); setCustomLink(''); setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error('ক্যাটাগরির নাম দিন'); return; }
    if (type === 'sub' && !parentId) { toast.error('পেরেন্ট মেইন ক্যাটাগরি সিলেক্ট করুন'); return; }

    const isMain = type === 'main';
    const parent = type === 'sub' ? parentId : null;

    if (editingId) {
      updateCategory(editingId, {
        name: name.trim(),
        icon: icon.trim(),
        lucideIcon: lucideIcon.trim(),
        isMain,
        parentId: parent,
        customLink: customLink.trim(),
      });
      toast.success('ক্যাটাগরি আপডেট হয়েছে');
    } else {
      const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
      addCategory({
        id: Date.now().toString(),
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
        icon: icon.trim(),
        lucideIcon: lucideIcon.trim(),
        productCount: 0,
        isMain,
        parentId: parent,
        sortOrder: maxOrder + 1,
        customLink: customLink.trim(),
      });
      toast.success('নতুন ক্যাটাগরি যোগ হয়েছে');
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (cat: typeof cats[0]) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setLucideIcon(cat.lucideIcon || '');
    setType(cat.isMain === false ? 'sub' : 'main');
    setParentId(cat.parentId || '');
    setCustomLink(cat.customLink || '');
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCategory(id);
    toast.success('ক্যাটাগরি ডিলিট করা হয়েছে');
  };

  // Sort helpers — operate within same group (main vs sub-of-same-parent)
  const sortedCats = useMemo(() => {
    return [...cats].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name));
  }, [cats]);

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    const cat = cats.find(c => c.id === id);
    if (!cat) return;
    const siblings = sortedCats.filter(c =>
      cat.isMain !== false ? c.isMain !== false : c.parentId === cat.parentId
    );
    const idx = siblings.findIndex(c => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    // Swap positions in the array, then reassign sortOrder sequentially
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Sequential awaits — each update reads fresh settings state
    for (let i = 0; i < reordered.length; i++) {
      await updateCategory(reordered[i].id, { sortOrder: i + 1 });
    }
  };


  const getParentName = (pid?: string | null) => cats.find(c => c.id === pid)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ক্যাটাগরি</h1>
          <p className="text-sm text-muted-foreground">মোট {cats.length}টি ক্যাটাগরি ({mainCategories.length} মেইন)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={cats}
            filename="categories"
            label="ক্যাটাগরি"
            onImport={(items) => {
              items.forEach((c: any) => {
                if (!cats.find(ec => ec.id === c.id)) addCategory(c);
              });
            }}
          />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> নতুন ক্যাটাগরি</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'ক্যাটাগরি এডিট করুন' : 'নতুন ক্যাটাগরি যোগ করুন'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>ক্যাটাগরির ধরন</Label>
                  <RadioGroup value={type} onValueChange={(v: 'main' | 'sub') => setType(v)} className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="main" id="type-main" />
                      <Label htmlFor="type-main" className="cursor-pointer font-normal">মেইন ক্যাটাগরি</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="sub" id="type-sub" />
                      <Label htmlFor="type-sub" className="cursor-pointer font-normal">সাব ক্যাটাগরি</Label>
                    </div>
                  </RadioGroup>
                </div>

                {type === 'sub' && (
                  <div className="space-y-2">
                    <Label>পেরেন্ট মেইন ক্যাটাগরি <span className="text-destructive">*</span></Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="মেইন ক্যাটাগরি সিলেক্ট করুন" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainCategories.filter(c => c.id !== editingId).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>ক্যাটাগরির নাম</Label>
                  <Input placeholder="ক্যাটাগরির নাম লিখুন" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>ব্যাকগ্রাউন্ড ইমেজ লিংক (ঐচ্ছিক)</Label>
                  <Input placeholder="https://example.com/image.jpg" value={icon} onChange={(e) => setIcon(e.target.value)} />
                  <p className="text-xs text-muted-foreground">ক্যাটাগরি কার্ডে ব্যাকগ্রাউন্ড ইমেজ হিসেবে দেখাবে।</p>
                  {icon && /^https?:\/\//i.test(icon) && (
                    <img src={icon} alt="preview" className="w-full h-32 object-cover rounded border" />
                  )}
                </div>

                {/* Lucide icon picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>আইকন (মেনু/সাইডবারে দেখাবে)</Label>
                    {lucideIcon && (
                      <button
                        type="button"
                        onClick={() => setLucideIcon('')}
                        className="text-xs text-destructive flex items-center gap-1 hover:underline"
                      >
                        <X className="w-3 h-3" /> ক্লিয়ার
                      </button>
                    )}
                  </div>
                  {lucideIcon && (
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/40">
                      <CategoryIcon name={lucideIcon} className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">{lucideIcon}</span>
                      <span className="text-xs text-muted-foreground ml-auto">নির্বাচিত</span>
                    </div>
                  )}
                  <Input
                    placeholder="আইকন খুঁজুন (যেমন: shirt, phone)..."
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                  />
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-56 overflow-y-auto p-2 border rounded">
                    {filteredIcons.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        title={iconName}
                        onClick={() => setLucideIcon(iconName)}
                        className={`flex items-center justify-center aspect-square rounded border transition-colors ${
                          lucideIcon === iconName
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card hover:bg-muted border-border'
                        }`}
                      >
                        <CategoryIcon name={iconName} className="w-5 h-5" />
                      </button>
                    ))}
                    {filteredIcons.length === 0 && (
                      <p className="col-span-full text-xs text-muted-foreground text-center py-4">
                        কোন আইকন পাওয়া যায়নি
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>কাস্টম লিংক (ঐচ্ছিক)</Label>
                  <Input
                    placeholder="যেমন: /shop?category=phone অথবা https://..."
                    value={customLink}
                    onChange={(e) => setCustomLink(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    সেট করলে ক্যাটাগরি কার্ড ডিফল্ট শপ লিংকের বদলে এই URL এ যাবে।
                  </p>
                </div>

                <Button className="w-full" onClick={handleSave}>সেভ করুন</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCats.map((cat) => (
          <Card key={cat.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {cat.icon && /^https?:\/\//i.test(cat.icon) ? (
                  <img src={cat.icon} alt={cat.name} className="w-12 h-12 rounded object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                    <CategoryIcon name={cat.lucideIcon} className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{cat.name}</h3>
                    {cat.isMain === false ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        সাব → {getParentName(cat.parentId) || '—'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">মেইন</span>
                    )}
                    {cat.customLink && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">কাস্টম লিংক</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {countFor(cat.slug)}টি পণ্য · সিরিয়াল #{cat.sortOrder ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="উপরে" onClick={() => moveCategory(cat.id, 'up')}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="নিচে" onClick={() => moveCategory(cat.id, 'down')}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Categories;
