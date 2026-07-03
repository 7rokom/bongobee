<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin.auth' => \App\Http\Middleware\AdminAuth::class,
            'employee.permission' => \App\Http\Middleware\EmployeePermission::class,
            'reseller.auth' => \App\Http\Middleware\ResellerAuth::class,
            'digital.auth' => \App\Http\Middleware\DigitalCustomerAuth::class,
            'custom.domain' => \App\Http\Middleware\CustomDomainMiddleware::class,
            'install.guard' => \App\Http\Middleware\InstallGuard::class,
        ]);

        // InstallGuard runs on all requests (web + API) to enforce install/not-installed state.
        $middleware->web(\App\Http\Middleware\InstallGuard::class);
        $middleware->api(\App\Http\Middleware\InstallGuard::class);
        $middleware->web(\App\Http\Middleware\CustomDomainMiddleware::class);

        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson()) {
                if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                    return response()->json(['message' => 'Unauthenticated.'], 401);
                }
                if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
                    return response()->json(['message' => 'Not found.'], 404);
                }
                if ($e instanceof \Illuminate\Validation\ValidationException) {
                    return response()->json(['message' => 'Validation failed.', 'errors' => $e->errors()], 422);
                }
            }
        });
    })->create();
