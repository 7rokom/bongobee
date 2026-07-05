<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Auth\AdminLoginController;
use App\Http\Controllers\Api\Auth\ResellerAuthController;
use App\Http\Controllers\Api\Auth\DigitalAuthController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\OrderController;
use App\Http\Controllers\Api\Admin\FrontendOrderController;
use App\Http\Controllers\Api\Admin\FrontendResellerController;
use App\Http\Controllers\Api\Admin\FrontendDigitalController;
use App\Http\Controllers\Api\Admin\FrontendMarketingController;
use App\Http\Controllers\Api\Admin\FrontendDataController;
use App\Http\Controllers\Api\Admin\BackupController;
use App\Http\Controllers\Api\Admin\FrontendCourierController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\VariationController;
use App\Http\Controllers\Api\Admin\CouponController;
use App\Http\Controllers\Api\Admin\EmployeeController;
use App\Http\Controllers\Api\Admin\ResellerController;
use App\Http\Controllers\Api\Admin\AccountController;
use App\Http\Controllers\Api\Admin\BlogController;
use App\Http\Controllers\Api\Admin\DigitalAdminController;
use App\Http\Controllers\Api\Admin\MarketingController;
use App\Http\Controllers\Api\Admin\FraudController;
use App\Http\Controllers\Api\Admin\SettingsController;
use App\Http\Controllers\Api\Admin\LandingPageController;
use App\Http\Controllers\Api\Admin\MediaController;
use App\Http\Controllers\Api\Public\ShopController;
use App\Http\Controllers\Api\Public\CheckoutController;
use App\Http\Controllers\Api\Reseller\ResellerPortalController;
use App\Http\Controllers\Api\Digital\DigitalStoreController;
use App\Http\Controllers\InstallerController;

// ============================================================
// INSTALLER ROUTES (only accessible before installation)
// Guarded by InstallGuard middleware registered in bootstrap/app.php
// ============================================================
Route::prefix('install')->group(function () {
    Route::post('/requirements',    [InstallerController::class, 'requirements']);
    Route::post('/check-db',        [InstallerController::class, 'checkDb']);
    Route::post('/install',         [InstallerController::class, 'install']);
    Route::post('/restore',         [InstallerController::class, 'restore']);
    Route::post('/validate-backup', [InstallerController::class, 'validateBackup']);
});

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================
Route::prefix('public')->group(function () {
    Route::get('/settings', [ShopController::class, 'siteSettings']);
    Route::get('/categories', [ShopController::class, 'allCategories']);
    Route::get('/products', [ShopController::class, 'products']);
    Route::get('/products/{slug}', [ShopController::class, 'product']);
    Route::get('/blog', [ShopController::class, 'blog']);
    Route::get('/blog/{slug}', [ShopController::class, 'blogPost']);
    Route::get('/pages/{slug}', [ShopController::class, 'page']);
    Route::get('/landing-pages/{slug}', [ShopController::class, 'landingPage']);
    Route::get('/short-links/{slug}', [ShopController::class, 'redirectShortLink']);
    Route::post('/short-links/{slug}/click', [ShopController::class, 'incrementShortLinkClick']);
    Route::post('/coupon/validate', [CheckoutController::class, 'validateCoupon']);
    Route::post('/orders', [CheckoutController::class, 'placeOrder']);
    Route::post('/incomplete-orders', [CheckoutController::class, 'saveIncompleteOrder']);
    Route::get('/order-tracking', [CheckoutController::class, 'trackOrder']);
    Route::post('/check-blocked', [FraudController::class, 'checkBlocked']);
    Route::post('/order-cooldown', [FraudController::class, 'orderCooldown']);
    Route::get('/fraud-settings', [FraudController::class, 'getFraudSettings']);
    Route::get('/site-settings', [SettingsController::class, 'getFrontendSettings']);
    Route::get('/courier-ratio', [FrontendDataController::class, 'courierRatio']);
    Route::post('/courier-ratio', [FrontendDataController::class, 'saveCourierRatio']);
    Route::post('/courier-check', [FrontendDataController::class, 'courierCheck']);
    Route::post('/device-check', [FrontendDataController::class, 'deviceCheck']);
    Route::post('/has-previous-order', [FrontendDataController::class, 'hasPreviousOrder']);
    Route::post('/incomplete-orders', [FrontendDataController::class, 'storeIncompleteOrder']);
    Route::post('/checkout-order', [FrontendOrderController::class, 'checkout']);
    Route::post('/confirm-order', [FrontendOrderController::class, 'confirmOrder']);
    Route::get('/reseller/{ref}', [FrontendResellerController::class, 'publicReseller']);
    Route::post('/reseller-order', [FrontendResellerController::class, 'publicStoreOrder']);
    Route::get('/reseller-prices', [FrontendResellerController::class, 'publicResellerPrices']);
    // Digital storefront (public reads + customer order create)
    Route::get('/digital-fe/products', [FrontendDigitalController::class, 'products']);
    Route::get('/digital-fe/products/{slug}', [FrontendDigitalController::class, 'productBySlug']);
    Route::get('/digital-fe/categories', [FrontendDigitalController::class, 'categories']);
    Route::get('/digital-fe/payment-methods', [FrontendDigitalController::class, 'paymentMethods']);
    Route::post('/digital-fe/orders', [FrontendDigitalController::class, 'createOrder']);
    Route::get('/digital-fe/my-orders', [FrontendDigitalController::class, 'myOrders']);
    Route::get('/digital-fe/blocks', [FrontendDigitalController::class, 'blocks']);
    Route::post('/digital-fe/upload', [FrontendDigitalController::class, 'upload']);
    // Push (storefront subscribe/check) + transactional SMS (server holds keys)
    Route::post('/push-subscribe', [FrontendMarketingController::class, 'subscribe']);
    Route::post('/push-check', [FrontendMarketingController::class, 'pushCheck']);
    Route::post('/send-sms', [FrontendMarketingController::class, 'sendSms']);
    Route::post('/mark-sms-sent', [FrontendMarketingController::class, 'markSmsSent']);
});

