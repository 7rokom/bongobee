import { Link, useLocation } from "react-router-dom";
import { Home, Store, BookOpen, ShoppingCart, User } from "lucide-react";
import { useCartStore } from "@/stores/useStore";

const BottomNav = () => {
  const location = useLocation();
  const cartTotal = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const openCart = useCartStore((s) => s.openCart);

  const navItems = [
    { label: "শপ", path: "/shop", icon: Store },
    { label: "ব্লগ", path: "/blog", icon: BookOpen },
    { label: "হোম", path: "/", icon: Home, isCenter: true },
    { label: "কার্ট", path: "#cart", icon: ShoppingCart, badge: cartTotal },
    { label: "একাউন্ট", path: "/reseller/login", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Curved background */}
      <div className="relative bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {/* Center notch curve */}
        <div className="absolute -top-[22px] left-1/2 -translate-x-1/2 w-[72px] h-[22px] overflow-hidden">
          <div className="absolute bottom-0 w-full h-[44px] bg-background rounded-t-full border-t border-l border-r border-border" />
        </div>

        <div className="flex items-end justify-around px-2 pb-[env(safe-area-inset-bottom,4px)] pt-2">
          {navItems.map((item) => {
            const isActive = item.path === "/" 
              ? location.pathname === "/" 
              : location.pathname.startsWith(item.path) && item.path !== "#cart" && item.path !== "#account";

            if (item.isCenter) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative -mt-[28px] flex flex-col items-center"
                >
                  <div
                    className={`w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                      isActive
                        ? "bg-primary text-primary-foreground scale-110"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <item.icon className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <span className={`text-[11px] mt-1 font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            const handleClick = item.path === "#cart"
              ? (e: React.MouseEvent) => { e.preventDefault(); openCart(); }
              : undefined;

            return (
              <Link
                key={item.path}
                to={item.path === "#cart" ? "/" : item.path}
                onClick={handleClick}
                className="flex flex-col items-center py-1 px-3 relative"
              >
                <div className="relative">
                  <item.icon
                    className={`h-5 w-5 transition-colors duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 transition-colors duration-200 ${
                    isActive ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
                {isActive && !item.isCenter && (
                  <div className="absolute -top-0.5 w-6 h-[3px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
