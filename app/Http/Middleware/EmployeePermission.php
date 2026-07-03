<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmployeePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $admin = $request->user('admin');
        if ($admin) {
            return $next($request);
        }

        $employee = $request->user('employee');
        if (!$employee || !$employee->hasPermission($permission)) {
            return response()->json(['message' => 'Forbidden. Missing permission: '.$permission], 403);
        }

        return $next($request);
    }
}