// ============================================================
// ADMIN AUTH
// ============================================================
Route::prefix('auth/admin')->group(function () {
    Route::post('/login', [AdminLoginController::class, 'login']);
    Route::middleware('auth:admin,employee')->group(function () {
        Route::post('/logout', [AdminLoginController::class, 'logout']);
        Route::get('/me', [AdminLoginController::class, 'me']);
    });
});

// ============================================================
// ADMIN API (protected by AdminAuth middleware)
// ============================================================
Route::prefix('admin')->middleware(['auth:admin,employee'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Frontend-schema orders (React order store)
    Route::get('/fe-orders', [FrontendOrderController::class, 'index']);
    Route::post('/fe-orders', [FrontendOrderController::class, 'store']);
    Route::post('/fe-orders/update', [FrontendOrderController::class, 'update']);
    Route::post('/fe-orders/delete', [FrontendOrderController::class, 'bulkDelete']);
    Route::post('/fe-orders/next-invoice', [FrontendOrderController::class, 'nextInvoice']);
    Route::get('/customer-history', [FrontendOrderController::class, 'customerHistory']);
    Route::get('/customer-devices', [FrontendOrderController::class, 'customerDevices']);
    Route::get('/counter/{key}', [FrontendOrderController::class, 'counterGet']);
    Route::put('/counter/{key}', [FrontendOrderController::class, 'counterSet']);
    Route::post('/counter/{key}/next', [FrontendOrderController::class, 'counterNext']);

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::put('/orders/{id}', [OrderController::class, 'update']);
    Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
    Route::post('/orders/bulk-status', [OrderController::class, 'bulkUpdateStatus']);

    // Incomplete Orders & Fraud
    Route::get('/incomplete-orders', [FraudController::class, 'incompleteOrders']);
    Route::delete('/incomplete-orders/{id}', [FraudController::class, 'destroyIncompleteOrder']);
    Route::get('/blocked-customers', [FraudController::class, 'blockedCustomers']);
    Route::post('/blocked-customers', [FraudController::class, 'blockCustomer']);
    Route::delete('/blocked-customers/group/{group}', [FraudController::class, 'unblockGroup']);
    Route::delete('/blocked-customers/{id}', [FraudController::class, 'unblockCustomer']);
    Route::get('/fraud-settings', [FraudController::class, 'getFraudSettings']);
    Route::put('/fraud-settings', [FraudController::class, 'updateFraudSettings']);
    Route::get('/customers', [FraudController::class, 'customerList']);

    // Coupons
    Route::apiResource('/coupons', CouponController::class)->except(['show']);

    // Products
    Route::post('/products/upload-image', [ProductController::class, 'uploadImage']);
    Route::apiResource('/products', ProductController::class);

    // Media manager
    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media/upload', [MediaController::class, 'upload']);
    Route::post('/media/delete', [MediaController::class, 'delete']);
    Route::apiResource('/categories', CategoryController::class)->except(['show']);
    Route::apiResource('/variations', VariationController::class)->except(['show']);

    // Blog & Content
    Route::apiResource('/blog', BlogController::class);
    Route::apiResource('/landing-pages', LandingPageController::class);

    // Employees
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
    Route::get('/employees/report', [EmployeeController::class, 'report']);

    // Resellers
    Route::get('/resellers', [ResellerController::class, 'index']);
    Route::post('/resellers', [ResellerController::class, 'store']);
    Route::put('/resellers/{id}', [ResellerController::class, 'update']);
    Route::delete('/resellers/{id}', [ResellerController::class, 'destroy']);
    Route::get('/resellers/orders', [ResellerController::class, 'orders']);
    Route::put('/resellers/orders/{id}', [ResellerController::class, 'updateOrder']);
    Route::get('/resellers/payment-requests', [ResellerController::class, 'paymentRequests']);
    Route::put('/resellers/payment-requests/{id}', [ResellerController::class, 'updatePaymentRequest']);
    Route::get('/resellers/{id}/product-prices', [ResellerController::class, 'getProductPrices']);
    Route::post('/resellers/{id}/product-prices', [ResellerController::class, 'setProductPrice']);
    Route::get('/resellers/report', [ResellerController::class, 'report']);

    // Account Management
    Route::get('/stock', [AccountController::class, 'stockIndex']);
    Route::post('/stock', [AccountController::class, 'stockStore']);
    Route::put('/stock/{id}', [AccountController::class, 'stockUpdate']);
    Route::delete('/stock/{id}', [AccountController::class, 'stockDestroy']);
    Route::get('/expenses', [AccountController::class, 'expenseIndex']);
    Route::post('/expenses', [AccountController::class, 'expenseStore']);
    Route::put('/expenses/{id}', [AccountController::class, 'expenseUpdate']);
    Route::delete('/expenses/{id}', [AccountController::class, 'expenseDestroy']);
    Route::get('/deposits', [AccountController::class, 'depositIndex']);
    Route::post('/deposits', [AccountController::class, 'depositStore']);
    Route::put('/deposits/{id}', [AccountController::class, 'depositUpdate']);
    Route::delete('/deposits/{id}', [AccountController::class, 'depositDestroy']);
    Route::get('/account-report', [AccountController::class, 'profitReport']);

    // Digital Products (Admin)
    Route::get('/digital/products', [DigitalAdminController::class, 'products']);
    Route::post('/digital/products', [DigitalAdminController::class, 'storeProduct']);
    Route::put('/digital/products/{id}', [DigitalAdminController::class, 'updateProduct']);
    Route::delete('/digital/products/{id}', [DigitalAdminController::class, 'destroyProduct']);
    Route::get('/digital/orders', [DigitalAdminController::class, 'orders']);
    Route::put('/digital/orders/{id}', [DigitalAdminController::class, 'updateOrder']);
    Route::get('/digital/users', [DigitalAdminController::class, 'users']);
    Route::post('/digital/users/{id}/block', [DigitalAdminController::class, 'blockUser']);
    Route::get('/digital/payment-methods', [DigitalAdminController::class, 'paymentMethods']);
    Route::post('/digital/payment-methods', [DigitalAdminController::class, 'storePaymentMethod']);
    Route::put('/digital/payment-methods/{id}', [DigitalAdminController::class, 'updatePaymentMethod']);
    Route::delete('/digital/payment-methods/{id}', [DigitalAdminController::class, 'destroyPaymentMethod']);
    Route::get('/digital/pixel-setup', [DigitalAdminController::class, 'getPixelSetup']);
    Route::put('/digital/pixel-setup', [DigitalAdminController::class, 'updatePixelSetup']);
    Route::get('/digital/categories', [DigitalAdminController::class, 'categories']);
    Route::post('/digital/categories', [DigitalAdminController::class, 'storeCategory']);
    Route::put('/digital/categories/{id}', [DigitalAdminController::class, 'updateCategory']);
    Route::delete('/digital/categories/{id}', [DigitalAdminController::class, 'destroyCategory']);
    Route::get('/digital/report', [DigitalAdminController::class, 'report']);

    // Marketing Tools
    Route::get('/sms/campaigns', [MarketingController::class, 'smsCampaigns']);
    Route::post('/sms/campaigns', [MarketingController::class, 'createSmsCampaign']);
    Route::get('/push/subscriptions', fn() => response()->json(\App\Models\PushSubscription::paginate(50)));
    Route::get('/push/campaigns', [MarketingController::class, 'pushCampaigns']);
    Route::post('/push/campaigns', [MarketingController::class, 'createPushCampaign']);
    Route::get('/short-links', [MarketingController::class, 'shortLinks']);
    Route::post('/short-links', [MarketingController::class, 'storeShortLink']);
    Route::put('/short-links/{id}', [MarketingController::class, 'updateShortLink']);
    Route::delete('/short-links/{id}', [MarketingController::class, 'destroyShortLink']);
    Route::get('/youtube-sources', [MarketingController::class, 'youtubeSources']);
    Route::post('/youtube-sources', [MarketingController::class, 'storeYoutubeSource']);
    Route::put('/youtube-sources/{id}', [MarketingController::class, 'updateYoutubeSource']);
    Route::delete('/youtube-sources/{id}', [MarketingController::class, 'destroyYoutubeSource']);

    // Settings
    Route::put('/site-settings', [SettingsController::class, 'saveFrontendSettings']);
    Route::post('/update-credentials', [SettingsController::class, 'updateAdminCredentials']);
    Route::get('/settings/general', [SettingsController::class, 'getGeneral']);
    Route::put('/settings/general', [SettingsController::class, 'updateGeneral']);
    Route::get('/settings/header-footer', [SettingsController::class, 'getHeaderFooter']);
    Route::put('/settings/header-footer', [SettingsController::class, 'updateHeaderFooter']);
    Route::get('/settings/courier', [SettingsController::class, 'getCourierSettings']);
    Route::put('/settings/courier', [SettingsController::class, 'updateCourierSettings']);
    Route::get('/settings/audio', [SettingsController::class, 'getAudioSettings']);
    Route::put('/settings/audio', [SettingsController::class, 'updateAudioSettings']);
    Route::post('/settings/change-password', [SettingsController::class, 'changePassword']);
    Route::post('/settings/backup', [SettingsController::class, 'createBackup']);
    Route::get('/settings/backups', [SettingsController::class, 'listBackups']);
    Route::get('/settings/backups/{filename}/download', [SettingsController::class, 'downloadBackup']);
});

