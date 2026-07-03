<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DigitalProduct;
use App\Models\DigitalOrder;
use App\Models\DigitalCustomer;
use App\Models\DigitalCategory;
use App\Models\DigitalPaymentMethod;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class DigitalAdminController extends Controller
{
    // ---- Products ----
    public function products(Request $request): JsonResponse
    {
        $query = DigitalProduct::with('category');
        if ($request->filled('search')) $query->where('title', 'like', '%'.$request->search.'%');
        return response()->json($query->orderByDesc('created_at')->paginate(20));
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:digital_products',
            'description' => 'nullable|string',
            'price' => 'required|numeric',
            'original_price' => 'nullable|numeric',
            'images' => 'nullable|array',
            'featured_image' => 'nullable|string',
            'category_id' => 'nullable|uuid|exists:digital_categories,id',
            'product_type' => 'nullable|in:download,link,code,mixed',
            'download_file_path' => 'nullable|string',
            'access_link' => 'nullable|string',
            'access_code' => 'nullable|string',
            'status' => 'nullable|in:active,inactive',
            'meta_description' => 'nullable|string',
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['title']);
        $base = $data['slug']; $i = 1;
        while (DigitalProduct::where('slug', $data['slug'])->exists()) { $data['slug'] = $base.'-'.$i++; }
        return response()->json(DigitalProduct::create($data), 201);
    }

    public function updateProduct(Request $request, string $id): JsonResponse
    {
        $product = DigitalProduct::findOrFail($id);
        $data = $request->validate([
            'title' => 'sometimes|string',
            'slug' => 'sometimes|string|unique:digital_products,slug,'.$id,
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric',
            'original_price' => 'nullable|numeric',
            'images' => 'nullable|array',
            'featured_image' => 'nullable|string',
            'category_id' => 'nullable|uuid|exists:digital_categories,id',
            'product_type' => 'nullable|in:download,link,code,mixed',
            'download_file_path' => 'nullable|string',
            'access_link' => 'nullable|string',
            'access_code' => 'nullable|string',
            'status' => 'nullable|in:active,inactive',
        ]);
        $product->update($data);
        return response()->json($product);
    }

    public function destroyProduct(string $id): JsonResponse
    {
        DigitalProduct::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Orders ----
    public function orders(Request $request): JsonResponse
    {
        $query = DigitalOrder::with('customer');
        if ($request->filled('status')) $query->where('status', $request->status);
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function updateOrder(Request $request, string $id): JsonResponse
    {
        $order = DigitalOrder::findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:pending,confirmed,rejected',
            'admin_note' => 'nullable|string',
        ]);
        $order->update($data);
        if ($data['status'] === 'confirmed' && $order->screenshot_path) {
            Storage::delete($order->screenshot_path);
            $order->update(['screenshot_path' => null]);
        }
        return response()->json($order);
    }

    // ---- Users ----
    public function users(Request $request): JsonResponse
    {
        $query = DigitalCustomer::query();
        if ($request->filled('search')) $query->where('email', 'like', '%'.$request->search.'%');
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function blockUser(Request $request, string $id): JsonResponse
    {
        $customer = DigitalCustomer::findOrFail($id);
        $customer->update(['is_blocked' => !$customer->is_blocked]);
        return response()->json(['is_blocked' => $customer->is_blocked]);
    }

    // ---- Payment Methods ----
    public function paymentMethods(): JsonResponse
    {
        return response()->json(DigitalPaymentMethod::orderBy('sort_order')->get());
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'method_name' => 'required|string',
            'account_number' => 'required|string',
            'account_holder' => 'nullable|string',
            'instructions' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);
        return response()->json(DigitalPaymentMethod::create($data), 201);
    }

    public function updatePaymentMethod(Request $request, string $id): JsonResponse
    {
        $pm = DigitalPaymentMethod::findOrFail($id);
        $pm->update($request->validate([
            'method_name' => 'sometimes|string',
            'account_number' => 'sometimes|string',
            'account_holder' => 'nullable|string',
            'instructions' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]));
        return response()->json($pm);
    }

    public function destroyPaymentMethod(string $id): JsonResponse
    {
        DigitalPaymentMethod::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Pixel Setup (header/footer code) ----
    public function getPixelSetup(): JsonResponse
    {
        return response()->json(SiteSetting::get('digital_settings', []));
    }

    public function updatePixelSetup(Request $request): JsonResponse
    {
        SiteSetting::set('digital_settings', $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    // ---- Categories ----
    public function categories(): JsonResponse
    {
        return response()->json(DigitalCategory::orderBy('sort_order')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate(['name'=>'required|string','slug'=>'nullable|string|unique:digital_categories','image'=>'nullable|string','sort_order'=>'nullable|integer','is_active'=>'nullable|boolean']);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return response()->json(DigitalCategory::create($data), 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        $cat = DigitalCategory::findOrFail($id);
        $cat->update($request->validate(['name'=>'sometimes|string','slug'=>'sometimes|string|unique:digital_categories,slug,'.$id,'image'=>'nullable|string','sort_order'=>'nullable|integer','is_active'=>'nullable|boolean']));
        return response()->json($cat);
    }

    public function destroyCategory(string $id): JsonResponse
    {
        DigitalCategory::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Report ----
    public function report(Request $request): JsonResponse
    {
        $from = $request->get('date_from', now()->startOfMonth()->toDateString());
        $to = $request->get('date_to', now()->toDateString());
        $revenue = DigitalOrder::where('status', 'confirmed')
            ->whereBetween(\DB::raw('DATE(created_at)'), [$from, $to])
            ->sum('total_amount');
        $count = DigitalOrder::where('status', 'confirmed')
            ->whereBetween(\DB::raw('DATE(created_at)'), [$from, $to])
            ->count();
        return response()->json(['revenue' => round($revenue, 2), 'confirmed_orders' => $count, 'date_from' => $from, 'date_to' => $to]);
    }
}
