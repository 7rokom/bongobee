import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDigitalOrderStore } from '@/stores/useDigitalOrderStore';
import { useDigitalBlockStore, type BlockType } from '@/stores/useDigitalBlockStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Search, Phone, Mail, Trash2, ShieldOff, Ban, ChevronDown, Globe, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

interface Row { id: string; name: string; email: string; phone?: string; address?: string; created_at: string; }

const DigitalUsers = () => {
  const [users, setUsers] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [confirmDelete2, setConfirmDelete2] = useState<Row | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ user: Row; type: BlockType; value: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const { orders, fetchAll: fetchOrders } = useDigitalOrderStore();
  const { blocks, fetchAll: fetchBlocks, add: addBlock, remove: removeBlock } = useDigitalBlockStore();

  const loadUsers = async () => {
    try { const data = await api.get('/admin/digital-fe/users'); if (Array.isArray(data)) setUsers(data); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUsers();
    fetchOrders();
    fetchBlocks();
  }, [fetchOrders, fetchBlocks]);

  const filtered = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search)
  );

  const orderCount = (userId: string) => orders.filter((o) => o.userId === userId).length;
  const confirmedCount = (userId: string) => orders.filter((o) => o.userId === userId && o.status === 'কনফার্মড').length;
  const lastOrderOf = (userId: string) => orders.find((o) => o.userId === userId);

  const findBlock = (type: BlockType, value: string) =>
    value ? blocks.find((b) => b.blockType === type && b.blockValue === value) : undefined;

  const getBlockValue = (user: Row, type: BlockType): string => {
    const last = lastOrderOf(user.id);
    if (type === 'user') return user.id;
    if (type === 'phone') return user.phone || '';
    if (type === 'ip') return last?.customerIp || '';
    if (type === 'fingerprint') return last?.customerFingerprint || '';
    return '';
  };

  const isUserBlocked = (u: Row) => {
    return (['user','phone','ip','fingerprint'] as BlockType[]).some((t) => !!findBlock(t, getBlockValue(u, t)));
  };

  const handleDelete = async () => {
    if (!confirmDelete2) return;
    let error: any = null;
    try { await api.del(`/admin/digital-fe/users/${confirmDelete2.id}`); } catch (e) { error = e; }
    if (error) { toast.error('ডিলিট ব্যর্থ: ' + error.message); return; }
    setUsers((prev) => prev.filter((u) => u.id !== confirmDelete2.id));
    toast.success('ইউজার ডিলিট হয়েছে');
    setConfirmDelete2(null);
  };

  const toggleBlock = async (user: Row, type: BlockType) => {
    const value = getBlockValue(user, type);
    if (!value) {
      toast.error(
        type === 'ip' || type === 'fingerprint'
          ? 'এই ইউজারের কোনো অর্ডার নেই, তাই IP/ফিঙ্গারপ্রিন্ট পাওয়া যায়নি'
          : 'মান পাওয়া যায়নি'
      );
      return;
    }
    const existing = findBlock(type, value);
    if (existing) {
      await removeBlock(existing.id);
      toast.success('আনব্লক হয়েছে');
      return;
    }
    setBlockReason('');
    setBlockTarget({ user, type, value });
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    const r = await addBlock({
      userId: blockTarget.user.id,
      blockType: blockTarget.type,
      blockValue: blockTarget.value,
      reason: blockReason || undefined,
    });
    if (!r.ok) { toast.error(r.error || 'ব্লক ব্যর্থ'); return; }
    toast.success('ব্লক করা হয়েছে');
    setBlockTarget(null);
  };

  const typeLabel: Record<BlockType, string> = {
    user: 'সম্পূর্ণ ইউজার', phone: 'ফোন', ip: 'IP', fingerprint: 'ফিঙ্গারপ্রিন্ট',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ডিজিটাল ইউজার</h1>
        <p className="text-sm text-muted-foreground">মোট: {users.length} | ব্লকড এন্ট্রি: {blocks.length}</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">ইউজার ({users.length})</TabsTrigger>
          <TabsTrigger value="blocked">ব্লকড লিস্ট ({blocks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="সার্চ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="grid gap-3">
            {filtered.length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground">কোন ইউজার নেই</CardContent></Card>
            )}
            {filtered.map((u) => {
              const blocked = isUserBlocked(u);
              const last = lastOrderOf(u.id);
              return (
                <Card key={u.id} className={blocked ? 'border-destructive/50' : ''}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{u.name}</h3>
                          {blocked && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> ব্লকড</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                          {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
                        </div>
                        {last?.customerIp && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Globe className="h-3 w-3" /> IP: <span className="font-mono">{last.customerIp}</span>
                          </p>
                        )}
                        {last?.customerFingerprint && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" /> FP: <span className="font-mono">{last.customerFingerprint}</span>
                          </p>
                        )}
                        {u.address && <p className="text-xs text-muted-foreground mt-1">{u.address}</p>}
                        <p className="text-xs text-muted-foreground mt-1">যোগ: {new Date(u.created_at).toLocaleDateString('bn-BD')}</p>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge variant="outline">মোট অর্ডার: {orderCount(u.id)}</Badge>
                        <Badge>কনফার্মড: {confirmedCount(u.id)}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant={blocked ? 'destructive' : 'outline'} className="gap-1">
                            <Ban className="h-4 w-4" /> ব্লক/আনব্লক <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>ক্লিক করে টগল করুন</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(['user','phone','ip','fingerprint'] as BlockType[]).map((t) => {
                            const val = getBlockValue(u, t);
                            const existing = findBlock(t, val);
                            const disabled = !val;
                            const label = typeLabel[t];
                            return (
                              <DropdownMenuItem
                                key={t}
                                onClick={() => toggleBlock(u, t)}
                                disabled={disabled}
                                className={existing ? 'text-destructive font-semibold' : ''}
                              >
                                {existing ? `আনব্লক করুন — ${label}` : `${label} ব্লক করুন`}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(u)}>
                        <Trash2 className="h-4 w-4 mr-1" /> ডিলিট
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-3 mt-4">
          {blocks.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">কোনো ব্লকড এন্ট্রি নেই</CardContent></Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`সব ${blocks.length} টি ব্লক রিমুভ করবেন?`)) return;
                    const ids = blocks.map((b) => b.id);
                    for (const id of ids) await removeBlock(id);
                    toast.success('সবাইকে আনব্লক করা হয়েছে');
                  }}
                >
                  <ShieldOff className="h-4 w-4 mr-1" /> সব আনব্লক করুন ({blocks.length})
                </Button>
              </div>
              {blocks.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="destructive">{typeLabel[b.blockType]}</Badge>
                        <span className="font-mono text-sm truncate">{b.blockValue}</span>
                      </div>
                      {b.reason && <p className="text-xs text-muted-foreground">কারণ: {b.reason}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString('bn-BD')}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={async () => { await removeBlock(b.id); toast.success('আনব্লক হয়েছে'); }}>
                      <ShieldOff className="h-4 w-4 mr-1" /> আনব্লক
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete user confirm step 1 */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ইউজার ডিলিট করবেন?</DialogTitle></DialogHeader>
          <p>{confirmDelete?.name} ({confirmDelete?.email}) ডিলিট হবে। এই কাজটি ফেরানো যাবে না।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete2(confirmDelete); setConfirmDelete(null); }}>হ্যাঁ, ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirm step 2 */}
      <Dialog open={!!confirmDelete2} onOpenChange={(o) => !o && setConfirmDelete2(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>আপনি কি নিশ্চিত?</DialogTitle></DialogHeader>
          <p>চূড়ান্তভাবে এই ইউজার ডিলিট হয়ে যাবে। আবার নিশ্চিত করুন।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete2(null)}>না</Button>
            <Button variant="destructive" onClick={handleDelete}>হ্যাঁ, কনফার্ম ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block confirm */}
      <Dialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{blockTarget && typeLabel[blockTarget.type]} ব্লক করবেন?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">মান: </span>
              <span className="font-mono font-semibold break-all">{blockTarget?.value}</span>
            </div>
            <div>
              <label className="text-sm font-medium">কারণ (ঐচ্ছিক)</label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="যেমন: ফ্রড অর্ডার" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={confirmBlock}>ব্লক করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalUsers;
