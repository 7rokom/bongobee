import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";
import { useCartStore } from "@/stores/useStore";
import { useResellerRef } from "@/contexts/ResellerRefContext";

const Cart = () => {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const navigate = useNavigate();
  const resellerRef = useResellerRef();
  const checkoutPath = resellerRef ? '/r/checkout' : '/checkout';

  if (items.length === 0) {
    return (
      <div className="container-box py-20 text-center">
        <span className="text-6xl block mb-4">🛒</span>
        <h1 className="text-2xl font-bold mb-2">আপনার কার্ট খালি</h1>
        <p className="text-muted-foreground mb-6">শপিং শুরু করুন!</p>
        <Link to="/shop">
          <Button className="rounded-full" size="lg">শপিং করুন</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="container-box py-8">
        <h1 className="text-3xl font-bold mb-6">কার্ট</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="bg-card rounded-2xl p-4 shadow-sm flex gap-4">
                <img
                  src={item.product.images[0]}
                  alt={item.product.title}
                  className="w-20 h-20 object-cover rounded-xl"
                />
                <div className="flex-1">
                  <Link to={`/product/${item.product.slug}`}>
                    <h3 className="font-medium hover:text-primary">{item.product.title}</h3>
                  </Link>
                  <p className="text-primary font-bold mt-1">৳{item.product.price}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="ml-auto font-bold">৳{item.product.price * item.quantity}</span>
                    <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => removeItem(item.product.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl p-6 shadow-sm h-fit sticky top-32 space-y-4">
            <h3 className="font-semibold text-lg">অর্ডার সামারি</h3>
            <div className="space-y-2 text-sm">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between">
                  <span className="text-muted-foreground">{item.product.title} × {item.quantity}</span>
                  <span>৳{item.product.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
              <span>মোট:</span>
              <span className="text-primary">৳{totalPrice()}</span>
            </div>
            <Button size="lg" className="w-full rounded-full text-base" onClick={() => navigate(checkoutPath)}>
              চেকআউট করুন
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
