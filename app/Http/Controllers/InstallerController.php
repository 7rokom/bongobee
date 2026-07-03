<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use App\Models\Admin;
use App\Models\SiteSetting;
use App\Models\Counter;

/**
 * Laravel-native installer endpoints.
 * Only reachable when storage/framework/installed does NOT exist
 * (enforced by InstallGuard middleware).
 * These complement public/install.php for environments where
 * Laravel can already boot (e.g. .env exists but install is incomplete).
 */
class InstallerController extends Controller
{
    private function alreadyInstalled(): bool
    {
        return file_exists(storage_path('framework/installed'));
    }

    public function requirements(): JsonResponse
    {
        $checks = [
            ['key'=>'php',       'label'=>'PHP ≥ 8.2',              'pass'=>version_compare(PHP_VERSION,'8.2.0','>='), 'detail'=>PHP_VERSION],
            ['key'=>'pdo_mysql', 'label'=>'PDO MySQL',               'pass'=>extension_loaded('pdo_mysql')],
            ['key'=>'openssl',   'label'=>'OpenSSL',                  'pass'=>extension_loaded('openssl')],
            ['key'=>'mbstring',  'label'=>'Mbstring',                 'pass'=>extension_loaded('mbstring')],
            ['key'=>'fileinfo',  'label'=>'Fileinfo',                 'pass'=>extension_loaded('fileinfo')],
            ['key'=>'json',      'label'=>'JSON',                     'pass'=>extension_loaded('json')],
            ['key'=>'curl',      'label'=>'cURL',                     'pass'=>extension_loaded('curl')],
            ['key'=>'tokenizer', 'label'=>'Tokenizer',                'pass'=>extension_loaded('tokenizer')],
            ['key'=>'zip',       'label'=>'ZIP',                      'pass'=>extension_loaded('zip'), 'optional'=>true],
            ['key'=>'storage',   'label'=>'storage/ writable',         'pass'=>is_writable(storage_path())],
            ['key'=>'bootstrap', 'label'=>'bootstrap/cache/ writable', 'pass'=>is_writable(base_path('bootstrap/cache'))],
        ];
        $required = array_filter($checks, fn($c) => !($c['optional'] ?? false));
        return response()->json([
            'checks'  => $checks,
            'allPass' => !in_array(false, array_column(array_values($required), 'pass'), true),
        ]);
    }

    public function checkDb(Request $request): JsonResponse
    {
        $host = $request->input('host', '127.0.0.1');
        $port = $request->input('port', '3306');
        $db   = $request->input('database', '');
        $user = $request->input('username', '');
        $pass = $request->input('password', '');
        if (!$db || !$user) return response()->json(['success'=>false,'error'=>'Database and username required']);
        try {
            $pdo = new \PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [\PDO::ATTR_TIMEOUT=>5, \PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
            $version = $pdo->query('SELECT VERSION()')->fetchColumn();
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            return response()->json(['success'=>true,'mysql_version'=>$version,'message'=>"Connected to MySQL {$version}. Database '{$db}' ready."]);
        } catch (\PDOException $e) {
            return response()->json(['success'=>false,'error'=>$e->getMessage()]);
        }
    }

    public function install(Request $request): JsonResponse
    {
        if ($this->alreadyInstalled()) return response()->json(['success'=>false,'error'=>'Already installed']);
        try {
            // Run migrations
            Artisan::call('migrate', ['--force' => true]);
            $migrateOut = Artisan::output();

            // Run default settings seeder
            Artisan::call('db:seed', ['--class' => 'DefaultSettingsSeeder', '--force' => true]);

            // Create admin
            $adminEmail = $request->input('admin_email') ?: config('app.admin_email');
            $adminName  = $request->input('admin_name', 'Admin');
            $adminPass  = $request->input('admin_password', 'admin123');
            if ($adminEmail) {
                Admin::updateOrCreate(
                    ['email' => $adminEmail],
                    ['name' => $adminName, 'email' => $adminEmail, 'password' => Hash::make($adminPass)]
                );
            }

            // Site settings
            $siteName = $request->input('site_name', config('app.name', 'BongoBee'));
            SiteSetting::set('general', [
                'site_name' => $siteName,
                'tagline'   => '',
                'primary_color'   => '#8B5CF6',
                'secondary_color' => '#7C3AED',
                'phone'     => '',
                'email'     => $adminEmail ?? '',
                'address'   => '',
                'whatsapp_number' => '',
                'currency'  => $request->input('currency', 'BDT'),
                'language'  => $request->input('language', 'bn'),
            ]);

            // Ensure counters
            Counter::firstOrCreate(['id'=>'order_number'],           ['value'=>1000]);
            Counter::firstOrCreate(['id'=>'reseller_order_number'],  ['value'=>1000]);
            Counter::firstOrCreate(['id'=>'digital_order_number'],   ['value'=>1000]);

            // Storage link
            Artisan::call('storage:link', ['--force' => true]);

            // Cache
            Artisan::call('optimize:clear');
            Artisan::call('config:cache');
            Artisan::call('route:cache');

            // Mark installed
            $marker = storage_path('framework/installed');
            file_put_contents($marker, json_encode(['installed_at'=>now()->toISOString(),'version'=>'1.0.0'], JSON_PRETTY_PRINT));

            return response()->json(['success'=>true,'message'=>'Installation complete!','migrate_output'=>$migrateOut]);
        } catch (\Throwable $e) {
            return response()->json(['success'=>false,'error'=>$e->getMessage()]);
        }
    }

    public function restore(Request $request): JsonResponse
    {
        if ($this->alreadyInstalled()) return response()->json(['success'=>false,'error'=>'Already installed']);
        try {
            Artisan::call('migrate', ['--force' => true]);
            // Table restore is handled by public/install.php's restore-table endpoint
            // This endpoint handles the artisan-side finalization after tables are restored.
            Artisan::call('storage:link', ['--force' => true]);
            Artisan::call('optimize:clear');
            Artisan::call('config:cache');
            Artisan::call('route:cache');
            $marker = storage_path('framework/installed');
            file_put_contents($marker, json_encode(['installed_at'=>now()->toISOString(),'version'=>'1.0.0','mode'=>'restore'], JSON_PRETTY_PRINT));
            return response()->json(['success'=>true,'message'=>'Restore finalized']);
        } catch (\Throwable $e) {
            return response()->json(['success'=>false,'error'=>$e->getMessage()]);
        }
    }

    public function validateBackup(Request $request): JsonResponse
    {
        $request->validate(['backup' => 'required|file|max:204800|mimes:json,zip']);
        $file = $request->file('backup');
        $content = file_get_contents($file->getPathname());
        $data = json_decode($content, true);
        if (!$data) return response()->json(['success'=>false,'error'=>'Invalid JSON backup file']);
        if (!isset($data['data'])) return response()->json(['success'=>false,'error'=>'Missing "data" section in backup']);
        $tables = array_keys($data['data']);
        $counts = array_map(fn($t)=>count($data['data'][$t]), $tables);
        return response()->json([
            'success'=>true,
            'version'=>$data['version']??'unknown',
            'created_at'=>$data['createdAt']??$data['created_at']??null,
            'tables'=>$tables,
            'table_counts'=>array_combine($tables,$counts),
            'total_tables'=>count($tables),
            'total_rows'=>array_sum($counts),
        ]);
    }
}
