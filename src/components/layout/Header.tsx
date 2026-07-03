import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Heart, ShoppingCart, User, Home, Store, BookOpen, Menu, ChevronDown, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCartStore, useWishlistStore } from "@/stores/useStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useProductStore } from "@/stores/useProductStore";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CategoryIcon from "@/components/CategoryIcon";
import { useResellerRef, useResellerSlug, useResellerRefValue } from "@/contexts/ResellerRefContext";

const Header = () => {
  const cartTotal = useCartStore((s) => s.totalItems());
  const cartPrice = useCartStore((s) => s.totalPrice());
  const openCart = useCartStore((s) => s.openCart);
  const wishlistItems = useWishlistStore((s) => s.items);
  const openWishlist = useWishlistStore((s) => s.openWishlist);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginPopupOpen, setLoginPopupOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const { logoUrl, desktopMenuCategories, mobileMenuCategories } = useSiteSettingsStore();
  const { categories } = useCategoryStore();
  const { products } = useProductStore();
  const desktopCats = categories.filter(c => desktopMenuCategories.includes(c.slug));
  const mobileCats = categories.filter(c => mobileMenuCategories.includes(c.slug));
  const resellerRef = useResellerRef();
  const resellerSlug = useResellerSlug();
  const resellerValue = useResellerRefValue();
  const rp = (path: string) => resellerSlug ? `/r/${resellerSlug}${path}` : path;

  // On custom domain (noUrlPrefix=true) redirect to main site for reseller login.
  const handleLoginClick = () => {
    if (resellerValue?.noUrlPrefix) {
      window.location.href = `${window.location.protocol}//${import.meta.env.VITE_APP_DOMAIN}/reseller/login`;
    } else if (resellerRef) {
      navigate('/reseller/login');
    } else {
      setLoginPopupOpen(true);
    }
  };

  // Use reseller branding logo when set, otherwise fall back to site logo.
  const effectiveLogo = resellerValue?.branding?.logoUrl || logoUrl;

  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [showMobileResults, setShowMobileResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const searchResults = searchQuery.trim()
    ? products.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  const mobileSearchResults = mobileSearchQuery.trim()
    ? products.filter(p =>
        p.title.toLowerCase().includes(mobileSearchQuery.toLowerCase()) ||
        p.shortDescription.toLowerCase().includes(mobileSearchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) setShowMobileResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (window.innerWidth >= 768) {
        if (currentScrollY < lastScrollY.current) {
          setShowHeader(true);
        } else if (currentScrollY > 50) {
          setShowHeader(false);
        }
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(rp(`/shop?q=${encodeURIComponent(searchQuery.trim())}`));
      setShowResults(false);
    }
  };

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileSearchQuery.trim()) {
      navigate(rp(`/shop?q=${encodeURIComponent(mobileSearchQuery.trim())}`));
      setShowMobileResults(false);
      setMobileOpen(false);
    }
  };

  const navItems = [
    { label: "হোম", path: rp("/"), icon: Home },
    { label: "শপ", path: rp("/shop"), icon: Store },
    { label: "ডিজিটাল শপ", path: resellerSlug ? `/r/${resellerSlug}/digital-shop` : "/digital-products", icon: Download },
    { label: "ব্লগ", path: rp("/blog"), icon: BookOpen },
  ];

  return (
    <>
    <header className={`sticky top-0 z-50 transition-transform duration-300 ${showHeader ? "translate-y-0" : "md:-translate-y-full"}`}>
      {/* Row 1 - White */}
      <div className="bg-card border-b border-border py-[15px]">
        <div className="container-box flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link to={resellerSlug ? `/r/${resellerSlug}` : "/"} className="flex-shrink-0">
            <img src={effectiveLogo} alt="BongoBe" className="h-12 w-auto object-contain" />
          </Link>

          {/* Search - hidden on mobile */}
          <div ref={searchRef} className="hidden md:flex flex-1 max-w-xl relative">
            <form onSubmit={handleSearch} className="flex w-full">
              <Input
                placeholder="Type to start searching..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="rounded-l-full bg-background border-2 border-primary border-r-0 pr-4 pl-5 h-11 text-[18px] w-full rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="submit" className="rounded-r-[5px] rounded-l-none h-11 px-6 text-[18px] font-semibold border-0 shadow-none hover:bg-foreground hover:text-background">
                Search
              </Button>
            </form>
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-[5px] shadow-lg z-50 max-h-80 overflow-y-auto">
                {searchResults.map((product) => (
                  <Link
                    key={product.id}
                    to={rp(`/product/${product.slug}`)}
                    onClick={() => { setShowResults(false); setSearchQuery(""); }}
                    className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
                  >
                    <img src={product.images[0]} alt={product.title} className="w-10 h-10 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.title}</p>
                      <p className="text-xs text-primary font-bold">৳{product.price}</p>
                    </div>
                  </Link>
                ))}
                <Link
                  to={rp(`/shop?q=${encodeURIComponent(searchQuery)}`)}
                  onClick={() => { setShowResults(false); setSearchQuery(""); }}
                  className="block p-3 text-center text-sm text-primary font-medium hover:bg-muted border-t border-border"
                >
                  সব রেজাল্ট দেখুন →
                </Link>
              </div>
            )}
          </div>

          {/* Icons */}
          <div className="flex items-center gap-2">
            {/* Wishlist */}
              <Button
                size="icon"
                onClick={openWishlist}
                className="relative rounded-full h-10 w-10 bg-gradient-to-r from-primary to-secondary text-white border-0 hover:opacity-90 transition-opacity"
              >
              <Heart className="h-5 w-5" />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </Button>

            {/* Cart */}
            <Button
              onClick={openCart}
              className="relative gap-1 sm:gap-2 bg-primary text-primary-foreground hover:bg-foreground hover:text-background text-[14px] sm:text-[18px] transition-colors px-2 sm:px-4 flex-shrink-0"
            >
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="truncate max-w-[80px] sm:max-w-none">৳{cartPrice}</span>
              {cartTotal > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {cartTotal}
                </span>
              )}
            </Button>

            <Button onClick={handleLoginClick} className="gap-2 hidden sm:flex text-[18px] bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity border-0">
              <User className="h-5 w-5" />
              লগইন
            </Button>


            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button size="icon" className="md:hidden rounded-full h-10 w-10 bg-gradient-to-r from-primary to-secondary text-white border-0 hover:opacity-90 transition-opacity">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="p-4 border-b border-border">
                  <img src={effectiveLogo} alt="BongoBe" className="h-8 w-auto object-contain" />
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                  <div ref={mobileSearchRef} className="relative mb-4">
                    <form onSubmit={handleMobileSearch}>
                      <Input
                        placeholder="পণ্য খুঁজুন..."
                        value={mobileSearchQuery}
                        onChange={(e) => { setMobileSearchQuery(e.target.value); setShowMobileResults(true); }}
                        onFocus={() => setShowMobileResults(true)}
                        className="pr-10 rounded-[5px] bg-muted border-0"
                      />
                      <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </form>
                    {showMobileResults && mobileSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-[5px] shadow-lg z-50 max-h-60 overflow-y-auto">
                        {mobileSearchResults.map((product) => (
                          <Link
                            key={product.id}
                            to={rp(`/product/${product.slug}`)}
                            onClick={() => { setShowMobileResults(false); setMobileSearchQuery(""); setMobileOpen(false); }}
                            className="flex items-center gap-3 p-2.5 hover:bg-muted transition-colors"
                          >
                            <img src={product.images[0]} alt={product.title} className="w-8 h-8 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{product.title}</p>
                              <p className="text-xs text-primary font-bold">৳{product.price}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <nav className="space-y-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-[18px] font-medium transition-colors ${
                          location.pathname === item.path
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                    <Link
                      to={rp("/order-tracking")}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-[18px] font-medium transition-colors ${
                        location.pathname.endsWith("/order-tracking")
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Package className="h-4 w-4" />
                      অর্ডার ট্র্যাকিং
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); handleLoginClick(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-[18px] font-medium transition-colors text-foreground hover:bg-muted"
                    >
                      <User className="h-4 w-4" />
                      লগইন
                    </button>

                  </nav>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-[18px] text-muted-foreground mb-2">ক্যাটাগরি</p>
                    {mobileCats.map((cat) => (
                      <Link
                        key={cat.id}
                        to={rp(`/shop?category=${cat.slug}`)}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-[18px] text-foreground hover:bg-muted rounded-[5px]"
                      >
                        <CategoryIcon name={cat.lucideIcon} fallback={Store} className="h-4 w-4" />
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Row 2 - Gradient Nav */}
      <div className="hidden md:block bg-gradient-to-r from-primary to-secondary">
        <div className="container-box flex items-center justify-between py-2">
          <div className="flex items-center gap-6">
            {/* Categories Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 rounded-[5px] bg-white text-foreground hover:bg-muted hover:text-foreground px-5 text-[18px] font-semibold border-0 bg-none [background-image:none] py-[10px] h-auto">
                  <Menu className="h-4 w-4" />
                  All Categories
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {desktopCats.map((cat) => (
                  <DropdownMenuItem key={cat.id} asChild>
                    <Link to={rp(`/shop?category=${cat.slug}`)} className="flex items-center gap-2 text-[18px]">
                      <CategoryIcon name={cat.lucideIcon} fallback={Store} className="h-4 w-4" />
                      {cat.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Nav Links */}
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 text-[18px] font-medium transition-colors ${
                  location.pathname === item.path
                    ? "text-white"
                    : "text-primary-foreground/80 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Order Tracking Button */}
          <Link to={rp("/order-tracking")}>
            <Button className="gap-2 rounded-[5px] bg-white text-foreground hover:bg-secondary hover:text-secondary-foreground text-[18px] border-0 bg-none [background-image:none]">
              <Package className="h-4 w-4" />
              অর্ডার ট্র্যাকিং
            </Button>
          </Link>
        </div>
      </div>
      </header>

      <Dialog open={loginPopupOpen} onOpenChange={setLoginPopupOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-center font-bold leading-snug" style={{ fontSize: '20px' }}>
              আপনি কি হিসেবে লগইন / সাইনআপ করতে চাচ্ছেন?
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <Button
              onClick={() => { setLoginPopupOpen(false); navigate('/digital/login'); }}
              className="h-12 text-base font-bold bg-gradient-to-r from-primary to-secondary text-white border-0 hover:opacity-90"
            >
              কাস্টমার
            </Button>
            <Button
              onClick={() => { setLoginPopupOpen(false); navigate('/reseller/login'); }}
              variant="outline"
              className="h-12 text-base font-bold border-2 border-primary text-primary hover:bg-primary/10"
            >
              রিসেলার
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;
