// Build a SQL dump from a BackupFile.
// Mirrors the server-side dump used by the off-site (cloud) backup uploader
// so manual browser-triggered backups produce identical output.

import { ALL_BACKUP_TABLES, BACKUP_FILE_VERSION, BackupFile } from './backup-registry';

const sqlEscape = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
};

export const buildSqlDump = (backup: BackupFile): string => {
  const lines: string[] = [];
  const totalRows = Object.values(backup.counts).reduce((a, b) => a + b, 0);
  lines.push(`-- BongoBee backup`);
  lines.push(`-- Created: ${backup.createdAt}`);
  lines.push(`-- Version: ${BACKUP_FILE_VERSION}`);
  lines.push(`-- Tables: ${ALL_BACKUP_TABLES.length}, total rows: ${totalRows}`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (const t of ALL_BACKUP_TABLES) {
    const rows = backup.data[t.key] || [];
    lines.push(`-- ====== ${t.table} (${rows.length} rows, strategy=${t.strategy}) ======`);
    if (rows.length === 0) {
      lines.push('');
      continue;
    }
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(', ');
    for (const r of rows) {
      const values = cols.map((c) => sqlEscape((r as any)[c])).join(', ');
      if (t.strategy === 'upsert') {
        const conflict = t.conflictKey || 'id';
        const updates = cols
          .filter((c) => c !== conflict)
          .map((c) => `"${c}"=EXCLUDED."${c}"`)
          .join(', ');
        lines.push(
          `INSERT INTO public.${t.table} (${colList}) VALUES (${values}) ON CONFLICT ("${conflict}") DO UPDATE SET ${updates};`,
        );
      } else {
        lines.push(
          `INSERT INTO public.${t.table} (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`,
        );
      }
    }
    lines.push('');
  }

  lines.push('COMMIT;');
  return lines.join('\n');
};
