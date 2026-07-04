<?php

namespace App\Http\Middleware;

use App\Models\ResellerDomain;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CustomDomainMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $workerSecret   = env('CLOUDFLARE_WORKER_SECRET');
        $xCustomDomain  = $request->header('X-Custom-Domain');

        // Trust the custom domain header only when it arrives with the correct worker secret.
        if ($xCustomDomain && $workerSecret && $request->header('X-Worker-Secret') === $workerSecret) {
            $host = $xCustomDomain;
        } else {
            $host = $request->getHost();
        }

        $appHost = parse_url(config('app.url'), PHP_URL_HOST);

        if ($host === $appHost) {
            return $next($request);
        }

        $domain = ResellerDomain::where('domain', $host)
            ->where('status', 'verified')
            ->with('reseller')
            ->first();

        if ($domain && $domain->reseller) {
            $request->attributes->set('custom_domain_reseller', $domain->reseller);
            $request->attributes->set('custom_domain_ref',
                $domain->reseller->serial_number ?? (string) $domain->reseller->id
            );
        }

        return $next($request);
    }
}
