<?php

use App\Models\Admin;
use App\Models\Employee;
use App\Models\Reseller;
use App\Models\DigitalCustomer;

return [

    'defaults' => [
        'guard' => 'admin',
        'passwords' => 'admins',
    ],

    'guards' => [
        'admin' => [
            'driver' => 'sanctum',
            'provider' => 'admins',
        ],
        'employee' => [
            'driver' => 'sanctum',
            'provider' => 'employees',
        ],
        'reseller' => [
            'driver' => 'sanctum',
            'provider' => 'resellers',
        ],
        'digital_customer' => [
            'driver' => 'sanctum',
            'provider' => 'digital_customers',
        ],
    ],

    'providers' => [
        'admins' => [
            'driver' => 'eloquent',
            'model' => Admin::class,
        ],
        'employees' => [
            'driver' => 'eloquent',
            'model' => Employee::class,
        ],
        'resellers' => [
            'driver' => 'eloquent',
            'model' => Reseller::class,
        ],
        'digital_customers' => [
            'driver' => 'eloquent',
            'model' => DigitalCustomer::class,
        ],
    ],

    'passwords' => [
        'admins' => [
            'provider' => 'admins',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

];
