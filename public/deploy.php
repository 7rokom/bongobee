<?php
/**
 * BongoBee Auto-Deploy Handler
 *
 * Upload this file along with deploy.flag to trigger auto-deployment on shared hosting.
 * The deploy.flag file is consumed (deleted) after a successful run.
 *
 * Usage:
 *   1. Upload your application files
 *   2. Create an empty file named "deploy.flag" in this directory
 *   3. Visit https://yourdomain.com/deploy.php (or set a cron job)
 *   4. The script runs migrations + seeders, then deletes deploy.flag
 *
 * Security: Protected by DEPLOY_SECRET env var. Set it in .env.
 */

define('LARAVEL_ROOT', dirname(__DIR__));

// Security check - require secret key
$secret = getenv('DEPLOY_SECRET') ?: '';
$provided = $_GET['secret'] ?? $_SERVER['HTTP_X_DEPLOY_SECRET'] ?? '';

if ($secret && $provided !== $secret) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

$flagFile = __DIR__ . '/deploy.flag';

if (!file_exists($flagFile)) {
    http_response_code(200);
    die(json_encode(['status' => 'no-op', 'message' => 'No deploy.flag found. Nothing to do.']));
}

// Lock to prevent concurrent deploys
$lockFile = sys_get_temp_dir() . '/bongobee_deploy.lock';
$lock = fopen($lockFile, 'w');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    http_response_code(409);
    die(json_encode(['error' => 'Deploy already in progress']));
}

$log = [];
$success = true;

function runArtisan(string $command, array &$log): bool
{
    $php = PHP_BINARY;
    $artisan = LARAVEL_ROOT . '/artisan';
    $cmd = escapeshellarg($php) . ' ' . escapeshellarg($artisan) . ' ' . $command . ' 2>&1';
    exec($cmd, $output, $exitCode);
    $log[] = ['cmd' => "artisan $command", 'output' => implode("\n", $output), 'exit' => $exitCode];
    return $exitCode === 0;
}

// Step 1: Put application into maintenance mode
runArtisan('down --retry=30', $log);

// Step 2: Clear all caches
runArtisan('config:clear', $log);
runArtisan('cache:clear', $log);
runArtisan('route:clear', $log);
runArtisan('view:clear', $log);

// Step 3: Run migrations
if (!runArtisan('migrate --force', $log)) {
    $success = false;
    $log[] = ['error' => 'Migration failed! Aborting seeder.'];
} else {
    // Step 4: Run seeders (only admin seeder - safe to re-run via updateOrCreate)
    runArtisan('db:seed --class=AdminSeeder --force', $log);
}

// Step 5: Rebuild caches for production
runArtisan('config:cache', $log);
runArtisan('route:cache', $log);
runArtisan('view:cache', $log);

// Step 6: Set correct storage permissions (shared hosting friendly)
if (is_writable(LARAVEL_ROOT . '/storage')) {
    runArtisan('storage:link', $log);
}

// Step 7: Bring application back up
runArtisan('up', $log);

// Step 8: Remove deploy.flag
if ($success) {
    unlink($flagFile);
    $log[] = ['info' => 'deploy.flag removed. Deploy complete.'];
}

flock($lock, LOCK_UN);
fclose($lock);
@unlink($lockFile);

header('Content-Type: application/json');
http_response_code($success ? 200 : 500);
echo json_encode([
    'status' => $success ? 'success' : 'error',
    'timestamp' => date('Y-m-d H:i:s'),
    'log' => $log,
]);
