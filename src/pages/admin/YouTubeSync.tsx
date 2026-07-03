import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Youtube,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  useYouTubeSourceStore,
  type YouTubeSource,
} from '@/stores/useYouTubeSourceStore';
import { useBlogStore } from '@/stores/useBlogStore';

type SourceType = YouTubeSource['source_type'];

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  channel: 'চ্যানেল (API)',
  playlist: 'প্লেলিস্ট (API)',
  search: 'কীওয়ার্ড সার্চ (API)',
  rss: 'চ্যানেল (RSS - ফ্রি)',
};

const SOURCE_VALUE_PLACEHOLDER: Record<SourceType, string> = {
  channel: 'https://youtube.com/@channelname  বা  UCxxxxxxxxxxxxxxxxxxxxxx',
  playlist: 'প্লেলিস্ট URL বা ID (PLxxx...)',
  search: 'কীওয়ার্ড লিখুন (যেমন: "bangladesh tech review")',
  rss: 'চ্যানেল ID (UCxxx...) বা /channel/UCxxx URL',
};

const formatDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘন্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
};

const YouTubeSync = () => {
  const { sources, loading, fetchSources, addSource, updateSource, deleteSource } =
    useYouTubeSourceStore();
  const fetchPosts = useBlogStore((s) => s.fetchPosts);

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<YouTubeSource | null>(null);

  const [form, setForm] = useState({
    name: '',
    source_type: 'channel' as SourceType,
    source_value: '',
    category: '',
    author: '',
    max_videos: 20,
    exclude_shorts: true,
    enabled: true,
  });

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      source_type: 'channel',
      source_value: '',
      category: '',
      author: '',
      max_videos: 20,
      exclude_shorts: true,
      enabled: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (s: YouTubeSource) => {
    setEditing(s);
    setForm({
      name: s.name,
      source_type: s.source_type,
      source_value: s.source_value,
      category: s.category ?? '',
      author: s.author ?? '',
      max_videos: s.max_videos,
      exclude_shorts: s.exclude_shorts,
      enabled: s.enabled,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.source_value.trim()) {
      toast.error('নাম ও সোর্স ভ্যালু দিতে হবে');
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        source_type: form.source_type,
        source_value: form.source_value.trim(),
        category: form.category.trim() || null,
        author: form.author.trim() || null,
        max_videos: Number(form.max_videos) || 20,
        exclude_shorts: form.exclude_shorts,
        enabled: form.enabled,
      };
      if (editing) {
        await updateSource(editing.id, payload);
        toast.success('আপডেট হয়েছে');
      } else {
        await addSource(payload);
        toast.success('সোর্স যোগ হয়েছে');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'সেভ করা যায়নি');
    }
  };

  const handleDelete = async (s: YouTubeSource) => {
    if (!confirm(`"${s.name}" ডিলিট করবেন?\n(ইমপোর্ট হওয়া পোস্টগুলো থাকবে — শুধু সোর্স মুছবে)`)) return;
    try {
      await deleteSource(s.id);
      toast.success('ডিলিট হয়েছে');
    } catch (e: any) {
      toast.error(e?.message ?? 'ডিলিট করা যায়নি');
    }
  };

  const runSync = async (sourceId?: string) => {
    if (sourceId) setSyncingId(sourceId);
    else setSyncingAll(true);
    try {
      const data: any = await api.post(
        '/admin/mk/youtube-sync',
        sourceId ? { source_id: sourceId } : {}
      );
      if (data?.success === false) throw new Error(data.error || 'Sync failed');

      const imported = data?.total_imported ?? 0;
      const skipped = data?.total_skipped ?? 0;
      const errs: string[] = (data?.results ?? []).flatMap((r: any) => r.errors ?? []);

      if (imported > 0) {
        toast.success(`${imported}টি নতুন ভিডিও ইমপোর্ট হয়েছে`, {
          description: skipped > 0 ? `${skipped}টি ইতিমধ্যে আছে, স্কিপ হয়েছে` : undefined,
        });
      } else {
        toast.info(`কোনো নতুন ভিডিও পাওয়া যায়নি`, {
          description: skipped > 0 ? `${skipped}টি ইতিমধ্যে ইমপোর্ট করা` : undefined,
        });
      }
      if (errs.length > 0) {
        toast.warning(`${errs.length}টি error`, { description: errs[0]?.substring(0, 200) });
        console.warn('[youtube-sync] errors:', errs);
      }
      await fetchSources();
      await fetchPosts();
    } catch (e: any) {
      toast.error(e?.message ?? 'Sync ব্যর্থ');
    } finally {
      setSyncingAll(false);
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Youtube className="h-7 w-7 text-red-600" />
            YouTube Auto-Import
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            YouTube থেকে অটোমেটিক ভিডিও এনে ব্লগ পোস্ট হিসেবে যোগ করুন
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNew} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            নতুন সোর্স
          </Button>
          <Button onClick={() => runSync()} disabled={syncingAll || sources.length === 0}>
            {syncingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            সব Sync করুন
          </Button>
        </div>
      </div>

      {/* Setup info card */}
      <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="pt-5 pb-5 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-semibold">সেটআপ ইনফরমেশন:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>RSS mode:</strong> কোনো API key লাগবে না — সর্বশেষ 15টি ভিডিও আনবে
              </li>
              <li>
                <strong>API mode (Channel/Playlist/Search):</strong> সার্ভার .env-এ{' '}
                <code className="px-1 bg-muted rounded">YOUTUBE_API_KEY</code> যোগ করতে হবে
              </li>
              <li>
                API Key ফ্রিতে নেওয়া যায়{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="h-3 w-3" />
                </a>{' '}
                থেকে
              </li>
              <li>নতুন ভিডিও সরাসরি <Badge variant="outline">Published</Badge> হিসেবে যোগ হবে</li>
              <li>একই ভিডিও দুইবার ইমপোর্ট হবে না (duplicate prevention)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Sources list */}
      <Card>
        <CardHeader>
          <CardTitle>সোর্স তালিকা ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে...
            </div>
          ) : sources.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Youtube className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>এখনো কোনো সোর্স যোগ করা হয়নি</p>
              <Button onClick={openNew} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                প্রথম সোর্স যোগ করুন
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {SOURCE_TYPE_LABEL[s.source_type]}
                      </Badge>
                      {!s.enabled && <Badge variant="outline">Disabled</Badge>}
                      {s.exclude_shorts && (
                        <Badge variant="outline" className="text-xs">
                          Shorts বাদ
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
                      {s.source_value}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      {s.category && <span>📁 {s.category}</span>}
                      {s.author && <span>👤 {s.author}</span>}
                      <span>📊 max {s.max_videos}</span>
                      <span className="flex items-center gap-1">
                        {s.last_synced_at ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : null}
                        শেষ sync: {formatDate(s.last_synced_at)}
                        {s.last_synced_at && ` (+${s.last_sync_count})`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => runSync(s.id)}
                      disabled={syncingId === s.id || syncingAll}
                    >
                      {syncingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">Sync</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(s)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'সোর্স এডিট করুন' : 'নতুন সোর্স যোগ করুন'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>নাম (অ্যাডমিন রেফারেন্স)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="যেমন: Tech Channel BD"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>সোর্স ধরন</Label>
              <Select
                value={form.source_type}
                onValueChange={(v) => setForm({ ...form, source_type: v as SourceType })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rss">{SOURCE_TYPE_LABEL.rss}</SelectItem>
                  <SelectItem value="channel">{SOURCE_TYPE_LABEL.channel}</SelectItem>
                  <SelectItem value="playlist">{SOURCE_TYPE_LABEL.playlist}</SelectItem>
                  <SelectItem value="search">{SOURCE_TYPE_LABEL.search}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                💡 RSS = সহজ, ফ্রি, কিন্তু সর্বশেষ 15টা ভিডিও মাত্র। API = সব ফিচার, কিন্তু{' '}
                <code>YOUTUBE_API_KEY</code> লাগবে।
              </p>
            </div>

            <div>
              <Label>সোর্স ভ্যালু</Label>
              <Input
                value={form.source_value}
                onChange={(e) => setForm({ ...form, source_value: e.target.value })}
                placeholder={SOURCE_VALUE_PLACEHOLDER[form.source_type]}
                className="mt-1.5 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ক্যাটাগরি (অপশনাল)</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="যেমন: টেক"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>লেখক (অপশনাল)</Label>
                <Input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="যেমন: BongoBe"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>সর্বোচ্চ ভিডিও সংখ্যা</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.max_videos}
                onChange={(e) =>
                  setForm({ ...form, max_videos: parseInt(e.target.value) || 20 })
                }
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                প্রতি sync-এ এই সোর্স থেকে সর্বোচ্চ কতগুলো ভিডিও চেক হবে
              </p>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="cursor-pointer">Shorts বাদ দিন</Label>
                <p className="text-xs text-muted-foreground">60 সেকেন্ডের কম ভিডিও স্কিপ হবে</p>
              </div>
              <Switch
                checked={form.exclude_shorts}
                onCheckedChange={(v) => setForm({ ...form, exclude_shorts: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="cursor-pointer">Enabled</Label>
                <p className="text-xs text-muted-foreground">"সব Sync করুন"-এ এটা কভার হবে</p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              বাতিল
            </Button>
            <Button onClick={handleSave}>{editing ? 'আপডেট' : 'যোগ করুন'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default YouTubeSync;