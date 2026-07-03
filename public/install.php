<?php
// =============================================================================
// BongoBee Installation Wizard — public/install.php
// Completely standalone. Does NOT require Laravel to be bootstrapped.
// Works on fresh hosting without SSH or Artisan access.
// =============================================================================
define('BB_INSTALLER_VERSION', '1.0.0');
define('BB_ROOT', dirname(__DIR__));
define('BB_INSTALLED_MARKER', BB_ROOT . '/storage/framework/installed');
define('BB_ENV_PATH', BB_ROOT . '/.env');
define('BB_ENV_EXAMPLE', BB_ROOT . '/.env.example');

// ─── Block if already installed (unless ?debug=1 is passed) ─────────────────
if (file_exists(BB_INSTALLED_MARKER) && empty($_GET['debug'])) {
    header('Location: /'); exit;
}

// ─── Security headers ────────────────────────────────────────────────────────
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// =============================================================================
// HELPERS
// =============================================================================
function bb_env(string $path): array {
    if (!file_exists($path)) return [];
    $env = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $env[trim($k)] = trim($v, " \t\"'");
    }
    return $env;
}

function bb_pdo(): PDO {
    $e = bb_env(BB_ENV_PATH);
    return new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $e['DB_HOST'] ?? '127.0.0.1', $e['DB_PORT'] ?? '3306', $e['DB_DATABASE'] ?? ''),
        $e['DB_USERNAME'] ?? '', $e['DB_PASSWORD'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
}

function bb_artisan(string $cmd): array {
    $php = PHP_BINARY ?: 'php';
    $art = BB_ROOT . '/artisan';
    if (!file_exists($art)) return [false, 'artisan not found'];
    $out = []; $code = 0;
    exec(escapeshellarg($php) . ' ' . escapeshellarg($art) . ' ' . $cmd . ' 2>&1', $out, $code);
    return [$code === 0, implode("\n", $out)];
}

function bb_json(array $data): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

// ─── Requirements ────────────────────────────────────────────────────────────
function a_requirements(): array {
    $checks = [
        ['k'=>'php',       'label'=>'PHP ≥ 8.2',              'pass'=>version_compare(PHP_VERSION,'8.2.0','>='), 'detail'=>'Current: '.PHP_VERSION],
        ['k'=>'pdo_mysql', 'label'=>'PDO MySQL',               'pass'=>extension_loaded('pdo_mysql')],
        ['k'=>'openssl',   'label'=>'OpenSSL',                  'pass'=>extension_loaded('openssl')],
        ['k'=>'mbstring',  'label'=>'Mbstring',                 'pass'=>extension_loaded('mbstring')],
        ['k'=>'fileinfo',  'label'=>'Fileinfo',                 'pass'=>extension_loaded('fileinfo')],
        ['k'=>'json',      'label'=>'JSON',                     'pass'=>extension_loaded('json')],
        ['k'=>'curl',      'label'=>'cURL',                     'pass'=>extension_loaded('curl')],
        ['k'=>'tokenizer', 'label'=>'Tokenizer',                'pass'=>extension_loaded('tokenizer')],
        ['k'=>'zip',       'label'=>'ZIP (backup restore)',      'pass'=>extension_loaded('zip'),     'optional'=>true],
        ['k'=>'storage',   'label'=>'storage/ writable',         'pass'=>is_dir(BB_ROOT.'/storage') && is_writable(BB_ROOT.'/storage')],
        ['k'=>'bootstrap', 'label'=>'bootstrap/cache/ writable', 'pass'=>is_dir(BB_ROOT.'/bootstrap/cache') && is_writable(BB_ROOT.'/bootstrap/cache')],
        ['k'=>'public',    'label'=>'public/ writable',          'pass'=>is_writable(BB_ROOT.'/public')],
        ['k'=>'artisan',   'label'=>'artisan exists',            'pass'=>file_exists(BB_ROOT.'/artisan')],
        ['k'=>'env_ex',    'label'=>'.env.example exists',       'pass'=>file_exists(BB_ENV_EXAMPLE)],
    ];
    $required = array_filter($checks, fn($c) => !($c['optional'] ?? false));
    return ['checks'=>$checks, 'allPass'=>!in_array(false, array_column(array_values($required),'pass'), true)];
}

// ─── Test DB connection ───────────────────────────────────────────────────────
function a_test_db(): array {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $host = $d['host'] ?? '127.0.0.1';
    $port = $d['port'] ?? '3306';
    $db   = trim($d['database'] ?? '');
    $user = trim($d['username'] ?? '');
    $pass = $d['password'] ?? '';
    if (!$db || !$user) return ['success'=>false,'error'=>'Database name and username are required'];
    try {
        $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass,
            [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT=>5]);
        $ver = $pdo->query('SELECT VERSION()')->fetchColumn();
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        return ['success'=>true,'mysql_version'=>$ver,'message'=>"Connected to MySQL {$ver}. Database '{$db}' is ready."];
    } catch (PDOException $e) {
        return ['success'=>false,'error'=>$e->getMessage()];
    }
}

// ─── Create .env file ─────────────────────────────────────────────────────────
function a_create_env(): array {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $appName   = $d['app_name']       ?? 'BongoBee';
    $appUrl    = rtrim($d['app_url']  ?? 'http://localhost', '/');
    $tz        = $d['timezone']       ?? 'Asia/Dhaka';
    $lang      = $d['language']       ?? 'bn';
    $dbHost    = $d['db_host']        ?? '127.0.0.1';
    $dbPort    = $d['db_port']        ?? '3306';
    $dbName    = $d['db_database']    ?? '';
    $dbUser    = $d['db_username']    ?? '';
    $dbPass    = $d['db_password']    ?? '';
    $adminEmail= $d['admin_email']    ?? '';
    $adminName = $d['admin_name']     ?? 'Admin';
    $adminPass = $d['admin_password'] ?? '';
    $domain    = parse_url($appUrl, PHP_URL_HOST) ?: 'localhost';

    $env = <<<ENV
APP_NAME="{$appName}"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL={$appUrl}
APP_TIMEZONE={$tz}
APP_LOCALE={$lang}
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
APP_MAINTENANCE_DRIVER=file
BCRYPT_ROUNDS=12
LOG_CHANNEL=daily
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error
DB_CONNECTION=mysql
DB_HOST={$dbHost}
DB_PORT={$dbPort}
DB_DATABASE={$dbName}
DB_USERNAME={$dbUser}
DB_PASSWORD="{$dbPass}"
SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=file
MEMCACHED_HOST=127.0.0.1
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@{$domain}"
MAIL_FROM_NAME="{$appName}"
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false
VITE_APP_NAME="{$appName}"
VITE_APP_DOMAIN={$domain}
ADMIN_EMAIL={$adminEmail}
ADMIN_NAME="{$adminName}"
ADMIN_PASSWORD="{$adminPass}"
BULKSMS_API_KEY=
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=
BDCOURIER_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
YOUTUBE_API_KEY=
CLOUD_BACKUP_URL=
CLOUD_BACKUP_KEY=
CUSTOM_DOMAIN_CNAME=store.{$domain}
CUSTOM_DOMAIN_SERVER_IP=
ENV;

    if (file_put_contents(BB_ENV_PATH, $env) === false)
        return ['success'=>false,'error'=>'Cannot write .env — check root directory permissions'];

    // Save wizard site data for use by set-site step
    $tmp = BB_ROOT.'/storage/framework/bb_installer_data.json';
    @file_put_contents($tmp, json_encode([
        'site_name'=>$d['site_name'] ?? $appName,
        'app_url'=>$appUrl,
        'timezone'=>$tz,
        'currency'=>$d['currency'] ?? 'BDT',
        'language'=>$lang,
        'admin_email'=>$adminEmail,
        'phone'=>$d['phone'] ?? '',
    ], JSON_UNESCAPED_UNICODE));

    return ['success'=>true,'message'=>'.env file created'];
}

