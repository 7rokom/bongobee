import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Loader2, Code2, MessageSquare, Palette, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useResellerStore } from '@/stores/useResellerStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

const ResellerSettings = () => {
  const auth = (() => {
    try { return JSON.parse(localStorage.getItem('reseller-auth') || 'null'); } catch { return null; }
  })();
  const resellerId: string | undefined = auth?.id;

  const resellers = useResellerStore((s) => s.resellers);
  const fetchResellers = useResellerStore((s) => s.fetchResellers);
  const updateReseller = useResellerStore((s) => s.updateReseller);
  const sitePhone = useSiteSettingsStore((s) => s.phone);
  const siteWhatsapp = useSiteSettingsStore((s) => s.whatsappNumber);
  const defaultPendingSms = useSiteSettingsStore((s) => s.smsPendingTemplate);
  const defaultConfirmedSms = useSiteSettingsStore((s) => s.smsConfirmedTemplate);
  const defaultShipmentSms = useSiteSettingsStore((s) => s.smsShipmentTemplate);
  const defaultFollowupSms = useSiteSettingsStore((s) => s.smsFollowupTemplate);

  const me = resellers.find((r) => r.id === resellerId);
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [headerCode, setHeaderCode] = useState('');
  const [bodyCode, setBodyCode] = useState('');
  const [footerCode, setFooterCode] = useState('');
  const [smsPendingTemplate, setSmsPendingTemplate] = useState('');
  const [smsConfirmedTemplate, setSmsConfirmedTemplate] = useState('');
  const [smsShipmentTemplate, setSmsShipmentTemplate] = useState('');
  const [smsFollowupTemplate, setSmsFollowupTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingCodes, setSavingCodes] = useState(false);
  const [savingSms, setSavingSms] = useState(false);

  const [storefrontLogoUrl, setStorefrontLogoUrl] = useState('');
  const [storefrontFaviconUrl, setStorefrontFaviconUrl] = useState('');
  const [storefrontBio, setStorefrontBio] = useState('');
  const [storefrontAddress, setStorefrontAddress] = useState('');
  const [storefrontPhone, setStorefrontPhone] = useState('');
  const [storefrontFooterCredit, setStorefrontFooterCredit] = useState('');
  const [storefrontFacebookUrl, setStorefrontFacebookUrl] = useState('');
  const [storefrontYoutubeUrl, setStorefrontYoutubeUrl] = useState('');
  const [storefrontTwitterUrl, setStorefrontTwitterUrl] = useState('');
  const [storefrontInstagramUrl, setStorefrontInstagramUrl] = useState('');
  const [storefrontLegalPages, setStorefrontLegalPages] = useState<Array<{ label: string; url: string }>>([]);
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => { if (!resellers.length) fetchResellers(); }, []);
  useEffect(() => {
    if (me) {
      setContactPhone(me.contactPhone || '');
      setContactWhatsapp(me.contactWhatsapp || '');
      setHeaderCode(me.headerCode || '');
      setBodyCode(me.bodyCode || '');
      setFooterCode(me.footerCode || '');
      setSmsPendingTemplate(me.smsPendingTemplate || '');
      setSmsConfirmedTemplate(me.smsConfirmedTemplate || '');
      setSmsShipmentTemplate(me.smsShipmentTemplate || '');
      setSmsFollowupTemplate(me.smsFollowupTemplate || '');
      setStorefrontLogoUrl(me.storefrontLogoUrl || '');
      setStorefrontFaviconUrl(me.storefrontFaviconUrl || '');
      setStorefrontBio(me.storefrontBio || '');
      setStorefrontAddress(me.storefrontAddress || '');
      setStorefrontPhone(me.storefrontPhone || '');
      setStorefrontFooterCredit(me.storefrontFooterCredit || '');
      setStorefrontFacebookUrl(me.storefrontFacebookUrl || '');
      setStorefrontYoutubeUrl(me.storefrontYoutubeUrl || '');
      setStorefrontTwitterUrl(me.storefrontTwitterUrl || '');
      setStorefrontInstagramUrl(me.storefrontInstagramUrl || '');
      setStorefrontLegalPages((me.storefrontLegalPages || []).map(p => ({ label: p.label, url: p.url })));
    }
  }, [me?.id, me?.contactPhone, me?.contactWhatsapp, me?.headerCode, me?.bodyCode, me?.footerCode, me?.smsPendingTemplate, me?.smsConfirmedTemplate, me?.smsShipmentTemplate, me?.smsFollowupTemplate, me?.storefrontLogoUrl]);

  if (!resellerId) {
    return <p className="text-sm text-muted-foreground">লগইন প্রয়োজন।</p>;
  }
  if (!me) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReseller(resellerId, {
        contactPhone: contactPhone.trim(),
        contactWhatsapp: contactWhatsapp.trim(),
      });
      // Update the locally-cached contact info so public reseller pages
      // pick it up without a full reload.
      try {
        const cached = { id: resellerId, contactPhone: contactPhone.trim(), contactWhatsapp: contactWhatsapp.trim() };
        localStorage.setItem('reseller_ref_contact', JSON.stringify(cached));
      } catch { /* ignore */ }
      toast({ title: 'সেটিং সংরক্ষিত হয়েছে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setContactPhone('');
    setContactWhatsapp('');
    setSaving(true);
    try {
      await updateReseller(resellerId, { contactPhone: '', contactWhatsapp: '' });
      try { localStorage.removeItem('reseller_ref_contact'); } catch { /* ignore */ }
      toast({ title: 'ডিফল্ট নাম্বার ব্যবহার করা হবে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCodes = async () => {
    setSavingCodes(true);
    try {
      await updateReseller(resellerId, {
        headerCode: headerCode.trim(),
        bodyCode: bodyCode.trim(),
        footerCode: footerCode.trim(),
      });
      // Refresh the reseller_ref_contact cache so the next reseller product
      // page render reads the new codes without a full reload.
      try {
        const raw = localStorage.getItem('reseller_ref_contact');
        const cached = raw ? JSON.parse(raw) : { id: resellerId };
        cached.headerCode = headerCode.trim();
        cached.bodyCode = bodyCode.trim();
        cached.footerCode = footerCode.trim();
        localStorage.setItem('reseller_ref_contact', JSON.stringify(cached));
      } catch { /* ignore */ }
      toast({ title: 'ট্র্যাকিং কোড সংরক্ষিত হয়েছে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSavingCodes(false);
    }
  };

  const handleClearCodes = async () => {
    setHeaderCode(''); setBodyCode(''); setFooterCode('');
    setSavingCodes(true);
    try {
      await updateReseller(resellerId, { headerCode: '', bodyCode: '', footerCode: '' });
      try {
        const raw = localStorage.getItem('reseller_ref_contact');
        const cached = raw ? JSON.parse(raw) : { id: resellerId };
        cached.headerCode = ''; cached.bodyCode = ''; cached.footerCode = '';
        localStorage.setItem('reseller_ref_contact', JSON.stringify(cached));
      } catch { /* ignore */ }
      toast({ title: 'কোড মুছে ফেলা হয়েছে — সাইটের ডিফল্ট পিক্সেল চলবে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSavingCodes(false);
    }
  };

  const handleSaveSms = async () => {
    setSavingSms(true);
    try {
      await updateReseller(resellerId, {
        smsPendingTemplate: smsPendingTemplate.trim(),
        smsConfirmedTemplate: smsConfirmedTemplate.trim(),
        smsShipmentTemplate: smsShipmentTemplate.trim(),
        smsFollowupTemplate: smsFollowupTemplate.trim(),
      });
      toast({ title: 'SMS মেসেজ সংরক্ষিত হয়েছে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSavingSms(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      await updateReseller(resellerId, {
        storefrontLogoUrl: storefrontLogoUrl.trim(),
        storefrontFaviconUrl: storefrontFaviconUrl.trim(),
        storefrontBio: storefrontBio.trim(),
        storefrontAddress: storefrontAddress.trim(),
        storefrontPhone: storefrontPhone.trim(),
        storefrontFooterCredit: storefrontFooterCredit.trim(),
        storefrontFacebookUrl: storefrontFacebookUrl.trim(),
        storefrontYoutubeUrl: storefrontYoutubeUrl.trim(),
        storefrontTwitterUrl: storefrontTwitterUrl.trim(),
        storefrontInstagramUrl: storefrontInstagramUrl.trim(),
        storefrontLegalPages: storefrontLegalPages
          .filter(p => p.label.trim() && p.url.trim())
          .map(p => ({ label: p.label.trim(), url: p.url.trim(), icon: 'FileText' })),
      });
      toast({ title: 'ব্র্যান্ডিং সংরক্ষিত হয়েছে' });
    } catch (e: any) {
      toast({ title: 'সংরক্ষণ ব্যর্থ', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">সেটিং</h1>
      </div>

      <Card className="p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold mb-1">যোগাযোগের নাম্বার</h2>
          <p className="text-sm text-muted-foreground">
            আপনার রিসেলার লিংকে শেয়ার করা প্রোডাক্ট পেজ, চেকআউট পপআপ ও থ্যাংক ইউ পেজে এই নাম্বারগুলো দেখাবে।
            ফাঁকা রাখলে ডিফল্টভাবে সাইটের নাম্বার ব্যবহার হবে।
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-phone">ফোন নাম্বার</Label>
          <Input
            id="contact-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder={sitePhone ? `ডিফল্ট: ${sitePhone}` : '01XXXXXXXXX'}
            inputMode="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-whatsapp">হোয়াটসঅ্যাপ নাম্বার</Label>
          <Input
            id="contact-whatsapp"
            value={contactWhatsapp}
            onChange={(e) => setContactWhatsapp(e.target.value)}
            placeholder={siteWhatsapp ? `ডিফল্ট: ${siteWhatsapp}` : '01XXXXXXXXX'}
            inputMode="tel"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            সংরক্ষণ করুন
          </Button>
          <Button onClick={handleClear} disabled={saving} variant="outline">
            ডিফল্টে ফিরে যান
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold mb-1">অর্ডার SMS মেসেজ</h2>
            <p className="text-sm text-muted-foreground">
              এখানে মেসেজ লিখলে আপনার রিসেলার অর্ডারে সেটাই যাবে। ফাঁকা থাকলে অ্যাডমিনের ডিফল্ট মেসেজ যাবে।
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sms-pending">পেন্ডিং SMS</Label>
          <Textarea id="sms-pending" value={smsPendingTemplate} onChange={(e) => setSmsPendingTemplate(e.target.value)} placeholder={defaultPendingSms || 'অ্যাডমিন ডিফল্ট মেসেজ ব্যবহার হবে'} rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-confirmed">কনফার্ম SMS</Label>
          <Textarea id="sms-confirmed" value={smsConfirmedTemplate} onChange={(e) => setSmsConfirmedTemplate(e.target.value)} placeholder={defaultConfirmedSms || 'অ্যাডমিন ডিফল্ট মেসেজ ব্যবহার হবে'} rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-shipment">শিপমেন্ট SMS</Label>
          <Textarea id="sms-shipment" value={smsShipmentTemplate} onChange={(e) => setSmsShipmentTemplate(e.target.value)} placeholder={defaultShipmentSms || 'অ্যাডমিন ডিফল্ট মেসেজ ব্যবহার হবে'} rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-followup">ফলোয়াপ SMS</Label>
          <Textarea id="sms-followup" value={smsFollowupTemplate} onChange={(e) => setSmsFollowupTemplate(e.target.value)} placeholder={defaultFollowupSms || 'অ্যাডমিন ডিফল্ট মেসেজ ব্যবহার হবে'} rows={4} />
        </div>

        <Button onClick={handleSaveSms} disabled={savingSms} className="w-full">
          {savingSms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          SMS মেসেজ সংরক্ষণ করুন
        </Button>
      </Card>

      <Card className="p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-2">
          <Palette className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold mb-1">স্টোর ব্র্যান্ডিং</h2>
            <p className="text-sm text-muted-foreground">
              কাস্টম ডোমেইনে আপনার স্টোরের লোগো, ফেভিকন, ঠিকানা ও সোশ্যাল লিংক কাস্টমাইজ করুন।
              ফাঁকা রাখলে সাইটের ডিফল্ট ব্যবহার হবে।
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sf-logo">লোগো URL</Label>
            <Input id="sf-logo" value={storefrontLogoUrl} onChange={(e) => setStorefrontLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-favicon">ফেভিকন URL</Label>
            <Input id="sf-favicon" value={storefrontFaviconUrl} onChange={(e) => setStorefrontFaviconUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sf-bio">স্টোর বায়ো / পরিচিতি</Label>
          <Textarea id="sf-bio" value={storefrontBio} onChange={(e) => setStorefrontBio(e.target.value)} rows={3} placeholder="আপনার স্টোর সম্পর্কে সংক্ষিপ্ত বিবরণ..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sf-address">ঠিকানা</Label>
            <Input id="sf-address" value={storefrontAddress} onChange={(e) => setStorefrontAddress(e.target.value)} placeholder="আপনার ব্যবসার ঠিকানা" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-phone">ফোন নাম্বার (ফুটার)</Label>
            <Input id="sf-phone" value={storefrontPhone} onChange={(e) => setStorefrontPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sf-footer-credit">ফুটার ক্রেডিট</Label>
          <Input id="sf-footer-credit" value={storefrontFooterCredit} onChange={(e) => setStorefrontFooterCredit(e.target.value)} placeholder="© 2026 আপনার স্টোর All Rights Reserved." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sf-fb">Facebook URL</Label>
            <Input id="sf-fb" value={storefrontFacebookUrl} onChange={(e) => setStorefrontFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-yt">YouTube URL</Label>
            <Input id="sf-yt" value={storefrontYoutubeUrl} onChange={(e) => setStorefrontYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-tw">Twitter / X URL</Label>
            <Input id="sf-tw" value={storefrontTwitterUrl} onChange={(e) => setStorefrontTwitterUrl(e.target.value)} placeholder="https://x.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-ig">Instagram URL</Label>
            <Input id="sf-ig" value={storefrontInstagramUrl} onChange={(e) => setStorefrontInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Legal Pages (ফুটারে দেখাবে)</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => setStorefrontLegalPages([...storefrontLegalPages, { label: '', url: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> যোগ করুন
            </Button>
          </div>
          {storefrontLegalPages.map((page, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={page.label}
                onChange={(e) => setStorefrontLegalPages(storefrontLegalPages.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                placeholder="পেজের নাম (যেমন: Privacy Policy)"
                className="flex-1"
              />
              <Input
                value={page.url}
                onChange={(e) => setStorefrontLegalPages(storefrontLegalPages.map((p, j) => j === i ? { ...p, url: e.target.value } : p))}
                placeholder="/privacy অথবা https://..."
                className="flex-1"
              />
              <Button type="button" size="icon" variant="ghost" className="text-destructive flex-shrink-0" onClick={() => setStorefrontLegalPages(storefrontLegalPages.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSaveBranding} disabled={savingBranding} className="w-full">
          {savingBranding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          ব্র্যান্ডিং সংরক্ষণ করুন
        </Button>
      </Card>

      <Card className="p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-2">
          <Code2 className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold mb-1">ট্র্যাকিং কোড / কাস্টম স্ক্রিপ্ট</h2>
            <p className="text-sm text-muted-foreground">
              Facebook Pixel, TikTok Pixel, GTM বা যেকোনো কাস্টম স্ক্রিপ্ট এখানে বসাতে পারবেন।
              এই কোড <strong>শুধুমাত্র আপনার সিংগেল প্রোডাক্ট পেজে</strong> চলবে — মেইন সাইট বা অন্য রিসেলারের পেজে নয়।
              <br />
              <span className="text-foreground">ফাঁকা রাখলে</span> অ্যাডমিনের ডিফল্ট পিক্সেল চলবে।
              কোড বসালে অ্যাডমিনের পিক্সেল আপনার প্রোডাক্ট পেজে বন্ধ থাকবে (ডাবল-ট্র্যাকিং হবে না)।
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="header-code">Header Code (&lt;head&gt;-এ যাবে)</Label>
          <Textarea
            id="header-code"
            value={headerCode}
            onChange={(e) => setHeaderCode(e.target.value)}
            placeholder="<!-- Meta Pixel base code, GTM head snippet, ইত্যাদি -->"
            rows={6}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body-code">Body Code (&lt;body&gt;-এর শুরুতে যাবে)</Label>
          <Textarea
            id="body-code"
            value={bodyCode}
            onChange={(e) => setBodyCode(e.target.value)}
            placeholder="<!-- GTM noscript, ইত্যাদি -->"
            rows={4}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-code">Footer Code (&lt;/body&gt;-এর আগে যাবে)</Label>
          <Textarea
            id="footer-code"
            value={footerCode}
            onChange={(e) => setFooterCode(e.target.value)}
            placeholder="<!-- কাস্টম স্ক্রিপ্ট, chat widget, ইত্যাদি -->"
            rows={4}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSaveCodes} disabled={savingCodes} className="flex-1">
            {savingCodes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            কোড সংরক্ষণ করুন
          </Button>
          <Button onClick={handleClearCodes} disabled={savingCodes} variant="outline">
            মুছে ফেলুন
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ResellerSettings;