// ============================================================
// DIGITAL ADMIN (React digital store — admin writes)
// ============================================================
Route::prefix('admin/digital-fe')->middleware('auth:admin,employee')->group(function () {
    Route::post('/products', [FrontendDigitalController::class, 'storeProduct']);
    Route::put('/products/{id}', [FrontendDigitalController::class, 'updateProduct']);
    Route::delete('/products/{id}', [FrontendDigitalController::class, 'deleteProduct']);
    Route::post('/categories', [FrontendDigitalController::class, 'addCategory']);
    Route::post('/categories/remove', [FrontendDigitalController::class, 'removeCategory']);
    Route::post('/payment-methods', [FrontendDigitalController::class, 'storePaymentMethod']);
    Route::put('/payment-methods/{id}', [FrontendDigitalController::class, 'updatePaymentMethod']);
    Route::delete('/payment-methods/{id}', [FrontendDigitalController::class, 'deletePaymentMethod']);
    Route::get('/orders', [FrontendDigitalController::class, 'orders']);
    Route::put('/orders/{id}', [FrontendDigitalController::class, 'updateOrder']);
    Route::delete('/orders/{id}', [FrontendDigitalController::class, 'deleteOrder']);
    Route::post('/blocks', [FrontendDigitalController::class, 'addBlock']);
    Route::delete('/blocks/{id}', [FrontendDigitalController::class, 'removeBlock']);
    Route::get('/users', [FrontendDigitalController::class, 'users']);
    Route::delete('/users/{id}', [FrontendDigitalController::class, 'deleteUser']);
});

