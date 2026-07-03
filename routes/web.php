<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes — React SPA
|--------------------------------------------------------------------------
| The React application (src/main.tsx, mounted in resources/views/app.blade.php)
| is served for every front-end path. React Router handles client-side routing.
|
| The {any} catch-all explicitly EXCLUDES backend paths (api, sanctum, storage,
| build, up) via a negative-lookahead so the Laravel API and assets are untouched.
*/

Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|sanctum|storage|build|up|install\.php).*$');
