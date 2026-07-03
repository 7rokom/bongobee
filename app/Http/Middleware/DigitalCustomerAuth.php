<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DigitalCustomerAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $customer = $request->user('digital_customer');
        if (!$customer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if ($customer->is_blocked) {
            return response()->json(['message' => 'Account is blocked.'], 403);
        }
        return $next($request);
    }
}
