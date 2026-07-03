import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Search, CheckCircle, XCircle, EyeOff, Trash2, RefreshCw } from 'lucide-react';

interface DomainRecord {
  id: number;
  reseller_id: string;
  domain: string;
  is_primary: boolean;
  status: 'pending' | 'verified' | 'failed' | 'inactive';
  ssl_status: string;
  verified_at: string | null;
  created_at: string;
  reseller?: { id: string; name: string; email: string };
}

interface Paginated {
  data: DomainRecord[];
  current_page: number;
  last_page: number;
  total: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'পেন্ডিং',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  verified: { label: 'যাচাইকৃত',  cls: 'bg-green-100 text-green-800 border-green-200' },
  failed:   { label: 'ব্যর্থ',     cls: 'bg-red-100 text-red-800 border-red-200' },
  inactive: { label: 'নিষ্ক্রিয়', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const ResellerDomains = () => {
  const [result, setResult] = useState<Paginated | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get(`/admin/reseller-domains?${params}`);
      setResult(data);
    } catch {
      toast({ title: 'ডেটা লোড ব্যর্থ।', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (
    id: number,
    action: 'approve' | 'reject' | 'disable' | 'delete',
  ) => {
    if (action === 'delete' && !confirm('এই ডোমেইন মুছতে চান?')) return;
    setActionId(id);
    try {
      if (action === 'delete') {
        await api.delete(`/admin/reseller-domains/${id}`);
      } else {
        await api.post(`/admin/reseller-domains/${id}/${action}`, {});
      }
      toast({ title: 'সম্পন্ন হয়েছে।' });
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'ক্রিয়া ব্যর্থ।';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">রিসেলার ডোমেইনসমূহ</h1>
        <Button size="sm" variant="outline" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> রিফ্রেশ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ডোমেইন বা রিসেলার খুঁজুন…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">সব স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং</option>
          <option value="verified">যাচাইকৃত</option>
          <option value="failed">ব্যর্থ</option>
          <option value="inactive">নিষ্ক্রিয়</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-7 w-7 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !result || result.data.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">কোন ডোমেইন পাওয়া যায়নি।</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ডোমেইন</th>
                    <th className="px-4 py-3 text-left font-medium">রিসেলার</th>
                    <th className="px-4 py-3 text-left font-medium">স্ট্যাটাস</th>
                    <th className="px-4 py-3 text-left font-medium">SSL</th>
                    <th className="px-4 py-3 text-left font-medium">যোগ করা হয়েছে</th>
                    <th className="px-4 py-3 text-right font-medium">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.data.map((row) => {
                    const sc = STATUS_LABELS[row.status] ?? STATUS_LABELS.pending;
                    const busy = actionId === row.id;
                    return (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono">{row.domain}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.reseller?.name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{row.reseller?.email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${sc.cls}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.ssl_status === 'none' ? '—' : row.ssl_status}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString('bn-BD')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {row.status !== 'verified' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                disabled={busy}
                                onClick={() => handleAction(row.id, 'approve')}
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> অনুমোদন
                              </Button>
                            )}
                            {row.status !== 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-700 border-red-200 hover:bg-red-50"
                                disabled={busy}
                                onClick={() => handleAction(row.id, 'reject')}
                              >
                                <XCircle className="h-3.5 w-3.5" /> বাতিল
                              </Button>
                            )}
                            {row.status !== 'inactive' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-gray-700"
                                disabled={busy}
                                onClick={() => handleAction(row.id, 'disable')}
                              >
                                <EyeOff className="h-3.5 w-3.5" /> বন্ধ
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              disabled={busy}
                              onClick={() => handleAction(row.id, 'delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {result && result.last_page > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            আগে
          </Button>
          <span className="text-sm flex items-center px-2 text-muted-foreground">
            {page} / {result.last_page}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= result.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            পরে
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResellerDomains;
