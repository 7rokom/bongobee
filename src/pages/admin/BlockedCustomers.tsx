import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ShieldBan, ShieldCheck, Plus, Phone, Globe, Trash2, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { useBlockStore, type BlockedEntry } from '@/stores/useBlockStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const BlockedCustomers = () => {
  const { blockedList, blockCustomer, unblockCustomer, unblockGroup, fetchBlocked, loading } = useBlockStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'phone' | 'ip' | 'fingerprint'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntry, setNewEntry] = useState({ type: 'phone' as 'phone' | 'ip' | 'fingerprint', value: '', customerName: '', reason: '' });

  useEffect(() => {
    fetchBlocked();
  }, []);

  const filtered = (() => {
    if (!search.trim()) {
      return blockedList.filter((b) => typeFilter === 'all' || b.type === typeFilter);
    }
    const matchedCustomerNames = new Set(
      blockedList
        .filter((b) => b.value.includes(search) || (b.customer_name || '').includes(search))
        .map((b) => b.customer_name)
        .filter(Boolean)
    );
    return blockedList.filter((b) => {
      const matchSearch =
        b.value.includes(search) ||
        (b.customer_name || '').includes(search) ||
        (b.customer_name && matchedCustomerNames.has(b.customer_name));
      const matchType = typeFilter === 'all' || b.type === typeFilter;
      return matchSearch && matchType;
    });
  })();

  const handleAdd = async () => {
    if (!newEntry.value.trim()) {
      toast.error('ফোন নম্বর বা IP অ্যাড্রেস দিন');
      return;
    }
    await blockCustomer({
      type: newEntry.type,
      value: newEntry.value.trim(),
      customerName: newEntry.customerName.trim() || undefined,
      reason: newEntry.reason.trim() || undefined,
    });
    toast.success(`${newEntry.type === 'phone' ? 'ফোন নম্বর' : newEntry.type === 'ip' ? 'IP অ্যাড্রেস' : 'ডিভাইস ফিঙ্গারপ্রিন্ট'} ব্লক করা হয়েছে`);
    setNewEntry({ type: 'phone', value: '', customerName: '', reason: '' });
    setShowAddDialog(false);
  };

  const handleUnblock = async (entry: BlockedEntry) => {
    if (entry.linked_group) {
      await unblockGroup(entry.linked_group);
      toast.success(`${entry.customer_name || entry.value} এবং সংশ্লিষ্ট সকল এন্ট্রি আনব্লক করা হয়েছে`);
    } else {
      await unblockCustomer(entry.id);
      toast.success(`${entry.value} আনব্লক করা হয়েছে`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldBan className="w-6 h-6 text-destructive" />
            ব্লক কাস্টমার
          </h1>
          <p className="text-sm text-muted-foreground">মোট {blockedList.length}টি ব্লক এন্ট্রি</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          ম্যানুয়ালি ব্লক করুন
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ফোন নম্বর বা IP খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'phone', 'ip', 'fingerprint'] as const).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'সব' : t === 'phone' ? 'ফোন' : t === 'ip' ? 'IP' : 'ডিভাইস'}
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${typeFilter === t ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'}`}>
                {t === 'all' ? blockedList.length : blockedList.filter((b) => b.type === t).length}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{loading ? 'লোড হচ্ছে...' : 'কোনো ব্লক এন্ট্রি পাওয়া যায়নি'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[60px]">#</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[100px]">ধরন</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[200px]">ভ্যালু</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[160px]">কাস্টমার</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[200px]">কারণ</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[160px]">ব্লকের তারিখ</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-[120px]">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, idx) => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30 align-middle">
                      <td className="py-3 px-4 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${entry.type === 'phone' ? 'bg-blue-100 text-blue-800' : entry.type === 'ip' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                          {entry.type === 'phone' ? <Phone className="w-3 h-3" /> : entry.type === 'ip' ? <Globe className="w-3 h-3" /> : <Fingerprint className="w-3 h-3" />}
                          {entry.type === 'phone' ? 'ফোন' : entry.type === 'ip' ? 'IP' : 'ডিভাইস'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium">{entry.value}</td>
                      <td className="py-3 px-4 text-center">{entry.customer_name || '—'}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground text-xs">{entry.reason || '—'}</td>
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                        {new Date(entry.blocked_at).toLocaleDateString('bn-BD')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => handleUnblock(entry)}>
                          <Trash2 className="w-3 h-3" />
                          আনব্লক
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldBan className="w-5 h-5 text-destructive" />
              কাস্টমার ব্লক করুন
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ব্লক ধরন</Label>
              <Select value={newEntry.type} onValueChange={(v) => setNewEntry({ ...newEntry, type: v as 'phone' | 'ip' | 'fingerprint' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">ফোন নম্বর</SelectItem>
                  <SelectItem value="ip">IP অ্যাড্রেস</SelectItem>
                  <SelectItem value="fingerprint">ডিভাইস ফিঙ্গারপ্রিন্ট</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{newEntry.type === 'phone' ? 'ফোন নম্বর' : newEntry.type === 'ip' ? 'IP অ্যাড্রেস' : 'ফিঙ্গারপ্রিন্ট'}</Label>
              <Input
                placeholder={newEntry.type === 'phone' ? '01XXXXXXXXX' : newEntry.type === 'ip' ? '192.168.1.1' : 'FPXXXXXX'}
                value={newEntry.value}
                onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>কাস্টমারের নাম (ঐচ্ছিক)</Label>
              <Input
                placeholder="কাস্টমারের নাম"
                value={newEntry.customerName}
                onChange={(e) => setNewEntry({ ...newEntry, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ব্লকের কারণ (ঐচ্ছিক)</Label>
              <Input
                placeholder="যেমন: ফেক অর্ডার দেয়"
                value={newEntry.reason}
                onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>বাতিল</Button>
            <Button variant="destructive" onClick={handleAdd} className="gap-2">
              <ShieldBan className="w-4 h-4" />
              ব্লক করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlockedCustomers;
