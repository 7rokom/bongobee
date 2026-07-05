import { lazy, Suspense } from 'react';
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Outlet } from "react-router-dom";

const WishlistDrawer = lazy(() => import('@/components/WishlistDrawer'));
const CartDrawer = lazy(() => import('@/components/CartDrawer'));
const PushNotificationPrompt = lazy(() => import('@/components/PushNotificationPrompt'));

const PublicLayout = () => (
  <>
    <Header />
    <main className="min-h-screen">
      <Outlet />
    </main>
    <Footer />
    <Suspense fallback={null}><WishlistDrawer /></Suspense>
    <Suspense fallback={null}><CartDrawer /></Suspense>
    <Suspense fallback={null}><PushNotificationPrompt /></Suspense>
  </>
);

export default PublicLayout;
