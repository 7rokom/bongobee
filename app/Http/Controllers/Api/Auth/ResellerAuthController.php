<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\Reseller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ResellerAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $reseller = Reseller::where('email', $request->email)->first();

        if (!$reseller) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        $stored = (string) $reseller->password;
        $isHashed = str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2b$') || str_starts_with($stored, '$argon');

        if ($isHashed) {
            $valid = Hash::check($request->password, $stored);
        } else {
            // Legacy plaintext password — compare directly, then rehash on success.
            $valid = ($request->password === $stored);
        }

        if (!$valid) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        // Auto-rehash any plaintext password on first successful login (one-time migration).
        if (!$isHashed) {
            $reseller->password = Hash::make($request->password);
            $reseller->save();
        }

        if ($reseller->status !== 'active') {
            return response()->json(['message' => 'Account is not active.'], 403);
        }

        $token = $reseller->createToken('reseller-token')->plainTextToken;
        return response()->json(['token' => $token, 'reseller' => $reseller]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:resellers',
            'phone' => 'required|string',
            'shop_name' => 'nullable|string',
            'password' => 'required|string|min:6',
        ]);

        $reseller = Reseller::create([
            ...$data,
            'password' => Hash::make($data['password']),
            'referral_code' => strtoupper(uniqid('R')),
            'status' => 'pending', // self-registrations require admin approval before login
        ]);

        $token = $reseller->createToken('reseller-token')->plainTextToken;
        return response()->json(['token' => $token, 'reseller' => $reseller], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user('reseller')->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user('reseller'));
    }
}
