<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class EmployeeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Employee::orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:employees',
            'phone' => 'nullable|string',
            'password' => 'required|string|min:6',
            'role' => 'nullable|string',
            'permissions' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);
        $data['password'] = Hash::make($data['password']);
        return response()->json(Employee::create($data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string',
            'email' => 'sometimes|email|unique:employees,email,'.$id,
            'phone' => 'nullable|string',
            'password' => 'nullable|string|min:6',
            'role' => 'nullable|string',
            'permissions' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $employee->update($data);
        return response()->json($employee);
    }

    public function destroy(string $id): JsonResponse
    {
        Employee::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function report(Request $request): JsonResponse
    {
        $query = EmployeeActivity::with('employee');
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }
}
