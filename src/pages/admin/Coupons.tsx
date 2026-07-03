import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCouponStore, Coupon } from '@/stores/useCouponStore';
import { useProductStore } from '@/stores/useProductStore';
import { Plus, Pencil, Trash2, Tag, Copy, Percent, BadgeDollarSign, Users, Calendar, ShoppingCart, X, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

const defaultForm = {
  code: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: 0,
  minOrderAmount: 0,
  maxUsage: 0,
  isActive: true,
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  productIds: [] as string[],
};

const Coupons = () => {
  const { coupons, addCoupon, updateCoupon, deleteCoupon, toggleCoupon, fetchCoupons } = useCouponStore();
  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);
  const { products } = useProductStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [productSearch, setProductSearch] = useState('');

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount,
      maxUsage: c.maxUsage,
      isActive: c.isActive,
      startDate: c.startDate.split('T')[0],
      endDate: c.endDate.split('T')[0],
      productIds: c.productIds || [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast({ title: 'কুপন কোড দিন', variant: 'destructive' });
      return;
    }
    if (form.discountValue <= 0) {
      toast({ title: 'ডিস্কাউন্ট পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (form.discountType === 'percentage' && form.discountValue > 100) {
      toast({ title: 'শতাংশ ১০০ এর বেশি হতে পারবে না', variant: 'destructive' });
      return;
    }

    const data = {
      ...form,
      code: form.code.toUpperCase().trim(),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };

    try {
      if (editingId) {
        await updateCoupon(editingId, data);
        toast({ title: 'কুপন আপডেট হয়েছে' });
      } else {
        await addCoupon(data);
        toast({ title: 'নতুন কুপন তৈরি হয়েছে' });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'কুপন সেভ করা যায়নি', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = (id: string) => {
    deleteCoupon(id);
    toast({ title: 'কুপন মুছে ফেলা হয়েছে' });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'কুপন কোড কপি হয়েছে' });
  };

  const isExpired = (endDate: string) => new Date(endDate) < new Date();
  const isUpcoming = (startDate: string) => new Date(startDate) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">কুপন ম্যানেজ</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> নতুন কুপন
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coupons.length}</p>
              <p className="text-xs text-muted-foreground">মোট কুপন</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Tag className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coupons.filter((c) => c.isActive && !isExpired(c.endDate)).length}</p>
              <p className="text-xs text-muted-foreground">সক্রিয়</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Tag className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coupons.filter((c) => isExpired(c.endDate)).length}</p>
              <p className="text-xs text-muted-foreground">মেয়াদোত্তীর্ণ</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coupons.reduce((s, c) => s + c.usedCount, 0)}</p>
              <p className="text-xs text-muted-foreground">মোট ব্যবহার</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupon List */}
      {coupons.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center space-y-4">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">কোনো কুপন তৈরি করা হয়নি</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> প্রথম কুপন তৈরি করুন
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className={`border-0 shadow-sm relative overflow-hidden ${!coupon.isActive || isExpired(coupon.endDate) ? 'opacity-60' : ''}`}>
              {/* Dashed border top accent */}
              <div className="h-1 bg-primary" />
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary font-mono font-bold text-lg px-3 py-1 rounded-[5px] tracking-wider">
                      {coupon.code}
                    </div>
                    <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {isExpired(coupon.endDate) ? (
                      <Badge variant="destructive" className="text-xs">মেয়াদোত্তীর্ণ</Badge>
                    ) : isUpcoming(coupon.startDate) ? (
                      <Badge variant="secondary" className="text-xs">আসন্ন</Badge>
                    ) : coupon.isActive ? (
                      <Badge className="text-xs bg-green-500/10 text-green-600 border-0">সক্রিয়</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">নিষ্ক্রিয়</Badge>
                    )}
                  </div>
                </div>

                {/* Discount display */}
                <div className="flex items-center gap-2 text-2xl font-bold">
                  {coupon.discountType === 'percentage' ? (
                    <>
                      <Percent className="h-5 w-5 text-primary" />
                      <span>{coupon.discountValue}% ছাড়</span>
                    </>
                  ) : (
                    <>
                      <BadgeDollarSign className="h-5 w-5 text-primary" />
                      <span>৳{coupon.discountValue} ছাড়</span>
                    </>
                  )}
                </div>

                {/* Rules */}
                <div className="space-y-2 text-sm text-muted-foreground">
                  {coupon.productIds && coupon.productIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5" />
                      <span>{coupon.productIds.length}টি প্রোডাক্টে প্রযোজ্য</span>
                    </div>
                  )}
                  {coupon.minOrderAmount > 0 && (
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>সর্বনিম্ন অর্ডার: ৳{coupon.minOrderAmount}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      ব্যবহার: {coupon.usedCount}/{coupon.maxUsage > 0 ? coupon.maxUsage : '∞'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(coupon.startDate).toLocaleDateString('bn-BD')} — {new Date(coupon.endDate).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Switch checked={coupon.isActive} onCheckedChange={() => toggleCoupon(coupon.id)} />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(coupon)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(coupon.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'কুপন সম্পাদনা' : 'নতুন কুপন তৈরি'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>কুপন কোড *</Label>
              <Input
                placeholder="যেমন: SAVE20"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono tracking-wider rounded-[5px]"
                maxLength={20}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ডিস্কাউন্ট ধরন</Label>
                <Select value={form.discountType} onValueChange={(v: 'percentage' | 'fixed') => setForm({ ...form, discountType: v })}>
                  <SelectTrigger className="rounded-[5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">শতাংশ (%)</SelectItem>
                    <SelectItem value="fixed">নির্দিষ্ট টাকা (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>পরিমাণ *</Label>
                <Input
                  type="number"
                  placeholder={form.discountType === 'percentage' ? '10' : '100'}
                  value={form.discountValue || ''}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="rounded-[5px]"
                  min={0}
                  max={form.discountType === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>সর্বনিম্ন অর্ডার (৳)</Label>
                <Input
                  type="number"
                  placeholder="0 = কোনো সীমা নেই"
                  value={form.minOrderAmount || ''}
                  onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                  className="rounded-[5px]"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>ব্যবহার সীমা</Label>
                <Input
                  type="number"
                  placeholder="0 = আনলিমিটেড"
                  value={form.maxUsage || ''}
                  onChange={(e) => setForm({ ...form, maxUsage: Number(e.target.value) })}
                  className="rounded-[5px]"
                  min={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>শুরুর তারিখ</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="rounded-[5px]"
                />
              </div>
              <div className="space-y-2">
                <Label>শেষ তারিখ</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="rounded-[5px]"
                />
              </div>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label>নির্দিষ্ট প্রোডাক্ট (ঐচ্ছিক)</Label>
              <p className="text-xs text-muted-foreground">কোনো প্রোডাক্ট সিলেক্ট না করলে সকল প্রোডাক্টে কাজ করবে</p>
              <Input
                placeholder="প্রোডাক্ট খুঁজুন..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="rounded-[5px]"
              />
              {form.productIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.productIds.map(pid => {
                    const p = products.find(pr => pr.id === pid);
                    return (
                      <Badge key={pid} variant="secondary" className="gap-1 pr-1">
                        <span className="max-w-[120px] truncate text-xs">{p?.title || pid}</span>
                        <button onClick={() => setForm({ ...form, productIds: form.productIds.filter(id => id !== pid) })}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="max-h-32 overflow-y-auto border border-border rounded-[5px] divide-y divide-border">
                {products
                  .filter(p => !form.productIds.includes(p.id) && (productSearch === '' || p.title.toLowerCase().includes(productSearch.toLowerCase())))
                  .slice(0, 20)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, productIds: [...form.productIds, p.id] })}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Checkbox checked={false} className="pointer-events-none" />
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))
                }
                {products.filter(p => !form.productIds.includes(p.id) && (productSearch === '' || p.title.toLowerCase().includes(productSearch.toLowerCase()))).length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>সক্রিয়</Label>
            </div>

            <Button onClick={handleSubmit} className="w-full">
              {editingId ? 'আপডেট করুন' : 'কুপন তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Coupons;
