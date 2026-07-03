import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { toast } from 'sonner';
import { Save, Code, FileCode, AlertTriangle } from 'lucide-react';

const DigitalHeaderFooterSettings = () => {
  const settings = useSiteSettingsStore();
  const [headerCode, setHeaderCode] = useState(settings.digitalHeaderCode || '');
  const [bodyCode, setBodyCode] = useState(settings.digitalBodyCode || '');
  const [footerCode, setFooterCode] = useState(settings.digitalFooterCode || '');

  useEffect(() => { setHeaderCode(settings.digitalHeaderCode || ''); }, [settings.digitalHeaderCode]);
  useEffect(() => { setBodyCode(settings.digitalBodyCode || ''); }, [settings.digitalBodyCode]);
  useEffect(() => { setFooterCode(settings.digitalFooterCode || ''); }, [settings.digitalFooterCode]);

  const handleSave = () => {
    settings.updateSettings({
      digitalHeaderCode: headerCode,
      digitalBodyCode: bodyCode,
      digitalFooterCode: footerCode,
    });
    toast.success('ডিজিটাল পিক্সেল সেভ হয়েছে!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ডিজিটাল প্রডাক্ট পিক্সেল</h1>
        <p className="text-muted-foreground text-sm">শুধুমাত্র ডিজিটাল প্রডাক্ট পেজগুলোতে এই কোড লোড হবে। মেইন সাইটের পিক্সেল ডিজিটাল পেজে চলবে না।</p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <p className="text-sm">
          এই কোডগুলো শুধুমাত্র /digital-product, /digital-products এবং /digital/* রুটে কাজ করবে। মেইন সাইটের জন্য আলাদা পিক্সেল সেটিংস ব্যবহার করুন।
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="h-5 w-5" /> Header কোড (Head Section)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            এই কোড পেজের {'<head>'} ট্যাগের ভিতরে বসবে।
          </Label>
          <Textarea
            value={headerCode}
            onChange={(e) => setHeaderCode(e.target.value)}
            placeholder={'<!-- Facebook Pixel / GTM head code -->'}
            className="font-mono text-xs min-h-[150px] bg-muted/30"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5" /> Body কোড (Body এর শুরুতে)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            এই কোড {'<body>'} ট্যাগ ওপেন হওয়ার পরপরই বসবে।
          </Label>
          <Textarea
            value={bodyCode}
            onChange={(e) => setBodyCode(e.target.value)}
            placeholder={'<!-- GTM noscript / Pixel noscript -->'}
            className="font-mono text-xs min-h-[150px] bg-muted/30"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="h-5 w-5" /> Footer কোড (Body এর শেষে)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            এই কোড {'</body>'} ট্যাগের আগে বসবে।
          </Label>
          <Textarea
            value={footerCode}
            onChange={(e) => setFooterCode(e.target.value)}
            placeholder={'<!-- Facebook Pixel / Chat widget -->'}
            className="font-mono text-xs min-h-[150px] bg-muted/30"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="gap-2">
        <Save className="h-4 w-4" /> সেভ করুন
      </Button>
    </div>
  );
};

export default DigitalHeaderFooterSettings;
