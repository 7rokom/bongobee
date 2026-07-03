export interface VariationPrice {
  variationType: 'color' | 'size' | 'weight';
  variationName: string;
  price?: number;
}

export interface ProductReview {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  images?: string[];
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  originalPrice?: number;
  buyPrice?: number;
  resellerPrice?: number;
  images: string[];
  featuredImage?: string;
  featuredVideo?: string;
  category: string;
  colors?: string[];
  sizes?: string[];
  weights?: string[];
  variationPrices?: VariationPrice[];
  variations?: { name: string; options: string[] }[];
  metaDescription?: string;
  metaKeywords?: string;
  stockType?: 'self' | 'vendor';
  stockProductName?: string;
  status?: 'published' | 'draft';
  inStock: boolean;
  rating: number;
  reviewCount: number;
  reviews?: ProductReview[];
  freeDelivery?: boolean;
  /** Affiliate product: order button opens external URL instead of cart/checkout */
  isAffiliate?: boolean;
  /** External affiliate URL (e.g. Amazon link). Used only when isAffiliate is true. */
  affiliateUrl?: string;
  /** Custom text for the order button when isAffiliate is true. Defaults to "এখনই অর্ডার করুন". */
  affiliateButtonText?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Background image URL for category card (optional) */
  icon: string;
  /** Lucide icon name (PascalCase, e.g. "ShoppingBag") shown in menus/sidebars */
  lucideIcon?: string;
  productCount: number;
  parentId?: string | null;
  isMain?: boolean;
  /** Display sort order (lower = first). */
  sortOrder?: number;
  /** Custom URL override; if set, category card links here. */
  customLink?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  galleryImages?: string[];
  date: string;
  author: string;
  category: string;
  type: 'post' | 'page';
  status: 'published' | 'draft';
  metaDescription?: string;
  metaKeywords?: string;
  /** YouTube video URL — if set, post displays as YouTube-style video */
  videoUrl?: string;
}
