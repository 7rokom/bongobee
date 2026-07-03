import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { renderTemplate, sendBulkSmsApi, TEMPLATE_VARS_HELP, type SmsTemplateVars } from '@/lib/bulksms';

interface ManualTemplate { name: string; body: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  vars: SmsTemplateVars;
  templates: ManualTemplate[];
  title?: string;
}

export default function ManualSmsDialog({ open, onOpenChange, phone, vars, templates, title }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setMessage(templates[0]?.body || '');
    }
  }, [open, templates]);

  const insertShortcode = (code: string) => {
    const ta = taRef.current;
    if (!ta) { setMessage((m) => m + code); return; }
    const start = ta.selectionStart ?? message.length;
    const end = ta.selectionEnd ?? message.length;
    const next = message.slice(0, start) + code + message.slice(end);
    setMessage(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + code.length, start + code.length);
    }, 0);
  };

  const handleSend = async () => {
    if (!phone) { toast.error('ফোন নম্বর নেই'); return; }
    const rendered = renderTemplate(message, vars).trim();
    if (!rendered) { toast.error('মেসেজ খালি'); return; }
    setSending(true);
    try {
      const r = await sendBulkSmsApi([{ phone, message: rendered }]);
      if (r.success) {
        toast.success('SMS পাঠানো হয়েছে');
        onOpenChange(false);
      } else {
        toast.error(r.error || 'SMS পাঠানো ব্যর্থ');
      }
    } finally {
      setSending(false);
    }
  };

  const preview = renderTemplate(message, vars);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || 'SMS পাঠান'} — {phone}</DialogTitle>
        </DialogHeader>

        {templates.length > 0 && (
          <div>
            <Label className="text-xs">ডিফল্ট টেমপ্লেট থেকে বেছে নিন</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {templates.map((t, i) => (
                <Button key={i} type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setMessage(t.body)}>
                  {t.name || `টেমপ্লেট ${i + 1}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">মেসেজ</Label>
          <Textarea ref={taRef} rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="মেসেজ লিখুন... শর্ট কোড ব্যবহার করতে পারেন (যেমনঃ {whatsapp})" />
          <p className="text-[10px] text-muted-foreground mt-1">{message.length} অক্ষর</p>
        </div>

        <div>
          <Label className="text-xs">শর্ট কোড (ক্লিক করে যোগ করুন)</Label>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {TEMPLATE_VARS_HELP.map((v) => (
              <button key={v.key} type="button" title={v.desc}
                onClick={() => insertShortcode(v.key)}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-muted hover:bg-accent">
                {v.key}
              </button>
            ))}
          </div>
        </div>

        {preview && (
          <div className="border rounded p-2 bg-muted/40">
            <Label className="text-[10px] text-muted-foreground">প্রিভিউ</Label>
            <p className="text-xs whitespace-pre-wrap mt-1">{preview}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>বাতিল</Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            পাঠান
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