// ─── Run a single artisan / post-install step ─────────────────────────────────
function a_run_step(): array {
    $d = json_decode(file_get_contents('php://input'), true) ?? [];
    $step = $d['step'] ?? '';
    switch ($step) {
        case 'key':
            [$ok,$out] = bb_artisan('key:generate --force');
            return ['success'=>$ok,'output'=>$out];

        case 'migrate':
            [$ok,$out] = bb_artisan('migrate --force');
            if (!$ok || stripos($out,'SQLSTATE') !== false)
                return ['success'=>false,'output'=>$out,'error'=>'Migration failed — check DB credentials and try again'];
            return ['success'=>true,'output'=>$out];

        case 'seed':
            // Run full seeder: AdminSeeder + DefaultSettingsSeeder
            [$ok,$out] = bb_artisan('db:seed --force');
            return ['success'=>true,'output'=>$out]; // non-fatal

        case 'default-settings':
            [$ok,$out] = bb_artisan('db:seed --class=DefaultSettingsSeeder --force');
            return ['success'=>true,'output'=>$out];

        case 'set-site':
            return a_set_site_data($d);

        case 'storage':
            [$ok,$out] = bb_artisan('storage:link --force');
            return ['success'=>true,'output'=>$out];

        case 'cache':
            [, $o1] = bb_artisan('optimize:clear');
            [, $o2] = bb_artisan('config:cache');
            [, $o3] = bb_artisan('route:cache');
            [, $o4] = bb_artisan('view:cache');
            return ['success'=>true,'output'=>implode("\n",[$o1,$o2,$o3,$o4])];

        default:
            return ['success'=>false,'error'=>'Unknown step: '.$step];
    }
}

function a_set_site_data(array $extra = []): array {
    $tmp = BB_ROOT.'/storage/framework/bb_installer_data.json';
    $d   = file_exists($tmp) ? (json_decode(file_get_contents($tmp), true) ?? []) : [];
    $d   = array_merge($d, $extra);
    try {
        $pdo = bb_pdo();
        $settings = ['site_name'=>$d['site_name']??'BongoBee','tagline'=>'',
            'primary_color'=>'#8B5CF6','secondary_color'=>'#7C3AED',
            'phone'=>$d['phone']??'','email'=>$d['admin_email']??'',
            'address'=>'','whatsapp_number'=>'',
            'currency'=>$d['currency']??'BDT','language'=>$d['language']??'bn'];
        $json = json_encode($settings, JSON_UNESCAPED_UNICODE);
        $now  = date('Y-m-d H:i:s');
        $pdo->prepare("INSERT INTO site_settings (id,value,created_at,updated_at) VALUES ('general',:v,:t,:t) ON DUPLICATE KEY UPDATE value=:v2,updated_at=:t2")
            ->execute(['v'=>$json,'t'=>$now,'v2'=>$json,'t2'=>$now]);
        // Ensure all counters exist
        $pdo->exec("INSERT IGNORE INTO counters (id,value,created_at,updated_at) VALUES ('order_number',1000,NOW(),NOW()),('reseller_order_number',1000,NOW(),NOW()),('digital_order_number',1000,NOW(),NOW())");
        @unlink($tmp);
        return ['success'=>true,'message'=>'Site settings saved'];
    } catch (PDOException $e) {
        return ['success'=>false,'error'=>$e->getMessage()];
    }
}

// ─── Upload backup file ───────────────────────────────────────────────────────
function a_upload_backup(): array {
    if (empty($_FILES['backup'])) return ['success'=>false,'error'=>'No file received'];
    $f = $_FILES['backup'];
    if ($f['error'] !== UPLOAD_ERR_OK) return ['success'=>false,'error'=>'Upload error code: '.$f['error']];
    if ($f['size'] > 200 * 1024 * 1024) return ['success'=>false,'error'=>'File too large (max 200 MB)'];
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['json','zip'])) return ['success'=>false,'error'=>'Only .json or .zip backups are supported'];
    $dir = BB_ROOT.'/storage/framework/bb_backup';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $dest = $dir.'/backup.'.$ext;
    if (!move_uploaded_file($f['tmp_name'], $dest)) return ['success'=>false,'error'=>'Could not save uploaded file'];
    if ($ext === 'zip') {
        if (!extension_loaded('zip')) return ['success'=>false,'error'=>'ZIP extension not available on this server'];
        $zip = new ZipArchive();
        if ($zip->open($dest) !== true) return ['success'=>false,'error'=>'Cannot open ZIP file'];
        $found = false;
        for ($i=0; $i<$zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) === 'json') {
                $zip->extractTo($dir, [$name]);
                rename($dir.'/'.$name, $dir.'/backup.json');
                $found = true; break;
            }
        }
        $zip->close();
        if (!$found) return ['success'=>false,'error'=>'No JSON file inside the ZIP'];
        @unlink($dest);
    }
    return a_validate_backup_file($dir.'/backup.json');
}

// ─── Validate backup ──────────────────────────────────────────────────────────
function a_validate_backup(): array {
    $path = BB_ROOT.'/storage/framework/bb_backup/backup.json';
    if (!file_exists($path)) return ['success'=>false,'error'=>'No backup uploaded yet'];
    return a_validate_backup_file($path);
}

function a_validate_backup_file(string $path): array {
    $raw = @file_get_contents($path);
    if ($raw === false) return ['success'=>false,'error'=>'Cannot read backup file'];
    $bk = json_decode($raw, true);
    if ($bk === null) return ['success'=>false,'error'=>'Invalid JSON: '.json_last_error_msg()];
    if (!isset($bk['data']) || !is_array($bk['data']))
        return ['success'=>false,'error'=>'Invalid backup format — missing "data" section'];
    $tables = array_keys($bk['data']);
    $counts = [];
    foreach ($tables as $t) $counts[$t] = count((array)$bk['data'][$t]);
    $totalRows = array_sum($counts);
    return [
        'success'=>true,
        'version'   =>$bk['version']??'unknown',
        'created_at'=>$bk['createdAt']??$bk['created_at']??null,
        'site_name' =>$bk['siteName']??$bk['site_name']??null,
        'tables'    =>$tables,
        'table_counts'=>$counts,
        'total_tables'=>count($tables),
        'total_rows'  =>$totalRows,
        'message'   =>"Backup OK: ".count($tables)." tables, {$totalRows} rows",
    ];
}

