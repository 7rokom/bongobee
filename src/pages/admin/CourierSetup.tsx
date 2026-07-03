import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSteadfastStore } from '@/stores/useSteadfastStore';
import { useCarrybeeStore } from '@/stores/useCarrybeeStore';
import { toast } from 'sonner';
import { Save, Truck, Key, ShieldCheck, Package } from 'lucide-react';

const maskValue = (val: string) => {
  if (!val || val.length <= 4) return '•'.repeat(val?.length || 0);
  return '•'.repeat(val.length - 4) + val.slice(-4);
};

const CourierSetup = () => {
  const { settings: sfSettings, updateSettings: updateSfSettings, fetchSettings: fetchSfSettings } = useSteadfastStore();
  const { settings: cbSettings, updateSettings: updateCbSettings, fetchSettings: fetchCbSettings } = useCarrybeeStore();

  const [sfApiKey, setSfApiKey] = useState(sfSettings.apiKey);
  const [sfSecretKey, setSfSecretKey] = useState(sfSettings.secretKey);
  const [sfShowApi, setSfShowApi] = useState(!sfSettings.apiKey);
  const [sfShowSecret, setSfShowSecret] = useState(!sfSettings.secretKey);

  const [cbClientId, setCbClientId] = useState(cbSettings.clientId);
  const [cbClientSecret, setCbClientSecret] = useState(cbSettings.clientSecret);
  const [cbClientContext, setCbClientContext] = useState(cbSettings.clientContext);
  const [cbStoreId, setCbStoreId] = useState(cbSettings.defaultStoreId);
  const [cbCityId, setCbCityId] = useState(String(cbSettings.defaultCityId || ''));
  const [cbZoneId, setCbZoneId] = useState(String(cbSettings.defaultZoneId || ''));
  const [cbShowId, setCbShowId] = useState(!cbSettings.clientId);
  const [cbShowSecret, setCbShowSecret] = useState(!cbSettings.clientSecret);
  const [cbShowContext, setCbShowContext] = useState(!cbSettings.clientContext);

  useEffect(() => {
    fetchSfSettings();
    fetchCbSettings();
  }, []);

  useEffect(() => {
    setSfApiKey(sfSettings.apiKey);
    setSfSecretKey(sfSettings.secretKey);
    setSfShowApi(!sfSettings.apiKey);
    setSfShowSecret(!sfSettings.secretKey);
  }, [sfSettings.apiKey, sfSettings.secretKey]);

  useEffect(() => {
    setCbClientId(cbSettings.clientId);
    setCbClientSecret(cbSettings.clientSecret);
    setCbClientContext(cbSettings.clientContext);
    setCbStoreId(cbSettings.defaultStoreId);
    setCbCityId(String(cbSettings.defaultCityId || ''));
    setCbZoneId(String(cbSettings.defaultZoneId || ''));
    setCbShowId(!cbSettings.clientId);
    setCbShowSecret(!cbSettings.clientSecret);
    setCbShowContext(!cbSettings.clientContext);
  }, [cbSettings.clientId, cbSettings.clientSecret, cbSettings.clientContext, cbSettings.defaultStoreId, cbSettings.defaultCityId, cbSettings.defaultZoneId]);

  const handleSaveSteadfast = async () => {
    try {
      await updateSfSettings({ apiKey: sfApiKey.trim(), secretKey: sfSecretKey.trim() });
      setSfShowApi(false);
      setSfShowSecret(false);
      toast.success('Steadfast কুরিয়ার সেটিংস সেভ হয়েছে!');
    } catch (e: any) {
      toast.error(`সেভ ব্যর্থ: ${e?.message || 'অজানা ত্রুটি'}`);
    }
  };

  const handleSaveCarrybee = async () => {
    try {
      await updateCbSettings({
        clientId: cbClientId.trim(), clientSecret: cbClientSecret.trim(),
        clientContext: cbClientContext.trim(), defaultStoreId: cbStoreId.trim(),
        defaultCityId: Number(cbCityId) || 0,
        defaultZoneId: Number(cbZoneId) || 0,
      });
      setCbShowId(false);
      setCbShowSecret(false);
      setCbShowContext(false);
      toast.success('CarryBee কুরিয়ার সেটিংস সেভ হয়েছে!');
    } catch (e: any) {
      toast.error(`সেভ ব্যর্থ: ${e?.message || 'অজানা ত্রুটি'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">কুরিয়ার সেটাপ</h1>
        <p className="text-sm text-muted-foreground">কুরিয়ার সার্ভিসের API কনফিগারেশন। আপনার API Key দিন, এটি সাইটে সেভ হয়ে ডিফল্ট হিসেবে কাজ করবে।</p>
      </div>

      {/* Steadfast */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" /> Steadfast কুরিয়ার
          </CardTitle>
          <CardDescription>আপনার Steadfast API Key ও Secret Key দিন। সেভ করলে এটি ডিফল্ট হয়ে কাজ করবে।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5" /> API Key</Label>
              <Input
                value={sfShowApi ? sfApiKey : maskValue(sfApiKey)}
                onChange={(e) => { setSfApiKey(e.target.value); setSfShowApi(true); }}
                onFocus={() => setSfShowApi(true)}
                onBlur={() => { if (sfSettings.apiKey) setSfShowApi(false); }}
                placeholder="আপনার Steadfast API Key দিন"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Secret Key</Label>
              <Input
                value={sfShowSecret ? sfSecretKey : maskValue(sfSecretKey)}
                onChange={(e) => { setSfSecretKey(e.target.value); setSfShowSecret(true); }}
                onFocus={() => setSfShowSecret(true)}
                onBlur={() => { if (sfSettings.secretKey) setSfShowSecret(false); }}
                placeholder="আপনার Steadfast Secret Key দিন"
              />
            </div>
          </div>
          {sfSettings.apiKey && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> API Key কনফিগার করা আছে
            </div>
          )}
          <Button onClick={handleSaveSteadfast} className="gap-2"><Save className="h-4 w-4" /> সেভ করুন</Button>
        </CardContent>
      </Card>

      {/* CarryBee */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> CarryBee কুরিয়ার
          </CardTitle>
          <CardDescription>আপনার CarryBee Client ID, Secret ও Context দিন। সেভ করলে এটি ডিফল্ট হয়ে কাজ করবে।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Key className="w-3.5 h-3.5" /> Client ID</Label>
              <Input
                value={cbShowId ? cbClientId : maskValue(cbClientId)}
                onChange={(e) => { setCbClientId(e.target.value); setCbShowId(true); }}
                onFocus={() => setCbShowId(true)}
                onBlur={() => { if (cbSettings.clientId) setCbShowId(false); }}
                placeholder="আপনার CarryBee Client ID দিন"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Client Secret</Label>
              <Input
                value={cbShowSecret ? cbClientSecret : maskValue(cbClientSecret)}
                onChange={(e) => { setCbClientSecret(e.target.value); setCbShowSecret(true); }}
                onFocus={() => setCbShowSecret(true)}
                onBlur={() => { if (cbSettings.clientSecret) setCbShowSecret(false); }}
                placeholder="আপনার CarryBee Client Secret দিন"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Client Context</Label>
              <Input
                value={cbShowContext ? cbClientContext : maskValue(cbClientContext)}
                onChange={(e) => { setCbClientContext(e.target.value); setCbShowContext(true); }}
                onFocus={() => setCbShowContext(true)}
                onBlur={() => { if (cbSettings.clientContext) setCbShowContext(false); }}
                placeholder="আপনার CarryBee Client Context দিন"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Default Store ID <span className="text-muted-foreground text-xs">(ঐচ্ছিক)</span></Label>
              <Input value={cbStoreId} onChange={(e) => setCbStoreId(e.target.value)} placeholder="স্বয়ংক্রিয়ভাবে নেওয়া হবে" />
              <p className="text-xs text-muted-foreground">খালি রাখলে প্রথম সক্রিয় স্টোর স্বয়ংক্রিয়ভাবে ব্যবহার হবে</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Default City ID <span className="text-muted-foreground text-xs">(ঠিকানা না পেলে ব্যবহার হবে)</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={cbCityId}
                  onChange={(e) => setCbCityId(e.target.value)}
                  placeholder="যেমন: 14 (Dhaka)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Default Zone ID</Label>
                <Input
                  type="number"
                  min="0"
                  value={cbZoneId}
                  onChange={(e) => setCbZoneId(e.target.value)}
                  placeholder="যেমন: 5"
                />
              </div>
            </div>
          </div>
          {cbSettings.clientId && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> CarryBee কনফিগার করা আছে
            </div>
          )}
          <Button onClick={handleSaveCarrybee} className="gap-2"><Save className="h-4 w-4" /> সেভ করুন</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourierSetup;
