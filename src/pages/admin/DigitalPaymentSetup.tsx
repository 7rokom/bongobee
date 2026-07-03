import { useEffect, useState } from 'react';
import { useDigitalPaymentMethodStore, type DigitalPaymentMethod, type DigitalPaymentType } from '@/stores/useDigitalPaymentMethodStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

type Draft = Partial<DigitalPaymentMethod> & { id?: string; _new?: boolean };

const blank = (): Draft => ({ _new: true, name: '', type: 'mobile', accountNumber: '', instructions: '', logoUrl: '', isActive: false, sortOrder: 0 });

const DigitalPaymentSetup = () => {
  const { methods, fetchAll, add, update, remove } = useDigitalPaymentMethodStore();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getDraft = (m: DigitalPaymentMethod): Draft => drafts[m.id] ?? m;
  const setField = (id: string, field: keyof Draft, value: any) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? methods.find((m) => m.id === id) ?? {}), [field]: value } }));
  };

  const saveExisting = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    await update(id, d);
    setDrafts((s) => { const n = { ...s }; delete n[id]; return n; });
    toast.success('সেভ হয়েছে');
  };

  const [newDraft, setNewDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DigitalPaymentMethod | null>(null);
  const [confirmDelete2, setConfirmDelete2] = useState<DigitalPaymentMethod | null>(null);

  const saveNew = async () => {
    if (!newDraft?.name) { toast.error('নাম দিন'); return; }
    await add({
      name: newDraft.name!,
      type: (newDraft.type as DigitalPaymentType) || 'mobile',
      accountNumber: newDraft.accountNumber || '',
      instructions: newDraft.instructions || '',
      logoUrl: newDraft.logoUrl || '',
      isActive: newDraft.isActive ?? false,
      sortOrder: Number(newDraft.sortOrder ?? 0),
    });
    setNewDraft(null);
    toast.success('যোগ করা হয়েছে (সক্রিয় করতে টগল অন করুন)');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">পেমেন্ট সেটআপ</h1>
          <p className="text-sm text-muted-foreground">/digital/payment পেজে দেখানো পেমেন্ট অপশনসমূহ</p>
        </div>
        {!newDraft && (
          <Button onClick={() => setNewDraft(blank())}>
            <Plus className="mr-2 h-4 w-4" /> নতুন পদ্ধতি
          </Button>
        )}
      </div>

      {newDraft && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">নতুন পেমেন্ট পদ্ধতি</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label>নাম *</Label><Input value={newDraft.name || ''} onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })} placeholder="যেমন: bKash" /></div>
              <div>
                <Label>ধরন *</Label>
                <Select value={newDraft.type || 'mobile'} onValueChange={(v) => setNewDraft({ ...newDraft, type: v as DigitalPaymentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">মোবাইল ব্যাংকিং (bKash/Nagad)</SelectItem>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>অ্যাকাউন্ট/নম্বর</Label><Input value={newDraft.accountNumber || ''} onChange={(e) => setNewDraft({ ...newDraft, accountNumber: e.target.value })} placeholder={newDraft.type === 'bank' ? 'A/C: 1234567890' : '01XXXXXXXXX'} /></div>
            </div>
            <div><Label>লোগো URL</Label><Input value={newDraft.logoUrl || ''} onChange={(e) => setNewDraft({ ...newDraft, logoUrl: e.target.value })} placeholder="https://..." /></div>
            <div><Label>নির্দেশনা</Label><Textarea value={newDraft.instructions || ''} onChange={(e) => setNewDraft({ ...newDraft, instructions: e.target.value })} placeholder="যেমন: এই নম্বরে Send Money করুন এবং TrxID দিন" rows={3} /></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={newDraft.isActive ?? true} onCheckedChange={(v) => setNewDraft({ ...newDraft, isActive: v })} /><Label>সক্রিয়</Label></div>
              <div className="flex items-center gap-2"><Label>ক্রম:</Label><Input type="number" className="w-20" value={newDraft.sortOrder ?? 0} onChange={(e) => setNewDraft({ ...newDraft, sortOrder: Number(e.target.value) })} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveNew}><Save className="mr-2 h-4 w-4" /> সেভ</Button>
              <Button variant="outline" onClick={() => setNewDraft(null)}>বাতিল</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {methods.length === 0 && !newDraft && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">কোন পেমেন্ট পদ্ধতি নেই</CardContent></Card>
      )}

      {methods.map((m) => {
        const d = getDraft(m);
        const isDirty = !!drafts[m.id];
        return (
          <Card key={m.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  {m.logoUrl && <img src={m.logoUrl} alt={m.name} className="h-6 w-6 object-contain" />}
                  {m.name} <span className="text-xs text-muted-foreground">({m.type === 'bank' ? 'ব্যাংক' : 'মোবাইল'})</span>
                </h3>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(m)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>নাম</Label><Input value={d.name || ''} onChange={(e) => setField(m.id, 'name', e.target.value)} /></div>
                <div>
                  <Label>ধরন</Label>
                  <Select value={(d.type as string) || 'mobile'} onValueChange={(v) => setField(m.id, 'type', v as DigitalPaymentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">মোবাইল ব্যাংকিং</SelectItem>
                      <SelectItem value="bank">ব্যাংক</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>অ্যাকাউন্ট/নম্বর</Label><Input value={d.accountNumber || ''} onChange={(e) => setField(m.id, 'accountNumber', e.target.value)} /></div>
              </div>
              <div><Label>লোগো URL</Label><Input value={d.logoUrl || ''} onChange={(e) => setField(m.id, 'logoUrl', e.target.value)} /></div>
              <div><Label>নির্দেশনা</Label><Textarea value={d.instructions || ''} onChange={(e) => setField(m.id, 'instructions', e.target.value)} rows={3} /></div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={!!d.isActive} onCheckedChange={(v) => setField(m.id, 'isActive', v)} /><Label>সক্রিয়</Label></div>
                <div className="flex items-center gap-2"><Label>ক্রম:</Label><Input type="number" className="w-20" value={d.sortOrder ?? 0} onChange={(e) => setField(m.id, 'sortOrder', Number(e.target.value))} /></div>
              </div>
              {isDirty && (
                <Button size="sm" onClick={() => saveExisting(m.id)}>
                  <Save className="mr-2 h-4 w-4" /> সেভ
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>পেমেন্ট পদ্ধতি ডিলিট করবেন?</DialogTitle></DialogHeader>
          <p>{confirmDelete?.name} ডিলিট হবে। এই কাজটি ফেরানো যাবে না।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete2(confirmDelete); setConfirmDelete(null); }}>হ্যাঁ, ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete2} onOpenChange={(o) => !o && setConfirmDelete2(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>আপনি কি নিশ্চিত?</DialogTitle></DialogHeader>
          <p>চূড়ান্তভাবে এই পেমেন্ট পদ্ধতি ডিলিট হয়ে যাবে। আবার নিশ্চিত করুন।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete2(null)}>না</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDelete2) { await remove(confirmDelete2.id); toast.success('ডিলিট হয়েছে'); setConfirmDelete2(null); }
            }}>হ্যাঁ, কনফার্ম ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalPaymentSetup;
