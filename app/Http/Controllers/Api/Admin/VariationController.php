<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Variation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VariationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Variation::all());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string', 'type' => 'nullable|string', 'options' => 'nullable|array']);
        return response()->json(Variation::create($data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $v = Variation::findOrFail($id);
        $v->update($request->validate(['name' => 'sometimes|string', 'type' => 'nullable|string', 'options' => 'nullable|array']));
        return response()->json($v);
    }

    public function destroy(string $id): JsonResponse
    {
        Variation::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
