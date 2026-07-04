import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Save, TestTube, Loader2, PackageCheck, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { api } from '@/lib/api';

const maskValue = (val: string) => {
  if (!val || val.length <= 4) return '•'.repeat(val?.length || 0);
  return '•'.repeat(val.length - 4) + val.slice(-4);
};

const FraudSettings = () => {
  const settings = useFraudSettingsStore();
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ all: number; delivered: number; returned: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showBdKey, setShowBdKey] = useState(!settings.bdcourierApiKey);
  const [bdKeyDraft, setBdKeyDraft] = useState(settings.bdcourierApiKey || '');
  const [sliderValue, setSliderValue] = useState(settings.minDeliveryPercent);

  // Keep local drafts in sync when realtime/store updates arrive
  useEffect(() => { setBdKeyDraft(settings.bdcourierApiKey || ''); }, [settings.bdcourierApiKey]);
  useEffect(() => { setSliderValue(settings.minDeliveryPercent); }, [settings.minDeliveryPercent]);

  const handleSaveBdKey = async () => {
    const key = bdKeyDraft.trim();
    if (!key) {
      toast.error('API Key খালি রাখা যাবে না');
      return;
    }
    await settings.updateSettings({ bdcourierApiKey: key });
    await settings.flushSettings();
    setShowBdKey(false);
    toast.success('BDCourier API Key সেভ হয়েছে');
  };

  const handleTest = async () => {
    if (!testPhone.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await api.post('/public/courier-check', {
        phone: testPhone,
        ...(settings.bdcourierApiKey ? { apiKey: settings.bdcourierApiKey } : {}),
      });
      setTestResult({ all: data.all || 0, delivered: data.delivered || 0, returned: data.returned || 0 });
    } catch {
      toast.error('টেস্ট ব্যর্থ হয়েছে');
    }
    setTesting(false);
  };

  const deliveryPercent = testResult && testResult.all > 0 ? Math.round((testResult.delivered / testResult.all) * 100) : 0;
  const wouldBlock = testResult ? (testResult.all === 0 ? settings.blockOnNoData : deliveryPercent < settings.minDeliveryPercent) : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">ফ্রড চেকিং সেটিংস</h1>
          <p className="text-sm text-muted-foreground">চেকআউটের সময় কাস্টমারের কুরিয়ার রেশিও অটো-চেক করুন</p>
        </div>
      </div>


      {/* Post-Order Popup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><PackageCheck className="h-5 w-5" /> পোস্ট-অর্ডার পপআপ সেটিংস</CardTitle>
          <CardDescription>অর্ডার সফল হওয়ার পর "সরাসরি পাঠিয়ে দিন / কল দিবেন" পপআপটি কাস্টমাইজ করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">পোস্ট-অর্ডার পপআপ দেখান</Label>
              <p className="text-sm text-muted-foreground">বন্ধ করলে অর্ডারের পর সরাসরি থাঙ্ক ইউ পেজে যাবে</p>
            </div>
            <Switch checked={settings.postOrderPopupEnabled} onCheckedChange={(v) => settings.updateSettings({ postOrderPopupEnabled: v })} />
          </div>

          {settings.postOrderPopupEnabled && (
            <>
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">প্রথম স্টেপ (অপশন বেছে নিন)</h3>
                <div className="space-y-2">
                  <Label>টাইটেল</Label>
                  <Input value={settings.postOrderChooseTitle} onChange={(e) => settings.updateSettings({ postOrderChooseTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>মেসেজ</Label>
                  <Textarea value={settings.postOrderChooseMessage} onChange={(e) => settings.updateSettings({ postOrderChooseMessage: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>সরাসরি পাঠান বাটন</Label>
                    <Input value={settings.postOrderDirectBtnText} onChange={(e) => settings.updateSettings({ postOrderDirectBtnText: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>কল করুন বাটন</Label>
                    <Input value={settings.postOrderCallBtnText} onChange={(e) => settings.updateSettings({ postOrderCallBtnText: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">সরাসরি পাঠান সাকসেস মেসেজ</h3>
                <div className="space-y-2">
                  <Label>টাইটেল</Label>
                  <Input value={settings.postOrderDirectSuccessTitle} onChange={(e) => settings.updateSettings({ postOrderDirectSuccessTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>মেসেজ</Label>
                  <Textarea value={settings.postOrderDirectSuccessMessage} onChange={(e) => settings.updateSettings({ postOrderDirectSuccessMessage: e.target.value })} rows={4} />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">কল করুন সাকসেস মেসেজ</h3>
                <div className="space-y-2">
                  <Label>টাইটেল</Label>
                  <Input value={settings.postOrderCallSuccessTitle} onChange={(e) => settings.updateSettings({ postOrderCallSuccessTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>মেসেজ</Label>
                  <Textarea value={settings.postOrderCallSuccessMessage} onChange={(e) => settings.updateSettings({ postOrderCallSuccessMessage: e.target.value })} rows={4} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Cooldown Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Timer className="h-5 w-5 text-blue-500" /> অর্ডার কুলডাউন সেটিংস</CardTitle>
          <CardDescription>একই কাস্টমার ডুপ্লিকেট অর্ডার করা থেকে বিরত রাখুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">কুলডাউন সক্রিয় করুন</Label>
              <p className="text-sm text-muted-foreground">অর্ডারের পর নির্দিষ্ট সময় নতুন অর্ডার ব্লক হবে</p>
            </div>
            <Switch checked={settings.cooldownEnabled} onCheckedChange={(v) => settings.updateSettings({ cooldownEnabled: v })} />
          </div>
          {settings.cooldownEnabled && (
            <>
              <div className="space-y-2">
                <Label>কুলডাউন সময় (মিনিট)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.cooldownMinutes}
                  onChange={(e) => settings.updateSettings({ cooldownMinutes: Math.max(1, Number(e.target.value)) })}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">অর্ডারের পর এই সময়ের মধ্যে একই কাস্টমার আবার অর্ডার করতে পারবে না</p>
              </div>
              <div className="space-y-2">
                <Label>কুলডাউন মেসেজ</Label>
                <Textarea
                  value={settings.cooldownMessage}
                  onChange={(e) => settings.updateSettings({ cooldownMessage: e.target.value })}
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auto Fraud Checking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">অটো ফ্রড চেকিং</CardTitle>
          <CardDescription>চেকআউটের সময় কাস্টমারের ফোন নম্বর দিয়ে স্বয়ংক্রিয়ভাবে কুরিয়ার রেশিও চেক করা হবে</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">ফ্রড চেকিং সক্রিয় করুন</Label>
              <p className="text-sm text-muted-foreground">চেকআউটে অটো কুরিয়ার রেশিও চেক</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => settings.updateSettings({ enabled: v })} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">মিনিমাম ডেলিভারি রেশিও</Label>
              <span className="text-2xl font-bold text-primary">{sliderValue}%</span>
            </div>
            <Slider
              value={[sliderValue]}
              onValueChange={(v) => setSliderValue(v[0])}
              onValueCommit={(v) => settings.updateSettings({ minDeliveryPercent: v[0] })}
              min={0} max={100} step={5} className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              কাস্টমারের ডেলিভারি রেশিও যদি {sliderValue}% এর নিচে হয় তাহলে অর্ডার ব্লক করা হবে
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">ডাটা না পাওয়া গেলে ব্লক</Label>
              <p className="text-sm text-muted-foreground">কুরিয়ার হিস্টোরি না থাকলে অর্ডার ব্লক করুন</p>
            </div>
            <Switch checked={settings.blockOnNoData} onCheckedChange={(v) => settings.updateSettings({ blockOnNoData: v })} />
          </div>
        </CardContent>
      </Card>

      {/* BDCourier API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">BDCourier API Key</CardTitle>
          <CardDescription>আপনার BDCourier API Key দিন। টাইপ শেষে "সেভ করুন" বাটনে ক্লিক করুন — তখনই কেবল সেভ হবে।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>BDCourier API Key</Label>
            <Input
              value={showBdKey ? bdKeyDraft : maskValue(bdKeyDraft)}
              onFocus={() => setShowBdKey(true)}
              onBlur={() => { if (bdKeyDraft) setShowBdKey(false); }}
              placeholder="আপনার BDCourier API Key দিন"
              onChange={(e) => { setShowBdKey(true); setBdKeyDraft(e.target.value); }}
            />
          </div>

          <Button onClick={handleSaveBdKey} className="gap-2">
            <Save className="h-4 w-4" /> API Key সেভ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">টেস্ট করুন</CardTitle>
          <CardDescription>একটি ফোন নম্বর দিয়ে API টেস্ট করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="01XXXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            <Button onClick={handleTest} disabled={testing} className="shrink-0 gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
              টেস্ট
            </Button>
          </div>

          {testResult && (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>মোট: <span className="font-bold">{testResult.all}</span></span>
                <span>|</span>
                <span>ডেলিভারি: <span className="font-bold text-green-600">{testResult.delivered}</span></span>
                <span>|</span>
                <span>রিটার্ন: <span className="font-bold text-red-600">{testResult.returned}</span></span>
              </div>
              {testResult.all > 0 && (
                <>
                  <div className="w-full h-3 rounded-full bg-background overflow-hidden flex">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${deliveryPercent}%` }} />
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.round((testResult.returned / testResult.all) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>ডেলিভারি: {deliveryPercent}%</span>
                    <span>রিটার্ন: {Math.round((testResult.returned / testResult.all) * 100)}%</span>
                  </div>
                </>
              )}
              <div className={`text-sm font-bold ${wouldBlock ? 'text-destructive' : 'text-green-600'}`}>
                {wouldBlock ? '⛔ এই নম্বর ব্লক হবে' : '✅ এই নম্বর অর্ডার করতে পারবে'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FraudSettings;