// ============================================================
// DATA (courier, employees, incomplete orders, follow-ups, audio)
// ============================================================
Route::prefix('admin/data')->middleware('auth:admin,employee')->group(function () {
    Route::get('/courier-settings/{provider}', [FrontendDataController::class, 'courierSettings']);
    Route::put('/courier-settings/{provider}', [FrontendDataController::class, 'saveCourierSettings']);
    Route::get('/courier-dispatch', [FrontendDataController::class, 'courierDispatch']);
    Route::post('/courier-dispatch', [FrontendDataController::class, 'saveCourierDispatch']);
    Route::post('/courier-dispatch/delete', [FrontendDataController::class, 'deleteCourierDispatch']);
    Route::get('/courier-ratio-all', [FrontendDataController::class, 'courierRatioAll']);
    Route::post('/courier-check', [FrontendDataController::class, 'courierCheck']);
    Route::post('/ledger-upsert', [FrontendDataController::class, 'ledgerUpsert']);
    Route::post('/ledger-delete', [FrontendDataController::class, 'ledgerDelete']);
    Route::get('/employees', [FrontendDataController::class, 'employees']);
    Route::post('/employees', [FrontendDataController::class, 'storeEmployee']);
    Route::put('/employees/{id}', [FrontendDataController::class, 'updateEmployee']);
    Route::delete('/employees/{id}', [FrontendDataController::class, 'deleteEmployee']);
    Route::get('/employee-activities', [FrontendDataController::class, 'employeeActivities']);
    Route::post('/employee-activities', [FrontendDataController::class, 'storeEmployeeActivity']);
    Route::get('/incomplete-orders', [FrontendDataController::class, 'incompleteOrders']);
    Route::delete('/incomplete-orders/{id}', [FrontendDataController::class, 'deleteIncompleteOrder']);
    Route::post('/incomplete-orders/bulk-delete', [FrontendDataController::class, 'bulkDeleteIncomplete']);
    Route::post('/incomplete-orders/{id}/cancel', [FrontendDataController::class, 'cancelIncomplete']);
    Route::post('/incomplete-orders/delete-by-phone', [FrontendDataController::class, 'deleteIncompleteByPhone']);
    Route::put('/incomplete-orders/{id}/note', [FrontendDataController::class, 'updateIncompleteNote']);
    Route::get('/follow-ups', [FrontendDataController::class, 'followUps']);
    Route::post('/follow-ups', [FrontendDataController::class, 'saveFollowUp']);
    Route::post('/follow-ups/delete', [FrontendDataController::class, 'deleteFollowUp']);
    Route::get('/audio', [FrontendDataController::class, 'audioList']);
    Route::post('/audio', [FrontendDataController::class, 'audioUpload']);
    Route::post('/audio/delete', [FrontendDataController::class, 'audioDelete']);
    Route::get('/backup-table', [BackupController::class, 'backupTable']);
    Route::post('/restore-table', [BackupController::class, 'restoreTable']);
    Route::post('/cloud-backup', [BackupController::class, 'cloudBackup']);
});

