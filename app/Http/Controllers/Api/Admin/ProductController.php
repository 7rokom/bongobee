<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query();

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', '%'.$request->search.'%')
                  ->orWhere('name', 'like', '%'.$request->search.'%');
            });
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->orderByDesc('created_at')->paginate($request->get('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $title = $data['title'] ?? $data['name'] ?? 'Product';
        $data['name'] = $data['name'] ?? $title;          // keep legacy name column populated
        $data['slug'] = $data['slug'] ?? Str::slug($title);
        $base = $data['slug'];
        $i = 1;
        while (Product::where('slug', $data['slug'])->exists()) {
            $data['slug'] = $base.'-'.$i++;
        }

        $product = Product::create($data);
        return response()->json($product, 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(Product::findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $data = $request->validate($this->rules($id));
        $product->update($data);
        return response()->json($product);
    }

    public function destroy(string $id): JsonResponse
    {
        Product::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Validation rules accepting the frontend's field names (title, long_description,
     * category slug, rating/reviews, affiliate). All optional so partial updates work.
     */
    private function rules(?string $id = null): array
    {
        $slugRule = $id ? 'sometimes|string|unique:products,slug,'.$id : 'nullable|string|unique:products';
        return [
            'title' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'slug' => $slugRule,
            'category_id' => 'nullable|uuid',
            'category' => 'nullable|string',
            'brand' => 'nullable|string',
            'description' => 'nullable|string',
            'long_description' => 'nullable|string',
            'short_description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'original_price' => 'nullable|numeric',
            'buy_price' => 'nullable|numeric',
            'reseller_price' => 'nullable|numeric',
            'images' => 'nullable|array',
            'featured_image' => 'nullable|string',
            'featured_video' => 'nullable|string',
            'colors' => 'nullable|array',
            'sizes' => 'nullable|array',
            'weights' => 'nullable|array',
            'variations' => 'nullable|array',
            'variation_prices' => 'nullable|array',
            'audio_url' => 'nullable|string',
            'stock_type' => 'nullable|string',
            'stock_product_name' => 'nullable|string',
            'status' => 'nullable|string',
            'in_stock' => 'nullable|boolean',
            'free_delivery' => 'nullable|boolean',
            'meta_description' => 'nullable|string',
            'meta_keywords' => 'nullable|string',
            'rating' => 'nullable|numeric',
            'review_count' => 'nullable|integer',
            'reviews' => 'nullable|array',
            'is_affiliate' => 'nullable|boolean',
            'affiliate_url' => 'nullable|string',
            'affiliate_button_text' => 'nullable|string',
        ];
    }
}
