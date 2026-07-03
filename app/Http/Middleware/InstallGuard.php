<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * InstallGuard — two-way protection:
 *
 * 1. If NOT installed: blocks all normal app routes and returns a 503 JSON.
 *    Installer routes (/install.php and /api/install/*) are always allowed.
 *
 * 2. If ALREADY installed: blocks /api/install/* to prevent re-installation.
 *    (public/install.php handles its own marker check at the top of the file.)
 */
class InstallGuard
{
    private const MARKER = 'framework/installed';

    private bool $installed;

    public function __construct()
    {
        // Primary check: explicit installed marker created by the installer.
        // Fallback: if .env exists AND APP_KEY is set, the app is considered
        // configured even without the marker (covers existing / dev environments).
        $hasMarker = file_exists(storage_path(self::MARKER));
        $hasEnv    = file_exists(base_path('.env')) && !empty(env('APP_KEY'));
        $this->installed = $hasMarker || $hasEnv;
    }

    public function handle(Request $request, Closure $next): Response
    {
        $path = ltrim($request->getPathInfo(), '/');

        // Always allow: health check, built assets, storage symlink
        if (in_array($path, ['up', '']) || str_starts_with($path, 'build/') || str_starts_with($path, 'storage/')) {
            return $next($request);
        }

        // Allow the standalone installer PHP file (served directly, not routed through Laravel)
        if ($path === 'install.php') {
            return $next($request);
        }

        // Installer API routes
        $isInstallerRoute = str_starts_with($path, 'api/install/');

        if ($this->installed) {
            // Block installer API after installation to prevent re-use
            if ($isInstallerRoute) {
                return response()->json(['message' => 'Installer is disabled — application is already installed.'], 403);
            }
            return $next($request);
        }

        // NOT installed: only allow installer routes
        if ($isInstallerRoute) {
            return $next($request);
        }

        // All other routes return a 503 until installed
        if ($request->expectsJson() || str_starts_with($path, 'api/')) {
            return response()->json([
                'message' => 'Application not installed. Please run the installer at /install.php',
                'installer' => url('/install.php'),
            ], 503);
        }

        // HTML response for browser requests
        return response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Setup Required</title><style>
            body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
            .box{text-align:center;padding:40px;background:#1e293b;border-radius:16px;border:1px solid #334155;max-width:400px}
            h1{font-size:32px;margin-bottom:8px}h2{font-size:18px;margin-bottom:20px;color:#94a3b8}
            a{display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}
            </style></head><body><div class="box"><h1>🐝</h1><h2>BongoBee Setup Required</h2>
            <p style="color:#64748b;margin-bottom:20px">This application has not been installed yet. Run the setup wizard to get started.</p>
            <a href="/install.php">▶ Run Setup Wizard</a></div></body></html>',
            503,
            ['Content-Type' => 'text/html']
        );
    }
}