// ============================================================
// COURIER DISPATCH PROXY (replaces steadfast / carrybee edge functions)
// ============================================================
Route::prefix('admin/courier')->middleware('auth:admin,employee')->group(function () {
    Route::post('/steadfast', [FrontendCourierController::class, 'steadfast']);
    Route::post('/carrybee', [FrontendCourierController::class, 'carrybee']);
});

// ============================================================
// MARKETING (React marketing tools)
// ============================================================
Route::prefix('admin/mk')->middleware('auth:admin,employee')->group(function () {
    Route::get('/short-links', [FrontendMarketingController::class, 'shortLinks']);
    Route::get('/short-links/check', [FrontendMarketingController::class, 'checkSlug']);
    Route::post('/short-links', [FrontendMarketingController::class, 'storeShortLink']);
    Route::put('/short-links/{id}', [FrontendMarketingController::class, 'updateShortLink']);
    Route::delete('/short-links/{id}', [FrontendMarketingController::class, 'deleteShortLink']);
    Route::get('/youtube-sources', [FrontendMarketingController::class, 'youtubeSources']);
    Route::post('/youtube-sources', [FrontendMarketingController::class, 'storeYoutubeSource']);
    Route::put('/youtube-sources/{id}', [FrontendMarketingController::class, 'updateYoutubeSource']);
    Route::delete('/youtube-sources/{id}', [FrontendMarketingController::class, 'deleteYoutubeSource']);
    Route::get('/push-subscriptions', [FrontendMarketingController::class, 'pushSubscriptions']);
    Route::get('/push-subscriptions/count', [FrontendMarketingController::class, 'pushSubscriptionsCount']);
    Route::delete('/push-subscriptions/section/{section}', [FrontendMarketingController::class, 'deletePushSection']);
    Route::get('/push-campaigns', [FrontendMarketingController::class, 'pushCampaigns']);
    Route::post('/push-campaigns', [FrontendMarketingController::class, 'createPushCampaign']);
    Route::delete('/push-campaigns/section/{section}', [FrontendMarketingController::class, 'deletePushCampaignSection']);
    Route::delete('/push-campaigns/{id}', [FrontendMarketingController::class, 'deletePushCampaign']);
    Route::post('/send-push', [FrontendMarketingController::class, 'sendPush']);
    Route::post('/send-sms', [FrontendMarketingController::class, 'sendSms']);
    Route::post('/mark-sms-sent', [FrontendMarketingController::class, 'markSmsSent']);
    Route::get('/sms-balance', [FrontendMarketingController::class, 'smsBalance']);
    Route::post('/youtube-sync', [FrontendMarketingController::class, 'youtubeSync']);
});

