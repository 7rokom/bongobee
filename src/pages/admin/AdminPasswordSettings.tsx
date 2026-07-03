import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminStore } from '@/stores/useAdminStore';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const AdminPasswordSettings = () => {
  const {
    storedAdminEmail,
    storedAdminPassword,
    updateAdminCredentials,
    fetchCredentials,
    credentialsLoaded,
  } = useAdminStore();
  const [currentPass, setCurrentPass] = useState('');
  const [newEmail, setNewEmail] = useState(storedAdminEmail);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Always sync with the latest credentials from DB on mount
  useEffect(() => {
    fetchCredentials(true);
  }, [fetchCredentials]);

  // Keep email input in sync when store updates from DB
  useEffect(() => {
    setNewEmail(storedAdminEmail);
  }, [storedAdminEmail]);

  const handleSave = async () => {
    if (!credentialsLoaded) {
      toast.error('ক্রেডেনশিয়াল লোড হচ্ছে, একটু অপেক্ষা করুন');
      return;
    }
    if (currentPass !== storedAdminPassword) {
      toast.error('বর্তমান পাসওয়ার্ড সঠিক নয়');
      return;
    }
    if (!newEmail) {
      toast.error('ইমেইল দিন');
      return;
    }
    
    const finalPass = newPass || storedAdminPassword;
    if (newPass) {
      if (newPass.length < 4) {
        toast.error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে');
        return;
      }
      if (newPass !== confirmPass) {
        toast.error('নতুন পাসওয়ার্ড মিলছে না');
        return;
      }
    }

    setSaving(true);
    try {
      await updateAdminCredentials(newEmail, finalPass);
      toast.success('অ্যাডমিন ক্রেডেনশিয়াল আপডেট হয়েছে ✅');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      toast.error(`সেভ ব্যর্থ: ${err?.message || 'অজানা সমস্যা'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">অ্যাডমিন পাসওয়ার্ড সেটিংস</h1>
        <p className="text-sm text-muted-foreground">অ্যাডমিন লগইন ইমেইল ও পাসওয়ার্ড পরিবর্তন করুন</p>
      </div>

      <Card className="border-0 shadow-sm max-w-lg">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">পরিবর্তন করতে বর্তমান পাসওয়ার্ড প্রয়োজন</p>
          </div>

          <div className="space-y-1.5">
            <Label>বর্তমান পাসওয়ার্ড *</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="বর্তমান পাসওয়ার্ড দিন"
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>অ্যাডমিন ইমেইল</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="নতুন ইমেইল"
              />
            </div>

            <div className="space-y-1.5">
              <Label>নতুন পাসওয়ার্ড (পরিবর্তন না করলে ফাঁকা রাখুন)</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="নতুন পাসওয়ার্ড"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {newPass && (
              <div className="space-y-1.5">
                <Label>পাসওয়ার্ড কনফার্ম করুন</Label>
                <Input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="আবার পাসওয়ার্ড দিন"
                />
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving || !credentialsLoaded} className="w-full gap-2">
            <KeyRound className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPasswordSettings;
