import { create } from 'zustand';
import { Product } from '@/data/store-data';

interface CartItem {
  product: Product;
  quantity: number;
  selectedVariations?: Record<string, string>;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, quantity?: number, variations?: Record<string, string>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  addItem: (product, quantity = 1, variations) => {
    const items = get().items;
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity, selectedVariations: variations || i.selectedVariations } : i
        ),
      });
    } else {
      set({ items: [...items, { product, quantity, selectedVariations: variations }] });
    }
  },
  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.product.id !== productId) }),
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      ),
    });
  },
  clearCart: () => set({ items: [] }),
  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  totalPrice: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
}));

interface WishlistStore {
  items: Product[];
  isOpen: boolean;
  openWishlist: () => void;
  closeWishlist: () => void;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleItem: (product: Product) => void;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  isOpen: false,
  openWishlist: () => set({ isOpen: true }),
  closeWishlist: () => set({ isOpen: false }),
  addItem: (product) => {
    if (!get().items.find((i) => i.id === product.id)) {
      set({ items: [...get().items, product] });
    }
  },
  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.id !== productId) }),
  isInWishlist: (productId) => !!get().items.find((i) => i.id === productId),
  toggleItem: (product) => {
    if (get().isInWishlist(product.id)) {
      get().removeItem(product.id);
    } else {
      get().addItem(product);
    }
  },
}));

interface CheckoutStore {
  isOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  isOpen: false,
  openCheckout: () => set({ isOpen: true }),
  closeCheckout: () => set({ isOpen: false }),
}));
