<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ResellerDomain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerDomainController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ResellerDomain::with('reseller')->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('domain', 'like', "%{$search}%")
                  ->orWhereHas('reseller', fn ($r) => $r->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(20));
    }

    public function approve(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'verified', 'verified_at' => now()]);
        return response()->json(['message' => 'Domain approved.', 'domain' => $domain]);
    }

    public function reject(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'failed']);
        return response()->json(['message' => 'Domain rejected.', 'domain' => $domain]);
    }

    public function disable(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'inactive']);
        return response()->json(['message' => 'Domain disabled.', 'domain' => $domain]);
    }

    public function destroy(string $id): JsonResponse
    {
        ResellerDomain::findOrFail($id)->delete();
        return response()->json(['message' => 'Domain deleted.']);
    }

    public function setupFiles(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);

        if ($domain->status !== 'verified') {
            return response()->json(['message' => 'Domain অনুমোদিত নয়।'], 422);
        }

        $domainName  = $domain->domain;
        $domainsBase = env('HOSTINGER_DOMAINS_PATH', '/home/u964920539/domains');
        $targetDir   = "{$domainsBase}/{$domainName}/public_html";
        $mainPublic  = public_path();
        $serverIp    = env('CUSTOM_DOMAIN_SERVER_IP', '');

        if (!is_dir($targetDir)) {
            return response()->json([
                'message' => "Directory পাওয়া যায়নি।\n\nHostinger hPanel-এ প্রথমে '{$domainName}' domain টি যোগ করুন, তারপর আবার চেষ্টা করুন।",
            ], 422);
        }

        $indexPhp = <<<PHP
<?php
/**
 * BongoBee custom domain bootstrap: {$domainName}
 * Serves the main Laravel app while preserving the custom domain URL.
 */
\$mainPublic = '{$mainPublic}';

\$uri      = parse_url(\$_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
\$filePath = \$mainPublic . \$uri;

if (\$uri !== '/' && \$uri !== '' && file_exists(\$filePath) && is_file(\$filePath)) {
    \$mimeTypes = [
        'js'    => 'application/javascript',
        'css'   => 'text/css',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'json'  => 'application/json',
        'webp'  => 'image/webp',
        'txt'   => 'text/plain',
        // Audio — browsers require correct Content-Type and Range support
        'mp3'   => 'audio/mpeg',
        'ogg'   => 'audio/ogg',
        'wav'   => 'audio/wav',
        'm4a'   => 'audio/mp4',
        'aac'   => 'audio/aac',
        // Video
        'mp4'   => 'video/mp4',
        'webm'  => 'video/webm',
    ];
    \$ext = strtolower(pathinfo(\$filePath, PATHINFO_EXTENSION));
    if (isset(\$mimeTypes[\$ext])) {
        header('Content-Type: ' . \$mimeTypes[\$ext]);
    }
    \$fileSize = filesize(\$filePath);
    header('Accept-Ranges: bytes');
    // Handle HTTP Range requests so browsers can stream/seek audio and video.
    \$range = \$_SERVER['HTTP_RANGE'] ?? null;
    if (\$range && preg_match('/bytes=(\d+)-(\d*)/', \$range, \$m)) {
        \$start  = (int) \$m[1];
        \$end    = (\$m[2] !== '') ? (int) \$m[2] : \$fileSize - 1;
        \$end    = min(\$end, \$fileSize - 1);
        \$length = \$end - \$start + 1;
        http_response_code(206);
        header("Content-Range: bytes \$start-\$end/\$fileSize");
        header("Content-Length: \$length");
        \$fh = fopen(\$filePath, 'rb');
        fseek(\$fh, \$start);
        \$remaining = \$length;
        while (\$remaining > 0 && !\$feof(\$fh)) {
            \$chunk = fread(\$fh, min(65536, \$remaining));
            if (\$chunk === false) break;
            echo \$chunk;
            \$remaining -= strlen(\$chunk);
        }
        fclose(\$fh);
        exit;
    }
    header("Content-Length: \$fileSize");
    readfile(\$filePath);
    exit;
}

chdir(\$mainPublic);
\$_SERVER['DOCUMENT_ROOT']   = \$mainPublic;
\$_SERVER['SCRIPT_FILENAME'] = \$mainPublic . '/index.php';
require \$mainPublic . '/index.php';
PHP;

        $htaccess = <<<HTACCESS
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^ index.php [L]
</IfModule>
HTACCESS;

        file_put_contents("{$targetDir}/index.php", $indexPhp);
        file_put_contents("{$targetDir}/.htaccess", $htaccess);

        return response()->json([
            'message'          => 'Bootstrap files তৈরি হয়েছে।',
            'dns_instructions' => [
                'server_ip' => $serverIp,
                'domain'    => $domainName,
            ],
        ]);
    }
}
