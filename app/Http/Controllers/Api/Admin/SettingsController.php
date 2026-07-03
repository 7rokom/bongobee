<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Models\BackupLog;
use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;

class SettingsController extends Controller
{
    // Update the authenticated admin's email/password (admins table, hashed).
    public function updateAdminCredentials(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string|min:6']);
        $admin = $request->user('admin');
        if (!$admin) return response()->json(['message' => 'Only admins can change credentials.'], 403);
        $admin->update(['email' => $data['email'], 'password' => \Illuminate\Support\Facades\Hash::make($data['password'])]);
        return response()->json(['message' => 'Updated.']);
    }

    // Full React site-settings blob (single JSON document).
    public function getFrontendSettings(): JsonResponse
    {
        return response()->json(SiteSetting::get('frontend_blob', new \stdClass()));
    }

    public function saveFrontendSettings(Request $request): JsonResponse
    {
        SiteSetting::set('frontend_blob', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    public function getGeneral(): JsonResponse
    {
        return response()->json(SiteSetting::get('general', []));
    }

    public function updateGeneral(Request $request): JsonResponse
    {
        SiteSetting::set('general', $request->all());
        return response()->json(['message' => 'Saved.', 'data' => $request->all()]);
    }

    public function getHeaderFooter(): JsonResponse
    {
        return response()->json(SiteSetting::get('header_footer', []));
    }

    public function updateHeaderFooter(Request $request): JsonResponse
    {
        SiteSetting::set('header_footer', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    public function getCourierSettings(): JsonResponse
    {
        return response()->json(SiteSetting::get('courier_settings', []));
    }

    public function updateCourierSettings(Request $request): JsonResponse
    {
        SiteSetting::set('courier_settings', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    public function getAudioSettings(): JsonResponse
    {
        return response()->json(SiteSetting::get('audio_settings', []));
    }

    public function updateAudioSettings(Request $request): JsonResponse
    {
        SiteSetting::set('audio_settings', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    public function getFraudSettings(): JsonResponse
    {
        return response()->json(SiteSetting::get('fraud_settings', []));
    }

    public function updateFraudSettings(Request $request): JsonResponse
    {
        SiteSetting::set('fraud_settings', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        $admin = $request->user('admin');
        if (!$admin || !Hash::check($request->current_password, $admin->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $admin->update(['password' => Hash::make($request->new_password)]);
        return response()->json(['message' => 'Password updated.']);
    }

    public function createBackup(Request $request): JsonResponse
    {
        $backup = app(BackupService::class)->createDatabaseBackup('manual');
        return response()->json($backup, $backup['success'] ? 200 : 500);
    }

    public function listBackups(): JsonResponse
    {
        $backups = app(BackupService::class)->listBackups();
        $logs = BackupLog::orderByDesc('created_at')->limit(20)->get();
        return response()->json(['files' => $backups, 'logs' => $logs]);
    }

    public function downloadBackup(string $filename): mixed
    {
        $path = app(BackupService::class)->downloadBackup($filename);
        if (!$path) return response()->json(['message' => 'File not found.'], 404);
        return response()->download($path, $filename);
    }
}
