import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "@/stores/useStore";
import { useResellerSlug } from "@/contexts/ResellerRefContext";

const CartDrawer = () => {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice } = useCartStore();
  const navigate = useNavigate();
  const resellerRef = useResellerSlug();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>কার্ট ({items.length})</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">🛒</span>
            <p className="text-muted-foreground mb-4">আপনার কার্ট খালি</p>
            <Link to="/shop" onClick={closeCart}>
              <Button className="rounded-full">শপিং করুন</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 bg-muted rounded-xl p-3">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.title}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-clamp-1">{item.product.title}</h4>
                    <p className="text-sm font-bold text-primary mt-1">৳{item.product.price}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded-full"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded-full"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 ml-auto text-destructive"
                        onClick={() => removeItem(item.product.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between font-semibold">
                <span>মোট:</span>
                <span className="text-primary text-lg">৳{totalPrice()}</span>
              </div>
              <Button
                className="w-full rounded-full text-base"
                size="lg"
                onClick={() => {
                  closeCart();
                  navigate(resellerRef ? "/r/checkout" : "/checkout");
                }}
              >
                চেকআউট করুন
              </Button>
              <Link to={resellerRef ? `/r/${resellerRef}/cart` : "/cart"} onClick={closeCart}>
                <Button variant="outline" className="w-full rounded-full" size="lg">
                  কার্ট দেখুন
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
