import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Loader2,
  FileJson,
  ShieldCheck,
  CircleSlash,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import {
  BACKUP_GROUPS,
  ALL_BACKUP_TABLES,
  BackupFile,
} from '@/lib/backup-registry';
import {
  createFullBackup,
  downloadBackupFile,
  validateBackupFile,
  restoreFullBackup,
  formatBytes,
  BackupValidationResult,
  RestoreSectionResult,
} from '@/lib/backup-utils';

type Phase = 'idle' | 'backing-up' | 'restoring';

const BackupRestore = () => {
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(
    () => localStorage.getItem('last_backup_at'),
  );

  // Restore state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupFile | null>(null);
  const [validation, setValidation] = useState<BackupValidationResult | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreResults, setRestoreResults] = useState<RestoreSectionResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud (Google Drive) manual trigger
  const [cloudBackingUp, setCloudBackingUp] = useState(false);
  const [cloudResult, setCloudResult] = useState<any>(null);

  const isProcessing = phase !== 'idle';

  const handleCloudBackup = async () => {
    setCloudBackingUp(true);
    setCloudResult(null);
    setPhase('backing-up');
    setProgress(0);
    setCurrentItem('');
    try {
      // 1. Build backup in browser using admin session (same as manual download — no SERVICE_ROLE_KEY needed)
      const { buildSqlDump } = await import('@/lib/sql-dump');
      const backup = await createFullBackup(siteName, ({ index, total, table, count }) => {
        setProgress(Math.round(((index + 1) / total) * 100));
        setCurrentItem(`${table.label} (${count})`);
      });
      const totalRows = Object.values(backup.counts).reduce((a, b) => a + b, 0);
      const json = JSON.stringify(backup, null, 2);
      const sql = buildSqlDump(backup);
      const dateStr = backup.createdAt.slice(0, 10);

      // 2. Hand off to Laravel, which forwards to the Google Drive uploader.
      setCurrentItem('Google Drive-এ আপলোড হচ্ছে…');
      const { api } = await import('@/lib/api');
      const data = await api.post('/admin/data/cloud-backup', {
        trigger: 'manual',
        mode: 'upload',
        json,
        sql,
        totalRows,
        tableCount: ALL_BACKUP_TABLES.length,
        dateStr,
      });
      if (data?.ok === false) {
        throw new Error(data?.error || 'Cloud backup failed');
      }
      setCloudResult({ ...data, totalRows, tableCount: ALL_BACKUP_TABLES.length });
      toast.success(
        `Google Drive ব্যাকআপ সম্পন্ন — ${totalRows} রো, ${ALL_BACKUP_TABLES.length} টেবিল`,
      );
    } catch (err: any) {
      console.error(err);
      toast.error('Google Drive ব্যাকআপ ব্যর্থ: ' + (err?.message || ''));
    } finally {
      setCloudBackingUp(false);
      setPhase('idle');
      setProgress(0);
      setCurrentItem('');
    }
  };

  // ---- Backup ----
  const handleBackup = async () => {
    setPhase('backing-up');
    setProgress(0);
    setCurrentItem('');
    try {
      const backup = await createFullBackup(siteName, ({ index, total, table, count }) => {
        setProgress(Math.round(((index + 1) / total) * 100));
        setCurrentItem(`${table.label} (${count})`);
      });
      downloadBackupFile(backup);
      const totalRows = Object.values(backup.counts).reduce((a, b) => a + b, 0);
      const ts = new Date().toISOString();
      localStorage.setItem('last_backup_at', ts);
      setLastBackupAt(ts);
      toast.success(`ব্যাকআপ সম্পন্ন — ${ALL_BACKUP_TABLES.length} সেকশন, মোট ${totalRows} রো`);
    } catch (err: any) {
      console.error(err);
      toast.error('ব্যাকআপ নিতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setPhase('idle');
      setProgress(0);
      setCurrentItem('');
    }
  };

  // ---- File select & validate ----
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const v = validateBackupFile(parsed);
      setPendingFile(file);
      setParsedBackup(parsed as BackupFile);
      setValidation(v);
      setConfirmText('');
      setRestoreResults(null);
      if (!v.ok) {
        toast.error(v.error || 'ফাইল valid নয়');
      }
    } catch (err: any) {
      toast.error('JSON parse error: ' + (err?.message || ''));
      setPendingFile(null);
      setParsedBackup(null);
      setValidation(null);
    }
  };

  const cancelRestore = () => {
    setPendingFile(null);
    setParsedBackup(null);
    setValidation(null);
    setConfirmText('');
    setRestoreResults(null);
  };

  // ---- Restore ----
  const executeRestore = async () => {
    if (!parsedBackup || !validation?.ok) return;

    // 1. Auto safety backup of current state
    setPhase('backing-up');
    setProgress(0);
    setCurrentItem('সেফটি ব্যাকআপ তৈরি হচ্ছে…');
    try {
      const safety = await createFullBackup(siteName, ({ index, total, table }) => {
        setProgress(Math.round(((index + 1) / total) * 100));
        setCurrentItem(`সেফটি ব্যাকআপ: ${table.label}`);
      });
      downloadBackupFile(safety, 'safety-backup');
      toast.success('সেফটি ব্যাকআপ ডাউনলোড হয়েছে');
    } catch (err: any) {
      console.error(err);
      toast.error('সেফটি ব্যাকআপ ব্যর্থ — restore বাতিল হলো');
      setPhase('idle');
      return;
    }

    // 2. Restore
    setPhase('restoring');
    setProgress(0);
    setCurrentItem('');
    try {
      const results = await restoreFullBackup(parsedBackup, ({ index, total, table }) => {
        setProgress(Math.round(((index + 1) / total) * 100));
        setCurrentItem(table.label);
      });
      setRestoreResults(results);
      const failed = results.filter((r) => r.status === 'failed').length;
      const success = results.filter((r) => r.status !== 'failed' && r.status !== 'skipped').length;
      // Clear persisted order/reseller caches so the page reload always fetches
      // fresh data from the restored DB — stale localStorage would show old
      // orders whose order_code no longer exists, making update/delete silently fail.
      localStorage.removeItem('cache-orders');
      localStorage.removeItem('cache-resellers');
      if (failed > 0) {
        toast.warning(`Restore সম্পন্ন — ${success} সফল, ${failed} ব্যর্থ। পেজ ৫ সেকেন্ডে রিলোড হবে`);
        setTimeout(() => window.location.reload(), 5000);
      } else {
        toast.success(`Restore সফল — ${success} সেকশন। পেজ ৩ সেকেন্ডে রিলোড হবে`);
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Restore-এ ত্রুটি: ' + (err?.message || ''));
    } finally {
      setPhase('idle');
      setProgress(0);
      setCurrentItem('');
    }
  };

  const validationByKey = useMemo(() => {
    const map = new Map<string, number>();
    validation?.knownSections.forEach((s) => map.set(s.key, s.count));
    return map;
  }, [validation]);

  const restoreReady =
    !!parsedBackup && !!validation?.ok && confirmText.trim() === 'REPLACE';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" /> ব্যাকআপ ও রিস্টোর
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            পুরো সাইটের ডাটা একটি JSON ফাইলে ডাউনলোড করুন বা পূর্বের ব্যাকআপ থেকে restore করুন।
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {lastBackupAt ? (
            <>সর্বশেষ ব্যাকআপ: {new Date(lastBackupAt).toLocaleString('bn-BD')}</>
          ) : (
            'এখনো কোনো ব্যাকআপ নেওয়া হয়নি'
          )}
        </div>
      </div>

      {/* Progress */}
      {isProcessing && (
        <Card className="border-primary/30">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="font-medium">
                {phase === 'backing-up' ? 'ব্যাকআপ চলছে' : 'রিস্টোর চলছে'}
              </span>
              <span className="text-muted-foreground truncate">— {currentItem}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* ============ BACKUP CARD ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" /> ফুল ব্যাকআপ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            নিচের সব সেকশনের ডাটা একসাথে একটি JSON ফাইলে ডাউনলোড হবে।
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {BACKUP_GROUPS.map((g) => (
              <div key={g.key} className="border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{g.tables.length}</Badge>
                </div>
                <ul className="space-y-1">
                  {g.tables.map((t) => (
                    <li
                      key={t.key}
                      className="text-xs text-muted-foreground flex items-center justify-between"
                    >
                      <span>• {t.label}</span>
                      <span className="text-[10px] text-muted-foreground/70 font-mono">
                        {t.strategy === 'upsert' ? 'upsert' : 'replace'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Button onClick={handleBackup} disabled={isProcessing} className="gap-2 w-full sm:w-auto">
            {phase === 'backing-up' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            ফুল ব্যাকআপ ডাউনলোড করুন
          </Button>
        </CardContent>
      </Card>

      {/* ============ GOOGLE DRIVE MANUAL BACKUP ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Google Drive ব্যাকআপ (Manual)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            প্রতিদিন রাত ১২টায় অটো ব্যাকআপ হয়। চাইলে এখনই ম্যানুয়ালি ট্রিগার করতে পারেন — JSON ও SQL
            দুই ফরম্যাটেই আপনার Google Drive-এর <strong>BongoBee Backups</strong> ফোল্ডারে সেভ হবে।
          </p>

          <Button
            onClick={handleCloudBackup}
            disabled={cloudBackingUp}
            className="gap-2 w-full sm:w-auto"
          >
            {cloudBackingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            এখনই ব্যাকআপ নিন
          </Button>

          {cloudResult && (
            <div className="p-3 rounded-md border bg-muted/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> ব্যাকআপ সফলভাবে Google Drive-এ আপলোড হয়েছে
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>টেবিল: <span className="font-mono text-foreground">{cloudResult.tableCount}</span></div>
                <div>রো: <span className="font-mono text-foreground">{cloudResult.totalRows}</span></div>
                <div>সময়: <span className="font-mono text-foreground">{cloudResult.durationMs}ms</span></div>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {cloudResult.jsonLink && (
                  <a href={cloudResult.jsonLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    JSON ফাইল
                  </a>
                )}
                {cloudResult.sqlLink && (
                  <a href={cloudResult.sqlLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    SQL ফাইল
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      {/* ============ RESTORE CARD ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> রিস্টোর (Replace Mode)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">
              <strong>সতর্কতা:</strong> এটি <strong>Full Replace</strong> mode — restore করলে
              বর্তমান সব ডাটা মুছে গিয়ে ফাইলের ডাটা বসবে। আপনাকে সুরক্ষার জন্য একটি{' '}
              <strong>সেফটি ব্যাকআপ</strong> অটো ডাউনলোড করানো হবে restore শুরু হওয়ার আগে।
            </p>
          </div>

          {/* File picker */}
          {!pendingFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                <FileJson className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">ব্যাকআপ JSON ফাইল সিলেক্ট করুন</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ক্লিক করুন বা ফাইল ড্রপ করুন
                </p>
              </button>
            </>
          )}

          {/* File preview */}
          {pendingFile && parsedBackup && validation && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(pendingFile.size)} · version {parsedBackup.version || '?'} ·{' '}
                      {parsedBackup.createdAt
                        ? new Date(parsedBackup.createdAt).toLocaleString('bn-BD')
                        : 'no date'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={cancelRestore} disabled={isProcessing}>
                  বাতিল
                </Button>
              </div>

              {!validation.ok && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validation.error}</span>
                </div>
              )}

              {/* Section preview */}
              {validation.ok && (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">ফাইলে যা পাওয়া গেছে:</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {BACKUP_GROUPS.map((g) => (
                        <div key={g.key} className="border rounded-lg p-3 bg-card">
                          <h4 className="text-xs font-semibold text-foreground mb-2">
                            {g.label}
                          </h4>
                          <ul className="space-y-1">
                            {g.tables.map((t) => {
                              const count = validationByKey.get(t.key);
                              const has = count !== undefined;
                              return (
                                <li
                                  key={t.key}
                                  className="text-xs flex items-center justify-between"
                                >
                                  <span
                                    className={
                                      has ? 'text-foreground' : 'text-muted-foreground/60'
                                    }
                                  >
                                    {has ? (
                                      <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-600" />
                                    ) : (
                                      <CircleSlash className="w-3 h-3 inline mr-1" />
                                    )}
                                    {t.label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {has ? count : '—'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {validation.unknownSections.length > 0 && (
                    <div className="p-3 rounded-md border bg-muted/30 text-xs text-muted-foreground">
                      <strong>অপ্রচলিত sections (ignore হবে):</strong>{' '}
                      {validation.unknownSections.join(', ')}
                    </div>
                  )}

                  {/* Confirm */}
                  <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5 space-y-3">
                    <p className="text-sm">
                      নিশ্চিত হতে নিচের বক্সে <strong>REPLACE</strong> টাইপ করুন:
                    </p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="REPLACE"
                      disabled={isProcessing}
                      className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-destructive/50"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!restoreReady || isProcessing}
                        onClick={executeRestore}
                        className="gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        সেফটি ব্যাকআপ + রিস্টোর শুরু করুন
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelRestore}
                        disabled={isProcessing}
                      >
                        বাতিল
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Restore results */}
          {restoreResults && (
            <div className="space-y-2">
              <p className="text-sm font-medium">রিস্টোর রিপোর্ট</p>
              <div className="border rounded-lg divide-y max-h-80 overflow-auto">
                {restoreResults.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : r.status === 'partial' ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : r.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      ) : (
                        <CircleSlash className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.removedColumns.length > 0 && (
                        <span className="text-[10px] text-amber-600">
                          ignored: {r.removedColumns.join(', ')}
                        </span>
                      )}
                      <span className="font-mono text-muted-foreground">
                        {r.status === 'failed'
                          ? r.error?.slice(0, 60) || 'failed'
                          : r.status === 'partial'
                          ? `${r.inserted} rows · ${r.skippedRows} skipped`
                          : `${r.inserted} rows`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupRestore;