// ============================================================
// RESELLER SHARED (React reseller store — admin OR reseller token)
// ============================================================
Route::prefix('rs')->middleware('auth:admin,employee,reseller')->group(function () {
    Route::get('/resellers', [FrontendResellerController::class, 'resellers']);
    Route::post('/resellers', [FrontendResellerController::class, 'storeReseller']);
    Route::put('/resellers/{id}', [FrontendResellerController::class, 'updateReseller']);
    Route::get('/reseller-orders', [FrontendResellerController::class, 'orders']);
    Route::post('/reseller-orders', [FrontendResellerController::class, 'storeOrder']);
    Route::post('/reseller-orders/update', [FrontendResellerController::class, 'updateOrder']);
    Route::post('/reseller-orders/delete', [FrontendResellerController::class, 'deleteOrder']);
    Route::post('/reseller-orders/next-id', [FrontendResellerController::class, 'nextOrderId']);
    Route::get('/payment-requests', [FrontendResellerController::class, 'paymentRequests']);
    Route::post('/payment-requests', [FrontendResellerController::class, 'storePaymentRequest']);
    Route::put('/payment-requests/{id}', [FrontendResellerController::class, 'updatePaymentRequest']);
    Route::get('/product-prices', [FrontendResellerController::class, 'productPrices']);
    Route::post('/product-prices', [FrontendResellerController::class, 'setProductPrice']);
    Route::get('/payment-methods', [FrontendResellerController::class, 'paymentMethods']);
    Route::post('/payment-methods', [FrontendResellerController::class, 'storePaymentMethod']);
    Route::delete('/payment-methods/{id}', [FrontendResellerController::class, 'deletePaymentMethod']);
});

// ============================================================
// SMS GATEWAY (Android relay - public API key auth)
// ============================================================
Route::prefix('sms-gateway')->group(function () {
    Route::get('/pending', [MarketingController::class, 'smsGatewayPending']);
    Route::post('/report', [MarketingController::class, 'smsGatewayReport']);
});

// Push notification subscribe (public)
Route::post('/push/subscribe', [MarketingController::class, 'pushSubscribe']);

// ============================================================
// RESELLER AUTH
// ============================================================
Route::prefix('auth/reseller')->group(function () {
    Route::post('/login', [ResellerAuthController::class, 'login']);
    Route::post('/register', [ResellerAuthController::class, 'register']);
    Route::middleware('auth:reseller')->group(function () {
        Route::post('/logout', [ResellerAuthController::class, 'logout']);
        Route::get('/me', [ResellerAuthController::class, 'me']);
    });
});

