<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ResellerOrder;
use App\Models\Product;
use App\Models\Reseller;
use App\Models\Expense;
use App\Models\Deposit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $dateFrom = $request->get('date_from', now()->startOfMonth()->toDateString());
        $dateTo = $request->get('date_to', now()->toDateString());

        // Order stats
        $orderStats = Order::selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status = 'ডেলিভারড' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status = 'পেন্ডিং' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'কনফার্মড' THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN status = 'ক্যান্সেল' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'রিটার্ন' THEN 1 ELSE 0 END) as returned
        ")->whereBetween(DB::raw('DATE(created_at)'), [$dateFrom, $dateTo])->first();

        // Revenue (delivered orders: total - delivery_charge)
        $revenue = Order::where('status', 'ডেলিভারড')
            ->whereBetween(DB::raw('DATE(created_at)'), [$dateFrom, $dateTo])
            ->sum(DB::raw('total_amount - delivery_charge'));

        // Reseller order stats
        $resellerStats = ResellerOrder::selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status = 'ডেলিভারড' THEN 1 ELSE 0 END) as delivered
        ")->whereBetween(DB::raw('DATE(created_at)'), [$dateFrom, $dateTo])->first();

        // Expenses & deposits
        $totalExpenses = Expense::whereBetween(DB::raw('DATE(created_at)'), [$dateFrom, $dateTo])->sum('amount');
        $totalDeposits = Deposit::whereBetween(DB::raw('DATE(created_at)'), [$dateFrom, $dateTo])->sum('amount');

        // Revenue trend (last 30 days)
        $trend = Order::where('status', 'ডেলিভারড')
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('DATE(created_at) as date, SUM(total_amount - delivery_charge) as revenue, COUNT(*) as orders')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'orders' => $orderStats,
            'revenue' => round($revenue, 2),
            'reseller_orders' => $resellerStats,
            'expenses' => $totalExpenses,
            'deposits' => $totalDeposits,
            'total_products' => Product::where('status', 'active')->count(),
            'total_resellers' => Reseller::where('status', 'active')->count(),
            'revenue_trend' => $trend,
        ]);
    }
}
