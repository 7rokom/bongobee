<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\DigitalCustomer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class DigitalAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:digital_customers',
            'phone' => 'nullable|string',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $customer = DigitalCustomer::create([
            ...$data,
            'password' => Hash::make($data['password']),
        ]);

        $token = $customer->createToken('digital-token')->plainTextToken;
        return response()->json(['token' => $token, 'customer' => $customer], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $customer = DigitalCustomer::where('email', $request->email)->first();
        if (!$customer || !Hash::check($request->password, $customer->password)) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }
        if ($customer->is_blocked) {
            return response()->json(['message' => 'Account is blocked.'], 403);
        }

        $token = $customer->createToken('digital-token')->plainTextToken;
        return response()->json(['token' => $token, 'customer' => $customer]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user('digital_customer')->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user('digital_customer'));
    }
}
