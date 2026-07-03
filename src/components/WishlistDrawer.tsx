import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useWishlistStore, useCartStore } from "@/stores/useStore";

const WishlistDrawer = () => {
  const { items, isOpen, closeWishlist, removeItem } = useWishlistStore();
  const addToCart = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeWishlist()}>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>উইশলিস্ট ({items.length})</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">💝</span>
            <p className="text-muted-foreground mb-4">আপনার উইশলিস্ট খালি</p>
            <Link to="/shop" onClick={closeWishlist}>
              <Button className="rounded-full">শপ নাও</Button>
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.map((product) => (
              <div key={product.id} className="flex gap-3 bg-muted rounded-xl p-3">
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${product.slug}`} onClick={closeWishlist}>
                    <h4 className="text-sm font-medium line-clamp-1 hover:text-primary">{product.title}</h4>
                  </Link>
                  <p className="text-sm font-bold text-primary mt-1">৳{product.price}</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-full gap-1"
                      onClick={() => {
                        addToCart(product);
                        openCart();
                        closeWishlist();
                      }}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      কার্টে
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive"
                      onClick={() => removeItem(product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WishlistDrawer;
