<?php

namespace App\Http\Controllers\Api\Reseller;

use App\Http\Controllers\Controller;
use App\Models\ResellerOrder;
use App\Models\PaymentRequest;
use App\Models\ResellerPaymentMethod;
use App\Models\Product;
use App\Models\ResellerProductPrice;
use App\Models\LandingPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResellerPortalController extends Controller
{
    private function reseller(Request $request) {
        return $request->user('reseller');
    }

    public function dashboard(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $stats = ResellerOrder::where('reseller_id', $reseller->id)->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status='ডেলিভারড' THEN reseller_profit ELSE 0 END) as total_profit,
            SUM(CASE WHEN status='রিটার্ন' THEN reseller_profit ELSE 0 END) as return_loss
        ")->first();
        $approved = PaymentRequest::where('reseller_id', $reseller->id)->where('status', 'approved')->sum('amount');
        $balance = ($stats->total_profit ?? 0) - ($stats->return_loss ?? 0) - $approved;
        return response()->json(['stats' => $stats, 'balance' => round($balance, 2)]);
    }

    public function products(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $customPrices = ResellerProductPrice::where('reseller_id', $reseller->id)
            ->pluck('custom_price', 'product_id');

        $products = Product::where('status', 'active')->get()->map(function ($p) use ($customPrices) {
            $p->reseller_selling_price = $customPrices[$p->id] ?? $p->reseller_price ?? $p->price;
            return $p;
        });

        return response()->json($products);
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $data = $request->validate([
            'customer_name' => 'required|string',
            'customer_phone' => 'required|string',
            'customer_address' => 'required|string',
            'delivery_zone' => 'nullable|string',
            'items' => 'required|array',
            'total_amount' => 'required|numeric',
            'delivery_charge' => 'nullable|numeric',
            'reseller_profit' => 'nullable|numeric',
            'note' => 'nullable|string',
        ]);

        $data['reseller_id'] = $reseller->id;
        $data['source'] = 'reseller';
        $order = ResellerOrder::create($data);

        return response()->json($order, 201);
    }

    public function orders(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $query = ResellerOrder::where('reseller_id', $reseller->id);
        if ($request->filled('status')) $query->where('status', $request->status);
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function balance(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $orders = ResellerOrder::where('reseller_id', $reseller->id)->get();
        $payments = PaymentRequest::where('reseller_id', $reseller->id)->where('status', 'approved')->get();

        $deliveredProfit = $orders->where('status', 'ডেলিভারড')->sum('reseller_profit');
        $returnLoss = $orders->where('status', 'রিটার্ন')->sum('reseller_profit');
        $paidReturn = $orders->where('status', 'পেইড রিটার্ন')->sum('paid_return_amount');
        $approvedWithdrawals = $payments->sum('amount');

        return response()->json([
            'delivered_profit' => round($deliveredProfit, 2),
            'return_loss' => round($returnLoss, 2),
            'paid_return' => round($paidReturn, 2),
            'approved_withdrawals' => round($approvedWithdrawals, 2),
            'available_balance' => round($deliveredProfit - $returnLoss - $paidReturn - $approvedWithdrawals, 2),
        ]);
    }

    public function paymentMethods(Request $request): JsonResponse
    {
        return response()->json(
            ResellerPaymentMethod::where('reseller_id', $this->reseller($request)->id)->get()
        );
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'method_name' => 'required|string',
            'account_number' => 'required|string',
            'account_holder' => 'nullable|string',
            'is_default' => 'nullable|boolean',
        ]);
        $data['reseller_id'] = $this->reseller($request)->id;
        return response()->json(ResellerPaymentMethod::create($data), 201);
    }

    public function requestPayment(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'payment_method' => 'required|string',
            'account_number' => 'required|string',
        ]);
        $data['reseller_id'] = $reseller->id;
        return response()->json(PaymentRequest::create($data), 201);
    }

    public function paymentRequests(Request $request): JsonResponse
    {
        return response()->json(
            PaymentRequest::where('reseller_id', $this->reseller($request)->id)
                ->orderByDesc('created_at')->get()
        );
    }

    public function landingPages(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $pages = LandingPage::with('product')->where('status', 'active')->get()->map(function ($page) use ($reseller) {
            $page->reseller_url = url("/r/{$reseller->referral_code}/lp/{$page->slug}");
            return $page;
        });
        return response()->json($pages);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $reseller = $this->reseller($request);
        $data = $request->validate([
            'name' => 'sometimes|string',
            'phone' => 'nullable|string',
            'shop_name' => 'nullable|string',
            'contact_phone' => 'nullable|string',
            'contact_whatsapp' => 'nullable|string',
            // Storefront branding
            'storefront_logo_url' => 'nullable|string',
            'storefront_favicon_url' => 'nullable|string',
            'storefront_bio' => 'nullable|string',
            'storefront_address' => 'nullable|string',
            'storefront_phone' => 'nullable|string',
            'storefront_footer_credit' => 'nullable|string',
            'storefront_legal_pages' => 'nullable|array',
            'storefront_facebook_url' => 'nullable|string',
            'storefront_youtube_url' => 'nullable|string',
            'storefront_twitter_url' => 'nullable|string',
            'storefront_instagram_url' => 'nullable|string',
        ]);
        $reseller->update($data);
        return response()->json($reseller);
    }
}
