import { useParams, useNavigate } from "react-router-dom";
import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import { useResellerRef, useResellerRefValue } from "@/contexts/ResellerRefContext";

import { useProductStore } from "@/stores/useProductStore";
import { useMohasagorStore } from "@/stores/useMohasagorStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useVariationStore } from "@/stores/useVariationStore";
import { api } from "@/lib/api";
import { trackViewContent, trackAddToCart, trackAddToWishlist } from "@/lib/dataLayer";
import { useCartStore, useWishlistStore } from "@/stores/useStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { useFraudBlockedStore } from "@/stores/useFraudBlockedStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, ShoppingCart, Phone, MessageCircle, Plus, Minus, Loader2, Play } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import YouTubeVideoModal, { extractYouTubeId } from "@/components/YouTubeVideoModal";
import ProductTrustSidebar from "@/components/ProductTrustSidebar";
import ProductTrustBadges from "@/components/ProductTrustBadges";
import AdSlot from "@/components/AdSlot";
import SEOHead, { DOMAIN } from "@/components/SEOHead";
import Breadcrumbs from "@/components/Breadcrumbs";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import PageAudioPlayer from "@/components/PageAudioPlayer";
import { useContactNumbers, toWaNumber } from "@/lib/contact-numbers";

import { toast } from "@/hooks/use-toast";

const getHashNumber = (id: string, min: number, max: number): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return min + (Math.abs(hash) % (max - min + 1));
};

const useSalesCount = (productId: string) => {
  return useMemo(() => getHashNumber(productId, 1, 69), [productId]);
};

const StickyCallWhatsApp = () => {
  const { phone, whatsapp } = useContactNumbers();
  const waNumber = toWaNumber(whatsapp);
  if (!phone && !whatsapp) return null;
  return (
    <div className="fixed bottom-[132px] right-4 md:bottom-[76px] md:right-6 z-50 flex flex-col gap-2">
      {phone && (
        <a href={`tel:${phone}`} aria-label="কল করুন">
          <button className="flex items-center justify-center h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:opacity-90 transition-opacity">
            <Phone className="h-5 w-5" />
          </button>
        </a>
      )}
      {waNumber && (
        <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="হোয়াটসঅ্যাপ">
          <button className="flex items-center justify-center h-11 w-11 rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:opacity-90 transition-opacity">
            <MessageCircle className="h-5 w-5" />
          </button>
        </a>
      )}
    </div>
  );
};


