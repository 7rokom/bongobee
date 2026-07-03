import HeroSection from "@/components/HeroSection";
import ProductCard from "@/components/ProductCard";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useProductStore } from "@/stores/useProductStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import SEOHead, { DOMAIN } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import CategoryIcon from "@/components/CategoryIcon";
import { trackViewItemList } from "@/lib/dataLayer";

const PRODUCTS_PER_PAGE = 20;

const Index = () => {
  const { products } = useProductStore();
  const { categories } = useCategoryStore();
  const { siteName, siteMetaDescription, homeProductsPerRow, homeProductsPerRowMobile, homeFeaturedCategoriesCount } =
    useSiteSettingsStore();
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

  // Fire view_item_list for the all-products grid (first page only)
  useEffect(() => {
    if (publishedProducts.length === 0) return;
    const firstPage = publishedProducts.slice(0, PRODUCTS_PER_PAGE);
    trackViewItemList(
      firstPage.map((p) => ({
        item_id: p.id,
        item_name: p.title,
        price: p.price,
        quantity: 1,
        item_category: p.category,
      })),
      "home_all_products",
      "Home — All Products",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedProducts.length]);

  const seoJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName || "BongoBe",
      url: DOMAIN,
      potentialAction: {
        "@type": "SearchAction",
        target: `${DOMAIN}/shop?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    }),
    [siteName],
  );

  return (
    <div>
      <SEOHead
        title={siteName || "BongoBe"}
        description={
          siteMetaDescription ||
          "বাংলাদেশের বিশ্বস্ত অনলাইন শপিং প্ল্যাটফর্ম। সেরা মানের পণ্য, দ্রুত ডেলিভারি এবং ক্যাশ অন ডেলিভারি সুবিধা।"
        }
        canonical={DOMAIN}
        ogType="website"
        jsonLd={seoJsonLd}
      />
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
                    to={`/shop?category=${cat.slug}`}
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
                to="/shop"
                className="text-sm font-semibold text-white hover:underline flex items-center gap-1"
              >
                সব দেখুন →
              </Link>
            </div>
            <div className="pt-1">
              <style>{`
                .home-product-grid { grid-template-columns: repeat(${homeProductsPerRowMobile}, minmax(0, 1fr)) !important; }
                @media (min-width: 640px) { .home-product-grid { grid-template-columns: repeat(${Math.min(homeProductsPerRow, Math.max(2, Math.ceil(homeProductsPerRow * 0.5)))}, minmax(0, 1fr)) !important; } }
                @media (min-width: 768px) { .home-product-grid { grid-template-columns: repeat(${Math.min(homeProductsPerRow, Math.max(3, Math.ceil(homeProductsPerRow * 0.7)))}, minmax(0, 1fr)) !important; } }
                @media (min-width: 1024px) { .home-product-grid { grid-template-columns: repeat(${homeProductsPerRow}, minmax(0, 1fr)) !important; } }
              `}</style>
              <div className="grid gap-x-[12px] gap-y-[26px] home-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    listId="home_all_products"
                    listName="Home — All Products"
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

      {/* Empty state */}
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

export default Index;
