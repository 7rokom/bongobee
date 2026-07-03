<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminLoginController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Try admin first
        $admin = Admin::where('email', $request->email)->first();
        if ($admin && Hash::check($request->password, $admin->password)) {
            $token = $admin->createToken('admin-token', ['role:admin'])->plainTextToken;
            return response()->json([
                'token' => $token,
                'user' => ['id' => $admin->id, 'name' => $admin->name, 'email' => $admin->email, 'role' => 'admin'],
            ]);
        }

        // Try employee
        $employee = Employee::where('email', $request->email)->where('is_active', true)->first();
        if ($employee && Hash::check($request->password, $employee->password)) {
            $token = $employee->createToken('employee-token', ['role:employee'])->plainTextToken;
            return response()->json([
                'token' => $token,
                'user' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'email' => $employee->email,
                    'role' => 'employee',
                    'permissions' => $employee->permissions ?? [],
                ],
            ]);
        }

        throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user('admin') ?? $request->user('employee');
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $data = ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
        if ($user instanceof Employee) {
            $data['role'] = 'employee';
            $data['permissions'] = $user->permissions ?? [];
        } else {
            $data['role'] = 'admin';
        }
        return response()->json($data);
    }
}