// ============================================================
// RESELLER PORTAL (protected)
// ============================================================
Route::prefix('reseller')->middleware(['auth:reseller'])->group(function () {
    Route::get('/dashboard', [ResellerPortalController::class, 'dashboard']);
    Route::get('/products', [ResellerPortalController::class, 'products']);
    Route::get('/orders', [ResellerPortalController::class, 'orders']);
    Route::post('/orders', [ResellerPortalController::class, 'placeOrder']);
    Route::get('/balance', [ResellerPortalController::class, 'balance']);
    Route::get('/payment-methods', [ResellerPortalController::class, 'paymentMethods']);
    Route::post('/payment-methods', [ResellerPortalController::class, 'storePaymentMethod']);
    Route::post('/payment-requests', [ResellerPortalController::class, 'requestPayment']);
    Route::get('/payment-requests', [ResellerPortalController::class, 'paymentRequests']);
    Route::get('/landing-pages', [ResellerPortalController::class, 'landingPages']);
    Route::put('/settings', [ResellerPortalController::class, 'updateSettings']);
});

// ============================================================
// CUSTOM DOMAIN MODULE
// ============================================================

// Public domain lookup (SPA calls this on boot to detect custom domain reseller)
Route::get('/public/domain-lookup', function (\Illuminate\Http\Request $request) {
    $host = $request->query('host');
    if (!$host) {
        return response()->json(['reseller' => null]);
    }
    $domain = \App\Models\ResellerDomain::where('domain', $host)
        ->where('status', 'verified')
        ->with('reseller')
        ->first();
    if (!$domain || !$domain->reseller) {
        return response()->json(['reseller' => null]);
    }
    $r = $domain->reseller;
    return response()->json([
        'reseller' => [
            'id'  => $r->id,
            'ref' => $r->serial_number ?? (string) $r->id,
            'name' => $r->name,
        ],
    ]);
});

// Admin — Reseller Domains management
Route::prefix('admin/reseller-domains')->middleware(['auth:admin,employee'])->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'index']);
    Route::post('/{id}/approve', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'approve']);
    Route::post('/{id}/reject', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'reject']);
    Route::post('/{id}/disable', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'disable']);
    Route::post('/{id}/setup-files', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'setupFiles']);
    Route::delete('/{id}', [\App\Http\Controllers\Api\Admin\ResellerDomainController::class, 'destroy']);
});

// Reseller — Custom Domain self-service (also accepts admin/employee tokens for impersonation)
Route::prefix('reseller/custom-domain')->middleware(['auth:admin,employee,reseller'])->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\Reseller\ResellerDomainController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\Reseller\ResellerDomainController::class, 'store']);
    Route::delete('/{id}', [\App\Http\Controllers\Api\Reseller\ResellerDomainController::class, 'destroy']);
    Route::post('/{id}/verify', [\App\Http\Controllers\Api\Reseller\ResellerDomainController::class, 'verifyDns']);
});

// ============================================================
// DIGITAL STORE AUTH
// ============================================================
Route::prefix('auth/digital')->group(function () {
    Route::post('/register', [DigitalAuthController::class, 'register']);
    Route::post('/login', [DigitalAuthController::class, 'login']);
    Route::middleware('auth:digital_customer')->group(function () {
        Route::post('/logout', [DigitalAuthController::class, 'logout']);
        Route::get('/me', [DigitalAuthController::class, 'me']);
    });
});

// ============================================================
// DIGITAL STORE (public + protected)
// ============================================================
Route::prefix('digital')->group(function () {
    Route::get('/settings', [DigitalStoreController::class, 'storeSettings']);
    Route::get('/categories', [DigitalStoreController::class, 'categories']);
    Route::get('/products', [DigitalStoreController::class, 'products']);
    Route::get('/products/{slug}', [DigitalStoreController::class, 'product']);
    Route::get('/payment-methods', [DigitalStoreController::class, 'paymentMethods']);
    Route::post('/orders', [DigitalStoreController::class, 'placeOrder']);

    Route::middleware('auth:digital_customer')->group(function () {
        Route::get('/my-orders', [DigitalStoreController::class, 'myOrders']);
    });
});
