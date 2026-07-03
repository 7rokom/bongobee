<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Category::orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'slug' => 'nullable|string|unique:categories',
            'image' => 'nullable|string',
            'featured' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'icon' => 'nullable|string',
            'lucide_icon' => 'nullable|string',
            'parent_id' => 'nullable|string',
            'is_main' => 'nullable|boolean',
            'custom_link' => 'nullable|string',
            'product_count' => 'nullable|integer',
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return response()->json(Category::create($data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $cat = Category::findOrFail($id);
        $cat->update($request->validate([
            'name' => 'sometimes|string',
            'slug' => 'sometimes|string|unique:categories,slug,'.$id,
            'image' => 'nullable|string',
            'featured' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'icon' => 'nullable|string',
            'lucide_icon' => 'nullable|string',
            'parent_id' => 'nullable|string',
            'is_main' => 'nullable|boolean',
            'custom_link' => 'nullable|string',
            'product_count' => 'nullable|integer',
        ]));
        return response()->json($cat);
    }

    public function destroy(string $id): JsonResponse
    {
        Category::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
