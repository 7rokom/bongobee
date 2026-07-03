import HeroSection from "@/components/HeroSection";
import ProductCard from "@/components/ProductCard";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useProductStore } from "@/stores/useProductStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { useResellerSlug } from "@/contexts/ResellerRefContext";
import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import CategoryIcon from "@/components/CategoryIcon";

const PRODUCTS_PER_PAGE = 20;

const ResellerStorefrontHome = () => {
  const { products } = useProductStore();
  const { categories } = useCategoryStore();
  const { homeProductsPerRow, homeProductsPerRowMobile, homeFeaturedCategoriesCount } = useSiteSettingsStore();
  const resellerSlug = useResellerSlug();
  const rp = (p: string) => resellerSlug ? `/r/${resellerSlug}${p}` : p;

  const publishedProducts = useMemo(
    () => products.filter((p) => (p.status || "published") === "published" && !p.isAffiliate),
    [products],
  );
  const visibleCategories = useMemo(
    () => categories.filter((c) => c.isMain !== false && !c.parentId).slice(0, homeFeaturedCategoriesCount || 5),
    [categories, homeFeaturedCategoriesCount],
  );

  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const visibleProducts = useMemo(() => publishedProducts.slice(0, visibleCount), [publishedProducts, visibleCount]);
  const hasMore = visibleCount < publishedProducts.length;

  return (
    <div>
      <HeroSection />

      {/* Categories */}
      {visibleCategories.length > 0 && (
        <section className="py-8 bg-white">
          <div className="container-box">
            <h2 className="text-2xl font-bold mb-6 text-center">ক্যাটাগরি</h2>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-[7px] sm:gap-4">
              {visibleCategories.map((cat) => {
                const isImageUrl = cat.icon && /^https?:\/\//i.test(cat.icon);
                return (
                  <Link
                    key={cat.id}
                    to={rp(`/shop?category=${cat.slug}`)}
                    className="group block rounded-[5px] overflow-hidden border border-primary shadow-sm group-hover:shadow-[0_8px_20px_hsl(var(--primary)/0.35)] hover:-translate-y-[5px] transition-all duration-300 bg-primary/10"
                  >
                    <div
                      className="relative aspect-[4/3] bg-muted flex items-center justify-center"
                      style={
                        isImageUrl
                          ? {
                              backgroundImage: `url(${cat.icon})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      {!isImageUrl && cat.lucideIcon && (
                        <CategoryIcon name={cat.lucideIcon} className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
                      )}
                    </div>
                    <h3 className="py-2 px-1 text-center text-sm sm:text-[18px] font-semibold text-foreground bg-primary/10">
                      {cat.name}
                    </h3>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* All Products */}
      {publishedProducts.length > 0 && (
        <section className="py-6 bg-white">
          <div className="container-box">
            <div className="flex items-center justify-between mb-3 rounded-[6px] overflow-hidden px-4 py-2.5" style={{ background: "var(--gradient-primary)" }}>
              <div className="text-white font-bold text-[18px]">সকল প্রোডাক্ট</div>
              <Link
                to={rp('/shop')}
                className="text-sm font-semibold text-white hover:underline flex items-center gap-1"
              >
                সব দেখুন →
              </Link>
            </div>
            <div className="pt-1">
              <style>{`
                .rs-home-grid { grid-template-columns: repeat(${homeProductsPerRowMobile}, minmax(0, 1fr)) !important; }
                @media (min-width: 640px) { .rs-home-grid { grid-template-columns: repeat(${Math.min(homeProductsPerRow, Math.max(2, Math.ceil(homeProductsPerRow * 0.5)))}, minmax(0, 1fr)) !important; } }
                @media (min-width: 768px) { .rs-home-grid { grid-template-columns: repeat(${Math.min(homeProductsPerRow, Math.max(3, Math.ceil(homeProductsPerRow * 0.7)))}, minmax(0, 1fr)) !important; } }
                @media (min-width: 1024px) { .rs-home-grid { grid-template-columns: repeat(${homeProductsPerRow}, minmax(0, 1fr)) !important; } }
              `}</style>
              <div className="grid gap-x-[12px] gap-y-[26px] rs-home-grid">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    listId="reseller_home"
                    listName="Reseller Home — All Products"
                  />
                ))}
              </div>
              {hasMore && (
                <div className="text-center mt-6">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-10 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setVisibleCount((c) => c + PRODUCTS_PER_PAGE)}
                  >
                    আরো দেখুন
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {publishedProducts.length === 0 && categories.length === 0 && (
        <section className="py-16 bg-white">
          <div className="container-box text-center text-muted-foreground">
            <Store className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-lg">এখনো কোনো পণ্য বা ক্যাটাগরি যোগ করা হয়নি।</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default ResellerStorefrontHome;
