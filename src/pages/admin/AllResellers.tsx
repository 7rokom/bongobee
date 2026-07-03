import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useResellerStore, Reseller } from '@/stores/useResellerStore';
import { Plus, Edit2, Eye, EyeOff, KeyRound, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const AllResellers = () => {
  const { resellers, addReseller, updateReseller } = useResellerStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [tab, setTab] = useState('pending');

  // Password change state
  const [passChangeId, setPassChangeId] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // Deactivation note state
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivateNote, setDeactivateNote] = useState('');

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', password: '' });
    setEditId(null);
    setShowPass(false);
  };

  const pendingResellers = resellers.filter(r => r.approvalStatus === 'pending');
  const activeResellers = resellers.filter(r => r.isActive && r.approvalStatus !== 'pending');
  const deactiveResellers = resellers.filter(r => !r.isActive && r.approvalStatus !== 'pending');

  const handleSave = () => {
    if (!form.name || !form.email || !form.phone || !form.password) {
      toast({ title: 'সব ফিল্ড পূরণ করুন', variant: 'destructive' });
      return;
    }
    if (editId) {
      updateReseller(editId, form);
      toast({ title: 'রিসেলার আপডেট হয়েছে' });
    } else {
      const newReseller: Reseller = {
        id: Date.now().toString(),
        ...form,
        isActive: true,
        approvalStatus: 'approved',
        createdAt: new Date().toISOString(),
        balance: 0,
        deactivationNote: '',
      };
      addReseller(newReseller);
      toast({ title: 'রিসেলার যোগ হয়েছে' });
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (r: Reseller) => {
    setForm({ name: r.name, email: r.email, phone: r.phone, password: r.password });
    setEditId(r.id);
    setOpen(true);
  };

  const handleApprove = (id: string) => {
    updateReseller(id, { approvalStatus: 'approved', isActive: true });
    toast({ title: 'রিসেলার অনুমোদিত হয়েছে ✅' });
  };

  const handleDeactivate = async () => {
    if (deactivateId) {
      try {
        await updateReseller(deactivateId, { isActive: false, deactivationNote: deactivateNote });
        toast({ title: 'রিসেলার ডিএকটিভ করা হয়েছে' });
        setDeactivateId(null);
        setDeactivateNote('');
      } catch (err: any) {
        toast({ title: 'ব্যর্থ', description: err?.message || 'ডেটাবেস আপডেট হয়নি', variant: 'destructive' });
      }
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await updateReseller(id, { isActive: true, deactivationNote: '' });
      toast({ title: 'রিসেলার একটিভ করা হয়েছে ✅' });
    } catch (err: any) {
      toast({ title: 'ব্যর্থ', description: err?.message || 'ডেটাবেস আপডেট হয়নি', variant: 'destructive' });
    }
  };

  const handlePasswordChange = () => {
    if (!newPass || newPass.length < 4) {
      toast({ title: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', variant: 'destructive' });
      return;
    }
    if (newPass !== confirmPass) {
      toast({ title: 'পাসওয়ার্ড মিলছে না', variant: 'destructive' });
      return;
    }
    if (passChangeId) {
      updateReseller(passChangeId, { password: newPass });
      toast({ title: 'পাসওয়ার্ড পরিবর্তন হয়েছে ✅' });
      setPassChangeId(null);
      setNewPass('');
      setConfirmPass('');
      setShowNewPass(false);
    }
  };

  const renderTable = (list: Reseller[], showApprove?: boolean) => (
    list.length === 0 ? (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          কোনো রিসেলার নেই।
        </CardContent>
      </Card>
    ) : (
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>আইডি</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead>ব্যালেন্স</TableHead>
                {!showApprove && <TableHead>নোট</TableHead>}
                <TableHead className="text-right">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{r.serialNumber || r.id.slice(0, 6)}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell>৳{r.balance}</TableCell>
                  {!showApprove && (
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {r.deactivationNote || '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-right space-x-1">
                    {showApprove ? (
                      <Button size="sm" onClick={() => handleApprove(r.id)} className="gap-1">
                        অনুমোদন করুন
                      </Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => window.open(`/reseller?as=${r.id}`, '_blank')} title="রিসেলার ড্যাশবোর্ড দেখুন">
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setPassChangeId(r.id)} title="পাসওয়ার্ড পরিবর্তন">
                          <KeyRound className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {r.isActive ? (
                          <Button size="sm" variant="outline" className="text-destructive text-xs" onClick={() => { setDeactivateId(r.id); setDeactivateNote(''); }}>
                            ডিএকটিভ
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-green-600 text-xs" onClick={() => handleActivate(r.id)}>
                            একটিভ করুন
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">All Resellers</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={resellers}
            filename="resellers"
            label="রিসেলার"
            onImport={(items: Reseller[]) => {
              items.forEach(r => {
                if (!resellers.find(er => er.id === r.id)) addReseller(r);
              });
            }}
          />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Reseller
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editId ? 'রিসেলার এডিট' : 'নতুন রিসেলার যোগ করুন'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>নাম</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="রিসেলারের নাম" />
                </div>
                <div className="space-y-2">
                  <Label>ইমেইল</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ইমেইল" />
                </div>
                <div className="space-y-2">
                  <Label>ফোন</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="ফোন নম্বর" />
                </div>
                <div className="space-y-2">
                  <Label>পাসওয়ার্ড</Label>
                  <div className="relative">
                    <Input type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="পাসওয়ার্ড" />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave}>{editId ? 'আপডেট করুন' : 'সেভ করুন'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Password change dialog */}
      <Dialog open={!!passChangeId} onOpenChange={(v) => { if (!v) { setPassChangeId(null); setNewPass(''); setConfirmPass(''); setShowNewPass(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> পাসওয়ার্ড পরিবর্তন</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resellers.find(r => r.id === passChangeId)?.name} — এর জন্য নতুন পাসওয়ার্ড সেট করুন
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>নতুন পাসওয়ার্ড</Label>
              <div className="relative">
                <Input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="নতুন পাসওয়ার্ড" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPass(!showNewPass)}>
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>পাসওয়ার্ড কনফার্ম করুন</Label>
              <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="আবার পাসওয়ার্ড দিন" />
            </div>
            <Button onClick={handlePasswordChange} className="w-full">পাসওয়ার্ড পরিবর্তন করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivation note dialog */}
      <Dialog open={!!deactivateId} onOpenChange={(v) => { if (!v) { setDeactivateId(null); setDeactivateNote(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ডিএকটিভ করার কারণ</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resellers.find(r => r.id === deactivateId)?.name} — কে কেন ডিএকটিভ করছেন?
          </p>
          <Textarea value={deactivateNote} onChange={(e) => setDeactivateNote(e.target.value)} placeholder="কারণ লিখুন..." rows={3} />
          <Button onClick={handleDeactivate} variant="destructive" className="w-full">ডিএকটিভ করুন</Button>
        </DialogContent>
      </Dialog>

      {/* Tabs: Pending / Active / Deactive */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="pending" className="relative">
            পেন্ডিং
            {pendingResellers.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {pendingResellers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">একটিভ ({activeResellers.length})</TabsTrigger>
          <TabsTrigger value="deactive">ডিএকটিভ ({deactiveResellers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderTable(pendingResellers, true)}</TabsContent>
        <TabsContent value="active">{renderTable(activeResellers)}</TabsContent>
        <TabsContent value="deactive">{renderTable(deactiveResellers)}</TabsContent>
      </Tabs>
    </div>
  );
};

export default AllResellers;
