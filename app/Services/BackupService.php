<?php

namespace App\Services;

use App\Models\BackupLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BackupService
{
    public function createDatabaseBackup(string $type = 'manual'): array
    {
        $filename = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
        $tempPath = sys_get_temp_dir() . '/' . $filename;

        $log = BackupLog::create([
            'file_name' => $filename,
            'type' => $type,
            'status' => 'started',
        ]);

        try {
            $db = config('database.connections.mysql');
            $host = $db['host'];
            $port = $db['port'];
            $database = $db['database'];
            $username = $db['username'];
            $password = $db['password'];

            $passwordFlag = $password ? '-p' . escapeshellarg($password) : '';
            $command = sprintf(
                'mysqldump --host=%s --port=%s --user=%s %s %s > %s 2>&1',
                escapeshellarg($host),
                escapeshellarg($port),
                escapeshellarg($username),
                $passwordFlag,
                escapeshellarg($database),
                escapeshellarg($tempPath)
            );

            exec($command, $output, $exitCode);

            if ($exitCode !== 0 || !file_exists($tempPath)) {
                throw new \RuntimeException('mysqldump failed: ' . implode("\n", $output));
            }

            $fileSize = filesize($tempPath);
            $content = file_get_contents($tempPath);
            @unlink($tempPath);

            Storage::disk('local')->put('backups/' . $filename, $content);

            $log->update([
                'status' => 'completed',
                'file_size' => $fileSize,
            ]);

            // Keep only last 10 backups
            $this->pruneOldBackups();

            return ['success' => true, 'filename' => $filename, 'size' => $fileSize];
        } catch (\Exception $e) {
            @unlink($tempPath);
            $log->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
            Log::error('Backup failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function listBackups(): array
    {
        $files = Storage::disk('local')->files('backups');
        return array_map(fn($f) => [
            'filename' => basename($f),
            'size' => Storage::disk('local')->size($f),
            'created_at' => date('Y-m-d H:i:s', Storage::disk('local')->lastModified($f)),
        ], array_reverse($files));
    }

    public function downloadBackup(string $filename): ?string
    {
        $path = 'backups/' . $filename;
        if (!Storage::disk('local')->exists($path)) return null;
        return Storage::disk('local')->path($path);
    }

    private function pruneOldBackups(): void
    {
        $files = Storage::disk('local')->files('backups');
        if (count($files) > 10) {
            $toDelete = array_slice($files, 0, count($files) - 10);
            foreach ($toDelete as $file) {
                Storage::disk('local')->delete($file);
            }
        }
    }
}
