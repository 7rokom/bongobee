import { useState, useMemo } from 'react';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, ChevronDown, ChevronRight, CheckCircle2, XCircle, Truck, RotateCcw, PauseCircle, Package, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type DateFilter = 'today' | 'yesterday' | '7days' | 'this_month' | 'last_month' | 'custom';

const filterLabels: Record<DateFilter, string> = {
  today: 'আজকে',
  yesterday: 'গতকাল',
  '7days': 'গত ৭ দিন',
  this_month: 'এই মাস',
  last_month: 'গত মাস',
  custom: 'কাস্টম',
};

const EmployeeReport = () => {
  const { employees } = useEmployeeStore();
  const { orders } = useOrderStore();
  const resellerOrders = useResellerStore((s) => s.orders);
  const { expenses } = useExpenseStore();
  useLazyFetch([
    useEmployeeStore.getState().fetchActivities,
    useExpenseStore.getState().fetchExpenses,
  ]);
  const [filter, setFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (filter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday': return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case '7days': return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case 'this_month': return { start: startOfMonth(now), end: endOfDay(now) };
      case 'last_month': { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
      case 'custom': return { start: customStart ? startOfDay(customStart) : startOfDay(now), end: customEnd ? endOfDay(customEnd) : endOfDay(now) };
    }
  }, [filter, customStart, customEnd]);

  // Count assigned orders per employee with status breakdown
  const summaryByEmployee = useMemo(() => {
    const ADMIN_ENTRY = { id: '__admin__', name: 'অ্যাডমিন' } as any;
    const allEntries = [ADMIN_ENTRY, ...employees];
    const filteredEmps = selectedEmployee === 'all' ? allEntries : allEntries.filter(e => e.id === selectedEmployee);
    
    return filteredEmps.map(emp => {
      const inDateRange = (o: any) => {
        const dateStr = o.isoDate || o.date;
        const orderDate = new Date(dateStr);
        if (isNaN(orderDate.getTime())) return true;
        return orderDate >= dateRange.start && orderDate <= dateRange.end;
      };

      // Orders directly assigned OR self-confirmed by this employee (dedup by id)
      const empNameNorm = (emp.name || '').trim().toLowerCase();
      const isAdminEntry = emp.id === '__admin__';
      const matchesConfirmer = (val?: string) => {
        const v = (val || '').trim().toLowerCase();
        if (!v) return false;
        if (!!empNameNorm && v === empNameNorm) return true;
        // Auto-confirmed (customer chose "direct ship") counts towards admin.
        if (isAdminEntry && v === 'অটোমেটিক') return true;
        return false;
      };
      const map = new Map<string, any>();
      orders.forEach((o) => {
        if (!inDateRange(o)) return;
        const isAssignedById = o.assignedTo && o.assignedTo === emp.id;
        const isAssignedByName = !!empNameNorm && (o.assignedToName || '').trim().toLowerCase() === empNameNorm;
        const isSelfConfirmed = matchesConfirmer(o.confirmedBy);
        if (isAssignedById || isAssignedByName || isSelfConfirmed) map.set(o.id, o);
      });
      const assignedOrders = Array.from(map.values());

      const selfConfirmedCount = assignedOrders.filter((o) => matchesConfirmer(o.confirmedBy)).length;
      const autoConfirmedCount = isAdminEntry
        ? assignedOrders.filter((o) => (o.confirmedBy || '').trim().toLowerCase() === 'অটোমেটিক').length
        : 0;

      // Reseller orders assigned to this employee
      const rMap = new Map<string, any>();
      resellerOrders.forEach((o: any) => {
        if (!inDateRange(o)) return;
        const isAssignedById = o.assignedTo && o.assignedTo === emp.id;
        const isAssignedByName = !!empNameNorm && (o.assignedToName || '').trim().toLowerCase() === empNameNorm;
        const isSelfConfirmed = matchesConfirmer(o.confirmedBy);
        if (isAssignedById || isAssignedByName || isSelfConfirmed) rMap.set(o.id, o);
      });
      const resellerAssignedOrders = Array.from(rMap.values());
      const resellerAutoConfirmedCount = isAdminEntry
        ? resellerAssignedOrders.filter((o) => (o.confirmedBy || '').trim().toLowerCase() === 'অটোমেটিক').length
        : 0;

      // Status counts — separated for main and reseller orders
      const buildStats = (list: any[]) => {
        const c = (s: string) => list.filter(o => o.status === s).length;
        return {
          assigned: list.length,
          pending: c('পেন্ডিং'),
          hold: c('হোল্ড'),
          confirmed: c('কনফার্মড'),
          packaging: c('প্যাকেজিং'),
          shipment: c('শিপমেন্ট'),
          assignStatus: c('এসাইন'),
          followup: c('ফলোআপ') + c('ফলোয়াপ'),
          delivered: c('ডেলিভারড'),
          cancelled: c('ক্যান্সেল'),
          returned: c('রিটার্ন'),
          paidReturn: c('পেইড রিটার্ন'),
        };
      };
      const mainStats = buildStats(assignedOrders);
      const resellerStats = buildStats(resellerAssignedOrders);
      // Combined (legacy fields used by per-employee badges below)
      const combined = [...assignedOrders, ...resellerAssignedOrders];
      const countStatus = (s: string) => combined.filter(o => o.status === s).length;
      const assigned = combined.length;
      const pending = countStatus('পেন্ডিং');
      const hold = countStatus('হোল্ড');
      const confirmed = countStatus('কনফার্মড');
      const packaging = countStatus('প্যাকেজিং');
      const shipment = countStatus('শিপমেন্ট');
      const assignStatus = countStatus('এসাইন');
      const followup = countStatus('ফলোআপ') + countStatus('ফলোয়াপ');
      const delivered = countStatus('ডেলিভারড');
      const cancelled = countStatus('ক্যান্সেল');
      const returned = countStatus('রিটার্ন');
      const paidReturn = countStatus('পেইড রিটার্ন');

      const totalPrice = assignedOrders.reduce((s, o) => s + o.total, 0);
      const confirmedPrice = assignedOrders.filter(o => o.status === 'কনফার্মড').reduce((s, o) => s + o.total, 0);
      const deliveredPrice = assignedOrders.filter(o => o.status === 'ডেলিভারড').reduce((s, o) => s + o.total, 0);

      const resellerAssigned = resellerAssignedOrders.length;
      const resellerConfirmed = resellerAssignedOrders.filter(o => o.status === 'কনফার্মড').length;
      const resellerDelivered = resellerAssignedOrders.filter(o => o.status === 'ডেলিভারড').length;

      // Payments to this employee
      const empPayments = expenses.filter(e => {
        if (e.employeeId !== emp.id) return false;
        const payDate = new Date(e.date);
        return payDate >= dateRange.start && payDate <= dateRange.end;
      });

      return {
        id: emp.id, name: emp.name,
        assigned, selfConfirmedCount,
        autoConfirmedCount, resellerAutoConfirmedCount,
        pending, hold, confirmed, packaging, shipment, assignStatus, followup,
        delivered, cancelled, returned, paidReturn,
        totalPrice, confirmedPrice, deliveredPrice,
        assignedOrders, payments: empPayments,
        resellerAssigned, resellerConfirmed, resellerDelivered, resellerAssignedOrders,
        mainStats, resellerStats,
      };
    }).sort((a, b) => b.assigned - a.assigned);
  }, [employees, orders, resellerOrders, expenses, selectedEmployee, dateRange]);

  const totalStats = useMemo(() => {
    const all = summaryByEmployee;
    const sumKey = (src: 'mainStats' | 'resellerStats', k: string) =>
      all.reduce((s, e) => s + ((e[src] as any)[k] as number), 0);
    const make = (src: 'mainStats' | 'resellerStats') => ({
      assigned: sumKey(src, 'assigned'),
      pending: sumKey(src, 'pending'),
      hold: sumKey(src, 'hold'),
      confirmed: sumKey(src, 'confirmed'),
      packaging: sumKey(src, 'packaging'),
      shipment: sumKey(src, 'shipment'),
      assignStatus: sumKey(src, 'assignStatus'),
      followup: sumKey(src, 'followup'),
      delivered: sumKey(src, 'delivered'),
      cancelled: sumKey(src, 'cancelled'),
      returned: sumKey(src, 'returned'),
      paidReturn: sumKey(src, 'paidReturn'),
    });
    return { main: make('mainStats'), reseller: make('resellerStats') };
  }, [summaryByEmployee]);


  const formatPrice = (n: number) => `৳${n.toLocaleString('bn-BD')}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">টিম রিপোর্ট</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(filterLabels) as DateFilter[]).map((key) => (
          <Button key={key} variant={filter === key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(key)}>
            {filterLabels[key]}
          </Button>
        ))}
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="সব টিম মেম্বার" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব টিম মেম্বার</SelectItem>
            <SelectItem value="__admin__">অ্যাডমিন</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filter === 'custom' && (
        <div className="flex flex-wrap gap-3 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('gap-2', !customStart && 'text-muted-foreground')}>
                <CalendarIcon className="w-4 h-4" />
                {customStart ? format(customStart, 'dd/MM/yyyy') : 'শুরু তারিখ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('gap-2', !customEnd && 'text-muted-foreground')}>
                <CalendarIcon className="w-4 h-4" />
                {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'শেষ তারিখ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Summary Cards — two rows: main orders and reseller orders */}
      {([
        { title: 'মেইন অর্ডার এক্টিভিটি', stats: totalStats.main },
        { title: 'রিসেলার অর্ডার এক্টিভিটি', stats: totalStats.reseller },
      ] as const).map((row) => (
        <div key={row.title} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{row.title}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
            {[
              { label: 'মোট এসাইন', value: row.stats.assigned, cls: 'text-foreground', bg: '' },
              { label: 'পেন্ডিং', value: row.stats.pending, cls: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'হোল্ড', value: row.stats.hold, cls: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'কনফার্মড', value: row.stats.confirmed, cls: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'প্যাকেজিং', value: row.stats.packaging, cls: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'শিপমেন্ট', value: row.stats.shipment, cls: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'এসাইন', value: row.stats.assignStatus, cls: 'text-cyan-700', bg: 'bg-cyan-50' },
              { label: 'ফলোয়াপ', value: row.stats.followup, cls: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'ডেলিভারড', value: row.stats.delivered, cls: 'text-green-700', bg: 'bg-green-50' },
              { label: 'ক্যান্সেল', value: row.stats.cancelled, cls: 'text-red-700', bg: 'bg-red-50' },
              { label: 'রিটার্ন', value: row.stats.returned, cls: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'পেইড রিটার্ন', value: row.stats.paidReturn, cls: 'text-pink-700', bg: 'bg-pink-50' },
            ].map((s) => (
              <Card key={s.label} className={cn('border-0 shadow-sm', s.bg)}>
                <CardContent className="p-4 text-center">
                  <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
                  <p className="text-sm font-medium text-muted-foreground leading-tight">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Employee-wise Breakdown */}
      {summaryByEmployee.length > 0 ? (
        <div className="space-y-3">
          {summaryByEmployee.map((emp) => (
            <Card key={emp.id} className="border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedEmployee(expandedEmployee === emp.id ? null : emp.id)}
                className="w-full text-left"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {expandedEmployee === emp.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="font-semibold text-foreground">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          মোট: {emp.assigned}টি · নিজে কনফার্ম: {emp.selfConfirmedCount}টি
                          {(emp.autoConfirmedCount + emp.resellerAutoConfirmedCount) > 0 && (
                            <> · অটোমেটিক কনফার্ম: {emp.autoConfirmedCount + emp.resellerAutoConfirmedCount}টি</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {emp.pending > 0 && <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 text-[10px]">পেন্ডিং: {emp.pending}</Badge>}
                      {emp.hold > 0 && <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px]">হোল্ড: {emp.hold}</Badge>}
                      {emp.confirmed > 0 && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">কনফার্মড: {emp.confirmed}</Badge>}
                      {emp.packaging > 0 && <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-[10px]">প্যাকেজিং: {emp.packaging}</Badge>}
                      {emp.shipment > 0 && <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px]">শিপমেন্ট: {emp.shipment}</Badge>}
                      {emp.assignStatus > 0 && <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100 text-[10px]">এসাইন: {emp.assignStatus}</Badge>}
                      {emp.followup > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">ফলোয়াপ: {emp.followup}</Badge>}
                      {emp.delivered > 0 && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px]">ডেলিভারড: {emp.delivered}</Badge>}
                      {emp.cancelled > 0 && <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">ক্যান্সেল: {emp.cancelled}</Badge>}
                      {emp.returned > 0 && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-[10px]">রিটার্ন: {emp.returned}</Badge>}
                      {emp.paidReturn > 0 && <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-100 text-[10px]">পেইড রিটার্ন: {emp.paidReturn}</Badge>}
                      {emp.resellerAssigned > 0 && <Badge className="bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100 text-[10px]">রিসেলার মোট: {emp.resellerAssigned}</Badge>}
                    </div>
                  </div>
                </CardContent>
              </button>

              {expandedEmployee === emp.id && (
                <div className="border-t border-border">
                  {/* Assigned Orders */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>অর্ডার</TableHead>
                          <TableHead>কাস্টমার</TableHead>
                          <TableHead>মূল্য</TableHead>
                          <TableHead>স্ট্যাটাস</TableHead>
                          <TableHead>কনফার্মকারী</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emp.assignedOrders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="text-xs font-medium text-primary">{o.id}</TableCell>
                            <TableCell className="text-xs">{o.customer}</TableCell>
                            <TableCell className="text-xs font-medium">৳{o.total.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{o.confirmedBy || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Reseller orders assigned */}
                  {emp.resellerAssignedOrders.length > 0 && (
                    <div className="border-t border-border p-4">
                      <p className="text-sm font-semibold mb-3">রিসেলার অর্ডার (এসাইনকৃত): {emp.resellerAssigned}টি</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>অর্ডার</TableHead>
                              <TableHead>রিসেলার</TableHead>
                              <TableHead>কাস্টমার</TableHead>
                              <TableHead>মূল্য</TableHead>
                              <TableHead>স্ট্যাটাস</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emp.resellerAssignedOrders.map((o: any) => (
                              <TableRow key={o.id}>
                                <TableCell className="text-xs font-medium text-primary">{o.id}</TableCell>
                                <TableCell className="text-xs">{o.resellerName}</TableCell>
                                <TableCell className="text-xs">{o.customerName}</TableCell>
                                <TableCell className="text-xs font-medium">৳{Number(o.totalSellingPrice).toLocaleString()}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px]">{o.status}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Payments to this employee */}
                  {emp.payments.length > 0 && (
                    <div className="border-t border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Wallet className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold">তাকে দেওয়া পেমেন্ট</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">তারিখ</TableHead>
                            <TableHead className="text-xs">টাকা</TableHead>
                            <TableHead className="text-xs">কারণ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emp.payments.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{format(new Date(p.date), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="text-xs font-semibold text-destructive">৳{p.amount.toLocaleString()}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.title} {p.note ? `— ${p.note}` : ''}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="text-xs font-bold">মোট</TableCell>
                            <TableCell className="text-xs font-bold text-destructive">৳{emp.payments.reduce((s, p) => s + p.amount, 0).toLocaleString()}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            এই সময়সীমায় কোনো এস্যাইন পাওয়া যায়নি।
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeeReport;
