import { useEffect, useRef, Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useResellerStore } from '@/stores/useResellerStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, ShoppingBag, Package, Wallet, LogOut, CreditCard, Landmark, Settings, FileText, Store, Truck } from 'lucide-react';

const dropshippingItems = [
  { title: 'ড্যাশবোর্ড', url: '/reseller', icon: LayoutDashboard },
  { title: 'শপ পেজ', url: '/reseller/shop', icon: ShoppingBag },
  { title: 'ল্যান্ডিং পেজ', url: '/reseller/landing-pages', icon: FileText },
  { title: 'আমার অর্ডার', url: '/reseller/orders', icon: Package },
  { title: 'ব্যালেন্স', url: '/reseller/balance', icon: Wallet },
  { title: 'পেমেন্ট মেথড', url: '/reseller/payment-methods', icon: Landmark },
  { title: 'পেমেন্ট রিকুয়েস্ট', url: '/reseller/payments', icon: CreditCard },
];

const standaloneItems = [
  { title: 'My Store', url: '/reseller/custom-domain', icon: Store },
  { title: 'সেটিং', url: '/reseller/settings', icon: Settings },
];

const getStoredResellerAuth = () => {
  const raw = localStorage.getItem('reseller-auth');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.id ? parsed : null;
  } catch {
    localStorage.removeItem('reseller-auth');
    return null;
  }
};

function ResellerSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const logoUrl = useSiteSettingsStore((s) => s.logoUrl);

  const handleLogout = () => {
    localStorage.removeItem('reseller-auth');
    window.location.href = '/reseller/login';
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        <div className="p-4 border-b border-sidebar-border flex items-center justify-center">
          <img
            src={logoUrl}
            alt="Reseller"
            className={collapsed ? "h-6 w-auto object-contain" : "h-8 w-auto object-contain"}
          />
        </div>
        {/* ড্রপশিপিং গ্রুপ */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>ড্রপশিপিং</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dropshippingItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/reseller'} onClick={handleNavClick} className="hover:bg-sidebar-accent" activeClassName="bg-primary/10 text-primary font-semibold">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* বিভাজক */}
        <div className="mx-3 border-t border-sidebar-border" />

        {/* Standalone মেনু */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {standaloneItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} onClick={handleNavClick} className="hover:bg-sidebar-accent" activeClassName="bg-primary/10 text-primary font-semibold">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto p-4 border-t border-sidebar-border">
          <SidebarMenuButton asChild>
            <button onClick={handleLogout} className="flex items-center gap-2 w-full text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>লগআউট</span>}
            </button>
          </SidebarMenuButton>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

const ResellerLayout = () => {
  const initialized = useRef(false);
  const fetchResellerOrders = useResellerStore((s) => s.fetchResellerOrders);
  const fetchPaymentRequests = useResellerStore((s) => s.fetchPaymentRequests);
  const fetchResellers = useResellerStore((s) => s.fetchResellers);
  const resellers = useResellerStore((s) => s.resellers);
  const location = useLocation();

  // Admin impersonation: ?as=<resellerId> sets reseller-auth automatically when admin is logged in
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchResellerOrders();
    fetchPaymentRequests();
    fetchResellers();
  }, []);

  // Handle ?as= parameter for admin impersonation
  const params = new URLSearchParams(location.search);
  const impersonateId = params.get('as');
  const adminAuthRaw = localStorage.getItem('admin-auth-storage');
  const isAdminLoggedIn = (() => {
    try { return JSON.parse(adminAuthRaw || '{}')?.state?.isAuthenticated === true; } catch { return false; }
  })();

  useEffect(() => {
    if (!impersonateId || !isAdminLoggedIn) return;
    const setImpersonation = (target: { id: string; name: string; email: string }) => {
      localStorage.setItem('reseller-auth', JSON.stringify({
        id: target.id, name: target.name, email: target.email, impersonatedBy: 'admin',
      }));
      // Reload so the layout reads the freshly written auth
      window.location.replace(window.location.pathname);
    };
    const found = resellers.find((r) => r.id === impersonateId);
    if (found) {
      setImpersonation(found);
    } else {
      // Resellers might not be loaded yet — fetch then retry
      fetchResellers().then(() => {
        const r = useResellerStore.getState().resellers.find((rr) => rr.id === impersonateId);
        if (r) setImpersonation(r);
      });
    }
  }, [impersonateId, isAdminLoggedIn, resellers.length]);

  const reseller = getStoredResellerAuth();
  if (!reseller) {
    // If admin tries to impersonate but resellers haven't loaded yet, wait instead of redirecting
    if (impersonateId && isAdminLoggedIn) {
      return <div className="min-h-screen flex items-center justify-center text-muted-foreground">রিসেলার ড্যাশবোর্ড লোড হচ্ছে…</div>;
    }
    return <Navigate to="/reseller/login" replace />;
  }

  const isImpersonating = reseller.impersonatedBy === 'admin';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <ResellerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isImpersonating && (
            <div className="bg-amber-100 text-amber-900 border-b border-amber-300 px-4 py-2 text-xs flex items-center justify-between gap-2">
              <span>👁️ অ্যাডমিন হিসেবে দেখছেন: <strong>{reseller.name}</strong></span>
              <button
                className="underline font-medium hover:text-amber-700"
                onClick={() => { localStorage.removeItem('reseller-auth'); window.location.href = '/admin/reseller-orders'; }}
              >
                ফিরে যান অ্যাডমিন প্যানেলে
              </button>
            </div>
          )}
          <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground hidden sm:inline">রিসেলার প্যানেল</span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">{reseller.name}</span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                R
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ResellerLayout;
