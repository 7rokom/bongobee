import { api } from '@/lib/api';
import {
  ALL_BACKUP_TABLES,
  BACKUP_FILE_VERSION,
  BackupFile,
  BackupTable,
} from './backup-registry';

// ---------- Backup ----------

export interface BackupProgressEvent {
  index: number;
  total: number;
  table: BackupTable;
  count: number;
}

// Fetch a table in pages so PHP never loads the whole table into memory.
const BACKUP_FETCH_SIZE = 1000;

async function backupTablePaginated(tableName: string): Promise<any[]> {
  const allRows: any[] = [];
  let offset = 0;
  for (;;) {
    const res = await api.get(
      `/admin/data/backup-table?table=${encodeURIComponent(tableName)}&limit=${BACKUP_FETCH_SIZE}&offset=${offset}`,
    );
    if (!res?.exists) break;
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    allRows.push(...rows);
    if (!res?.hasMore) break;
    offset += rows.length;
  }
  return allRows;
}

export const createFullBackup = async (
  siteName: string | undefined,
  onProgress?: (e: BackupProgressEvent) => void,
): Promise<BackupFile> => {
  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (let i = 0; i < ALL_BACKUP_TABLES.length; i++) {
    const t = ALL_BACKUP_TABLES[i];
    try {
      const rows = await backupTablePaginated(t.table);
      data[t.key] = rows;
      counts[t.key] = rows.length;
    } catch (err: any) {
      console.warn(`[backup] ${t.table} fetch failed:`, err?.message || err);
      data[t.key] = [];
      counts[t.key] = 0;
    }
    onProgress?.({ index: i, total: ALL_BACKUP_TABLES.length, table: t, count: counts[t.key] });
  }

  return {
    version: BACKUP_FILE_VERSION,
    createdAt: new Date().toISOString(),
    siteName,
    counts,
    data,
  };
};

