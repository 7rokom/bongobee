<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LandingPageController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(LandingPage::with('product')->orderByDesc('created_at')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:landing_pages',
            'product_id' => 'nullable|string',
            'custom_price' => 'nullable|numeric',
            'custom_original_price' => 'nullable|numeric',
            'content' => 'nullable|string',
            'custom_html' => 'nullable|string',
            'image' => 'nullable|string',
            'status' => 'nullable|string',
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['title']);
        $base = $data['slug']; $i = 1;
        while (LandingPage::where('slug', $data['slug'])->exists()) { $data['slug'] = $base.'-'.$i++; }
        return response()->json(LandingPage::create($data)->load('product'), 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(LandingPage::with('product')->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $page = LandingPage::findOrFail($id);
        $data = $request->validate([
            'title' => 'sometimes|string',
            'slug' => 'sometimes|string|unique:landing_pages,slug,'.$id,
            'product_id' => 'nullable|string',
            'custom_price' => 'nullable|numeric',
            'custom_original_price' => 'nullable|numeric',
            'content' => 'nullable|string',
            'custom_html' => 'nullable|string',
            'image' => 'nullable|string',
            'status' => 'nullable|string',
        ]);
        $page->update($data);
        return response()->json($page->load('product'));
    }

    public function destroy(string $id): JsonResponse
    {
        LandingPage::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
