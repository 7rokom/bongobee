import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Volume2, Upload, Loader2, Save, Trash2, RefreshCw, FileAudio } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

/* ── Generic audio file uploader ── */
function AudioUploader({ onUpload }: { onUpload: (url: string, path: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const valid = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name);
    if (!valid) {
      toast.error('শুধু অডিও ফাইল আপলোড করুন (mp3, wav, ogg)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.post('/admin/data/audio', fd);
      if (data?.path) {
        onUpload(data.path, data.fullPath);
        toast.success('অডিও আপলোড সফল!');
      }
    } catch (e: any) {
      toast.error('আপলোড ব্যর্থ: ' + (e?.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'আপলোড হচ্ছে...' : 'নতুন অডিও আপলোড করুন'}
      </Button>
    </div>
  );
}

/* ── Reusable audio settings tab ── */
interface AudioTabProps {
  title: string;
  description: string;
  url: string;
  enabled: boolean;
  onChange: (url: string, enabled: boolean) => Promise<void> | void;
}

function AudioTab({ title, description, url, enabled, onChange }: AudioTabProps) {
  const [localUrl, setLocalUrl] = useState(url);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  useEffect(() => { setLocalUrl(url); }, [url]);
  useEffect(() => { setLocalEnabled(enabled); }, [enabled]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5" /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`enabled-${title}`}
            checked={localEnabled}
            onCheckedChange={(c) => setLocalEnabled(!!c)}
          />
          <Label htmlFor={`enabled-${title}`} className="cursor-pointer">
            ভয়েস চালু রাখুন
          </Label>
        </div>

        <AudioUploader onUpload={(u) => setLocalUrl(u)} />

        <div>
          <Label>অডিও ফাইল URL (mp3 / wav / ogg)</Label>
          <Input
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            className="mt-1"
            placeholder="https://example.com/voice-message.mp3"
          />
          <p className="text-xs text-muted-foreground mt-1">
            উপরের Upload বাটনে ক্লিক করলে automatic URL আসবে। অথবা যেকোনো public direct .mp3 link হাতে লিখতে পারেন।
          </p>
        </div>

        {localUrl && (
          <div>
            <Label className="text-xs text-muted-foreground">প্রিভিউ</Label>
            <audio src={localUrl} controls className="w-full mt-1" />
          </div>
        )}

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
          <p>📌 প্রতিটি ভিজিটরের কাছে শুধু <strong>প্রথমবার</strong> auto-play হবে।</p>
          <p>📌 Visitor চাইলে floating button থেকে যেকোনো সময় play/pause করতে পারবে।</p>
          <p>📌 অডিও শেষ হলে নিজে থেকেই থেমে যাবে।</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={async () => { await onChange(localUrl, localEnabled); toast.success('সেভ হয়েছে!'); }}
            className="gap-2"
          >
            <Save className="h-4 w-4" /> সেভ করুন
          </Button>
          {localUrl && (
            <Button
              variant="outline"
              onClick={() => setLocalUrl('')}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> URL ক্লিয়ার করুন
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Audio file manager (lists files in bucket, allows delete) ── */
interface StorageFile {
  name: string;
  fullPath: string;
  publicUrl: string;
  size: number;
  createdAt: string;
}

function AudioFileManager() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/data/audio');
      const allFiles: StorageFile[] = (Array.isArray(data) ? data : []).map((f: any) => ({
        name: f.name,
        fullPath: f.fullPath,
        publicUrl: f.url,
        size: f.size || 0,
        createdAt: f.createdAt || '',
      }));
      setFiles(allFiles);
    } catch (e: any) {
      toast.error('ফাইল লোড ব্যর্থ: ' + (e?.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, []);

  const handleDelete = async (file: StorageFile) => {
    if (!window.confirm(`"${file.name}" ডিলিট করতে চান?\n\nএই URL যদি কোনো পেজে সেট করা থাকে, সেখানে অডিও আর প্লে হবে না।`)) return;
    setDeletingPath(file.fullPath);
    try {
      await api.post('/admin/data/audio/delete', { path: file.fullPath });
      toast.success('অডিও ডিলিট হয়েছে');
      setFiles((prev) => prev.filter((f) => f.fullPath !== file.fullPath));
    } catch (e: any) {
      toast.error('ডিলিট ব্যর্থ: ' + (e?.message || 'Unknown'));
    } finally {
      setDeletingPath(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" /> আপলোড করা সকল অডিও ফাইল
          </span>
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            রিফ্রেশ
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          সার্ভারে সংরক্ষিত সব অডিও ফাইল। অপ্রয়োজনীয় ফাইল ডিলিট করে স্টোরেজ ফাঁকা রাখুন।
        </p>
      </CardHeader>
      <CardContent>
        {loading && files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            লোড হচ্ছে...
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            কোনো অডিও ফাইল আপলোড করা হয়নি।
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.fullPath} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.fullPath} · {formatSize(file.size)}
                    {file.createdAt && ' · ' + new Date(file.createdAt).toLocaleString('bn-BD')}
                  </p>
                  <audio src={file.publicUrl} controls className="w-full mt-2 h-8" />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => handleDelete(file)}
                  disabled={deletingPath === file.fullPath}
                >
                  {deletingPath === file.fullPath ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  ডিলিট
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main page ── */
const AudioSettings = () => {
  const settings = useSiteSettingsStore();

  const updateProduct = (url: string, enabled: boolean) =>
    settings.updateSettings({ productAudioUrl: url, productAudioEnabled: enabled });
  const updateCheckout = (url: string, enabled: boolean) =>
    settings.updateSettings({ checkoutAudioUrl: url, checkoutAudioEnabled: enabled });
  const updateThankYou = (url: string, enabled: boolean) =>
    settings.updateSettings({ thankYouAudioUrl: url, thankYouAudioEnabled: enabled });
  const updateThankYouDirect = (url: string, enabled: boolean) =>
    settings.updateSettings({ thankYouDirectAudioUrl: url, thankYouDirectAudioEnabled: enabled });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">অডিও / ভয়েস সেটিংস</h1>
        <p className="text-muted-foreground text-sm">
          প্রোডাক্ট, চেকআউট ও থ্যাংক ইউ পেজে আলাদা আলাদা ভয়েস মেসেজ অটো-প্লে করুন।
        </p>
      </div>

      <Tabs defaultValue="product" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="product">প্রোডাক্ট পেজ</TabsTrigger>
          <TabsTrigger value="checkout">চেকআউট পেজ</TabsTrigger>
          <TabsTrigger value="thankyou">থ্যাংক ইউ পেজ</TabsTrigger>
        </TabsList>

        <TabsContent value="product">
          <AudioTab
            title="প্রোডাক্ট পেজ ভয়েস"
            description="প্রতিটি প্রোডাক্ট পেজে ভিজিটরের কাছে এই ভয়েসটি অটো-প্লে হবে।"
            url={settings.productAudioUrl || ''}
            enabled={settings.productAudioEnabled ?? false}
            onChange={updateProduct}
          />
        </TabsContent>

        <TabsContent value="checkout">
          <AudioTab
            title="চেকআউট পেজ ভয়েস"
            description="চেকআউট পেজে প্রবেশের পর এই ভয়েসটি অটো-প্লে হবে।"
            url={settings.checkoutAudioUrl || ''}
            enabled={settings.checkoutAudioEnabled ?? false}
            onChange={updateCheckout}
          />
        </TabsContent>

        <TabsContent value="thankyou" className="space-y-4">
          <AudioTab
            title="থ্যাংক ইউ পেজ ভয়েস — কল করার জন্য"
            description='গ্রাহক যখন "পাঠানোর আগে কল দিন" বেছে নেয়, তখন থ্যাংক ইউ পেজে এই ভয়েসটি অটো-প্লে হবে। (পপআপ বন্ধ থাকলে ডিফল্ট হিসেবেও এটাই বাজবে।)'
            url={settings.thankYouAudioUrl || ''}
            enabled={settings.thankYouAudioEnabled ?? false}
            onChange={updateThankYou}
          />
          <AudioTab
            title="থ্যাংক ইউ পেজ ভয়েস — সরাসরি ডেলিভারির জন্য"
            description='গ্রাহক যখন "সরাসরি পাঠিয়ে দিন" বেছে নেয় (অর্ডার অটো-কনফার্ম হয়), তখন থ্যাংক ইউ পেজে এই ভয়েসটি অটো-প্লে হবে।'
            url={settings.thankYouDirectAudioUrl || ''}
            enabled={settings.thankYouDirectAudioEnabled ?? false}
            onChange={updateThankYouDirect}
          />
        </TabsContent>
      </Tabs>

      <AudioFileManager />
    </div>
  );
};

export default AudioSettings;