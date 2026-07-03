<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;

// Phase 3 — generic full-site backup & restore. Replaces the Supabase
// table-by-table dump/restore that used to live in src/lib/backup-utils.ts.
// The frontend keeps the orchestration + progress UI and calls these
// per-table endpoints, so the JSON file format and the per-section result
// shape stay identical.
class BackupController extends Controller
{
    // Dump one table's rows. Supports optional ?limit=N&offset=N pagination so
    // large tables are fetched in chunks without exhausting PHP memory.
    // hasMore=true in the response means more rows remain after this page.
    public function backupTable(Request $request): JsonResponse
    {
        $table = (string) $request->input('table');
        if (!$table || !Schema::hasTable($table)) {
            return response()->json(['rows' => [], 'exists' => false]);
        }

        $limit  = (int) $request->input('limit', 0);
        $offset = (int) $request->input('offset', 0);

        if ($limit > 0) {
            $total   = DB::table($table)->count();
            $rows    = DB::table($table)->offset($offset)->limit($limit)->get();
            $hasMore = ($offset + count($rows)) < $total;
            return response()->json(['rows' => $rows, 'exists' => true, 'hasMore' => $hasMore]);
        }

        return response()->json(['rows' => DB::table($table)->get(), 'exists' => true]);
    }

    // Restore one table. Strategy mirrors the registry: 'replace' wipes then
    // inserts; 'upsert' merges by conflictKey. FK / duplicate rows are skipped
    // so a single bad row never aborts the whole section.
    public function restoreTable(Request $request): JsonResponse
    {
        $table = (string) $request->input('table');
        $strategy = $request->input('strategy', 'replace');
        $conflictKey = $request->input('conflictKey') ?: 'id';
        $rows = (array) $request->input('rows', []);

        if (!Schema::hasTable($table)) {
            return response()->json([
                'status' => 'skipped', 'inserted' => 0,
                'removedColumns' => [], 'error' => 'এই টেবিল সার্ভারে নেই',
            ]);
        }

        // Strip columns that don't exist on the target schema (this replaces the
        // client-side "schema cache" column-removal fallback) and normalize
        // JSON/datetime values for MySQL.
        $cols = Schema::getColumnListing($table);
        $colMeta = $this->getSchemaInfo($table);

        $removed = [];
        $clean = [];
        foreach ($rows as $r) {
            $r = (array) $r;
            $out = [];
            foreach ($r as $k => $v) {
                if (!in_array($k, $cols, true)) { $removed[$k] = true; continue; }
                $out[$k] = $this->normalizeValue($v);
            }
            if (!empty($out)) $clean[] = $out;
        }

        // Fix 1364 (missing required fields) and 1048 (NULL in NOT NULL columns):
        // fill in db-default or synthetic defaults for any NOT NULL column that is
        // absent from or NULL in the backup row.
        $this->fixRequiredFields($clean, $colMeta);

        // Fix 1406 (data too long): truncate VARCHAR values to column limits.
        $this->truncateToLimits($clean, $colMeta);

        // When the frontend sends rows in multiple chunks, only the first chunk
        // should wipe the table.  Subsequent chunks pass clear=false so they
        // append without destroying what the previous chunk already inserted.
        $clearFirst = (bool) $request->input('clear', true);

        try {
            if ($strategy === 'upsert') {
                $inserted = 0;
                foreach ($clean as $row) {
                    if (!array_key_exists($conflictKey, $row)) {
                        DB::table($table)->insert($row); $inserted++; continue;
                    }
                    $exists = DB::table($table)->where($conflictKey, $row[$conflictKey])->exists();
                    if ($exists) {
                        DB::table($table)->where($conflictKey, $row[$conflictKey])->update($row);
                    } else {
                        DB::table($table)->insert($row);
                    }
                    $inserted++;
                }
                return response()->json([
                    'status' => 'success', 'inserted' => $inserted,
                    'removedColumns' => array_keys($removed),
                ]);
            }

            // 'replace' — FK checks off for the whole operation:
            // - DELETE: prevents deadlocks on cascading FK references.
            // - INSERT: allows tables like follow_up_data / courier_dispatch
            //   (whose order_id stores order_code strings, not the UUID PK of
            //   orders) to be restored without spurious FK violations that would
            //   silently skip every row and leave courier/tracking data empty.
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            try {
                if ($clearFirst) {
                    DB::table($table)->delete();
                }

                $inserted = 0; $skipped = 0;
                foreach (array_chunk($clean, 100) as $batch) {
                    try {
                        DB::table($table)->insert($batch);
                        $inserted += count($batch);
                    } catch (\Throwable $e) {
                        // Retry row-by-row, skipping only skippable offenders.
                        foreach ($batch as $row) {
                            try { DB::table($table)->insert($row); $inserted++; }
                            catch (\Throwable $e2) {
                                if ($this->isSkippableError($e2)) { $skipped++; continue; }
                                throw $e2;
                            }
                        }
                    }
                }
            } finally {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }

            // Post-restore normalisation — idempotent (WHERE guards re-runs on later chunks).
            if ($table === 'orders') {
                // 1. invoice_number backfill (newer legacy format)
                try {
                    DB::statement(
                        "UPDATE orders SET order_code = CONCAT('#', CAST(invoice_number AS CHAR)) "
                        . "WHERE (order_code IS NULL OR order_code = '') AND invoice_number IS NOT NULL"
                    );
                } catch (\Throwable $ignored) {}
                // 2. Old backups where id IS the order code (e.g. '#682'). Copy it so
                //    follow_up_data and courier_dispatch lookups still resolve correctly.
                try {
                    DB::statement(
                        "UPDATE orders SET order_code = id "
                        . "WHERE (order_code IS NULL OR order_code = '') AND id LIKE '#%'"
                    );
                } catch (\Throwable $ignored) {}
            }

            if ($table === 'reseller_orders') {
                // Old backups have id='RO176' with no order_code. Add '#' so presentOrder()
                // returns '#RO176' and the follow_up key becomes 'reseller-#RO176'.
                try {
                    DB::statement(
                        "UPDATE reseller_orders SET order_code = CONCAT('#', id) "
                        . "WHERE (order_code IS NULL OR order_code = '') AND id LIKE 'RO%' AND id NOT LIKE '#%'"
                    );
                } catch (\Throwable $ignored) {}
            }

            if ($table === 'follow_up_data') {
                // Old backups stored reseller follow-up keys without '#' (e.g. 'reseller-RO176').
                // Current system uses 'reseller-#RO176'. Normalise so lookups match.
                try {
                    DB::statement(
                        "UPDATE follow_up_data "
                        . "SET order_id = CONCAT('reseller-#', SUBSTR(order_id, 10)) "
                        . "WHERE order_id LIKE 'reseller-RO%' AND order_id NOT LIKE 'reseller-#%'"
                    );
                } catch (\Throwable $ignored) {}
            }

            if ($table === 'courier_dispatch') {
                // Same format mismatch for dispatch entries — normalise 'reseller-RO03' → 'reseller-#RO03'.
                try {
                    DB::statement(
                        "UPDATE courier_dispatch "
                        . "SET order_id = CONCAT('reseller-#', SUBSTR(order_id, 10)) "
                        . "WHERE order_id LIKE 'reseller-RO%' AND order_id NOT LIKE 'reseller-#%'"
                    );
                } catch (\Throwable $ignored) {}
            }

            return response()->json([
                'status' => $skipped > 0 ? 'partial' : 'success',
                'inserted' => $inserted,
                'skippedRows' => $skipped ?: null,
                'removedColumns' => array_keys($removed),
                'error' => $skipped > 0 ? "$skipped টি রো constraint conflict এর কারণে স্কিপ হয়েছে" : null,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'failed', 'inserted' => 0,
                'removedColumns' => array_keys($removed),
                'error' => $e->getMessage(),
            ]);
        }
    }

