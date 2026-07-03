<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResellerAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $reseller = $request->user('reseller');
        if (!$reseller) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if ($reseller->status !== 'active') {
            return response()->json(['message' => 'Account is not active.'], 403);
        }
        return $next($request);
    }
}