export const downloadBackupFile = (backup: BackupFile, prefix = 'site-backup') => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, 19);
  a.href = url;
  a.download = `${prefix}_${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// ---------- Validation ----------

export interface BackupValidationResult {
  ok: boolean;
  error?: string;
  knownSections: { key: string; label: string; count: number }[];
  unknownSections: string[];
  missingSections: { key: string; label: string }[];
}

export const validateBackupFile = (parsed: any): BackupValidationResult => {
  const empty: BackupValidationResult = {
    ok: false,
    knownSections: [],
    unknownSections: [],
    missingSections: [],
  };
  if (!parsed || typeof parsed !== 'object') return { ...empty, error: 'Invalid JSON object' };
  if (!parsed.data || typeof parsed.data !== 'object')
    return { ...empty, error: '`data` field missing — এটি সঠিক backup file নয়' };

  const known = ALL_BACKUP_TABLES;
  const knownKeys = new Set(known.map((t) => t.key));
  const fileKeys = Object.keys(parsed.data);

  const knownSections = known
    .filter((t) => Array.isArray(parsed.data[t.key]))
    .map((t) => ({
      key: t.key,
      label: t.label,
      count: (parsed.data[t.key] as any[]).length,
    }));

  const unknownSections = fileKeys.filter((k) => !knownKeys.has(k));
  const missingSections = known
    .filter((t) => !Array.isArray(parsed.data[t.key]))
    .map((t) => ({ key: t.key, label: t.label }));

  return {
    ok: knownSections.length > 0,
    error: knownSections.length === 0 ? 'কোনো বৈধ section পাওয়া যায়নি' : undefined,
    knownSections,
    unknownSections,
    missingSections,
  };
};

// ---------- Restore ----------

export interface RestoreSectionResult {
  key: string;
  label: string;
  status: 'success' | 'skipped' | 'failed' | 'partial';
  inserted: number;
  removedColumns: string[];
  skippedRows?: number;
  error?: string;
}

export interface RestoreProgressEvent {
  index: number;
  total: number;
  table: BackupTable;
}

// Tables with many rows (orders, reseller_orders) are split into chunks so no
// single HTTP request risks hitting PHP post_max_size / memory limits. Smaller
// chunks reduce the chance that an oversized JSON body is silently dropped by PHP.
// The backend wipes the table only on the first chunk (clear=true) and appends on the rest.
const RESTORE_CHUNK_SIZE = 200;

async function restoreTableInChunks(
  t: BackupTable,
  rows: any[],
): Promise<RestoreSectionResult> {
  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += RESTORE_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + RESTORE_CHUNK_SIZE));
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  let removedColumns: string[] = [];
  let overallStatus: RestoreSectionResult['status'] = 'success';
  let firstError: string | undefined;

  for (let ci = 0; ci < chunks.length; ci++) {
    try {
      const res = await api.post('/admin/data/restore-table', {
        table: t.table,
        rows: chunks[ci],
        strategy: t.strategy,
        conflictKey: t.conflictKey || 'id',
        clear: ci === 0, // wipe only on the first chunk
      });

      // Detect silent post_max_size failure: when the JSON request body exceeds
      // PHP's post_max_size, php://input becomes empty → backend receives rows:[]
      // → inserts 0 and returns status:'success' with no error. We catch this by
      // checking that rows were sent but nothing was inserted and nothing was skipped.
      const silentDrop =
        (!res || typeof res !== 'object') ||
        (res?.status !== 'failed' &&
          (res?.inserted ?? 0) === 0 &&
          !(res?.skippedRows) &&
          chunks[ci].length > 0);

      if (silentDrop) {
        overallStatus = 'failed';
        if (!firstError) {
          firstError = `Chunk ${ci + 1}: 0 rows inserted — সার্ভারের post_max_size limit অতিক্রম হতে পারে`;
        }
        console.error(`[restore] ${t.table} chunk ${ci + 1}/${chunks.length}: silent drop detected`, res);
        continue;
      }

      const chunkStatus: string = res?.status || 'success';
      totalInserted += res?.inserted || 0;
      if (res?.skippedRows) totalSkipped += res.skippedRows;
      if (ci === 0 && Array.isArray(res?.removedColumns)) removedColumns = res.removedColumns;
      if (chunkStatus === 'failed') {
        overallStatus = 'failed';
        if (!firstError) firstError = res?.error;
      } else if (chunkStatus === 'partial' && overallStatus !== 'failed') {
        overallStatus = 'partial';
      }
    } catch (err: any) {
      overallStatus = 'failed';
      if (!firstError) firstError = err?.message || 'Chunk failed';
      console.error(`[restore] ${t.table} chunk ${ci + 1}/${chunks.length} failed:`, err);
    }
  }

  if (totalSkipped > 0 && overallStatus === 'success') overallStatus = 'partial';

  return {
    key: t.key,
    label: t.label,
    status: overallStatus,
    inserted: totalInserted,
    removedColumns,
    skippedRows: totalSkipped || undefined,
    error: firstError,
  };
}

export const restoreFullBackup = async (
  backup: BackupFile,
  onProgress?: (e: RestoreProgressEvent) => void,
): Promise<RestoreSectionResult[]> => {
  const results: RestoreSectionResult[] = [];

  for (let i = 0; i < ALL_BACKUP_TABLES.length; i++) {
    const t = ALL_BACKUP_TABLES[i];
    onProgress?.({ index: i, total: ALL_BACKUP_TABLES.length, table: t });

    const rowsRaw = backup.data[t.key];
    if (rowsRaw === undefined) {
      results.push({ key: t.key, label: t.label, status: 'skipped', inserted: 0, removedColumns: [] });
      continue;
    }
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw];

    // Config/singleton tables with nothing to restore stay untouched.
    if (t.strategy === 'upsert' && rows.length === 0) {
      results.push({ key: t.key, label: t.label, status: 'skipped', inserted: 0, removedColumns: [] });
      continue;
    }

    // Large tables are split into chunks to avoid PHP memory exhaustion.
    if (rows.length > RESTORE_CHUNK_SIZE) {
      results.push(await restoreTableInChunks(t, rows));
      continue;
    }

    try {
      const res = await api.post('/admin/data/restore-table', {
        table: t.table,
        rows,
        strategy: t.strategy,
        conflictKey: t.conflictKey || 'id',
        clear: true,
      });
      results.push({
        key: t.key,
        label: t.label,
        status: res?.status || 'success',
        inserted: res?.inserted || 0,
        removedColumns: Array.isArray(res?.removedColumns) ? res.removedColumns : [],
        skippedRows: res?.skippedRows || undefined,
        error: res?.error || undefined,
      });
    } catch (err: any) {
      console.error(`[restore] ${t.table} failed:`, err);
      results.push({
        key: t.key,
        label: t.label,
        status: 'failed',
        inserted: 0,
        removedColumns: [],
        error: err?.message || 'Unknown error',
      });
    }
  }

  return results;
};

export const formatBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};
