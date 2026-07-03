import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useResellerDomainStore } from '@/stores/useResellerDomainStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { toast } from '@/hooks/use-toast';
import { Globe, Trash2, ShieldCheck, RefreshCw, Copy, Check, AlertCircle, Clock, X, CheckCircle } from 'lucide-react';
import { ApiError } from '@/lib/api';

const CNAME_TARGET = import.meta.env.VITE_CUSTOM_DOMAIN_CNAME || 'store.bongobee.com';

const getStoredResellerId = () => {
  try {
    return JSON.parse(localStorage.getItem('reseller-auth') || '{}')?.id || '';
  } catch {
    return '';
  }
};

const statusConfig = {
  pending:  { label: 'পেন্ডিং',    color: 'bg-yellow-100 text-yellow-800', Icon: Clock },
  verified: { label: 'যাচাইকৃত',   color: 'bg-green-100 text-green-800',  Icon: CheckCircle },
  failed:   { label: 'ব্যর্থ',      color: 'bg-red-100 text-red-800',      Icon: X },
  inactive: { label: 'নিষ্ক্রিয়',  color: 'bg-gray-100 text-gray-700',   Icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const ResellerCustomDomain = () => {
  const { domain, loading, fetchDomain, addDomain, removeDomain, verifyDns } = useResellerDomainStore();
  const resellers = useResellerStore((s) => s.resellers);
  const resellerId = getStoredResellerId();
  const reseller = resellers.find((r) => r.id === resellerId);

  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchDomain();
  }, []);

  const storeUrl = reseller
    ? `${window.location.origin}/r/${reseller.serialNumber ?? resellerId}`
    : '';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRow(key);
      setTimeout(() => setCopiedRow(null), 2000);
    });
  };

  const handleAdd = async () => {
    if (!domainInput.trim()) return;
    setSaving(true);
    try {
      await addDomain(domainInput.trim());
      setDomainInput('');
      toast({ title: 'ডোমেইন যোগ হয়েছে!', description: 'এখন DNS রেকর্ড কনফিগার করুন।' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'ডোমেইন সেভ ব্যর্থ হয়েছে।';
      toast({ title: 'ত্রুটি', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!domain) return;
    if (!confirm(`আপনি কি "${domain.domain}" ডোমেইন মুছতে চান?`)) return;
    setRemoving(true);
    try {
      await removeDomain(domain.id);
      toast({ title: 'ডোমেইন মুছে ফেলা হয়েছে।' });
    } catch {
      toast({ title: 'মুছতে ব্যর্থ।', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const handleVerify = async () => {
    if (!domain) return;
    setVerifying(true);
    try {
      const res = await verifyDns(domain.id);
      toast({ title: res.message });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'DNS যাচাই ব্যর্থ।';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">কাস্টম ডোমেইন</h1>

      {/* Current store URL */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> স্টোর ডোমেইন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">বর্তমান শেয়ারযোগ্য লিংক</p>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">{storeUrl || '—'}</code>
              {storeUrl && (
                <Button size="icon" variant="ghost" className="shrink-0" onClick={() => handleCopy(storeUrl, 'store')}>
                  {copiedRow === 'store' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {domain && (
            <>
              <hr />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">প্রাইমারি ডোমেইন</p>
                  <p className="font-medium mt-0.5">{domain.domain}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">স্ট্যাটাস</p>
                  <div className="mt-0.5"><StatusBadge status={domain.status} /></div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SSL স্ট্যাটাস</p>
                  <p className="font-medium mt-0.5">{domain.ssl_status === 'none' ? 'সেটআপ হয়নি' : domain.ssl_status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">যাচাই সময়</p>
                  <p className="font-medium mt-0.5">
                    {domain.verified_at
                      ? new Date(domain.verified_at).toLocaleDateString('bn-BD')
                      : 'যাচাই হয়নি'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleVerify}
                  disabled={verifying || domain.status === 'verified'}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  DNS যাচাই করুন
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={handleRemove}
                  disabled={removing}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  ডোমেইন মুছুন
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add domain */}
      {!domain && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ডোমেইন যোগ করুন</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="domain-input">ডোমেইন নাম</Label>
              <div className="flex gap-2">
                <Input
                  id="domain-input"
                  placeholder="shop.example.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd} disabled={saving || !domainInput.trim()}>
                  {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">উদাহরণ: shop.yourname.com</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DNS instructions (always show if domain exists) */}
      {domain && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              DNS কনফিগারেশন নির্দেশনা
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              আপনার ডোমেইন প্রোভাইডারের DNS সেটিংসে নিচের রেকর্ডগুলো যোগ করুন:
            </p>

            <div className="rounded-md border border-blue-200 bg-white overflow-hidden text-sm">
              <div className="grid grid-cols-4 bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">
                <span>Type</span><span>Host / Name</span><span className="col-span-2">Value / Target</span>
              </div>

              {/* CNAME row */}
              <div className="grid grid-cols-4 items-center px-3 py-2 border-t border-blue-100 gap-1">
                <span className="font-mono font-bold text-blue-700">CNAME</span>
                <span className="font-mono">
                  {domain.domain.split('.').length > 2 ? domain.domain.split('.')[0] : '@'}
                </span>
                <code className="col-span-1 truncate font-mono text-xs">{CNAME_TARGET}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 justify-self-end"
                  onClick={() => handleCopy(CNAME_TARGET, 'cname')}
                >
                  {copiedRow === 'cname' ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>

              {/* A record row */}
              <div className="grid grid-cols-4 items-center px-3 py-2 border-t border-blue-100 gap-1">
                <span className="font-mono font-bold text-blue-700">A</span>
                <span className="font-mono">@</span>
                <code className="col-span-1 font-mono text-xs">{'<আপনার সার্ভার IP>'}</code>
                <span className="text-muted-foreground text-xs justify-self-end">প্রয়োজনে</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              DNS পরিবর্তন প্রচার হতে সাধারণত ২৪-৪৮ ঘণ্টা সময় লাগতে পারে। পরিবর্তনের পরে "DNS যাচাই করুন" বোতামে ক্লিক করুন।
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResellerCustomDomain;
