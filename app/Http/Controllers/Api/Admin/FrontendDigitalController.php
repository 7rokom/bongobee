<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DigitalProduct;
use App\Models\DigitalCategory;
use App\Models\DigitalPaymentMethod;
use App\Models\DigitalOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

// Phase 3 Module 12 — digital store in the React frontend's exact schema.
class FrontendDigitalController extends Controller
{
    // ---- Products ----
    public function products(Request $request): JsonResponse
    {
        $q = DigitalProduct::query()->orderByDesc('created_at');
        if (!$request->boolean('includeAll')) $q->where('status', 'published');
        return response()->json($q->get());
    }

    public function productBySlug(string $slug): JsonResponse
    {
        return response()->json(DigitalProduct::where('slug', $slug)->first());
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->except(['id']);
        $data['slug'] = $request->input('slug') ?: Str::slug($request->input('title', 'product')) . '-' . Str::random(4);
        $product = DigitalProduct::create($data);
        return response()->json($product, 201);
    }

    public function updateProduct(Request $request, string $id): JsonResponse
    {
        $p = DigitalProduct::findOrFail($id);
        $p->update($request->except(['id']));
        return response()->json($p->fresh());
    }

    public function deleteProduct(string $id): JsonResponse
    {
        DigitalProduct::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Categories (frontend uses just the name) ----
    public function categories(): JsonResponse
    {
        return response()->json(DigitalCategory::orderBy('name')->get(['name']));
    }

    public function addCategory(Request $request): JsonResponse
    {
        $name = trim((string) $request->input('name'));
        if ($name === '') return response()->json(['message' => 'name required'], 422);
        $cat = DigitalCategory::firstOrCreate(['name' => $name], ['slug' => Str::slug($name) ?: Str::random(6)]);
        return response()->json($cat, 201);
    }

    public function removeCategory(Request $request): JsonResponse
    {
        DigitalCategory::where('name', $request->input('name'))->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Payment methods ----
    public function paymentMethods(Request $request): JsonResponse
    {
        $q = DigitalPaymentMethod::orderBy('sort_order');
        if ($request->boolean('activeOnly')) $q->where('is_active', true);
        return response()->json($q->get());
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        return response()->json(DigitalPaymentMethod::create($request->except(['id'])), 201);
    }

    public function updatePaymentMethod(Request $request, string $id): JsonResponse
    {
        $m = DigitalPaymentMethod::findOrFail($id);
        $m->update($request->except(['id']));
        return response()->json($m->fresh());
    }

    public function deletePaymentMethod(string $id): JsonResponse
    {
        DigitalPaymentMethod::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Orders ----
    public function orders(): JsonResponse
    {
        return response()->json(DigitalOrder::orderByDesc('created_at')->get());
    }

    public function myOrders(Request $request): JsonResponse
    {
        $userId = $request->input('user_id');
        if (!$userId) return response()->json([]);
        return response()->json(DigitalOrder::where('user_id', $userId)->orderByDesc('created_at')->get());
    }

    public function createOrder(Request $request): JsonResponse
    {
        $data = $request->except(['id']);
        // generate order_number atomically
        $num = DB::transaction(function () {
            $c = \App\Models\Counter::lockForUpdate()->find('digital_order_number');
            if (!$c) $c = \App\Models\Counter::create(['id' => 'digital_order_number', 'value' => 0]);
            $c->increment('value');
            return $c->fresh()->value;
        });
        $data['order_number'] = $request->input('order_number') ?: ('DO' . str_pad((string) $num, 3, '0', STR_PAD_LEFT));
        $order = DigitalOrder::create($data);
        return response()->json($order, 201);
    }

    public function updateOrder(Request $request, string $id): JsonResponse
    {
        $o = DigitalOrder::findOrFail($id);
        $o->update($request->except(['id']));
        return response()->json($o->fresh());
    }

    public function deleteOrder(string $id): JsonResponse
    {
        DigitalOrder::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Blocked users ----
    public function blocks(): JsonResponse
    {
        return response()->json(DB::table('digital_blocked_users')->orderByDesc('created_at')->get());
    }

    public function addBlock(Request $request): JsonResponse
    {
        $id = (string) Str::uuid();
        DB::table('digital_blocked_users')->insert([
            'id' => $id,
            'user_id' => $request->input('user_id'),
            'block_type' => $request->input('block_type'),
            'block_value' => $request->input('block_value'),
            'type' => $request->input('block_type'),
            'value' => $request->input('block_value'),
            'reason' => $request->input('reason'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('digital_blocked_users')->find($id), 201);
    }

    public function removeBlock(string $id): JsonResponse
    {
        DB::table('digital_blocked_users')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Digital customers ----
    public function users(): JsonResponse
    {
        return response()->json(\App\Models\DigitalCustomer::orderByDesc('created_at')->get());
    }

    public function deleteUser(string $id): JsonResponse
    {
        \App\Models\DigitalCustomer::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- File uploads (screenshots, product files) ----
    public function upload(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:10240']);
        $folder = $request->input('folder', 'digital-uploads');
        $path = $request->file('file')->store($folder, 'public');
        return response()->json(['path' => '/storage/' . $path]);
    }
}
