import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useProductStore } from "@/stores/useProductStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X, Loader2, ChevronDown } from "lucide-react";
import SEOHead, { DOMAIN } from "@/components/SEOHead";

import Breadcrumbs from "@/components/Breadcrumbs";
import CategoryIcon from "@/components/CategoryIcon";
import { trackViewItemList } from "@/lib/dataLayer";

const INITIAL_COUNT = 12;
const LOAD_MORE_STEP = 8;

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "";
  const [sortBy, setSortBy] = useState("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const { products } = useProductStore();
  const { categories } = useCategoryStore();
  const { shopProductsPerRow, shopProductsPerRowMobile } = useSiteSettingsStore();
  const searchQuery = searchParams.get("q") || "";

  const publishedProducts = useMemo(() => products.filter(p => (p.status || 'published') === 'published'), [products]);

  const matchingCat = categories.find(c => c.slug === activeCategory);
  const activeCatName = matchingCat?.name || '';

  // If active category is a main category, also include all its sub-category slugs/names
  const activeCategoryMatchSet = useMemo(() => {
    if (!matchingCat) return new Set<string>();
    const set = new Set<string>([matchingCat.slug, matchingCat.name]);
    if (matchingCat.isMain !== false) {
      categories
        .filter(c => c.parentId === matchingCat.id)
        .forEach(sub => { set.add(sub.slug); set.add(sub.name); });
    }
    return set;
  }, [matchingCat, categories]);

  const filtered = useMemo(() => {
    let result = activeCategory
      ? publishedProducts.filter((p) => {
          if (!p.category) return false;
          const cats = p.category.split(', ').map((c: string) => c.trim());
          return cats.some(c => activeCategoryMatchSet.has(c));
        })
      : publishedProducts.filter((p) => !p.isAffiliate);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) || p.shortDescription.toLowerCase().includes(q)
      );
    }

    if (sortBy === "low") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "high") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [publishedProducts, activeCategory, activeCategoryMatchSet, searchQuery, sortBy]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [activeCategory, sortBy, searchQuery]);

  // Fire view_item_list on filter change
  useEffect(() => {
    if (filtered.length === 0) return;
    const listId = searchQuery
      ? `search_${searchQuery}`
      : activeCategory
      ? `category_${activeCategory}`
      : 'shop_all';
    const listName = searchQuery
      ? `Search: ${searchQuery}`
      : activeCatName
      ? `Category: ${activeCatName}`
      : 'Shop — All Products';
    const firstPage = filtered.slice(0, INITIAL_COUNT);
    trackViewItemList(
      firstPage.map(p => ({ item_id: p.id, item_name: p.title, price: p.price, quantity: 1, item_category: p.category })),
      listId,
      listName
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, searchQuery, filtered.length]);

  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const mainCategories = useMemo(
    () => categories
      .filter(c => c.isMain !== false && !c.parentId)
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
    [categories]
  );
  const subsByParent = useMemo(() => {
    const map: Record<string, typeof categories> = {};
    categories.forEach(c => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
    );
    return map;
  }, [categories]);

  // Auto-expand parent when an active sub-cat is selected
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!matchingCat) return;
    if (matchingCat.parentId) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.add(matchingCat.parentId!);
        return next;
      });
    }
  }, [matchingCat]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SidebarContent = () => (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-base mb-3 text-foreground flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full" />
          ক্যাটাগরি
        </h3>
        <div className="space-y-1.5">
          <button
            onClick={() => { setSearchParams({}); setFilterOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !activeCategory
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/40 hover:bg-muted text-foreground'
            }`}
          >
            <span>সকল পণ্য</span>
          </button>
          {mainCategories.map((cat) => {
            const subs = subsByParent[cat.id] || [];
            const isActive = activeCategory === cat.slug;
            const isExpanded = expandedIds.has(cat.id);
            const hasActiveSub = subs.some(s => s.slug === activeCategory);
            return (
              <div key={cat.id} className="space-y-1">
                <div
                  className={`w-full flex items-stretch rounded-lg overflow-hidden transition-all ${
                    isActive || hasActiveSub
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 hover:bg-muted text-foreground'
                  }`}
                >
                  <button
                    onClick={() => { setSearchParams({ category: cat.slug }); setFilterOpen(false); }}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium min-w-0"
                  >
                    <CategoryIcon name={cat.lucideIcon} className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </button>
                  {subs.length > 0 && (
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="px-2 flex items-center justify-center hover:bg-black/10 transition-colors"
                      aria-label="toggle subcategories"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {subs.length > 0 && isExpanded && (
                  <div className="ml-3 pl-3 border-l-2 border-primary/30 space-y-1">
                    {subs.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => { setSearchParams({ category: sub.slug }); setFilterOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          activeCategory === sub.slug
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <CategoryIcon name={sub.lucideIcon} className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="font-bold text-base mb-3 text-foreground flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full" />
          সর্ট করুন
        </h3>
        <div className="space-y-1.5">
          {[
            { value: "default", label: "ডিফল্ট" },
            { value: "low", label: "কম দাম" },
            { value: "high", label: "বেশি দাম" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSortBy(opt.value); setFilterOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                sortBy === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 hover:bg-muted text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );


  const shopTitle = activeCatName || 'সকল পণ্য';
  const breadcrumbItems = activeCatName ? [{ label: 'শপ', href: '/shop' }, { label: activeCatName }] : [{ label: 'শপ' }];

  return (
    <div className="bg-white min-h-screen">
      <SEOHead title={shopTitle} description={`${activeCatName || 'সকল'} পণ্য কিনুন BongoBe থেকে। সেরা দামে অনলাইনে অর্ডার করুন।`} canonical={`${DOMAIN}/shop${activeCategory ? `?category=${activeCategory}` : ''}`} />
      <div className="container-box py-8">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:w-56 flex-shrink-0">
            <div className="bg-card rounded-2xl p-4 shadow-sm sticky top-32">
              <SidebarContent />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-4">{filtered.length}টি পণ্য পাওয়া গেছে</p>
            <style>{`
              .shop-product-grid { grid-template-columns: repeat(${shopProductsPerRowMobile}, minmax(0, 1fr)) !important; }
              @media (min-width: 640px) { .shop-product-grid { grid-template-columns: repeat(${Math.min(shopProductsPerRow, Math.ceil(shopProductsPerRow * 0.75))}, minmax(0, 1fr)) !important; } }
              @media (min-width: 1024px) { .shop-product-grid { grid-template-columns: repeat(${shopProductsPerRow}, minmax(0, 1fr)) !important; } }
            `}</style>
            <div className="grid gap-x-[12px] gap-y-[26px] shop-product-grid">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  listId={searchQuery ? `search_${searchQuery}` : activeCategory ? `category_${activeCategory}` : 'shop_all'}
                  listName={searchQuery ? `Search: ${searchQuery}` : activeCatName ? `Category: ${activeCatName}` : 'Shop — All Products'}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center py-8">
                <Button
                  onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                  size="lg"
                  className="rounded-full px-8"
                >
                  আরও দেখুন ({filtered.length - visibleCount}টি বাকি)
                </Button>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                এই ক্যাটাগরিতে কোন পণ্য পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Button */}
      <button
        onClick={() => setFilterOpen(true)}
        className="lg:hidden fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground rounded-[5px] p-3 shadow-lg flex items-center gap-2 text-[16px] font-semibold"
      >
        <SlidersHorizontal className="h-5 w-5" />
        ফিল্টার
      </button>

      {/* Mobile Filter Popup */}
      {filterOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">ফিল্টার ও সর্ট</h2>
              <button onClick={() => setFilterOpen(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
