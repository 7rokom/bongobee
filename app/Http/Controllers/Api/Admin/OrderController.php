<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\FollowUpData;
use App\Models\EmployeeActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('phone')) {
            $query->where('customer_phone', 'like', '%'.$request->phone.'%');
        }
        if ($request->filled('invoice')) {
            $query->where('invoice_number', $request->invoice);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $orders = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => 'required|string',
            'customer_phone' => 'required|string',
            'customer_address' => 'nullable|string',
            'delivery_zone' => 'nullable|string',
            'items' => 'required|array',
            'total_amount' => 'required|numeric',
            'delivery_charge' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'coupon_code' => 'nullable|string',
            'note' => 'nullable|string',
            'source' => 'nullable|string',
        ]);

        $data['invoice_number'] = Order::nextInvoiceNumber();

        $order = Order::create($data);

        return response()->json($order, 201);
    }

    public function show(string $id): JsonResponse
    {
        $order = Order::with('followUp')->findOrFail($id);
        return response()->json($order);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $order = Order::findOrFail($id);

        $data = $request->validate([
            'status' => 'nullable|string',
            'note' => 'nullable|string',
            'admin_note' => 'nullable|string',
            'assigned_to' => 'nullable|string',
            'tracking_url' => 'nullable|string',
            'courier_name' => 'nullable|string',
            'vendor_buy_price' => 'nullable|numeric',
            'courier_invoice_id' => 'nullable|string',
            'courier_delivery_charge' => 'nullable|numeric',
        ]);

        $order->update(array_filter($data, fn($v) => $v !== null));

        // Sync follow-up data if tracking fields present
        if ($request->hasAny(['tracking_url','courier_name','vendor_buy_price','courier_invoice_id','courier_delivery_charge'])) {
            FollowUpData::updateOrCreate(
                ['order_id' => $order->id],
                array_filter([
                    'tracking_url' => $request->tracking_url,
                    'courier_name' => $request->courier_name,
                    'vendor_buy_price' => $request->vendor_buy_price,
                    'courier_invoice_id' => $request->courier_invoice_id,
                    'courier_delivery_charge' => $request->courier_delivery_charge,
                ], fn($v) => $v !== null)
            );
        }

        // Log employee activity
        if ($request->user('employee')) {
            EmployeeActivity::create([
                'employee_id' => $request->user('employee')->id,
                'action' => 'order_updated',
                'entity_type' => 'order',
                'entity_id' => $order->id,
                'details' => 'Status: '.($data['status'] ?? $order->status),
            ]);
        }

        return response()->json($order->fresh('followUp'));
    }

    public function destroy(string $id): JsonResponse
    {
        Order::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function bulkUpdateStatus(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array',
            'status' => 'required|string',
        ]);

        Order::whereIn('id', $request->ids)->update(['status' => $request->status]);
        return response()->json(['message' => 'Updated.', 'count' => count($request->ids)]);
    }
}