    // Off-site (Google Drive) backup. The frontend builds the JSON/SQL and posts
    // it here; Laravel forwards it to the external Drive-uploader function so the
    // browser only ever talks to the Laravel API. URL/key are env-overridable.
    public function cloudBackup(Request $request): JsonResponse
    {
        $url = env('CLOUD_BACKUP_URL', 'https://qsaqyoyyganjzezmfqod.supabase.co/functions/v1/auto-backup');
        $key = env('CLOUD_BACKUP_KEY', 'sb_publishable_OoLb-i8gUZgQIHwyUZdiZQ_0dhvezQW');
        try {
            $resp = Http::timeout(120)
                ->withHeaders(['apikey' => $key, 'Authorization' => 'Bearer ' . $key])
                ->post($url, $request->all());
            return response()->json($resp->json() ?? ['ok' => false, 'error' => 'no response']);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    // Returns SHOW COLUMNS metadata keyed by column name.
    private function getSchemaInfo(string $table): array
    {
        try {
            $cols = DB::select("SHOW COLUMNS FROM `{$table}`");
        } catch (\Throwable $e) {
            return [];
        }
        $info = [];
        foreach ($cols as $col) {
            $info[$col->Field] = [
                'type'     => strtolower($col->Type),
                'nullable' => $col->Null === 'YES',
                'default'  => $col->Default,
                'autoInc'  => str_contains(strtolower($col->Extra ?? ''), 'auto_increment'),
            ];
        }
        return $info;
    }

    // Fills in db-default or synthetic values for NOT NULL columns that are
    // absent from or explicitly NULL in a backup row. Prevents 1364 / 1048.
    private function fixRequiredFields(array &$rows, array $colMeta): void
    {
        foreach ($rows as &$row) {
            foreach ($colMeta as $field => $meta) {
                if ($meta['nullable'] || $meta['autoInc']) continue;

                $missing = !array_key_exists($field, $row);
                $nulled  = !$missing && $row[$field] === null;

                if (!$missing && !$nulled) continue;

                if ($missing && $meta['default'] !== null) {
                    // MySQL will supply its own DEFAULT; omitting the column is fine.
                    continue;
                }

                if ($nulled && $meta['default'] !== null) {
                    // Explicit NULL in a NOT NULL column — replace with the declared default.
                    $row[$field] = $this->castToType((string) $meta['default'], $meta['type']);
                    continue;
                }

                // Missing with no DB default, or NULL with no DB default → synthesize.
                $row[$field] = $this->syntheticDefault($field, $meta['type'], $row);
            }
        }
        unset($row);
    }

    // Truncates string values that would exceed VARCHAR column limits. Prevents 1406.
    private function truncateToLimits(array &$rows, array $colMeta): void
    {
        $limits = [];
        foreach ($colMeta as $field => $meta) {
            if (preg_match('/^varchar\((\d+)\)$/i', $meta['type'], $m)) {
                $limits[$field] = (int) $m[1];
            }
        }
        if (empty($limits)) return;

        foreach ($rows as &$row) {
            foreach ($limits as $field => $max) {
                if (isset($row[$field]) && is_string($row[$field]) && mb_strlen($row[$field]) > $max) {
                    $row[$field] = mb_substr($row[$field], 0, $max);
                }
            }
        }
        unset($row);
    }

    // Generates a type-appropriate placeholder for a required column absent from backup.
    private function syntheticDefault(string $field, string $type, array $row): mixed
    {
        // char(36) — UUID primary keys and FK columns
        if (str_contains($type, 'char(36)')) {
            return (string) Str::uuid();
        }

        // slug — derive from name/title + unique suffix so UNIQUE constraint passes
        if ($field === 'slug') {
            $base = $row['name'] ?? $row['title'] ?? null;
            $slug = $base ? Str::slug((string) $base) : 'item';
            return substr($slug, 0, 180) . '-' . Str::random(8);
        }

        // password — bcrypt of random secret; user must reset to regain access
        if ($field === 'password') {
            return Hash::make(Str::random(32));
        }

        // numeric → 0
        if (preg_match('/^(int|bigint|decimal|float|double|tinyint|smallint|mediumint)/', $type)) {
            return 0;
        }

        // datetime/timestamp → now
        if (preg_match('/^(datetime|timestamp)/', $type)) {
            return now()->format('Y-m-d H:i:s');
        }

        // everything else (varchar, text, enum, …) → empty string
        return '';
    }

    private function castToType(string $value, string $type): mixed
    {
        if (preg_match('/^(int|bigint|tinyint|smallint|mediumint)/', $type)) return (int) $value;
        if (preg_match('/^(decimal|float|double)/', $type)) return (float) $value;
        return $value;
    }

    private function normalizeValue($v)
    {
        if (is_array($v)) return json_encode($v, JSON_UNESCAPED_UNICODE);
        // ISO 8601 (Supabase) datetimes → MySQL DATETIME format.
        if (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $v)) {
            try { return Carbon::parse($v)->format('Y-m-d H:i:s'); } catch (\Throwable $e) { return $v; }
        }
        return $v;
    }

    // Returns true for errors that are safe to skip row-by-row rather than crash.
    // 1062 duplicate, 1452/1216/1217 FK violations, 1406 data too long,
    // 3140 invalid JSON value (backup row has malformed json column).
    private function isSkippableError(\Throwable $e): bool
    {
        $code = $e instanceof \Illuminate\Database\QueryException ? ($e->errorInfo[1] ?? null) : null;
        if (in_array($code, [1062, 1292, 1366, 1406, 1216, 1217, 1452, 3140], true)) return true;
        return (bool) preg_match('/(Duplicate entry|foreign key constraint|Invalid JSON)/i', $e->getMessage());
    }
}
