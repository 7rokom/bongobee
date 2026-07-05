import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Trash2, Copy, ImageIcon, Volume2, Video, Search, Check, Loader2 } from 'lucide-react';

interface MediaFile {
  path: string;
  url: string;
  name: string;
  folder: string;
  size: number;
  type: 'image' | 'audio' | 'video' | 'other';
  last_modified: number;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const FILTERS = [
  { key: 'all', label: 'সব' },
  { key: 'image', label: 'ছবি', Icon: ImageIcon },
  { key: 'audio', label: 'অডিও', Icon: Volume2 },
  { key: 'video', label: 'ভিডিও', Icon: Video },
] as const;

const MediaManager = () => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'audio' | 'video'>('all');
  const [search, setSearch] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<MediaFile[]>('/admin/media');
      setFiles(data);
    } catch {
      toast.error('মিডিয়া লোড ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    setUploading(true);
    let count = 0;
    try {
      for (let i = 0; i < selected.length; i++) {
        const fd = new FormData();
        fd.append('file', selected[i]);
        const res = await api.post<MediaFile>('/admin/media/upload', fd);
        setFiles(prev => [res, ...prev]);
        count++;
      }
      toast.success(`${count}টি ফাইল আপলোড হয়েছে`);
    } catch {
      toast.error('আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.post('/admin/media/delete', { path: deleteTarget.path });
      setFiles(prev => prev.filter(f => f.path !== deleteTarget.path));
      toast.success('ফাইল ডিলিট হয়েছে');
      setDeleteTarget(null);
    } catch {
      toast.error('ডিলিট ব্যর্থ হয়েছে');
    } finally {
      setDeleting(false);
    }
  };

  const copyUrl = (url: string, path: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    });
  };

  const filtered = files.filter(f => {
    if (filter !== 'all' && f.type !== filter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: files.length,
    image: files.filter(f => f.type === 'image').length,
    audio: files.filter(f => f.type === 'audio').length,
    video: files.filter(f => f.type === 'video').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">মিডিয়া ম্যানেজার</h1>
          <p className="text-sm text-muted-foreground mt-1">আপলোড করা সব ছবি, অডিও ও ভিডিও এখানে দেখুন ও ম্যানেজ করুন</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple accept="image/*,audio/*,video/*" className="hidden" onChange={handleUpload} />
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'আপলোড হচ্ছে...' : 'ফাইল আপলোড'}
          </Button>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label, Icon }: any) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${filter === key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {counts[key as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ফাইলের নাম খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-border">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-2 space-y-1">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{files.length === 0 ? 'এখনো কোনো মিডিয়া আপলোড হয়নি' : 'কোনো ফলাফল পাওয়া যায়নি'}</p>
          {files.length === 0 && (
            <p className="text-sm mt-1">উপরের "ফাইল আপলোড" বাটন দিয়ে শুরু করুন</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((file) => (
            <div
              key={file.path}
              className="group relative border border-border rounded-lg overflow-hidden bg-card hover:border-primary/50 transition-colors"
            >
              {/* Thumbnail area */}
              <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                {file.type === 'image' ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : file.type === 'audio' ? (
                  <div className="flex flex-col items-center gap-2 p-3">
                    <Volume2 className="w-12 h-12 text-primary/50" />
                    <span className="text-[10px] text-muted-foreground text-center truncate w-full uppercase">
                      .{file.name.split('.').pop()}
                    </span>
                  </div>
                ) : file.type === 'video' ? (
                  <div className="flex flex-col items-center gap-2 p-3">
                    <Video className="w-12 h-12 text-primary/50" />
                    <span className="text-[10px] text-muted-foreground text-center truncate w-full uppercase">
                      .{file.name.split('.').pop()}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">📄</span>
                    <span className="text-[10px] text-muted-foreground uppercase">.{file.name.split('.').pop()}</span>
                  </div>
                )}

                {/* Hover action overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => copyUrl(file.url, file.path)}
                    className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                    title="URL কপি করুন"
                  >
                    {copiedPath === file.path
                      ? <Check className="w-4 h-4 text-green-600" />
                      : <Copy className="w-4 h-4 text-gray-800" />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(file)}
                    className="p-2 bg-white/90 rounded-lg hover:bg-red-50 transition-colors"
                    title="ডিলিট করুন"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>

              {/* File info */}
              <div className="p-2">
                <p className="text-xs font-medium truncate leading-snug" title={file.name}>{file.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-background border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">ফাইল ডিলিট করুন?</h3>
                <p className="text-sm text-muted-foreground mt-0.5 break-all">{deleteTarget.name}</p>
                <p className="text-xs text-destructive mt-1">এই ফাইল ব্যবহার হচ্ছে এমন প্রডাক্টে ছবি দেখাবে না।</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>বাতিল</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                ডিলিট করুন
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaManager;
