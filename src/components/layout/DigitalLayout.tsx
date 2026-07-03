import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { useDigitalCartStore } from '@/stores/useDigitalCartStore';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { ShoppingCart } from 'lucide-react';

const DigitalLayout = () => {
  const init = useDigitalAuthStore((s) => s.init);
  const cartCount = useDigitalCartStore((s) => s.totalItems());
  const location = useLocation();
  useEffect(() => { const unsub = init(); return unsub; }, [init]);

  const hideCartIcon = location.pathname.endsWith('/digital/cart')
    || location.pathname.endsWith('/digital/checkout')
    || location.pathname.endsWith('/digital/payment')
    || location.pathname.endsWith('/digital/thank-you');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      {cartCount > 0 && !hideCartIcon && (
        <Link
          to="/digital/cart"
          aria-label="ডিজিটাল কার্ট"
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-full h-14 w-14 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1">
            {cartCount}
          </span>
        </Link>
      )}
      <Footer />
      <PushNotificationPrompt />
    </div>
  );
};

export default DigitalLayout;
