<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\StockEntry;
use App\Models\Expense;
use App\Models\Deposit;
use App\Models\Order;
use App\Models\ResellerOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    // Stock
    public function stockIndex(): JsonResponse
    {
        return response()->json(StockEntry::orderByDesc("created_at")->get());
    }

    public function stockStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_name' => 'required|string',
            'quantity' => 'required|integer|min:1',
            'buy_price' => 'required|numeric|min:0',
            'sell_price' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'note' => 'nullable|string',
            'date' => 'nullable|string',
            'entry_date' => 'nullable|date',
            'damage' => 'nullable|integer',
        ]);
        $data['total_cost'] = $data['quantity'] * $data['buy_price'];
        return response()->json(StockEntry::create($data), 201);
    }

    public function stockUpdate(Request $request, string $id): JsonResponse
    {
        $entry = StockEntry::findOrFail($id);
        $data = $request->validate([
            'product_name' => 'sometimes|string',
            'quantity' => 'sometimes|integer',
            'buy_price' => 'sometimes|numeric',
            'sell_price' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'note' => 'nullable|string',
            'date' => 'nullable|string',
            'entry_date' => 'nullable|date',
            'damage' => 'nullable|integer',
        ]);
        if (isset($data['quantity']) && isset($data['buy_price'])) {
            $data['total_cost'] = $data['quantity'] * $data['buy_price'];
        }
        $entry->update($data);
        return response()->json($entry);
    }

    public function stockDestroy(string $id): JsonResponse
    {
        StockEntry::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Expenses
    public function expenseIndex(): JsonResponse
    {
        return response()->json(Expense::orderByDesc("created_at")->get());
    }

    public function expenseStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'category' => 'nullable|string',
            'note' => 'nullable|string',
            'date' => 'nullable|string',
            'employee_id' => 'nullable|string',
            'expense_date' => 'nullable|date',
        ]);
        return response()->json(Expense::create($data), 201);
    }

    public function expenseUpdate(Request $request, string $id): JsonResponse
    {
        $e = Expense::findOrFail($id);
        $e->update($request->validate(['title'=>'sometimes|string','amount'=>'sometimes|numeric','category'=>'nullable|string','note'=>'nullable|string','expense_date'=>'nullable|date']));
        return response()->json($e);
    }

    public function expenseDestroy(string $id): JsonResponse
    {
        Expense::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Deposits
    public function depositIndex(): JsonResponse
    {
        return response()->json(Deposit::orderByDesc("created_at")->get());
    }

    public function depositStore(Request $request): JsonResponse
    {
        $data = $request->validate(['title'=>'required|string','amount'=>'required|numeric','source'=>'nullable|string','note'=>'nullable|string','date'=>'nullable|string','deposit_date'=>'nullable|date']);
        return response()->json(Deposit::create($data), 201);
    }

    public function depositUpdate(Request $request, string $id): JsonResponse
    {
        $d = Deposit::findOrFail($id);
        $d->update($request->validate(['title'=>'sometimes|string','amount'=>'sometimes|numeric','source'=>'nullable|string','note'=>'nullable|string','date'=>'nullable|string','deposit_date'=>'nullable|date']));
        return response()->json($d);
    }

    public function depositDestroy(string $id): JsonResponse
    {
        Deposit::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Profit / Account Report
    public function profitReport(Request $request): JsonResponse
    {
        $from = $request->get('date_from', now()->startOfMonth()->toDateString());
        $to = $request->get('date_to', now()->toDateString());

        $deliveredRevenue = Order::where('status', 'ডেলিভারড')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to])
            ->sum(DB::raw('total_amount - delivery_charge'));

        $resellerRevenue = ResellerOrder::where('status', 'ডেলিভারড')
            ->whereBetween(DB::raw('DATE(created_at)'), [$from, $to])
            ->sum('reseller_profit');

        $totalExpenses = Expense::whereBetween(DB::raw('DATE(created_at)'), [$from, $to])->sum('amount');
        $totalDeposits = Deposit::whereBetween(DB::raw('DATE(created_at)'), [$from, $to])->sum('amount');
        $totalStockCost = StockEntry::whereBetween(DB::raw('DATE(created_at)'), [$from, $to])->sum('total_cost');

        $totalRevenue = $deliveredRevenue + $resellerRevenue;
        $netProfit = $totalRevenue + $totalDeposits - $totalExpenses - $totalStockCost;

        return response()->json([
            'date_from' => $from,
            'date_to' => $to,
            'delivered_revenue' => round($deliveredRevenue, 2),
            'reseller_profit' => round($resellerRevenue, 2),
            'total_revenue' => round($totalRevenue, 2),
            'total_expenses' => round($totalExpenses, 2),
            'total_deposits' => round($totalDeposits, 2),
            'total_stock_cost' => round($totalStockCost, 2),
            'net_profit' => round($netProfit, 2),
        ]);
    }
}
