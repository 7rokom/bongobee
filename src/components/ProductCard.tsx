import { forwardRef, memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/data/store-data";
import { useCartStore, useWishlistStore } from "@/stores/useStore";
import { useFraudBlockedStore } from "@/stores/useFraudBlockedStore";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { trackSelectItem, trackAddToCart, trackAddToWishlist } from "@/lib/dataLayer";
import { useResellerRef, useResellerSlug } from "@/contexts/ResellerRefContext";

interface ProductCardProps {
  product: Product;
  listId?: string;
  listName?: string;
}

const ProductCardBase = forwardRef<HTMLDivElement, ProductCardProps>(({ product, listId = "default", listName = "Product List" }, ref) => {
  const navigate = useNavigate();
  const resellerRef = useResellerRef();
  const resellerSlug = useResellerSlug();
  const addToCart = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const isInWishlist = useWishlistStore((s) => !!s.items.find((i) => i.id === product.id));
  const isDeviceBlocked = useFraudBlockedStore((s) => s.isDeviceBlocked);
  const cardTitleSize = useSiteSettingsStore((s) => s.cardTitleSize);
  const cardTitleSizeMobile = useSiteSettingsStore((s) => s.cardTitleSizeMobile ?? 13);
  const cardPriceSize = useSiteSettingsStore((s) => s.cardPriceSize);
  const cardButtonTextSize = useSiteSettingsStore((s) => s.cardButtonTextSize);

  const hasVariations = (product.variations && product.variations.length > 0) ||
    (product.colors && product.colors.length > 0) ||
    (product.sizes && product.sizes.length > 0) ||
    (product.weights && product.weights.length > 0);

  const itemPayload = useCallback(() => ({
    item_id: product.id,
    item_name: product.title,
    price: product.price,
    quantity: 1,
    item_category: product.category,
  }), [product]);

  const handleSelect = useCallback(() => {
    trackSelectItem(itemPayload(), listId, listName);
  }, [itemPayload, listId, listName]);

  const productPath = resellerSlug ? `/r/${resellerSlug}/product/${product.slug}` : `/product/${product.slug}`;

  const handleAddToCart = useCallback(() => {
    trackSelectItem(itemPayload(), listId, listName);
    if (hasVariations) {
      navigate(productPath);
    } else {
      addToCart(product);
      trackAddToCart([itemPayload()]);
      openCart();
    }
  }, [hasVariations, product, navigate, addToCart, openCart, itemPayload, listId, listName, productPath]);

  const handleOrder = useCallback(() => {
    trackSelectItem(itemPayload(), listId, listName);
    if (hasVariations) {
      navigate(productPath);
    } else {
      addToCart(product);
      trackAddToCart([itemPayload()]);
      navigate(resellerRef ? '/r/checkout' : '/checkout');
    }
  }, [hasVariations, product, navigate, addToCart, itemPayload, listId, listName, productPath, resellerRef]);

  const handleToggleWishlist = useCallback(() => {
    if (!isInWishlist) trackAddToWishlist(itemPayload());
    toggleWishlist(product);
  }, [toggleWishlist, product, isInWishlist, itemPayload]);

  const rawImg = product.featuredImage || product.images[0];
  const imgSrc = rawImg && /googleusercontent\.com|blogspot\.com/.test(rawImg)
    ? rawImg.replace(/\/s\d+(-[a-z0-9]+)?\//, '/s300/').replace(/\/w\d+-h\d+(-[a-z0-9]+)?\//, '/s300/')
    : rawImg;


  return (
    <div
      ref={ref}
      className="group bg-card rounded-[5px] border-b-[3px] border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.10)] hover:shadow-[0_8px_22px_rgba(0,0,0,0.22)] hover:-translate-y-[3px] transition-all duration-300 flex flex-col"
    >
      <div className="relative aspect-square overflow-hidden rounded-[5px] shrink-0">
        <Link to={productPath} onClick={handleSelect} className="block w-full h-full overflow-hidden rounded-[5px]">
          <img
            src={imgSrc}
            alt={product.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            width={300}
            height={300}
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleWishlist}
          className="absolute top-[14px] right-[14px] bg-primary/30 backdrop-blur-sm hover:bg-primary rounded-full h-8 w-8 text-primary-foreground hover:text-primary-foreground"
        >
          <Heart className={`h-4 w-4 ${isInWishlist ? "fill-primary-foreground text-primary-foreground" : ""}`} />
        </Button>
      </div>

      <div className="p-[7px] flex-1 flex flex-col">
        <Link to={productPath} onClick={handleSelect}>
          <h3 className="product-card-title font-semibold line-clamp-2 hover:text-primary transition-colors leading-tight mb-2 text-black dark:text-white">
            {product.title}
          </h3>
        </Link>
        <style>{`.product-card-title{font-size:${cardTitleSizeMobile}px}@media(min-width:768px){.product-card-title{font-size:${cardTitleSize}px}}`}</style>

        <div className="flex-1" />

        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-bold text-red-600" style={{ fontSize: `${cardPriceSize}px` }}>৳{product.price}</span>
          {product.originalPrice && (
            <span className="font-bold text-foreground line-through decoration-2 decoration-foreground" style={{ fontSize: `${cardPriceSize}px` }}>৳{product.originalPrice}</span>
          )}
        </div>

        <div className="flex items-center gap-[4px]">
            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0 rounded-[5px] bg-primary text-primary-foreground hover:bg-foreground hover:text-background"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button
              className="flex-1 h-9 rounded-[5px] hover:bg-foreground hover:text-background"
              style={{ fontSize: `${cardButtonTextSize}px` }}
              onClick={handleOrder}
            >
              অর্ডার করুন
            </Button>
          </div>
      </div>
    </div>
  );
});

ProductCardBase.displayName = "ProductCard";

const ProductCard = memo(ProductCardBase);
ProductCard.displayName = "ProductCard";

export default ProductCard;
