import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WishlistDrawer from "@/components/WishlistDrawer";
import CartDrawer from "@/components/CartDrawer";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import { Outlet } from "react-router-dom";

const PublicLayout = () => (
  <>
    <Header />
    <main className="min-h-screen">
      <Outlet />
    </main>
    <Footer />
    <WishlistDrawer />
    <CartDrawer />
    <PushNotificationPrompt />
  </>
);

export default PublicLayout;