// ─── Restore one table from backup ────────────────────────────────────────────
function a_restore_table(): array {
    $d         = json_decode(file_get_contents('php://input'), true) ?? [];
    $tableName = $d['table']      ?? '';
    $strategy  = $d['strategy']   ?? 'replace';
    $conflictKey = $d['conflict'] ?? 'id';
    $pk        = $d['pk']         ?? 'id';
    if (!$tableName) return ['success'=>false,'error'=>'Table name required'];
    $backupPath = BB_ROOT.'/storage/framework/bb_backup/backup.json';
    if (!file_exists($backupPath)) return ['success'=>false,'error'=>'Backup file not found'];
    $bk = json_decode(file_get_contents($backupPath), true);
    if (!isset($bk['data'][$tableName])) return ['success'=>true,'inserted'=>0,'table'=>$tableName,'message'=>"'{$tableName}' not in backup (skipped)"];
    $rows = (array)$bk['data'][$tableName];
    if (empty($rows)) return ['success'=>true,'inserted'=>0,'table'=>$tableName,'message'=>"'{$tableName}' is empty in backup"];
    try {
        $pdo = bb_pdo();
        // Check table exists
        if (!$pdo->query("SHOW TABLES LIKE '{$tableName}'")->fetch())
            return ['success'=>true,'inserted'=>0,'table'=>$tableName,'message'=>"Table '{$tableName}' not in DB (skipped)"];
        // Get columns
        $cols = [];
        foreach ($pdo->query("SHOW COLUMNS FROM `{$tableName}`") as $c) $cols[$c['Field']] = $c;
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        $inserted = 0; $skipped = 0;
        if ($strategy === 'replace') {
            $pdo->exec("DELETE FROM `{$tableName}`");
            foreach (array_chunk($rows, 100) as $batch) {
                $clean = bb_clean_rows($batch, $cols);
                if (empty($clean)) continue;
                [$ins,$sk] = bb_insert_batch($pdo, $tableName, $clean);
                $inserted += $ins; $skipped += $sk;
            }
        } else { // upsert
            foreach ($rows as $row) {
                $row = bb_clean_rows([$row], $cols)[0] ?? [];
                if (empty($row)) { $skipped++; continue; }
                try {
                    if (isset($row[$conflictKey]) && $pdo->query("SELECT COUNT(*) FROM `{$tableName}` WHERE `{$conflictKey}`=".
                        $pdo->quote($row[$conflictKey]))->fetchColumn() > 0) {
                        $sets = implode(',', array_map(fn($k)=>"`{$k}`=?", array_keys($row)));
                        $stmt = $pdo->prepare("UPDATE `{$tableName}` SET {$sets} WHERE `{$conflictKey}`=?");
                        $stmt->execute([...array_values($row), $row[$conflictKey]]);
                    } else {
                        $cols2 = array_keys($row);
                        $ph = implode(',', array_fill(0, count($cols2), '?'));
                        $pdo->prepare("INSERT INTO `{$tableName}` (`".implode('`,`',$cols2)."`) VALUES ({$ph})")
                            ->execute(array_values($row));
                    }
                    $inserted++;
                } catch (PDOException $e) { $skipped++; }
            }
        }
        // Special: backfill order_code
        if ($tableName === 'orders') {
            try { $pdo->exec("UPDATE orders SET order_code=CONCAT('#',CAST(invoice_number AS CHAR)) WHERE order_code IS NULL AND invoice_number IS NOT NULL"); }
            catch (\Throwable $ignored) {}
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        return ['success'=>true,'table'=>$tableName,'inserted'=>$inserted,'skipped'=>$skipped,
            'message'=>"Restored {$inserted} rows to '{$tableName}'".($skipped?" ({$skipped} skipped)":'')];
    } catch (PDOException $e) {
        try { bb_pdo()->exec('SET FOREIGN_KEY_CHECKS=1'); } catch (\Throwable $ig) {}
        return ['success'=>false,'error'=>$e->getMessage(),'table'=>$tableName];
    }
}

function bb_clean_rows(array $rows, array $cols): array {
    $clean = [];
    foreach ($rows as $row) {
        $row = (array) $row;
        $out = [];
        foreach ($row as $k => $v) {
            if (!isset($cols[$k])) continue;
            if (is_array($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
            elseif (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $v)) {
                try { $v = date('Y-m-d H:i:s', strtotime($v)); } catch (\Throwable $e) {}
            }
            $out[$k] = $v;
        }
        if (!empty($out)) $clean[] = $out;
    }
    return $clean;
}

function bb_insert_batch(PDO $pdo, string $table, array $rows): array {
    $inserted = 0; $skipped = 0;
    $colNames = array_keys($rows[0]);
    $ph = '('.implode(',',array_fill(0,count($colNames),'?')).')';
    $sql = 'INSERT INTO `'.$table.'` (`'.implode('`,`',$colNames).'`) VALUES '.implode(',',array_fill(0,count($rows),$ph));
    $params = [];
    foreach ($rows as $r) foreach ($colNames as $c) $params[] = $r[$c] ?? null;
    try {
        $pdo->prepare($sql)->execute($params);
        return [count($rows), 0];
    } catch (PDOException $e) {
        // row-by-row fallback
        $singlePh = '('.implode(',',array_fill(0,count($colNames),'?')).')';
        $singleSql = 'INSERT INTO `'.$table.'` (`'.implode('`,`',$colNames).'`) VALUES '.$singlePh;
        foreach ($rows as $r) {
            $vals = array_map(fn($c)=>$r[$c]??null, $colNames);
            try { $pdo->prepare($singleSql)->execute($vals); $inserted++; }
            catch (PDOException $e2) { $skipped++; }
        }
        return [$inserted, $skipped];
    }
}

// ─── Repair counters after restore ────────────────────────────────────────────
function a_repair_counters(): array {
    $log = [];
    try {
        $pdo = bb_pdo();
        // Main orders
        try {
            $max = (int)$pdo->query('SELECT COALESCE(MAX(invoice_number),1000) FROM orders')->fetchColumn();
            if ($max >= 1000) {
                $pdo->exec("INSERT INTO counters (id,value,created_at,updated_at) VALUES ('order_number',{$max},NOW(),NOW()) ON DUPLICATE KEY UPDATE value={$max},updated_at=NOW()");
                $log[] = "Order counter → {$max}";
            }
        } catch (\Throwable $e) { $log[] = 'Order: '.$e->getMessage(); }
        // Reseller orders
        try {
            $r = $pdo->query("SELECT order_code FROM reseller_orders WHERE order_code REGEXP '^RO[0-9]+' ORDER BY id DESC LIMIT 1")->fetchColumn();
            if ($r) {
                $n = (int)preg_replace('/[^0-9]/','',$r);
                if ($n > 1000) {
                    $pdo->exec("INSERT INTO counters (id,value,created_at,updated_at) VALUES ('reseller_order_number',{$n},NOW(),NOW()) ON DUPLICATE KEY UPDATE value={$n},updated_at=NOW()");
                    $log[] = "Reseller counter → {$n}";
                }
            }
        } catch (\Throwable $e) { $log[] = 'Reseller: '.$e->getMessage(); }
        // Digital orders
        try {
            $r = $pdo->query("SELECT order_number FROM digital_orders WHERE order_number REGEXP '^DP[0-9]+' ORDER BY id DESC LIMIT 1")->fetchColumn();
            if ($r) {
                $n = (int)preg_replace('/[^0-9]/','',$r);
                if ($n > 1000) {
                    $pdo->exec("INSERT INTO counters (id,value,created_at,updated_at) VALUES ('digital_order_number',{$n},NOW(),NOW()) ON DUPLICATE KEY UPDATE value={$n},updated_at=NOW()");
                    $log[] = "Digital counter → {$n}";
                }
            }
        } catch (\Throwable $e) { $log[] = 'Digital: '.$e->getMessage(); }
        // Ensure base counters exist
        $pdo->exec("INSERT IGNORE INTO counters (id,value,created_at,updated_at) VALUES ('order_number',1000,NOW(),NOW()),('reseller_order_number',1000,NOW(),NOW()),('digital_order_number',1000,NOW(),NOW())");
        return ['success'=>true,'log'=>$log,'message'=>'Counters repaired'];
    } catch (PDOException $e) {
        return ['success'=>false,'error'=>$e->getMessage(),'log'=>$log];
    }
}

// ─── Finalize (create installed marker) ──────────────────────────────────────
function a_finalize(): array {
    $dir = dirname(BB_INSTALLED_MARKER);
    if (!is_dir($dir) && !mkdir($dir,0755,true))
        return ['success'=>false,'error'=>'Cannot create storage/framework/ directory'];
    $content = json_encode(['installed_at'=>date('Y-m-d H:i:s'),'installer_version'=>BB_INSTALLER_VERSION,'php_version'=>PHP_VERSION], JSON_PRETTY_PRINT);
    if (file_put_contents(BB_INSTALLED_MARKER, $content) === false)
        return ['success'=>false,'error'=>'Cannot write installed marker. Check storage/framework/ permissions.'];
    // Cleanup temp files
    $backupDir = BB_ROOT.'/storage/framework/bb_backup';
    if (is_dir($backupDir)) { foreach (glob($backupDir.'/*') as $f) @unlink($f); @rmdir($backupDir); }
    @unlink(BB_ROOT.'/storage/framework/bb_installer_data.json');
    return ['success'=>true,'message'=>'Installation complete!'];
}

// =============================================================================
// AJAX DISPATCH — must be before any HTML output
// =============================================================================
$action = $_GET['action'] ?? null;
if ($action) {
    try {
        switch ($action) {
            case 'requirements':    bb_json(a_requirements());    break;
            case 'test-db':         bb_json(a_test_db());         break;
            case 'create-env':      bb_json(a_create_env());      break;
            case 'run-step':        bb_json(a_run_step());        break;
            case 'upload-backup':   bb_json(a_upload_backup());   break;
            case 'validate-backup': bb_json(a_validate_backup()); break;
            case 'restore-table':   bb_json(a_restore_table());   break;
            case 'repair-counters': bb_json(a_repair_counters()); break;
            case 'set-site':        bb_json(a_set_site_data());   break;
            case 'finalize':        bb_json(a_finalize());        break;
            default: bb_json(['error'=>'Unknown action: '.$action]);
        }
    } catch (Throwable $e) {
        bb_json(['success'=>false,'error'=>$e->getMessage()]);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BongoBee — Installation Wizard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;width:100%;max-width:680px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.card-header{background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;display:flex;align-items:center;gap:14px}
.logo{font-size:32px}
.header-text h1{font-size:22px;font-weight:700;color:#fff}
.header-text p{font-size:13px;color:#c4b5fd;margin-top:2px}
/* Progress bar */
.progress-bar{background:#0f172a;padding:0;overflow:hidden}
.progress-fill{height:4px;background:linear-gradient(90deg,#7c3aed,#4f46e5);transition:width .4s ease;width:0}
/* Steps indicator */
.steps{display:flex;justify-content:space-between;padding:20px 32px 0;position:relative}
.steps::before{content:'';position:absolute;top:30px;left:calc(32px + 16px);right:calc(32px + 16px);height:2px;background:#334155;z-index:0}
.step-dot{display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;z-index:1}
.step-dot .dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid #334155;background:#1e293b;transition:all .3s}
.step-dot.done .dot{background:#7c3aed;border-color:#7c3aed;color:#fff}
.step-dot.active .dot{background:#1e293b;border-color:#7c3aed;color:#7c3aed;box-shadow:0 0 0 4px rgba(124,58,237,.2)}
.step-dot .label{font-size:11px;color:#64748b;white-space:nowrap}
.step-dot.done .label,.step-dot.active .label{color:#a78bfa}
/* Content area */
.content{padding:32px}
.step-panel{display:none}
.step-panel.active{display:block}
h2{font-size:20px;font-weight:700;color:#f1f5f9;margin-bottom:8px}
.subtitle{color:#94a3b8;font-size:14px;margin-bottom:24px}
/* Form */
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.form-row.single{grid-template-columns:1fr}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px;font-weight:500}
.form-group input,.form-group select{width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;outline:none;transition:border-color .2s}
.form-group input:focus,.form-group select:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.15)}
.form-group input::placeholder{color:#475569}
/* Buttons */
.btn{padding:11px 24px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.btn-primary{background:#7c3aed;color:#fff}
.btn-primary:hover:not(:disabled){background:#6d28d9}
.btn-secondary{background:#334155;color:#e2e8f0}
.btn-secondary:hover:not(:disabled){background:#475569}
.btn-success{background:#059669;color:#fff}
.btn-success:hover{background:#047857}
.btn:disabled{opacity:.5;cursor:not-allowed}
.footer{display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-top:1px solid #334155;background:#172033}
/* Requirements */
.req-list{display:flex;flex-direction:column;gap:8px}
.req-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:#0f172a}
.req-item.pass{border-left:3px solid #10b981}
.req-item.fail{border-left:3px solid #ef4444}
.req-item.optional-warn{border-left:3px solid #f59e0b}
.req-item .icon{font-size:16px}
.req-item .name{flex:1;font-size:13px}
.req-item .detail{font-size:11px;color:#64748b}
/* Alert */
.alert{padding:14px 16px;border-radius:8px;font-size:13px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.alert-success{background:rgba(16,185,129,.1);border:1px solid #059669;color:#6ee7b7}
.alert-error{background:rgba(239,68,68,.1);border:1px solid #dc2626;color:#fca5a5}
.alert-warn{background:rgba(245,158,11,.1);border:1px solid #d97706;color:#fcd34d}
.alert-info{background:rgba(99,102,241,.1);border:1px solid #4f46e5;color:#a5b4fc}
/* Mode cards */
.mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.mode-card{padding:20px;border:2px solid #334155;border-radius:12px;cursor:pointer;transition:all .2s;background:#0f172a}
.mode-card:hover{border-color:#7c3aed}
.mode-card.selected{border-color:#7c3aed;background:rgba(124,58,237,.08)}
.mode-card .mc-icon{font-size:28px;margin-bottom:10px}
.mode-card h3{font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px}
.mode-card p{font-size:12px;color:#64748b}
/* Progress log */
.install-steps{display:flex;flex-direction:column;gap:8px}
.install-step{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:#0f172a;font-size:13px}
.install-step .st-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.st-pending .st-icon{background:#334155;color:#64748b}
.st-running .st-icon{background:#1d4ed8;color:#fff;animation:pulse 1s infinite}
.st-done .st-icon{background:#059669;color:#fff}
.st-fail .st-icon{background:#dc2626;color:#fff}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
.install-step .st-label{flex:1;color:#94a3b8}
.st-done .st-label{color:#6ee7b7}
.st-fail .st-label{color:#fca5a5}
.st-running .st-label{color:#93c5fd}
.log-box{background:#0a0f1a;border:1px solid #1e293b;border-radius:8px;padding:12px;font-family:monospace;font-size:11px;color:#64748b;max-height:200px;overflow-y:auto;margin-top:16px;white-space:pre-wrap;word-break:break-all}
/* File upload */
.upload-area{border:2px dashed #334155;border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:16px}
.upload-area:hover,.upload-area.drag-over{border-color:#7c3aed;background:rgba(124,58,237,.05)}
.upload-area p{color:#64748b;font-size:13px;margin-top:8px}
.upload-area .up-icon{font-size:32px}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.badge-green{background:rgba(16,185,129,.15);color:#6ee7b7}
.badge-blue{background:rgba(99,102,241,.15);color:#a5b4fc}
/* Finish */
.finish-box{text-align:center;padding:20px 0}
.finish-icon{font-size:64px;margin-bottom:16px}
.finish-url{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:13px;color:#a78bfa;margin:8px 0;word-break:break-all}
.section-title{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;margin-top:20px}
/* Spinner */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* DB fields row */
.db-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px}
@media(max-width:560px){.mode-cards,.form-row,.db-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="card">
  <!-- Header -->
  <div class="card-header">
    <div class="logo">🐝</div>
    <div class="header-text">
      <h1>BongoBee Setup Wizard</h1>
      <p>Installation Wizard v<?= BB_INSTALLER_VERSION ?> &mdash; Laravel E-Commerce Platform</p>
    </div>
  </div>

  <!-- Top progress fill -->
  <div class="progress-bar"><div class="progress-fill" id="topBar"></div></div>

  <!-- Step indicators -->
  <div class="steps" id="stepIndicator">
    <div class="step-dot active" data-step="1"><div class="dot">1</div><span class="label">Welcome</span></div>
    <div class="step-dot" data-step="2"><div class="dot">2</div><span class="label">Requirements</span></div>
    <div class="step-dot" data-step="3"><div class="dot">3</div><span class="label">Database</span></div>
    <div class="step-dot" data-step="4"><div class="dot">4</div><span class="label">Mode</span></div>
    <div class="step-dot" data-step="5"><div class="dot">5</div><span class="label">Install</span></div>
  </div>

  <!-- Content -->
  <div class="content">

    <!-- ── STEP 1: WELCOME ── -->
    <div class="step-panel active" id="step1">
      <h2>Welcome to BongoBee</h2>
      <p class="subtitle">This wizard will guide you through setting up your e-commerce platform on this server.</p>
      <div class="alert alert-info">
        <span>ℹ️</span>
        <div>
          <strong>What this installer does</strong><br>
          Checks server requirements · Configures database · Creates environment file · Runs migrations · Seeds default data · Sets up storage
        </div>
      </div>
      <p class="section-title">Installation Modes</p>
      <div class="mode-cards">
        <div class="mode-card">
          <div class="mc-icon">🆕</div>
          <h3>Fresh Install</h3>
          <p>New website with default settings, empty database and your admin account.</p>
        </div>
        <div class="mode-card">
          <div class="mc-icon">♻️</div>
          <h3>Restore Backup</h3>
          <p>Restore a previously exported backup — all data, settings, and orders included.</p>
        </div>
      </div>
      <?php if (file_exists(BB_ENV_PATH)): ?>
      <div class="alert alert-warn"><span>⚠️</span><div>An existing <code>.env</code> file was found. Proceeding will overwrite it.</div></div>
      <?php endif; ?>
    </div>

    <!-- ── STEP 2: REQUIREMENTS ── -->
    <div class="step-panel" id="step2">
      <h2>Server Requirements</h2>
      <p class="subtitle">Checking your server environment…</p>
      <div id="reqResult"><div class="alert alert-info"><span>⏳</span> Checking requirements…</div></div>
    </div>

    <!-- ── STEP 3: DATABASE ── -->
    <div class="step-panel" id="step3">
      <h2>Database Configuration</h2>
      <p class="subtitle">Enter your MySQL database credentials. The database will be created if it doesn't exist.</p>
      <div class="db-grid">
        <div class="form-group"><label>DB Host</label><input type="text" id="dbHost" value="127.0.0.1" placeholder="127.0.0.1"></div>
        <div class="form-group"><label>Port</label><input type="text" id="dbPort" value="3306" placeholder="3306"></div>
      </div>
      <div class="form-group"><label>Database Name</label><input type="text" id="dbName" placeholder="bongobee_db"></div>
      <div class="form-group"><label>Username</label><input type="text" id="dbUser" placeholder="root"></div>
      <div class="form-group"><label>Password</label><input type="password" id="dbPass" placeholder="(leave empty if none)"></div>
      <button class="btn btn-secondary" id="testDbBtn" onclick="testDb()">
        <span id="testDbSpinner" style="display:none" class="spinner"></span>
        🔌 Test Connection
      </button>
      <div id="dbResult" style="margin-top:14px"></div>
    </div>

    <!-- ── STEP 4: INSTALLATION MODE ── -->
    <div class="step-panel" id="step4">
      <h2>Choose Installation Mode</h2>
      <p class="subtitle">Select how you want to set up your website.</p>

      <div class="mode-cards">
        <div class="mode-card" id="cardFresh" onclick="selectMode('fresh')">
          <div class="mc-icon">🆕</div>
          <h3>Fresh Install</h3>
          <p>Start a brand new site with empty data.</p>
        </div>
        <div class="mode-card" id="cardRestore" onclick="selectMode('restore')">
          <div class="mc-icon">♻️</div>
          <h3>Restore Backup</h3>
          <p>Restore from an existing backup file.</p>
        </div>
      </div>

      <!-- Fresh Install form -->
      <div id="freshForm" style="display:none">
        <p class="section-title">Site Information</p>
        <div class="form-row">
          <div class="form-group"><label>Site Name</label><input type="text" id="siteName" placeholder="My Store" value="BongoBee"></div>
          <div class="form-group"><label>Site URL</label><input type="text" id="siteUrl" placeholder="https://mysite.com" value="<?= htmlspecialchars('http://'.$_SERVER['HTTP_HOST'] ?? 'http://localhost') ?>"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Timezone</label>
            <select id="timezone">
              <option value="Asia/Dhaka" selected>Asia/Dhaka (Bangladesh)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>
          <div class="form-group">
            <label>Currency</label>
            <select id="currency">
              <option value="BDT" selected>BDT (Bangladeshi Taka)</option>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <p class="section-title">Admin Account</p>
        <div class="form-row">
          <div class="form-group"><label>Admin Name</label><input type="text" id="adminName" placeholder="Administrator" value="Admin"></div>
          <div class="form-group"><label>Admin Email</label><input type="email" id="adminEmail" placeholder="admin@mysite.com"></div>
        </div>
        <div class="form-group">
          <label>Admin Password <span style="color:#64748b;font-size:11px">(min 8 chars)</span></label>
          <input type="password" id="adminPassword" placeholder="Choose a strong password">
        </div>
      </div>

      <!-- Restore form -->
      <div id="restoreForm" style="display:none">
        <p class="section-title">Upload Backup File</p>
        <div class="upload-area" id="uploadArea" onclick="document.getElementById('backupFile').click()"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="event.preventDefault();this.classList.remove('drag-over');handleFileDrop(event)">
          <div class="up-icon">📁</div>
          <p>Click to select or drag and drop your backup file</p>
          <p style="font-size:11px;color:#475569;margin-top:4px">Supported: .json, .zip (max 200 MB)</p>
          <input type="file" id="backupFile" style="display:none" accept=".json,.zip" onchange="uploadBackup(this)">
        </div>
        <div id="uploadProgress" style="display:none">
          <div class="alert alert-info"><span class="spinner"></span> &nbsp;Uploading and validating backup…</div>
        </div>
        <div id="backupInfo"></div>
        <p class="section-title" style="margin-top:16px">Admin Fallback Account</p>
        <div class="alert alert-info"><span>ℹ️</span>If admin accounts are not included in the backup, this account will be created as a fallback.</div>
        <div class="form-row" style="margin-top:12px">
          <div class="form-group"><label>Admin Email</label><input type="email" id="restoreAdminEmail" placeholder="admin@mysite.com"></div>
          <div class="form-group"><label>Admin Password</label><input type="password" id="restoreAdminPassword" placeholder="Fallback password (min 8 chars)"></div>
        </div>
        <div class="alert alert-warn" style="margin-top:4px">
          <span>⚠️</span>
          <div>Backup data will be fully restored including all orders, products, and settings. Admin passwords in the backup are kept as-is.</div>
        </div>
      </div>
    </div>

    <!-- ── STEP 5: INSTALLATION PROGRESS ── -->
    <div class="step-panel" id="step5">
      <div id="installProgress">
        <h2 id="installTitle">Installing…</h2>
        <p class="subtitle" id="installSubtitle">Please wait while we set up your website.</p>
        <div class="install-steps" id="installSteps"></div>
        <div class="log-box" id="logBox" style="display:none"></div>
      </div>
      <div id="finishPanel" style="display:none">
        <div class="finish-box">
          <div class="finish-icon">🎉</div>
          <h2 style="color:#6ee7b7">Installation Complete!</h2>
          <p class="subtitle">Your BongoBee store is ready.</p>
          <p class="section-title">Your Website</p>
          <div class="finish-url" id="finishUrl"></div>
          <p class="section-title">Admin Panel</p>
          <div class="finish-url" id="finishAdminUrl"></div>
          <div id="finishCredentials"></div>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
            <a id="btnGoSite" href="#" class="btn btn-secondary" style="text-decoration:none">🌐 Visit Site</a>
            <a id="btnGoAdmin" href="#" class="btn btn-primary" style="text-decoration:none">🔑 Go to Admin</a>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /content -->

  <!-- Footer nav -->
  <div class="footer">
    <button class="btn btn-secondary" id="btnBack" onclick="goBack()" style="display:none">← Back</button>
    <span style="font-size:12px;color:#475569">BongoBee v<?= BB_INSTALLER_VERSION ?></span>
    <button class="btn btn-primary" id="btnNext" onclick="goNext()">Continue →</button>
  </div>
</div>

<script>
// =============================================================================
// Installer State Machine
// =============================================================================
let currentStep = 1;
const TOTAL_STEPS = 5;
let dbVerified = false;
let installMode = null; // 'fresh' | 'restore'
let backupValidated = false;
let installRunning = false;
let dbConfig = {};
let freshConfig = {};
let adminEmail = '';
let siteUrl = '';

function updateUI() {
  // Step indicators
  document.querySelectorAll('.step-dot').forEach((el, i) => {
    const s = i + 1;
    el.className = 'step-dot' + (s < currentStep ? ' done' : s === currentStep ? ' active' : '');
    el.querySelector('.dot').textContent = s < currentStep ? '✓' : s;
  });
  // Progress bar
  document.getElementById('topBar').style.width = ((currentStep - 1) / (TOTAL_STEPS - 1) * 100) + '%';
  // Panels
  document.querySelectorAll('.step-panel').forEach((el, i) => {
    el.className = 'step-panel' + (i + 1 === currentStep ? ' active' : '');
  });
  // Back / Next buttons
  document.getElementById('btnBack').style.display = currentStep > 1 && currentStep < 5 ? '' : 'none';
  const next = document.getElementById('btnNext');
  if (currentStep === 5) { next.style.display = 'none'; }
  else { next.style.display = ''; next.textContent = currentStep === 4 ? '🚀 Install Now →' : 'Continue →'; }
}

function goBack() {
  if (currentStep > 1 && currentStep < 5) { currentStep--; updateUI(); if (currentStep === 2) checkRequirements(); }
}

async function goNext() {
  if (installRunning) return;
  if (currentStep === 1) { currentStep = 2; updateUI(); checkRequirements(); return; }
  if (currentStep === 2) {
    const req = await fetch('?action=requirements').then(r=>r.json());
    if (!req.allPass) { showAlert('step2', 'Some required checks failed. Fix them before continuing.', 'error'); return; }
    currentStep = 3; updateUI(); return;
  }
  if (currentStep === 3) {
    if (!dbVerified) { showAlert('step3', 'Please test the database connection first.', 'error'); return; }
    currentStep = 4; updateUI(); return;
  }
  if (currentStep === 4) {
    if (!installMode) { alert('Please select an installation mode.'); return; }
    if (installMode === 'fresh') {
      const sv = val('siteUrl'), sn = val('siteName'), ae = val('adminEmail'), ap = val('adminPassword'), an = val('adminName');
      if (!sn) { alert('Site name is required'); return; }
      if (!sv) { alert('Site URL is required'); return; }
      if (!ae || !ae.includes('@')) { alert('Valid admin email is required'); return; }
      if (!ap || ap.length < 8) { alert('Admin password must be at least 8 characters'); return; }
      adminEmail = ae; siteUrl = sv;
      freshConfig = { app_name: sn, site_name: sn, app_url: sv, timezone: val('timezone'), currency: val('currency'), language: 'bn', admin_name: an, admin_email: ae, admin_password: ap, db_host: dbConfig.host, db_port: dbConfig.port, db_database: dbConfig.database, db_username: dbConfig.username, db_password: dbConfig.password };
    } else {
      if (!backupValidated) { alert('Please upload and validate a backup file first.'); return; }
      const rae = val('restoreAdminEmail'), rap = val('restoreAdminPassword');
      if (rae && (!rap || rap.length < 8)) { alert('If providing admin email, password must be at least 8 characters'); return; }
      siteUrl = window.location.origin;
      adminEmail = rae || 'admin@site.com';
      freshConfig = { app_name:'BongoBee', site_name:'BongoBee', app_url:window.location.origin,
        db_host:dbConfig.host, db_port:dbConfig.port, db_database:dbConfig.database,
        db_username:dbConfig.username, db_password:dbConfig.password,
        admin_email:rae||'', admin_name:'Admin', admin_password:rap||'',
        timezone:'Asia/Dhaka', currency:'BDT', language:'bn' };
    }
    currentStep = 5; updateUI();
    await runInstallation();
    return;
  }
}

function val(id) { return (document.getElementById(id)?.value || '').trim(); }

function showAlert(containerId, msg, type='info') {
  const icons = {success:'✅',error:'❌',warn:'⚠️',info:'ℹ️'};
  const el = document.getElementById(containerId + 'Alert') || (() => {
    const div = document.createElement('div');
    div.id = containerId + 'Alert';
    document.getElementById(containerId)?.appendChild(div);
    return div;
  })();
  el.innerHTML = `<div class="alert alert-${type}"><span>${icons[type]||'ℹ️'}</span><div>${msg}</div></div>`;
}

// =============================================================================
// Requirements Check
// =============================================================================
async function checkRequirements() {
  document.getElementById('reqResult').innerHTML = '<div class="alert alert-info"><span>⏳</span> Checking requirements…</div>';
  const data = await fetch('?action=requirements').then(r=>r.json());
  let html = '<div class="req-list">';
  data.checks.forEach(c => {
    const opt = c.optional;
    const cls = c.pass ? 'pass' : (opt ? 'optional-warn' : 'fail');
    const icon = c.pass ? '✅' : (opt ? '⚠️' : '❌');
    html += `<div class="req-item ${cls}"><span class="icon">${icon}</span><span class="name">${c.label}</span>${c.detail?`<span class="detail">${c.detail}</span>`:''}${opt&&!c.pass?'<span class="badge badge-blue">Optional</span>':''}</div>`;
  });
  html += '</div>';
  if (data.allPass) html += '<div class="alert alert-success" style="margin-top:16px"><span>✅</span> All required checks passed!</div>';
  else html += '<div class="alert alert-error" style="margin-top:16px"><span>❌</span> Fix the failed requirements before continuing.</div>';
  document.getElementById('reqResult').innerHTML = html;
}

// =============================================================================
// DB Test
// =============================================================================
async function testDb() {
  const btn = document.getElementById('testDbBtn');
  const sp  = document.getElementById('testDbSpinner');
  btn.disabled = true; sp.style.display = '';
  dbConfig = { host:val('dbHost'), port:val('dbPort'), database:val('dbName'), username:val('dbUser'), password:document.getElementById('dbPass')?.value||'' };
  const res = await fetch('?action=test-db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dbConfig)}).then(r=>r.json());
  btn.disabled = false; sp.style.display = 'none';
  if (res.success) {
    dbVerified = true;
    document.getElementById('dbResult').innerHTML = `<div class="alert alert-success"><span>✅</span><div><strong>Connected!</strong> ${res.message}</div></div>`;
  } else {
    dbVerified = false;
    document.getElementById('dbResult').innerHTML = `<div class="alert alert-error"><span>❌</span><div>${res.error}</div></div>`;
  }
}

// =============================================================================
// Mode selection
// =============================================================================
function selectMode(mode) {
  installMode = mode;
  document.getElementById('cardFresh').classList.toggle('selected', mode==='fresh');
  document.getElementById('cardRestore').classList.toggle('selected', mode==='restore');
  document.getElementById('freshForm').style.display = mode==='fresh' ? '' : 'none';
  document.getElementById('restoreForm').style.display = mode==='restore' ? '' : 'none';
  // Prefill site URL
  if (mode==='fresh') document.getElementById('siteUrl').value = window.location.origin;
}

// =============================================================================
// Backup Upload & Validate
// =============================================================================
function handleFileDrop(e) {
  const file = e.dataTransfer.files[0];
  if (file) doUpload(file);
}
function uploadBackup(input) { if (input.files[0]) doUpload(input.files[0]); }

async function doUpload(file) {
  document.getElementById('uploadProgress').style.display = '';
  document.getElementById('backupInfo').innerHTML = '';
  backupValidated = false;
  const fd = new FormData();
  fd.append('backup', file);
  const res = await fetch('?action=upload-backup',{method:'POST',body:fd}).then(r=>r.json());
  document.getElementById('uploadProgress').style.display = 'none';
  if (res.success) {
    backupValidated = true;
    let html = `<div class="alert alert-success"><span>✅</span><div><strong>Backup validated!</strong><br>`;
    html += `Version: <span class="badge badge-blue">${res.version}</span> &nbsp;`;
    if (res.site_name) html += `Site: <strong>${res.site_name}</strong> &nbsp;`;
    if (res.created_at) html += `Created: ${res.created_at}<br>`;
    html += `Tables: <strong>${res.total_tables}</strong> &nbsp; Rows: <strong>${res.total_rows.toLocaleString()}</strong>`;
    html += `</div></div>`;
    document.getElementById('backupInfo').innerHTML = html;
  } else {
    document.getElementById('backupInfo').innerHTML = `<div class="alert alert-error"><span>❌</span>${res.error}</div>`;
  }
}

// =============================================================================
// Main Installation Runner
// =============================================================================
const FRESH_STEPS = [
  { id:'env',     label:'Creating .env configuration file',   icon:'📝' },
  { id:'key',     label:'Generating application key',          icon:'🔑' },
  { id:'migrate', label:'Running database migrations (29 tables)',icon:'🗄️' },
  { id:'seed',    label:'Creating admin account',              icon:'👤' },
  { id:'site',    label:'Saving site settings',                icon:'⚙️' },
  { id:'storage', label:'Creating storage symlink',            icon:'🔗' },
  { id:'cache',   label:'Optimizing & caching routes',         icon:'⚡' },
  { id:'done',    label:'Finalizing installation',             icon:'🎉' },
];

async function buildRestoreSteps() {
  const meta = await fetch('?action=validate-backup').then(r=>r.json());
  const tables = meta.tables || [];
  const steps = [
    { id:'env',     label:'Creating .env configuration file',   icon:'📝' },
    { id:'key',     label:'Generating application key',          icon:'🔑' },
    { id:'migrate', label:'Running database migrations',         icon:'🗄️' },
  ];
  // Map backup table keys to restore steps using registry order
  const REGISTRY = [
    {key:'site_settings',strategy:'upsert'},{key:'fraud_settings',strategy:'upsert'},{key:'courier_settings',strategy:'upsert'},
    {key:'counters',strategy:'upsert',conflict:'id'},
    {key:'categories',strategy:'replace'},{key:'variations',strategy:'replace'},{key:'products',strategy:'replace'},{key:'stock_entries',strategy:'replace'},
    {key:'blog_posts',strategy:'replace'},{key:'landing_pages',strategy:'replace'},{key:'coupons',strategy:'replace'},{key:'short_links',strategy:'replace'},
    {key:'employees',strategy:'replace'},{key:'employee_activities',strategy:'replace'},
    {key:'resellers',strategy:'replace'},{key:'reseller_payment_methods',strategy:'replace'},{key:'reseller_product_prices',strategy:'replace'},
    {key:'reseller_orders',strategy:'replace'},{key:'payment_requests',strategy:'replace'},{key:'reseller_domains',strategy:'replace'},
    {key:'orders',strategy:'replace'},{key:'incomplete_orders',strategy:'replace'},{key:'follow_up_data',strategy:'replace',pk:'order_id'},
    {key:'blocked_customers',strategy:'replace'},
    {key:'expenses',strategy:'replace'},{key:'deposits',strategy:'replace'},
    {key:'courier_dispatch',strategy:'replace',pk:'order_id'},{key:'courier_ratio_cache',strategy:'replace',pk:'phone'},
    {key:'youtube_sources',strategy:'replace'},
    {key:'push_subscriptions',strategy:'upsert',conflict:'endpoint'},{key:'push_campaigns',strategy:'replace'},
    {key:'sms_campaigns',strategy:'replace'},{key:'sms_queue',strategy:'replace'},
    {key:'digital_categories',strategy:'replace'},{key:'digital_products',strategy:'replace'},
    {key:'digital_payment_methods',strategy:'replace'},{key:'digital_customers',strategy:'replace'},
    {key:'digital_orders',strategy:'replace'},{key:'digital_blocked_users',strategy:'replace'},
    {key:'admins',strategy:'replace'},
  ];
  const labels = {
    site_settings:'Restoring site settings',categories:'Restoring categories',products:'Restoring products',
    orders:'Restoring orders',reseller_orders:'Restoring reseller orders',digital_orders:'Restoring digital orders',
    employees:'Restoring team members',resellers:'Restoring resellers',blog_posts:'Restoring blog posts',
    landing_pages:'Restoring landing pages',admins:'Restoring admin accounts',counters:'Restoring counters',
    reseller_domains:'Restoring reseller domains',follow_up_data:'Restoring follow-up data',
    courier_dispatch:'Restoring courier dispatch',blocked_customers:'Restoring blocked customers',
    digital_customers:'Restoring digital customers',digital_products:'Restoring digital products',
  };
  const icons = {site_settings:'⚙️',categories:'📂',products:'📦',orders:'🛒',reseller_orders:'🤝',digital_orders:'💾',
    employees:'👥',resellers:'🏪',blog_posts:'📝',landing_pages:'📄',admins:'👤',counters:'🔢',
    reseller_domains:'🌐',follow_up_data:'📋',courier_dispatch:'🚚',blocked_customers:'🚫',
    digital_customers:'💻',digital_products:'💿'};
  REGISTRY.filter(r=>tables.includes(r.key)).forEach(r=>{
    steps.push({id:'restore_'+r.key, label:labels[r.key]||'Restoring '+r.key, icon:icons[r.key]||'📊', restoreTable:r.key, strategy:r.strategy, conflict:r.conflict, pk:r.pk });
  });
  steps.push(
    { id:'counters', label:'Repairing order counters', icon:'🔢' },
    { id:'storage',  label:'Creating storage symlink', icon:'🔗' },
    { id:'cache',    label:'Optimizing & caching',      icon:'⚡' },
    { id:'done',     label:'Finalizing installation',   icon:'🎉' },
  );
  return steps;
}

async function runInstallation() {
  installRunning = true;
  document.getElementById('btnNext').style.display = 'none';
  const title = document.getElementById('installTitle');
  const subtitle = document.getElementById('installSubtitle');
  if (installMode === 'restore') {
    title.textContent = 'Restoring Backup…';
    subtitle.textContent = 'Importing all your data. This may take a few minutes.';
  }
  const steps = installMode === 'fresh' ? FRESH_STEPS : await buildRestoreSteps();
  renderSteps(steps);
  const logBox = document.getElementById('logBox');
  logBox.style.display = '';
  let log = '';
  function addLog(msg) { log += msg + '\n'; logBox.textContent = log; logBox.scrollTop = logBox.scrollHeight; }
  async function doStep(step) {
    setStepStatus(step.id, 'running');
    let res = null;
    try {
      if (step.id === 'env') {
        res = await api('create-env', freshConfig);
      } else if (step.id === 'key') {
        res = await api('run-step',{step:'key'});
      } else if (step.id === 'migrate') {
        res = await api('run-step',{step:'migrate'});
      } else if (step.id === 'seed') {
        res = await api('run-step',{step:'seed'});
      } else if (step.id === 'site') {
        res = await api('run-step',{step:'set-site',...freshConfig});
      } else if (step.id === 'counters') {
        res = await api('repair-counters',{});
      } else if (step.id === 'storage') {
        res = await api('run-step',{step:'storage'});
      } else if (step.id === 'cache') {
        res = await api('run-step',{step:'cache'});
      } else if (step.id === 'done') {
        res = await api('finalize',{});
      } else if (step.id.startsWith('restore_')) {
        res = await api('restore-table',{table:step.restoreTable,strategy:step.strategy,conflict:step.conflict||'id',pk:step.pk||'id'});
        if (res.inserted !== undefined) addLog(`[${step.restoreTable}] ${res.inserted} rows restored${res.skipped?' ('+res.skipped+' skipped)':''}`);
      }
      if (res) {
        if (res.output) addLog(res.output.trim());
        if (res.message) addLog('✓ ' + res.message);
        if (!res.success && res.error) {
          addLog('✗ ERROR: ' + res.error);
          setStepStatus(step.id, 'fail');
          return false;
        }
      }
      setStepStatus(step.id, 'done');
      return true;
    } catch(e) {
      addLog('✗ EXCEPTION: ' + e.message);
      setStepStatus(step.id, 'fail');
      return false;
    }
  }
  let ok = true;
  for (const step of steps) {
    if (!ok && step.id !== 'done') { setStepStatus(step.id, 'fail'); continue; }
    const result = await doStep(step);
    if (!result && step.id !== 'storage' && step.id !== 'cache' && !step.id.startsWith('restore_')) ok = false;
  }
  installRunning = false;
  setTimeout(() => showFinish(ok), 600);
}

function showFinish(ok) {
  document.getElementById('installProgress').style.display = 'none';
  document.getElementById('finishPanel').style.display = '';
  const base = siteUrl || window.location.origin;
  const adminUrl = base + '/admin';
  document.getElementById('finishUrl').textContent = base;
  document.getElementById('finishAdminUrl').textContent = adminUrl;
  document.getElementById('btnGoSite').href = base;
  document.getElementById('btnGoAdmin').href = adminUrl;
  if (installMode === 'fresh' && freshConfig.admin_email) {
    document.getElementById('finishCredentials').innerHTML =
      `<div class="alert alert-info" style="margin-top:16px;text-align:left"><span>🔑</span><div><strong>Admin Credentials</strong><br>Email: ${freshConfig.admin_email}<br>Password: (as you entered)</div></div>`;
  }
  if (!ok) {
    document.getElementById('finishPanel').querySelector('.finish-icon').textContent = '⚠️';
    document.getElementById('finishPanel').querySelector('h2').textContent = 'Installation Completed with Warnings';
    document.getElementById('finishPanel').querySelector('h2').style.color = '#fcd34d';
  }
}

function renderSteps(steps) {
  document.getElementById('installSteps').innerHTML = steps.map(s =>
    `<div class="install-step st-pending" id="istep_${s.id}">
      <div class="st-icon">${s.icon}</div>
      <div class="st-label">${s.label}</div>
      <div class="st-status"></div>
    </div>`
  ).join('');
}

function setStepStatus(id, status) {
  const el = document.getElementById('istep_'+id);
  if (!el) return;
  el.className = 'install-step st-'+status;
  const icons = {pending:'⏳', running:'…', done:'✓', fail:'✗'};
  el.querySelector('.st-status').textContent = icons[status]||'';
}

async function api(action, body) {
  const r = await fetch('?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return r.json();
}

// Init
updateUI();
</script>
</body>
</html>