const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const resellerRef = useResellerRef();
  const resellerRefValue = useResellerRefValue();
  const checkoutPath = resellerRef ? '/r/checkout' : '/checkout';

  // Reseller's custom pixel/script codes are injected by ResellerPublicLayout
  // for ALL reseller public pages (shop, product, checkout, thank-you).

  const { getProductBySlug, getRelatedProducts, fetchProductBySlug } = useProductStore();
  const storeLoading = useProductStore((s) => s.loading);
  const initialized = useProductStore((s) => s.initialized);

  // Mohasagor product fallback — Mohasagor products live in a separate store
  // (long-lived browser cache) and are NOT in the local DB. Detect by slug prefix.
  // Detect Mohasagor products by slug pattern. New format: `m-<id>`. Old: `mohasagor-<...>` (kept for backward-compat with cached/shared links).
  const isMohasagorSlug = !!slug && (/^m-\d+$/.test(slug) || slug.startsWith('mohasagor-'));
  const mohasagorProducts = useMohasagorStore((s) => s.products);
  const fetchMohasagor = useMohasagorStore((s) => s.fetchProducts);
  const mohasagorProduct = isMohasagorSlug
    ? mohasagorProducts.find((p) => p.slug === slug)
    : undefined;

  const product = mohasagorProduct || getProductBySlug(slug || "");
  const [slugFetchDone, setSlugFetchDone] = useState(false);
  const [resellerCustomPrice, setResellerCustomPrice] = useState<number | null>(null);

  // Direct slug fetch for deep links / refresh
  useEffect(() => {
    if (!slug) return;
    if (isMohasagorSlug) {
      if (mohasagorProducts.length === 0) {
        fetchMohasagor().finally(() => setSlugFetchDone(true));
      } else {
        setSlugFetchDone(true);
      }
      return;
    }
    // If we already have the product AND its full long_description, skip refetch.
    // List-load only fetches short_description, so we MUST refetch when longDescription is empty,
    // otherwise users without persisted cache (new device/browser) only see short description.
    if (product && product.longDescription && product.longDescription.trim() !== '') {
      setSlugFetchDone(true);
      return;
    }
    fetchProductBySlug(slug).then(() => setSlugFetchDone(true));
  }, [slug, isMohasagorSlug, mohasagorProducts.length]);


  // Fetch reseller custom price
  useEffect(() => {
    if (!resellerRef || !product) return;
    api.get(`/public/reseller-prices?reseller_id=${resellerRef}&product_id=${product.id}`)
      .then((data: any) => {
        const row = Array.isArray(data) ? data[0] : null;
        if (row) setResellerCustomPrice(Number(row.custom_price));
      }).catch(() => {});
  }, [resellerRef, product?.id]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedWeight, setSelectedWeight] = useState<string>('');
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const salesCount = useSalesCount(product?.id || '');
  const productPageTitleSize = useSiteSettingsStore((s) => s.productPageTitleSize);
  const productPageDescSize = useSiteSettingsStore((s) => s.productPageDescSize);
  const productPageAdCode = useSiteSettingsStore((s) => s.productPageAdCode);
  const productAudioUrl = useSiteSettingsStore((s) => s.productAudioUrl);
  const productAudioEnabled = useSiteSettingsStore((s) => s.productAudioEnabled);

  const addToCart = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const isInWishlist = useWishlistStore((s) => product ? s.isInWishlist(product.id) : false);
  const isDeviceBlocked = useFraudBlockedStore((s) => s.isDeviceBlocked);

  // Track view_item event
  useEffect(() => {
    if (product) {
      trackViewContent({
        item_id: product.id,
        item_name: product.title,
        price: product.price,
        quantity: 1,
        item_category: product.category,
      });
    }
  }, [product?.id]);

  const loading = useProductStore((s) => s.loading);

  // Variation/category hooks — MUST be called before any early return
  // to keep hooks order stable between "product loading" and "product loaded" renders.
  const variationItems = useVariationStore((s) => s.items);
  const fetchVariations = useVariationStore((s) => s.fetchVariations);
  const categories = useCategoryStore((s) => s.categories);
  useEffect(() => {
    if (variationItems.length === 0) fetchVariations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allImages = useMemo(() => {
    if (!product) return ['/placeholder.svg'];
    const imgs: string[] = [];
    if (product.featuredImage) imgs.push(product.featuredImage);
    product.images.forEach((img) => {
      if (!imgs.includes(img)) imgs.push(img);
    });
    return imgs.length > 0 ? imgs : ['/placeholder.svg'];
  }, [product]);

  // Blogger/Googleusercontent images support /sN/ or /wN-hN/ resize. Serve smaller LCP-friendly sizes.
  const resizeBlogger = (url: string, size: number) => {
    if (!url) return url;
    if (!/googleusercontent\.com|blogspot\.com/.test(url)) return url;
    return url.replace(/\/s\d+(-[a-z0-9]+)?\//, `/s${size}/`).replace(/\/w\d+-h\d+(-[a-z0-9]+)?\//, `/s${size}/`);
  };


  const currentPrice = useMemo(() => {
    if (!product) return 0;
    // If reseller has set a custom price, use it
    if (resellerRef && resellerCustomPrice !== null) return resellerCustomPrice;
    let price = product.price;
    const vp = product.variationPrices;
    if (vp && vp.length > 0) {
      if (selectedColor) {
        const cp = vp.find(v => v.variationType === 'color' && v.variationName === selectedColor);
        if (cp?.price) price = cp.price;
      }
      if (selectedSize) {
        const sp = vp.find(v => v.variationType === 'size' && v.variationName === selectedSize);
        if (sp?.price) price = sp.price;
      }
      if (selectedWeight) {
        const wp = vp.find(v => v.variationType === 'weight' && v.variationName === selectedWeight);
        if (wp?.price) price = wp.price;
      }
    }
    return price;
  }, [product, selectedColor, selectedSize, selectedWeight, resellerRef, resellerCustomPrice]);

  const productJsonLd = useMemo(() => {
    if (!product) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.metaDescription || product.shortDescription?.replace(/<[^>]*>/g, '').slice(0, 160),
      image: allImages,
      url: `${DOMAIN}/product/${product.slug}`,
      brand: { '@type': 'Brand', name: 'BongoBe' },
      offers: {
        '@type': 'Offer',
        price: currentPrice,
        priceCurrency: 'BDT',
        availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `${DOMAIN}/product/${product.slug}`,
      },
      ...(product.reviews && product.reviews.length > 0 ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: (product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length).toFixed(1),
          reviewCount: product.reviews.length,
        },
      } : {}),
    };
  }, [product, currentPrice, allImages]);

  // Product with overridden price for cart (reseller custom price)
  const cartProduct = useMemo(() => {
    if (!product) return null;
    if (resellerRef && resellerCustomPrice !== null) {
      return { ...product, price: resellerCustomPrice };
    }
    return product;
  }, [product, resellerRef, resellerCustomPrice]);

  // Layer 2 — display filter: hide variation options whose master record
  // was deleted from the Variations admin. MUST be called before any early
  // return to keep hooks order stable between "loading" and "loaded" renders.
  const allowedNames = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const make = (t: 'color' | 'size' | 'weight') =>
      new Set(variationItems.filter((v) => v.type === t).map((v) => norm(v.name)));
    return { color: make('color'), size: make('size'), weight: make('weight'), norm };
  }, [variationItems]);

  // If variation master is empty (not yet loaded), don't filter — avoids flicker.
  const visibleColors = useMemo(() => {
    if (!product?.colors) return [] as string[];
    if (allowedNames.color.size === 0) return product.colors;
    return product.colors.filter((c) => allowedNames.color.has(allowedNames.norm(c)));
  }, [product?.colors, allowedNames]);
  const visibleSizes = useMemo(() => {
    if (!product?.sizes) return [] as string[];
    if (allowedNames.size.size === 0) return product.sizes;
    return product.sizes.filter((s) => allowedNames.size.has(allowedNames.norm(s)));
  }, [product?.sizes, allowedNames]);
  const visibleWeights = useMemo(() => {
    if (!product?.weights) return [] as string[];
    if (allowedNames.weight.size === 0) return product.weights;
    return product.weights.filter((w) => allowedNames.weight.has(allowedNames.norm(w)));
  }, [product?.weights, allowedNames]);

  if (!product) {
    if (!slugFetchDone || loading) {
      return (
        <div className="container-box py-20 text-center flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">একটু অপেক্ষা করুন🙏</h1>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="container-box py-20 text-center">
        <h1 className="text-2xl font-bold">পণ্যটি পাওয়া যায়নি</h1>
      </div>
    );
  }

  const related = getRelatedProducts(product.id, product.category);
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const hasColors = visibleColors.length > 0;
  const hasSizes = visibleSizes.length > 0;
  const hasWeights = visibleWeights.length > 0;

  const validateVariations = (): boolean => {
    const missing: string[] = [];
    if (hasColors && !selectedColor) missing.push('কালার');
    if (hasSizes && !selectedSize) missing.push('সাইজ');
    if (hasWeights && !selectedWeight) missing.push('ওজন');
    if (missing.length > 0) {
      toast({ title: `দয়া করে ${missing.join(', ')} সিলেক্ট করুন`, variant: "destructive" });
      return false;
    }
    return true;
  };

  // Filter deleted categories from breadcrumb (Layer 2)
  const firstCategoryName = product.category ? product.category.split(',')[0].trim() : '';
  const categoryStillExists = firstCategoryName
    ? categories.some((c) => c.name.trim().toLowerCase() === firstCategoryName.toLowerCase() || c.slug === firstCategoryName)
    : false;
  const breadcrumbItems = [
    { label: 'শপ', href: '/shop' },
    ...(categoryStillExists ? [{ label: firstCategoryName, href: `/shop?category=${firstCategoryName}` }] : []),
    { label: product.title },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title={product.title}
        description={product.metaDescription || product.shortDescription?.replace(/<[^>]*>/g, '').slice(0, 160)}
        keywords={product.metaKeywords}
        canonical={`${DOMAIN}/product/${product.slug}`}
        ogImage={product.featuredImage || allImages[0]}
        ogType="product"
        jsonLd={productJsonLd}
      />
      <div className="container-box pt-[15px] md:pt-[15px] lg:pt-[25px] pb-8">
        <Breadcrumbs items={breadcrumbItems} />
        {/* Product Main - 40% gallery / 45% info / 15% empty */}
        <div className="grid grid-cols-1 lg:grid-cols-[40%_45%_15%] gap-4 lg:gap-6 mb-10 items-start">
          {/* ===== IMAGE GALLERY ===== */}
          <div>
            {/* Main image */}
            <div className="relative w-full aspect-square rounded-[5px] overflow-hidden bg-card border border-primary/30 shadow-sm">
              <img
                src={resizeBlogger(allImages[selectedImage], 600)}
                alt={product.title}
                className="w-full h-full object-cover"
                fetchPriority="high"
                loading="eager"
                referrerPolicy="no-referrer"
                width={600}
                height={600}
              />
              {discount > 0 && (
                <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-[5px]">
                  -{discount}%
                </span>
              )}
              {/* Play button overlay - shown only when a valid YouTube link exists and main image is selected */}
              {product.featuredVideo && extractYouTubeId(product.featuredVideo) && selectedImage === 0 && (
                <button
                  onClick={() => setVideoModalOpen(true)}
                  aria-label="ভিডিও দেখুন"
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors group"
                >
                  <span className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-white/95 shadow-2xl ring-4 ring-white/40 group-hover:scale-110 transition-transform animate-pulse-play animate-play-bounce">
                    <Play className="h-8 w-8 md:h-10 md:w-10 text-destructive fill-destructive ml-1" />
                  </span>
                </button>
              )}
            </div>
            {/* Horizontal thumbnails BELOW main image (scrolls when more than 4) */}
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-thin pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`aspect-square w-[calc((100%-1.5rem)/4)] shrink-0 rounded-[5px] overflow-hidden border-2 transition-all ${
                    selectedImage === i ? "border-primary shadow-md scale-[1.02]" : "border-border hover:border-primary/50"
                  }`}
                >
                  <img src={resizeBlogger(img, 150)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* ===== PRODUCT INFO ===== */}
          <div className="space-y-3">
            <h1 className="font-bold leading-tight text-black dark:text-white line-clamp-2" style={{ fontSize: `${productPageTitleSize}px` }}>{product.title}</h1>

            {/* Price — directly below title */}
            <div className="flex items-center gap-3 !mt-[15px]">
              <span className="text-[20px] font-bold text-foreground">দামঃ</span>
              <span className="text-3xl font-extrabold text-primary">৳{currentPrice}</span>
              {product.originalPrice && (
                <span className="text-2xl text-muted-foreground/60 line-through font-bold">৳{product.originalPrice}</span>
              )}
              {discount > 0 && (
                <span className="bg-destructive/10 text-destructive text-sm font-bold px-2 py-0.5 rounded-[5px]">
                  {discount}% ছাড়
                </span>
              )}
            </div>

            <div className="text-black dark:text-white prose prose-sm max-w-none leading-[1.3] [&_*]:text-black dark:[&_*]:text-white [&_p]:mb-[2px] [&_li]:mb-[2px] !mt-[15px] overflow-hidden break-words [&_img]:max-w-full [&_img]:h-auto [&_*]:max-w-full font-['Noto_Serif_Bengali'] whitespace-pre-line" style={{ fontSize: `${productPageDescSize}px` }} dangerouslySetInnerHTML={{ __html: product.shortDescription }} />

            {/* Variations - side by side on desktop */}
            <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2 lg:gap-4">
              {hasColors && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[16px] font-medium">কালার:</label>
                  {visibleColors.map((color) => {
                    const hasPrice = product.variationPrices?.find(v => v.variationType === 'color' && v.variationName === color);
                    return (
                      <Button
                        key={color}
                        variant={selectedColor === color ? "default" : "outline"}
                        size="sm"
                        className={`rounded-[5px] ${selectedColor !== color ? "border-foreground" : ""}`}
                        onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                      >
                        {color} {hasPrice?.price ? `(৳${hasPrice.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Size Variations */}
              {hasSizes && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[16px] font-medium">সাইজ:</label>
                  {visibleSizes.map((size) => {
                    const hasPrice = product.variationPrices?.find(v => v.variationType === 'size' && v.variationName === size);
                    return (
                      <Button
                        key={size}
                        variant={selectedSize === size ? "default" : "outline"}
                        size="sm"
                        className={`rounded-[5px] ${selectedSize !== size ? "border-foreground" : ""}`}
                        onClick={() => setSelectedSize(selectedSize === size ? '' : size)}
                      >
                        {size} {hasPrice?.price ? `(৳${hasPrice.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Weight Variations */}
              {hasWeights && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[16px] font-medium">ওজন:</label>
                  {visibleWeights.map((weight) => {
                    const hasPrice = product.variationPrices?.find(v => v.variationType === 'weight' && v.variationName === weight);
                    return (
                      <Button
                        key={weight}
                        variant={selectedWeight === weight ? "default" : "outline"}
                        size="sm"
                        className={`rounded-[5px] ${selectedWeight !== weight ? "border-foreground" : ""}`}
                        onClick={() => setSelectedWeight(selectedWeight === weight ? '' : weight)}
                      >
                        {weight} {hasPrice?.price ? `(৳${hasPrice.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legacy Variations */}
            {product.variations?.map((variation) => (
              <div key={variation.name} className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium">{variation.name}:</label>
                {variation.options.map((opt) => (
                  <Button
                    key={opt}
                    variant={selectedVariations[variation.name] === opt ? "default" : "outline"}
                    size="sm"
                    className={`rounded-[5px] ${selectedVariations[variation.name] !== opt ? "border-foreground" : ""}`}
                    onClick={() =>
                      setSelectedVariations({ ...selectedVariations, [variation.name]: opt })
                    }
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            ))}



            {/* Buttons Section */}
            <div className="flex flex-col gap-[10px] pt-1">
              {/* Quantity + Add to Cart + Wishlist */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-foreground rounded-[5px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-[5px]"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-[5px]"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="flex-1 gap-2 rounded-[5px] hover:bg-foreground hover:text-background text-[18px]"
                  onClick={() => {
                    if (!validateVariations()) return;
                    const allVariations = { ...selectedVariations };
                    if (selectedColor) allVariations['কালার'] = selectedColor;
                    if (selectedSize) allVariations['সাইজ'] = selectedSize;
                    if (selectedWeight) allVariations['ওজন'] = selectedWeight;
                    addToCart(cartProduct!, quantity, allVariations);
                    trackAddToCart([{ item_id: product.id, item_name: product.title, price: currentPrice, quantity, item_category: product.category }]);
                    openCart();
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-[5px] h-10 w-10 border-foreground"
                  onClick={() => {
                    if (!isInWishlist) {
                      trackAddToWishlist({
                        item_id: product.id,
                        item_name: product.title,
                        price: currentPrice,
                        quantity: 1,
                        item_category: product.category,
                      });
                    }
                    toggleWishlist(product);
                  }}
                >
                  <Heart className={`h-4 w-4 ${isInWishlist ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>

              {/* Order Now */}
              <Button
                size="lg"
                className="w-full rounded-[5px] text-[25px] font-bold gap-2 animate-order-bg-blink [background-image:none] hover:[background-image:none] border border-foreground hover:[animation:none] hover:!bg-[#f7f700] hover:!text-black shadow-[0_4px_15px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all active:scale-[0.98]"
                onClick={() => {
                  if (product.isAffiliate && product.affiliateUrl) {
                    window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  if (isDeviceBlocked) {
                    toast({ title: 'আপনার ডিভাইস ব্লক করা হয়েছে', variant: 'destructive' });
                    return;
                  }
                  if (!validateVariations()) return;
                  const allVariations = { ...selectedVariations };
                  if (selectedColor) allVariations['কালার'] = selectedColor;
                  if (selectedSize) allVariations['সাইজ'] = selectedSize;
                  if (selectedWeight) allVariations['ওজন'] = selectedWeight;
                  addToCart(cartProduct!, quantity, allVariations);
                  trackAddToCart([{ item_id: product.id, item_name: product.title, price: currentPrice, quantity, item_category: product.category }]);
                  navigate(checkoutPath);
                }}
              >
                <ShoppingCart className="h-5 w-5" />
                {product.isAffiliate ? (product.affiliateButtonText || 'এখনই অর্ডার করুন') : 'এখনই অর্ডার করুন'}
              </Button>

            </div>
          </div>
        </div>

        {/* Sponsor / Ad Slot (controlled from Site Settings) */}
        <AdSlot html={productPageAdCode || ''} className="mb-4" />


        {/* Description section — plain, no tabs */}
        <div className="mb-10 bg-white" ref={tabsRef}>
          <div className="pb-0">
            <span className="text-[18px] font-bold uppercase tracking-wide text-foreground">Description</span>
            <div className="h-[2px] w-full mt-2" style={{ background: 'var(--primary)' }} />
          </div>
          <div className="pt-3 overflow-hidden break-words">
            <div
              className="prose prose-sm sm:prose max-w-none w-full font-['Noto_Serif_Bengali'] text-foreground [&_p]:mb-3 [&_br]:block [&_br]:content-[''] [&_br]:mb-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-[5px] [&_img]:my-3 [&_img]:block [&_img]:mx-auto [&_*]:max-w-full [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-muted [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-2 break-words overflow-wrap-anywhere"
              dangerouslySetInnerHTML={{ __html: product.longDescription || '' }}
            />
          </div>
        </div>

        <div className="h-[25px]" />
      </div>

      {/* Mobile Sticky Order Button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white p-3 md:hidden border-t border-border">
        <Button
          className="w-full h-12 text-[27px] font-bold gap-2 rounded-[5px] animate-order-bg-blink border border-foreground shadow-[0_4px_15px_rgba(0,0,0,0.15)] [background-image:none] hover:[background-image:none] hover:!bg-[#f7f700] hover:!text-black hover:[animation:none]"
          onClick={() => {
            if (product.isAffiliate && product.affiliateUrl) {
              window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
              return;
            }
            if (isDeviceBlocked) {
              toast({ title: 'আপনার ডিভাইস ব্লক করা হয়েছে', variant: 'destructive' });
              return;
            }
            if (!validateVariations()) return;
            const allVariations = { ...selectedVariations };
            if (selectedColor) allVariations['কালার'] = selectedColor;
            if (selectedSize) allVariations['সাইজ'] = selectedSize;
            if (selectedWeight) allVariations['ওজন'] = selectedWeight;
            addToCart(cartProduct!, quantity, allVariations);
            trackAddToCart([{ item_id: product.id, item_name: product.title, price: currentPrice, quantity, item_category: product.category }]);
            navigate(checkoutPath);
          }}
        >
          <ShoppingCart className="h-5 w-5" />
          {product.isAffiliate ? (product.affiliateButtonText || 'এখনই অর্ডার করুন') : 'এখনই অর্ডার করুন'}
        </Button>
      </div>

      {/* YouTube video popup */}
      {product.featuredVideo && (
        <YouTubeVideoModal
          videoUrl={product.featuredVideo}
          open={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
        />
      )}

      {/* Exit-intent discount popup (only when an active product-specific coupon exists) */}
      <ExitIntentPopup
        productId={product.id}
        productSlug={product.slug}
        productTitle={product.title}
      />

      {/* Floating global audio player (auto-plays once per visitor per page) */}
      <PageAudioPlayer
        audioUrl={productAudioUrl}
        enabled={productAudioEnabled}
        pageKey="product"
      />

      {/* Sticky call / WhatsApp buttons — right side, just above the audio player */}
      <StickyCallWhatsApp />
    </div>
  );
};

export default ProductPage;
