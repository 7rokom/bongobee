import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PublicLayout from "@/components/layout/PublicLayout";
import ScrollToTop from "@/components/ScrollToTop";
import SiteSettingsInitializer from "@/components/SiteSettingsInitializer";
import DataLayerPageTracker from "@/components/DataLayerPageTracker";
import DataInitializer from "@/components/DataInitializer";
import { isOnCustomDomain } from "@/lib/custom-domain";

const CustomDomainLayout = lazy(() => import("./components/layout/CustomDomainLayout"));
const ResellerPublicLayout = lazy(() => import("./components/layout/ResellerPublicLayout"));
const ResellerCheckoutLayout = lazy(() =>
  import("./components/layout/ResellerPublicLayout").then(m => ({ default: m.ResellerCheckoutLayout }))
);

// Public pages — only Index is eager (homepage = fastest first paint).
// Everything else lazy-loaded to drastically reduce initial bundle.
import Index from "./pages/Index";
const Shop = lazy(() => import("./pages/Shop"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const FakeThankYou = lazy(() => import("./pages/FakeThankYou"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PageView = lazy(() => import("./pages/PageView"));
const LandingPage = lazy(() => import("./pages/LandingPage"));


// Admin pages (lazy loaded)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Products = lazy(() => import("./pages/admin/Products"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const IncompleteOrders = lazy(() => import("./pages/admin/IncompleteOrders"));

const Coupons = lazy(() => import("./pages/admin/Coupons"));
const Variations = lazy(() => import("./pages/admin/Variations"));
const MediaManager = lazy(() => import("./pages/admin/MediaManager"));
const AllEmployees = lazy(() => import("./pages/admin/AllEmployees"));
const EmployeeReport = lazy(() => import("./pages/admin/EmployeeReport"));
const AllResellers = lazy(() => import("./pages/admin/AllResellers"));
const ResellerReport = lazy(() => import("./pages/admin/ResellerReport"));
const AdminResellerOrders = lazy(() => import("./pages/admin/AdminResellerOrders"));
const AdminResellerPayments = lazy(() => import("./pages/admin/ResellerPayments"));
const Expenses = lazy(() => import("./pages/admin/Expenses"));
const Deposits = lazy(() => import("./pages/admin/Deposits"));
const AccountReport = lazy(() => import("./pages/admin/AccountReport"));
const StockManagement = lazy(() => import("./pages/admin/StockManagement"));
const BlockedCustomers = lazy(() => import("./pages/admin/BlockedCustomers"));
const FraudSettings = lazy(() => import("./pages/admin/FraudSettings"));
const SiteSettings = lazy(() => import("./pages/admin/SiteSettings"));
const AudioSettings = lazy(() => import("./pages/admin/AudioSettings"));
const CourierSetup = lazy(() => import("./pages/admin/CourierSetup"));
const HeaderFooterSettings = lazy(() => import("./pages/admin/HeaderFooterSettings"));
const AdminPasswordSettings = lazy(() => import("./pages/admin/AdminPasswordSettings"));
const BackupRestore = lazy(() => import("./pages/admin/BackupRestore"));
const LandingPages = lazy(() => import("./pages/admin/LandingPages"));
const ResellerDomains = lazy(() => import("./pages/admin/ResellerDomains"));
const BulkSMS = lazy(() => import("./pages/admin/BulkSMS"));
const LinkShortener = lazy(() => import("./pages/admin/LinkShortener"));
const ShortLinkRedirect = lazy(() => import("./pages/ShortLinkRedirect"));
const GoLink = lazy(() => import("./pages/GoLink"));
const YouTubeSync = lazy(() => import("./pages/admin/YouTubeSync"));
const PushNotifications = lazy(() => import("./pages/admin/PushNotifications"));
const DigitalProducts = lazy(() => import("./pages/admin/DigitalProducts"));
const DigitalProductForm = lazy(() => import("./pages/admin/DigitalProductForm"));
const DigitalOrders = lazy(() => import("./pages/admin/DigitalOrders"));
const DigitalUsers = lazy(() => import("./pages/admin/DigitalUsers"));
const DigitalPaymentSetup = lazy(() => import("./pages/admin/DigitalPaymentSetup"));
const DigitalReport = lazy(() => import("./pages/admin/DigitalReport"));
const DigitalHeaderFooterSettings = lazy(() => import("./pages/admin/DigitalHeaderFooterSettings"));

// Digital store (public)
const DigitalLayout = lazy(() => import("./components/layout/DigitalLayout"));
const DigitalProductPage = lazy(() => import("./pages/digital/DigitalProductPage"));
const DigitalCheckout = lazy(() => import("./pages/digital/DigitalCheckout"));
const DigitalPayment = lazy(() => import("./pages/digital/DigitalPayment"));
const DigitalThankYou = lazy(() => import("./pages/digital/DigitalThankYou"));
const DigitalLogin = lazy(() => import("./pages/digital/DigitalLogin"));
const DigitalAccount = lazy(() => import("./pages/digital/DigitalAccount"));
const DigitalShop = lazy(() => import("./pages/digital/DigitalShop"));
const DigitalCart = lazy(() => import("./pages/digital/DigitalCart"));

// Reseller storefront pages (lazy loaded)
const ResellerStorefrontHome = lazy(() => import("./pages/reseller/storefront/ResellerStorefrontHome"));

// Reseller pages (lazy loaded)
const ResellerLogin = lazy(() => import("./pages/reseller/ResellerLogin"));
const ResellerLayout = lazy(() => import("./pages/reseller/ResellerLayout"));
const ResellerDashboard = lazy(() => import("./pages/reseller/ResellerDashboard"));
const ResellerShop = lazy(() => import("./pages/reseller/ResellerShop"));
const ResellerPlaceOrder = lazy(() => import("./pages/reseller/ResellerPlaceOrder"));
const ResellerOrders = lazy(() => import("./pages/reseller/ResellerOrders"));
const ResellerBalance = lazy(() => import("./pages/reseller/ResellerBalance"));
const ResellerPayments = lazy(() => import("./pages/reseller/ResellerPayments"));
const ResellerPaymentMethods = lazy(() => import("./pages/reseller/ResellerPaymentMethods"));
const ResellerSettings = lazy(() => import("./pages/reseller/ResellerSettings"));
const ResellerLandingPages = lazy(() => import("./pages/reseller/ResellerLandingPages"));
const ResellerCustomDomain = lazy(() => import("./pages/reseller/ResellerCustomDomain"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

// Evaluated once at module load — pure sync hostname check.
// On a reseller's custom domain we render CustomDomainLayout instead of
// the primary routing tree, so none of the admin/reseller-portal routes are
// exposed on the custom domain.
const ON_CUSTOM_DOMAIN = isOnCustomDomain();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SiteSettingsInitializer />
        {ON_CUSTOM_DOMAIN ? (
          // Custom domain: resolve reseller from domain, render full storefront
          <Suspense fallback={<LazyFallback />}><CustomDomainLayout /></Suspense>
        ) : (
        <>
        <DataLayerPageTracker />
        <DataInitializer />
        <ScrollToTop />
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin/login" element={<Suspense fallback={<LazyFallback />}><AdminLogin /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<LazyFallback />}><AdminLayout /></Suspense>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="incomplete-orders" element={<IncompleteOrders />} />
            
            <Route path="coupons" element={<Coupons />} />
            <Route path="blocked-customers" element={<BlockedCustomers />} />
            <Route path="fraud-settings" element={<FraudSettings />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/edit/:id" element={<ProductForm />} />
            <Route path="categories" element={<Categories />} />
            <Route path="variations" element={<Variations />} />
            <Route path="media" element={<MediaManager />} />
            <Route path="blog" element={<BlogAdmin />} />
            <Route path="employees" element={<AllEmployees />} />
            <Route path="employees/report" element={<EmployeeReport />} />
            <Route path="resellers" element={<AllResellers />} />
            <Route path="resellers/orders" element={<AdminResellerOrders />} />
            <Route path="resellers/payments" element={<AdminResellerPayments />} />
            <Route path="resellers/report" element={<ResellerReport />} />
            <Route path="resellers/domains" element={<ResellerDomains />} />
            <Route path="stock" element={<StockManagement />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="deposits" element={<Deposits />} />
            <Route path="account-report" element={<AccountReport />} />
            <Route path="courier-setup" element={<CourierSetup />} />
            <Route path="settings/site" element={<SiteSettings />} />
            <Route path="settings/audio" element={<AudioSettings />} />
            <Route path="settings/header-footer" element={<HeaderFooterSettings />} />
            <Route path="settings/password" element={<AdminPasswordSettings />} />
            <Route path="backup" element={<BackupRestore />} />
            <Route path="landing-pages" element={<LandingPages />} />
            <Route path="bulk-sms" element={<BulkSMS />} />
            <Route path="link-shortener" element={<LinkShortener />} />
            <Route path="youtube-sync" element={<YouTubeSync />} />
            <Route path="push-notifications" element={<PushNotifications />} />
            <Route path="digital/products" element={<DigitalProducts />} />
            <Route path="digital/products/new" element={<DigitalProductForm />} />
            <Route path="digital/products/edit/:id" element={<DigitalProductForm />} />
            <Route path="digital/orders" element={<DigitalOrders />} />
            <Route path="digital/users" element={<DigitalUsers />} />
            <Route path="digital/payment-setup" element={<DigitalPaymentSetup />} />
            <Route path="digital/report" element={<DigitalReport />} />
            <Route path="digital/header-footer" element={<DigitalHeaderFooterSettings />} />
          </Route>

          {/* Reseller Routes */}
          <Route path="/reseller/login" element={<Suspense fallback={<LazyFallback />}><ResellerLogin /></Suspense>} />
          <Route path="/reseller" element={<Suspense fallback={<LazyFallback />}><ResellerLayout /></Suspense>}>
            <Route index element={<ResellerDashboard />} />
            <Route path="shop" element={<ResellerShop />} />
            <Route path="landing-pages" element={<ResellerLandingPages />} />
            <Route path="custom-domain" element={<ResellerCustomDomain />} />
            <Route path="place-order" element={<ResellerPlaceOrder />} />
            <Route path="orders" element={<ResellerOrders />} />
            <Route path="balance" element={<ResellerBalance />} />
            <Route path="payment-methods" element={<ResellerPaymentMethods />} />
            <Route path="payments" element={<ResellerPayments />} />
            <Route path="settings" element={<ResellerSettings />} />
            
          </Route>

          {/* Reseller Checkout/Thank-you Routes (no reseller ID in URL) */}
          <Route path="/r" element={<Suspense fallback={<LazyFallback />}><ResellerCheckoutLayout /></Suspense>}>
            <Route path="cart" element={<Suspense fallback={<LazyFallback />}><Cart /></Suspense>} />
            <Route path="checkout" element={<Suspense fallback={<LazyFallback />}><Checkout /></Suspense>} />
            <Route path="thank-you" element={<Suspense fallback={<LazyFallback />}><ThankYou /></Suspense>} />
            <Route path="confirm-order" element={<Suspense fallback={<LazyFallback />}><FakeThankYou /></Suspense>} />
          </Route>

          {/* Reseller Public Routes (shareable links with reseller ID) */}
          <Route path="/r/:resellerId" element={<Suspense fallback={<LazyFallback />}><ResellerPublicLayout /></Suspense>}>
            <Route index element={<Suspense fallback={<LazyFallback />}><ResellerStorefrontHome /></Suspense>} />
            <Route path="product/:slug" element={<Suspense fallback={<LazyFallback />}><ProductPage /></Suspense>} />
            <Route path="lp/:slug" element={<Suspense fallback={<LazyFallback />}><LandingPage /></Suspense>} />
            <Route path="cart" element={<Suspense fallback={<LazyFallback />}><Cart /></Suspense>} />
            <Route path="shop" element={<Suspense fallback={<LazyFallback />}><Shop /></Suspense>} />
            <Route path="blog" element={<Suspense fallback={<LazyFallback />}><Blog /></Suspense>} />
            <Route path="blog/:slug" element={<Suspense fallback={<LazyFallback />}><BlogPost /></Suspense>} />
            <Route path="digital-shop" element={<Suspense fallback={<LazyFallback />}><DigitalShop /></Suspense>} />
            <Route path="order-tracking" element={<Suspense fallback={<LazyFallback />}><OrderTracking /></Suspense>} />
            <Route path="page/:slug" element={<Suspense fallback={<LazyFallback />}><PageView /></Suspense>} />
          </Route>

          {/* Short link redirect (must be before catch-all) */}
          <Route path="/s/:slug" element={<Suspense fallback={<LazyFallback />}><ShortLinkRedirect /></Suspense>} />
          <Route path="/go/:slug" element={<Suspense fallback={<LazyFallback />}><GoLink /></Suspense>} />
          <Route path="/go" element={<Suspense fallback={<LazyFallback />}><GoLink /></Suspense>} />

          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Suspense fallback={<LazyFallback />}><Shop /></Suspense>} />
            <Route path="/product/:slug" element={<Suspense fallback={<LazyFallback />}><ProductPage /></Suspense>} />
            <Route path="/blog" element={<Suspense fallback={<LazyFallback />}><Blog /></Suspense>} />
            <Route path="/blog/:slug" element={<Suspense fallback={<LazyFallback />}><BlogPost /></Suspense>} />
            <Route path="/cart" element={<Suspense fallback={<LazyFallback />}><Cart /></Suspense>} />
            <Route path="/checkout" element={<Suspense fallback={<LazyFallback />}><Checkout /></Suspense>} />
            <Route path="/thank-you" element={<Suspense fallback={<LazyFallback />}><ThankYou /></Suspense>} />
            <Route path="/order-confirmed" element={<Suspense fallback={<LazyFallback />}><FakeThankYou /></Suspense>} />
            <Route path="/order-tracking" element={<Suspense fallback={<LazyFallback />}><OrderTracking /></Suspense>} />
            <Route path="/page/:slug" element={<Suspense fallback={<LazyFallback />}><PageView /></Suspense>} />
            <Route path="/lp/:slug" element={<Suspense fallback={<LazyFallback />}><LandingPage /></Suspense>} />
            <Route path="*" element={<Suspense fallback={<LazyFallback />}><NotFound /></Suspense>} />
          </Route>

          {/* Digital Store Routes */}
          <Route element={<Suspense fallback={<LazyFallback />}><DigitalLayout /></Suspense>}>
            <Route path="/digital-products" element={<DigitalShop />} />
            <Route path="/digital-product/:slug" element={<DigitalProductPage />} />
            <Route path="/digital/cart" element={<DigitalCart />} />
            <Route path="/digital/checkout" element={<DigitalCheckout />} />
            <Route path="/digital/payment" element={<DigitalPayment />} />
            <Route path="/digital/thank-you" element={<DigitalThankYou />} />
            <Route path="/digital/login" element={<DigitalLogin />} />
            <Route path="/digital/account" element={<DigitalAccount />} />
          </Route>



        </Routes>
        </>
        )}
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
