import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Pencil, Trash2, CalendarIcon, TrendingDown, Wallet } from 'lucide-react';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { useExpenseStore, expenseCategories, Expense } from '@/stores/useExpenseStore';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useDepositStore } from '@/stores/useDepositStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { format, isToday, isYesterday, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const Expenses = () => {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore();
  const { employees } = useEmployeeStore();
  const { deposits } = useDepositStore();
  useLazyFetch([
    useExpenseStore.getState().fetchExpenses,
    useDepositStore.getState().fetchDeposits,
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({ title: '', category: '', amount: '', note: '', date: new Date(), employeeId: '' });
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [filterCategory, setFilterCategory] = useState('all');

  const filtered = useMemo(() => {
    let list = [...expenses];
    if (filterCategory !== 'all') list = list.filter((e) => e.category === filterCategory);
    const now = new Date();
    list = list.filter((e) => {
      const d = new Date(e.date);
      switch (dateFilter) {
        case 'today': return isToday(d);
        case 'yesterday': return isYesterday(d);
        case '7days': return d >= subDays(now, 7);
        case 'month': return d >= startOfMonth(now) && d <= endOfMonth(now);
        case 'lastMonth': { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
        case 'year': return d >= startOfYear(now);
        case 'custom': return (!customStart || d >= customStart) && (!customEnd || d <= new Date(customEnd.getTime() + 86400000));
        default: return true;
      }
    });
    return list;
  }, [expenses, dateFilter, filterCategory, customStart, customEnd]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);

  // Filter deposits by same date range
  const filteredDeposits = useMemo(() => {
    const now = new Date();
    return deposits.filter((dep) => {
      if (!dep.date) return dateFilter === 'all';
      const d = new Date(dep.date);
      switch (dateFilter) {
        case 'today': return isToday(d);
        case 'yesterday': return isYesterday(d);
        case '7days': return d >= subDays(now, 7);
        case 'month': return d >= startOfMonth(now) && d <= endOfMonth(now);
        case 'lastMonth': { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
        case 'year': return d >= startOfYear(now);
        case 'custom': return (!customStart || d >= customStart) && (!customEnd || d <= new Date(customEnd.getTime() + 86400000));
        default: return true;
      }
    });
  }, [deposits, dateFilter, customStart, customEnd]);

  const totalDeposit = filteredDeposits.reduce((s, d) => s + d.amount, 0);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const openAdd = () => {
    setEditingExpense(null);
    setForm({ title: '', category: expenseCategories[0], amount: '', note: '', date: new Date(), employeeId: '' });
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setForm({ title: e.title, category: e.category, amount: String(e.amount), note: e.note, date: new Date(e.date), employeeId: e.employeeId || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.amount) return;
    const data: any = { title: form.title, category: form.category, amount: Number(form.amount), note: form.note, date: form.date.toISOString() };
    if (form.employeeId) data.employeeId = form.employeeId;
    if (editingExpense) {
      updateExpense(editingExpense.id, data);
    } else {
      addExpense({ id: 'e' + Date.now(), ...data });
    }
    setDialogOpen(false);
  };

  const getEmployeeName = (id?: string) => {
    if (!id) return '';
    return employees.find(e => e.id === id)?.name || '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">খরচ হিসাব</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons data={expenses} filename="expenses" label="খরচ" onImport={(items: Expense[]) => { items.forEach(e => { if (!expenses.find(ex => ex.id === e.id)) addExpense(e); }); }} />
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> খরচ যোগ করুন</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-500/10 to-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-red-500/20">
                <TrendingDown className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-xs text-muted-foreground">মোট খরচ</p>
            </div>
            <p className="text-xl font-bold text-red-600">৳{totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground">মোট খাত</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{categoryTotals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xs text-muted-foreground">
                {filterCategory !== 'all' ? filterCategory : 'সর্বোচ্চ খরচ/একক'}
              </p>
            </div>
            {filterCategory !== 'all' ? (
              <p className="text-xl font-bold text-amber-600">
                ৳{filtered.filter(e => e.category === filterCategory).reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </p>
            ) : (
              <>
                <p className="text-xl font-bold text-amber-600">
                  ৳{filtered.length ? Math.max(...filtered.map(e => e.amount)).toLocaleString() : 0}
                </p>
                {filtered.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {filtered.reduce((max, e) => e.amount > max.amount ? e : max, filtered[0]).category}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryTotals.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">খাত অনুযায়ী খরচ</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {categoryTotals.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-foreground">{cat}</span>
                  </div>
                  <span className="font-semibold text-foreground">৳{amt.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <ToggleGroup type="single" value={dateFilter} onValueChange={(v) => v && setDateFilter(v)} className="flex-wrap">
          {[['all','সব'],['today','আজ'],['yesterday','গতকাল'],['7days','৭ দিন'],['month','এই মাস'],['lastMonth','গত মাস'],['year','এই বছর'],['custom','কাস্টম']].map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} size="sm" className="text-xs px-3 h-8">{l}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব খাত</SelectItem>
            {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex gap-2 items-center flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                {customStart ? format(customStart, 'dd/MM/yyyy') : 'শুরু'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">থেকে</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'শেষ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">তারিখ</TableHead>
                <TableHead className="text-xs">শিরোনাম</TableHead>
                <TableHead className="text-xs">খাত</TableHead>
                <TableHead className="text-xs">টিম মেম্বার</TableHead>
                <TableHead className="text-xs text-right">টাকা</TableHead>
                <TableHead className="text-xs">নোট</TableHead>
                <TableHead className="text-xs text-center">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো খরচ পাওয়া যায়নি</TableCell></TableRow>
              ) : filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs font-medium">{e.title}</TableCell>
                  <TableCell className="text-xs">{e.category}</TableCell>
                  <TableCell className="text-xs">{getEmployeeName(e.employeeId) || '-'}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">৳{e.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{e.note || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExpense(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'খরচ এডিট করুন' : 'নতুন খরচ যোগ করুন'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="শিরোনাম" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="খাত নির্বাচন" /></SelectTrigger>
              <SelectContent>{expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            {/* Team member selection */}
            <Select value={form.employeeId || 'none'} onValueChange={(v) => setForm({ ...form, employeeId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="টিম মেম্বার (ঐচ্ছিক)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">কোনো টিম মেম্বার নয়</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="টাকার পরিমাণ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="w-4 h-4 mr-2" />{format(form.date, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.date} onSelect={(d) => d && setForm({ ...form, date: d })} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Textarea placeholder="নোট / কারণ (ঐচ্ছিক)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave}>{editingExpense ? 'আপডেট' : 'সেভ করুন'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
