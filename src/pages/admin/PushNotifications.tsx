import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Send, Users, Image as ImageIcon, Settings as SettingsIcon, Download, Upload, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { PUSH_SECTIONS, PUSH_SECTION_LABELS, type PushSection } from '@/lib/push-section';

interface Campaign {
  id: string; title: string; body: string; image_url: string | null; click_url: string | null;
  sent_count: number; failed_count: number; created_at: string; section: string | null;
}

const SHOW_COUPON_FOR: PushSection[] = ['main', 'reseller'];

const SectionPanel = ({ section }: { section: PushSection }) => {
  const { pushSections, updateSettings } = useSiteSettingsStore();
  const cfg = pushSections[section];

  const [pEnabled, setPEnabled] = useState(cfg.promptEnabled);
  const [pTitle, setPTitle] = useState(cfg.promptTitle);
  const [pBody, setPBody] = useState(cfg.promptBody);
  const [pBtn, setPBtn] = useState(cfg.promptButtonText);
  const [psEnabled, setPsEnabled] = useState(cfg.couponPopupEnabled);
  const [psHeading, setPsHeading] = useState(cfg.couponPopupHeading);
  const [psCoupon, setPsCoupon] = useState(cfg.couponCode);
  const [savingSettings, setSavingSettings] = useState(false);

  const [subCount, setSubCount] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('/');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Campaign[]>([]);

  useEffect(() => {
    setPEnabled(cfg.promptEnabled); setPTitle(cfg.promptTitle); setPBody(cfg.promptBody); setPBtn(cfg.promptButtonText);
    setPsEnabled(cfg.couponPopupEnabled); setPsHeading(cfg.couponPopupHeading); setPsCoupon(cfg.couponCode);
  }, [section, cfg.promptEnabled, cfg.promptTitle, cfg.promptBody, cfg.promptButtonText, cfg.couponPopupEnabled, cfg.couponPopupHeading, cfg.couponCode]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        pushSections: {
          ...pushSections,
          [section]: {
            promptEnabled: pEnabled,
            promptTitle: pTitle.trim() || cfg.promptTitle,
            promptBody: pBody.trim() || cfg.promptBody,
            promptButtonText: pBtn.trim() || cfg.promptButtonText,
            couponPopupEnabled: psEnabled,
            couponPopupHeading: psHeading,
            couponCode: psCoupon.trim(),
          },
        },
      });
      toast({ title: 'সেটিংস সেভ হয়েছে' });
    } catch (e: any) {
      toast({ title: 'সেভ ব্যর্থ', description: e.message, variant: 'destructive' });
    } finally { setSavingSettings(false); }
  };

  const loadStats = async () => {
    try {
      const c = await api.get(`/admin/mk/push-subscriptions/count?section=${encodeURIComponent(section)}`);
      setSubCount(c?.count || 0);
    } catch { setSubCount(0); }
    try {
      const data = await api.get(`/admin/mk/push-campaigns?section=${encodeURIComponent(section)}`);
      setHistory((Array.isArray(data) ? data : []) as Campaign[]);
    } catch { setHistory([]); }
  };

  useEffect(() => { loadStats(); }, [section]);

  const handleExport = async () => {
    try {
      const data = await api.get(`/admin/mk/push-subscriptions?section=${encodeURIComponent(section)}&activeOnly=1`);
      const blob = new Blob([JSON.stringify(data || [], null, 2)], { type: 'application/json' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `push-subscribers-${section}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(dlUrl);
      toast({ title: `ডাউনলোড হয়েছে: ${data?.length || 0} জন` });
    } catch (e: any) {
      toast({ title: 'ডাউনলোড ব্যর্থ', description: e.message, variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Invalid file format');
      const rows = arr
        .map((s: any) => ({
          endpoint: s.endpoint,
          p256dh: s.p256dh ?? s.keys?.p256dh,
          auth: s.auth ?? s.keys?.auth,
          user_agent: s.user_agent || null,
          is_active: s.is_active ?? true,
          section,
        }))
        .filter((r: any) => r.endpoint && r.p256dh && r.auth);
      if (rows.length === 0) throw new Error('কোনো ভ্যালিড সাবস্ক্রিপশন পাওয়া যায়নি');
      for (const r of rows) {
        await api.post('/public/push-subscribe', { endpoint: r.endpoint, p256dh_key: r.p256dh, auth_key: r.auth, section: r.section }).catch(() => {});
      }
      toast({ title: `ইমপোর্ট হয়েছে: ${rows.length} জন` });
      loadStats();
    } catch (err: any) {
      toast({ title: 'ইমপোর্ট ব্যর্থ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`এই সেকশনের (${PUSH_SECTION_LABELS[section]}) সব সাবস্ক্রাইবার মুছবেন?`)) return;
    try {
      const res = await api.del(`/admin/mk/push-subscriptions/section/${encodeURIComponent(section)}`);
      toast({ title: `মুছে ফেলা হয়েছে (${res?.deleted ?? 0})` });
      loadStats();
    } catch (e: any) {
      toast({ title: 'মুছতে ব্যর্থ', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('এই হিস্ট্রি আইটেমটি মুছবেন?')) return;
    try {
      await api.del(`/admin/mk/push-campaigns/${id}`);
      toast({ title: 'মুছে ফেলা হয়েছে' });
      loadStats();
    } catch (e: any) {
      toast({ title: 'মুছতে ব্যর্থ', description: e.message, variant: 'destructive' });
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('এই সেকশনের সব হিস্ট্রি মুছবেন?')) return;
    try {
      await api.del(`/admin/mk/push-campaigns/section/${encodeURIComponent(section)}`);
      toast({ title: 'সব হিস্ট্রি মুছে ফেলা হয়েছে' });
      loadStats();
    } catch (e: any) {
      toast({ title: 'মুছতে ব্যর্থ', description: e.message, variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'টাইটেল ও মেসেজ দিন', variant: 'destructive' });
      return;
    }
    if (!confirm(`${PUSH_SECTION_LABELS[section]} - ${subCount} জন সাবস্ক্রাইবারকে পাঠাবেন?`)) return;
    setSending(true);
    try {
      const data = await api.post('/admin/mk/send-push', { title: title.trim(), body: body.trim(), image: image.trim() || undefined, url: url.trim() || '/', section });
      toast({ title: `পাঠানো হয়েছে: ${data.sent} | ব্যর্থ: ${data.failed}` });
      setTitle(''); setBody(''); setImage(''); setUrl('/');
      loadStats();
    } catch (e: any) {
      toast({ title: 'পাঠানো ব্যর্থ', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  const showCoupon = SHOW_COUPON_FOR.includes(section);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{PUSH_SECTION_LABELS[section]} সাবস্ক্রাইবার</p>
            <p className="text-2xl font-bold">{subCount} জন</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-4 w-4" /> সাবস্ক্রাইবার ম্যানেজ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> ডাউনলোড (JSON)
            </Button>
            <label className="inline-flex">
              <input type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
              <span className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /> ইমপোর্ট (JSON)
              </span>
            </label>
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} className="gap-2">
              <Trash2 className="h-4 w-4" /> সব মুছুন
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> পপআপ সেটিংস
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-semibold text-sm">পপআপ অন/অফ</p>
              <p className="text-xs text-muted-foreground">বন্ধ করলে এই সেকশনে ভিজিটরদের কাছে পপআপ যাবে না।</p>
            </div>
            <Switch checked={pEnabled} onCheckedChange={setPEnabled} />
          </div>
          <div>
            <Label>পপআপ টাইটেল</Label>
            <Input value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>পপআপ মেসেজ</Label>
            <Textarea value={pBody} onChange={(e) => setPBody(e.target.value)} rows={3} maxLength={250} />
          </div>
          <div>
            <Label>বাটনের টেক্সট</Label>
            <Input value={pBtn} onChange={(e) => setPBtn(e.target.value)} maxLength={30} />
          </div>

          {showCoupon && (
            <div className="mt-2 pt-4 border-t space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-semibold text-sm">সাবস্ক্রাইব সাকসেস কুপন পপআপ</p>
                  <p className="text-xs text-muted-foreground">সাবস্ক্রাইব করার পর কুপন সহ একটি পপআপ দেখাবে।</p>
                </div>
                <Switch checked={psEnabled} onCheckedChange={setPsEnabled} />
              </div>
              <div>
                <Label>সাকসেস পপআপ হেডিং</Label>
                <Input value={psHeading} onChange={(e) => setPsHeading(e.target.value)} maxLength={120} placeholder="🎉 অভিনন্দন! আপনার জন্য স্পেশাল অফার" />
              </div>
              <div>
                <Label>কুপন কোড</Label>
                <Input value={psCoupon} onChange={(e) => setPsCoupon(e.target.value)} maxLength={30} placeholder="WELCOME10" />
              </div>
            </div>
          )}

          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? 'সেভ হচ্ছে...' : 'সেটিংস সেভ করুন'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">নতুন নোটিফিকেশন পাঠান</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>টাইটেল *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: নতুন প্রোডাক্ট এসেছে!" maxLength={80} />
          </div>
          <div>
            <Label>মেসেজ *</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="ছোট বর্ণনা লিখুন..." maxLength={200} rows={3} />
          </div>
          <div>
            <Label>ছবির URL (optional)</Label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
            {image && (
              <div className="mt-2"><img src={image} alt="preview" className="max-h-32 rounded border" /></div>
            )}
          </div>
          <div>
            <Label>Click URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/shop বা https://..." />
          </div>
          <Button onClick={handleSend} disabled={sending || subCount === 0} className="gap-2">
            <Send className="h-4 w-4" /> {sending ? 'পাঠানো হচ্ছে...' : `${subCount} জনকে পাঠান`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between gap-2">
            <span>পাঠানো হিস্ট্রি</span>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-destructive hover:text-destructive gap-1.5">
                <Trash2 className="h-4 w-4" /> সব মুছুন
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">এখনও কোনো নোটিফিকেশন পাঠানো হয়নি।</p>
          ) : (
            <div className="space-y-2">
              {history.map((c) => (
                <div key={c.id} className="border rounded-md p-3 flex items-start gap-3">
                  {c.image_url && <img src={c.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />}
                  {!c.image_url && <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      পাঠানো: {c.sent_count} | ব্যর্থ: {c.failed_count} · {new Date(c.created_at).toLocaleString('bn-BD')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(c.id)} className="text-destructive hover:text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PushNotifications = () => {
  const [tab, setTab] = useState<PushSection>('main');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">পুশ নোটিফিকেশন</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PushSection)}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          {PUSH_SECTIONS.map((s) => (
            <TabsTrigger key={s} value={s}>{PUSH_SECTION_LABELS[s]}</TabsTrigger>
          ))}
        </TabsList>
        {PUSH_SECTIONS.map((s) => (
          <TabsContent key={s} value={s} className="mt-6">
            <SectionPanel section={s} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PushNotifications;
