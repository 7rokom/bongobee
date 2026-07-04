import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface HomepageCategorySection {
  id: string; categorySlug: string; title: string; productCount: number; order: number;
}

export interface LegalPageLink {
  label: string; url: string; icon: string;
}

export interface CategoryHierarchyEntry {
  parentId: string | null;
  isMain: boolean;
  /** Lucide icon name (PascalCase) shown in menus/sidebars */
  lucideIcon?: string;
  /** Display sort order (lower = first). */
  sortOrder?: number;
  /** Custom link override (if set, used instead of /shop?category=slug) */
  customLink?: string;
}

export interface SiteSettings {
  siteName: string; tagline: string; primaryColor: string; secondaryColor: string; logoUrl: string; faviconUrl: string;
  address: string; phone: string; email: string; whatsappNumber: string;
  facebookUrl: string; youtubeUrl: string; twitterUrl: string; linkedinUrl: string; pinterestUrl: string;
  legalPages: LegalPageLink[];
  siteMetaDescription: string;
  googleVerificationCode: string;
  homepageSections: HomepageCategorySection[];
  desktopMenuCategories: string[];
  mobileMenuCategories: string[];
  headerCode: string; bodyCode: string; footerCode: string;
  digitalHeaderCode: string; digitalBodyCode: string; digitalFooterCode: string;
  adsenseCode: string; adsTxtCode: string;
  footerCredit: string;
  // Design customization
  homeProductsPerRow: number;
  homeProductsPerRowMobile: number;
  shopProductsPerRow: number;
  shopProductsPerRowMobile: number;
  cardTitleSize: number;
  cardTitleSizeMobile: number;
  cardPriceSize: number;
  cardButtonTextSize: number;
  productPageTitleSize: number;
  productPageDescSize: number;
  homeFeaturedCategoriesCount: number;
  homeBestSellingCount: number;
  // Category hierarchy: { [categoryId]: { parentId, isMain } }
  categoryHierarchy: Record<string, CategoryHierarchyEntry>;
  // SMS Gateway (legacy Android relay)
  smsGatewayApiKey: string;
  // bulksmsbd.net API
  bulkSmsApiKey: string;
  bulkSmsSenderId: string;
  smsPendingEnabled: boolean;
  smsPendingTemplate: string;
  smsConfirmedEnabled: boolean;
  smsConfirmedTemplate: string;
  smsFollowupEnabled: boolean;
  smsFollowupTemplate: string;
  smsShipmentEnabled: boolean;
  smsShipmentTemplate: string;
  smsHoldEnabled: boolean;
  smsHoldTemplate: string;
  // Manual SMS preset templates for হোল্ড / ফলোয়াপ status (multiple presets)
  smsHoldTemplates: Array<{ name: string; body: string }>;
  smsFollowupTemplates: Array<{ name: string; body: string }>;
  courierTrackingBase: string;
  // Hero section
  heroTitle: string;
  heroSubtitle: string;
  heroBackgroundImage: string;
  // Product page ad slot (HTML, shown above trust badges)
  productPageAdCode: string;
  // Product page global voice/audio
  productAudioUrl: string;
  productAudioEnabled: boolean;
  // Checkout page voice/audio
  checkoutAudioUrl: string;
  checkoutAudioEnabled: boolean;
  // Thank-you page voice/audio (played when customer chose "call before shipping")
  thankYouAudioUrl: string;
  thankYouAudioEnabled: boolean;
  // Thank-you page voice/audio for "direct ship" choice (auto-confirmed orders)
  thankYouDirectAudioUrl: string;
  thankYouDirectAudioEnabled: boolean;
  // Link shortener gateway (for non-product custom URLs)
  linkGatewayEnabled: boolean;
  linkGatewayPostSlug: string;
  linkGatewayTimer1: number;
  linkGatewayTimer2: number;
  linkGatewayTimer3: number;
  linkGatewayBtn1Text: string;
  linkGatewayBtn2Text: string;
  linkGatewayBtn3Text: string;
  linkGatewayBtnFinalText: string;
  linkGatewayPopupTitle: string;
  linkGatewayPopupText: string;
  linkGatewayAdTop: string;
  linkGatewayAdBottom: string;
  // Push notification prompt (legacy — kept for backward-compat; mirrors `main` section)
  pushPromptEnabled: boolean;
  pushPromptTitle: string;
  pushPromptBody: string;
  pushPromptButtonText: string;
  // Post-subscribe success popup (legacy — kept for backward-compat; mirrors `main` section)
  pushSubscribedPopupEnabled: boolean;
  pushSubscribedPopupHeading: string;
  pushSubscribedCouponCode: string;
  // Reseller-specific toggles
  smsResellerEnabled: boolean;
  pushPromptResellerEnabled: boolean;
  // Per-section push notification configuration
  pushSections: Record<'main' | 'digital' | 'blog' | 'reseller', {
    promptEnabled: boolean;
    promptTitle: string;
    promptBody: string;
    promptButtonText: string;
    couponPopupEnabled: boolean;
    couponPopupHeading: string;
    couponCode: string;
  }>;
  // Cache versions — bumped by admin "Refresh Cache" button to invalidate
  // long-lived browser caches (products = 7 days, mohasagor = 30 days)
  productsCacheVersion: number;
  mohasagorCacheVersion: number;
  // Custom domain server IP — shown in reseller DNS instructions
  customDomainServerIp: string;
}


interface SiteSettingsStore extends SiteSettings {
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<SiteSettings>) => Promise<void>;
  addHomepageSection: (section: HomepageCategorySection) => void;
  removeHomepageSection: (id: string) => void;
  updateHomepageSection: (id: string, updates: Partial<HomepageCategorySection>) => void;
  reorderHomepageSections: (sections: HomepageCategorySection[]) => void;
}

const defaultSettings: SiteSettings = {
  siteName: 'BongoBee | Best Online Shop', tagline: 'আপনার বিশ্বস্ত অনলাইন শপ',
  primaryColor: '156 99% 36%', secondaryColor: '160 53% 35%', logoUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiuzxV6RAai9nkkRjWf6ZEL50oBSOjPIyxNMRIVj8-X8dDkr2hScbGzPt6fZiepBt-VcWCfTo0lgKLw-s1sDfypQ2vYdeqSULHz4F_JtaePzT67609KkvQMC6-NZBmdqNweci664OCAd7LUwSJSm6qJzxqdeiSmxj3B0Ev_q7ULAA_9yW3ZGELrOpeEixk/s1068/converted_image_2%20(3).webp', faviconUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEilmT3NsAkGKwe-ysQMCZ0CjmVsN-w1JGGjiWMShT_UH8tH3vxdhgF1s5RjTSO9CD65Zf_-3Pbh1wvX7roPje9HLFAEq9xjRAUaqlvGwS4pJgkfQ_eVf01nSgWcA4cXf4nMEkVDvBdYyp2Y8-eMLvkI0Ehe0_oOwykQZ9mU6Hvjivu384WkTF0sWnMnl9k/s1080/converted_image_1%20(5).webp',
  address: 'Maniknagor Pukur Par, Mugda, Dhaka', phone: '01948818255',
  email: 'info@BongoBe.com', whatsappNumber: '01948818255',
  facebookUrl: 'https://facebook.com', youtubeUrl: 'https://youtube.com',
  twitterUrl: 'https://twitter.com', linkedinUrl: 'https://linkedin.com', pinterestUrl: '',
  legalPages: [
    { label: 'About Us', url: '/page/about-us', icon: 'User' },
    { label: 'Contact Us', url: '/page/contact-us', icon: 'PhoneCall' },
    { label: 'Privacy Policy', url: '/page/privacy-policy', icon: 'ShieldQuestion' },
    { label: 'Terms of Services', url: '/page/terms-of-services', icon: 'HelpCircle' },
    { label: 'Refund & Returns', url: '/page/refund-returns', icon: 'FileText' },
  ],
  siteMetaDescription: '', googleVerificationCode: '',
  homepageSections: [
    { id: '1', categorySlug: 'gadget-accessories', title: 'গ্যাজেট এক্সেসরিজ', productCount: 6, order: 1 },
    { id: '2', categorySlug: 'kitchen-accessories', title: 'কিচেন এক্সেসরিজ', productCount: 6, order: 2 },
    { id: '3', categorySlug: 'mens-fashion', title: 'মেনস ফ্যাশন', productCount: 6, order: 3 },
    { id: '4', categorySlug: 'womens-fashion', title: 'উইমেনস ফ্যাশন', productCount: 6, order: 4 },
  ],
  desktopMenuCategories: ['button-phone', 'gadget-accessories', 'kitchen-accessories', 'mens-fashion', 'womens-fashion'],
  mobileMenuCategories: ['button-phone', 'gadget-accessories', 'kitchen-accessories', 'mens-fashion', 'womens-fashion'],
  headerCode: '', bodyCode: '', footerCode: '',
  digitalHeaderCode: '', digitalBodyCode: '', digitalFooterCode: '',
  adsenseCode: '', adsTxtCode: '',
  footerCredit: '© 2026 BongoBee All Rights Reserved.',
  homeProductsPerRow: 6,
  homeProductsPerRowMobile: 2,
  shopProductsPerRow: 4,
  shopProductsPerRowMobile: 2,
  cardTitleSize: 15,
  cardTitleSizeMobile: 13,
  cardPriceSize: 18,
  cardButtonTextSize: 16,
  productPageTitleSize: 25,
  productPageDescSize: 18,
  homeFeaturedCategoriesCount: 5,
  homeBestSellingCount: 6,
  categoryHierarchy: {},
  smsGatewayApiKey: '',
  bulkSmsApiKey: '',
  bulkSmsSenderId: '',
  smsPendingEnabled: false,
  smsPendingTemplate: 'প্রিয় {customer_name}!\n\nBongoBee-তে আপনার অর্ডারটি পেন্ডিং আছে। অর্ডার আইডিঃ {order_id}\nযেকোনো প্রয়োজনে যোগাযোগ করুনঃ {whatsapp}',
  smsConfirmedEnabled: false,
  smsConfirmedTemplate: 'প্রিয় {customer_name}!\nBongoBee-তে আপনার করা অর্ডার কনফার্ম হয়েছে।\nঅর্ডার আইডিঃ {order_id}\nপ্রডাক্টঃ {products}\nমোটঃ {total} টাকা\n\nজরুরি প্রয়োজনে হোয়াটসঅ্যাপে মেসেজ করুনঃ {whatsapp}',
  smsFollowupEnabled: false,
  smsFollowupTemplate: 'প্রিয় {customer_name}!\n\nBongoBee-তে আপনার করা প্রডাক্টটি আপনার ঠিকানায় পৌঁছে গেছে। দয়া করে ডেলিভারি ম্যানের সাথে যোগাযোগ করে প্রডাক্টটি রিসিভ করে নিবেন। ধন্যবাদ!\n\nঅর্ডার ট্র্যাকিং লিংকঃ {courier_link}',
  smsShipmentEnabled: false,
  smsShipmentTemplate: 'প্রিয় {customer_name}!\n\nBongoBee-তে আপনার করা অর্ডারটি কুরিয়ারে পাঠানো হয়েছে।\nঅর্ডার আইডিঃ {order_id}\n\nঅর্ডার ট্র্যাকিং লিংকঃ {courier_link}',
  smsHoldEnabled: false,
  smsHoldTemplate: 'প্রিয় {customer_name}!\n\nBongoBee-তে আপনার করা অর্ডারটি (আইডিঃ {order_id}) আপাতত হোল্ডে রাখা হয়েছে। যেকোন প্রয়োজনে হোয়াটসঅ্যাপে যোগাযোগ করুনঃ {whatsapp}',
  smsHoldTemplates: [
    { name: 'ডিফল্ট হোল্ড', body: 'প্রিয় {customer_name}!\n\nআপনার অর্ডারটি (আইডিঃ {order_id}) আপাতত হোল্ডে রাখা হয়েছে। যেকোন প্রয়োজনে যোগাযোগ করুনঃ {whatsapp}' },
  ],
  smsFollowupTemplates: [
    { name: 'ডিফল্ট ফলোয়াপ', body: 'প্রিয় {customer_name}!\n\nআপনার অর্ডারটি (আইডিঃ {order_id}) ডেলিভারির জন্য পাঠানো হয়েছে। ট্র্যাকিং লিংকঃ {courier_link}\n\nযোগাযোগঃ {whatsapp}' },
  ],
  courierTrackingBase: 'https://steadfast.com.bd/t/',
  heroTitle: 'বাংলাদেশের সেরা\nঅনলাইন শপিং প্ল্যাটফর্ম',
  heroSubtitle: 'আমরা নিয়ে এসেছি ট্রেন্ডি গ্যাজেট, স্মার্টওয়াচ ও প্রয়োজনীয় পণ্যের সেরা সংগ্রহ—সঠিক দামে, দ্রুত ডেলিভারি এবং ক্যাশ অন ডেলিভারি সুবিধাসহ। নিরাপদ শপিং, নিশ্চিন্ত কেনাকাটা।',
  heroBackgroundImage: '/images/hero-bg.png',
  productPageAdCode: '',
  productAudioUrl: '',
  productAudioEnabled: false,
  checkoutAudioUrl: '',
  checkoutAudioEnabled: false,
  thankYouAudioUrl: '',
  thankYouAudioEnabled: false,
  thankYouDirectAudioUrl: '',
  thankYouDirectAudioEnabled: false,
  linkGatewayEnabled: true,
  linkGatewayPostSlug: '',
  linkGatewayTimer1: 10,
  linkGatewayTimer2: 10,
  linkGatewayTimer3: 10,
  linkGatewayBtn1Text: 'পরবর্তী ধাপে যান',
  linkGatewayBtn2Text: 'পোস্ট পড়ুন',
  linkGatewayBtn3Text: 'শেষ ধাপে যান',
  linkGatewayBtnFinalText: 'মূল লিংকে যান',
  linkGatewayPopupTitle: 'আপনার লিংক প্রস্তুত!',
  linkGatewayPopupText: 'অপেক্ষা করার জন্য ধন্যবাদ। নিচের বাটনে ক্লিক করে আপনার গন্তব্যে পৌঁছান।',
  linkGatewayAdTop: '',
  linkGatewayAdBottom: '',
  pushPromptEnabled: true,
  pushPromptTitle: 'নতুন অফার ও আপডেট পেতে চান?',
  pushPromptBody: 'নিয়মিত নতুন প্রোডাক্টের স্পেশাল ডিসকাউন্ট অফার সবার আগে পেতে চাইলে এখনই বলুন।',
  pushPromptButtonText: 'হ্যাঁ, পাঠান',
  pushSubscribedPopupEnabled: true,
  pushSubscribedPopupHeading: '🎉 অভিনন্দন! আপনার জন্য স্পেশাল অফার',
  pushSubscribedCouponCode: 'WELCOME10',
  smsResellerEnabled: true,
  pushPromptResellerEnabled: false,
  pushSections: {
    main: {
      promptEnabled: true,
      promptTitle: 'নতুন অফার ও আপডেট পেতে চান?',
      promptBody: 'নিয়মিত নতুন প্রোডাক্টের স্পেশাল ডিসকাউন্ট অফার সবার আগে পেতে চাইলে এখনই বলুন।',
      promptButtonText: 'হ্যাঁ, পাঠান',
      couponPopupEnabled: true,
      couponPopupHeading: '🎉 অভিনন্দন! আপনার জন্য স্পেশাল অফার',
      couponCode: 'WELCOME10',
    },
    digital: {
      promptEnabled: true,
      promptTitle: 'নতুন ডিজিটাল প্রোডাক্ট আসলে জানতে চান?',
      promptBody: 'নতুন ডিজিটাল প্রোডাক্ট, কোর্স ও আপডেট সবার আগে পেতে চাইলে নোটিফিকেশন চালু করুন।',
      promptButtonText: 'হ্যাঁ, পাঠান',
      couponPopupEnabled: false,
      couponPopupHeading: '',
      couponCode: '',
    },
    blog: {
      promptEnabled: true,
      promptTitle: 'নতুন ব্লগ পোস্ট পড়তে চান?',
      promptBody: 'নতুন আর্টিকেল প্রকাশ হওয়ার সাথে সাথে নোটিফিকেশন পেতে চাইলে এখনই চালু করুন।',
      promptButtonText: 'হ্যাঁ, পাঠান',
      couponPopupEnabled: false,
      couponPopupHeading: '',
      couponCode: '',
    },
    reseller: {
      promptEnabled: false,
      promptTitle: 'নতুন অফার ও আপডেট পেতে চান?',
      promptBody: 'নতুন প্রোডাক্ট ও ডিসকাউন্ট অফার সবার আগে পেতে নোটিফিকেশন চালু করুন।',
      promptButtonText: 'হ্যাঁ, পাঠান',
      couponPopupEnabled: true,
      couponPopupHeading: '🎉 অভিনন্দন! আপনার জন্য স্পেশাল অফার',
      couponCode: 'WELCOME10',
    },
  },
  productsCacheVersion: 1,
  mohasagorCacheVersion: 1,
  customDomainServerIp: '',
};


let settingsFetched = false;
let settingsInflight: Promise<void> | null = null;

export const useSiteSettingsStore = create<SiteSettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      loading: false,

      fetchSettings: async () => {
        // Dedupe: avoid duplicate fetches from DataInitializer + SiteSettingsInitializer
        if (settingsFetched && !settingsInflight) return;
        if (settingsInflight) return settingsInflight;
        set({ loading: true });
        settingsInflight = (async () => {
          try {
            const data = await api.get('/public/site-settings');
            if (data && typeof data === 'object' && Object.keys(data).length) {
              // Deep-merge pushSections so fields added in newer versions of the
              // schema are filled in from defaults even when DB has old data.
              if (data.pushSections && typeof data.pushSections === 'object') {
                const secs = ['main', 'digital', 'blog', 'reseller'] as const;
                data.pushSections = secs.reduce((acc, s) => {
                  acc[s] = { ...defaultSettings.pushSections[s], ...(data.pushSections[s] ?? {}) };
                  return acc;
                }, {} as typeof defaultSettings.pushSections);
              }
              set({ ...data });
            }
          } catch { /* keep defaults */ }
          settingsFetched = true;
          settingsInflight = null;
          set({ loading: false });
        })();
        return settingsInflight;
      },

  updateSettings: async (updates) => {
    set((s) => ({ ...s, ...updates }));
    // Save full settings to DB
    const state = get();
    const allSettings: SiteSettings = {
      siteName: state.siteName, tagline: state.tagline, primaryColor: state.primaryColor, secondaryColor: state.secondaryColor,
      logoUrl: state.logoUrl, faviconUrl: state.faviconUrl, address: state.address,
      phone: state.phone, email: state.email, whatsappNumber: state.whatsappNumber,
      facebookUrl: state.facebookUrl, youtubeUrl: state.youtubeUrl, twitterUrl: state.twitterUrl,
      linkedinUrl: state.linkedinUrl, pinterestUrl: state.pinterestUrl, legalPages: state.legalPages,
      siteMetaDescription: state.siteMetaDescription, googleVerificationCode: state.googleVerificationCode,
      homepageSections: state.homepageSections,
      desktopMenuCategories: state.desktopMenuCategories, mobileMenuCategories: state.mobileMenuCategories,
      headerCode: state.headerCode, bodyCode: state.bodyCode, footerCode: state.footerCode,
      digitalHeaderCode: state.digitalHeaderCode ?? '', digitalBodyCode: state.digitalBodyCode ?? '', digitalFooterCode: state.digitalFooterCode ?? '',
      adsenseCode: state.adsenseCode, adsTxtCode: state.adsTxtCode,
      footerCredit: state.footerCredit,
      homeProductsPerRow: state.homeProductsPerRow, homeProductsPerRowMobile: state.homeProductsPerRowMobile,
      shopProductsPerRow: state.shopProductsPerRow, shopProductsPerRowMobile: state.shopProductsPerRowMobile,
      cardTitleSize: state.cardTitleSize, cardTitleSizeMobile: state.cardTitleSizeMobile ?? 13, cardPriceSize: state.cardPriceSize, cardButtonTextSize: state.cardButtonTextSize,
      productPageTitleSize: state.productPageTitleSize, productPageDescSize: state.productPageDescSize,
      homeFeaturedCategoriesCount: state.homeFeaturedCategoriesCount ?? 5,
      homeBestSellingCount: state.homeBestSellingCount ?? 6,
      categoryHierarchy: state.categoryHierarchy || {},
      smsGatewayApiKey: state.smsGatewayApiKey || '',
      bulkSmsApiKey: state.bulkSmsApiKey ?? '',
      bulkSmsSenderId: state.bulkSmsSenderId ?? '',
      smsPendingEnabled: state.smsPendingEnabled ?? false,
      smsPendingTemplate: state.smsPendingTemplate ?? defaultSettings.smsPendingTemplate,
      smsConfirmedEnabled: state.smsConfirmedEnabled ?? false,
      smsConfirmedTemplate: state.smsConfirmedTemplate ?? defaultSettings.smsConfirmedTemplate,
      smsFollowupEnabled: state.smsFollowupEnabled ?? false,
      smsFollowupTemplate: state.smsFollowupTemplate ?? defaultSettings.smsFollowupTemplate,
      smsShipmentEnabled: state.smsShipmentEnabled ?? false,
      smsShipmentTemplate: state.smsShipmentTemplate ?? defaultSettings.smsShipmentTemplate,
      smsHoldEnabled: state.smsHoldEnabled ?? false,
      smsHoldTemplate: state.smsHoldTemplate ?? defaultSettings.smsHoldTemplate,
      smsHoldTemplates: state.smsHoldTemplates ?? defaultSettings.smsHoldTemplates,
      smsFollowupTemplates: state.smsFollowupTemplates ?? defaultSettings.smsFollowupTemplates,
      courierTrackingBase: state.courierTrackingBase ?? defaultSettings.courierTrackingBase,
      heroTitle: state.heroTitle ?? defaultSettings.heroTitle,
      heroSubtitle: state.heroSubtitle ?? defaultSettings.heroSubtitle,
      heroBackgroundImage: state.heroBackgroundImage ?? defaultSettings.heroBackgroundImage,
      productPageAdCode: state.productPageAdCode ?? '',
      productAudioUrl: state.productAudioUrl ?? '',
      productAudioEnabled: state.productAudioEnabled ?? false,
      checkoutAudioUrl: state.checkoutAudioUrl ?? '',
      checkoutAudioEnabled: state.checkoutAudioEnabled ?? false,
      thankYouAudioUrl: state.thankYouAudioUrl ?? '',
      thankYouAudioEnabled: state.thankYouAudioEnabled ?? false,
      thankYouDirectAudioUrl: state.thankYouDirectAudioUrl ?? '',
      thankYouDirectAudioEnabled: state.thankYouDirectAudioEnabled ?? false,
      linkGatewayEnabled: state.linkGatewayEnabled ?? true,
      linkGatewayPostSlug: state.linkGatewayPostSlug ?? '',
      linkGatewayTimer1: state.linkGatewayTimer1 ?? 10,
      linkGatewayTimer2: state.linkGatewayTimer2 ?? 10,
      linkGatewayTimer3: state.linkGatewayTimer3 ?? 10,
      linkGatewayBtn1Text: state.linkGatewayBtn1Text ?? defaultSettings.linkGatewayBtn1Text,
      linkGatewayBtn2Text: state.linkGatewayBtn2Text ?? defaultSettings.linkGatewayBtn2Text,
      linkGatewayBtn3Text: state.linkGatewayBtn3Text ?? defaultSettings.linkGatewayBtn3Text,
      linkGatewayBtnFinalText: state.linkGatewayBtnFinalText ?? defaultSettings.linkGatewayBtnFinalText,
      linkGatewayPopupTitle: state.linkGatewayPopupTitle ?? defaultSettings.linkGatewayPopupTitle,
      linkGatewayPopupText: state.linkGatewayPopupText ?? defaultSettings.linkGatewayPopupText,
      linkGatewayAdTop: state.linkGatewayAdTop ?? '',
      linkGatewayAdBottom: state.linkGatewayAdBottom ?? '',
      pushPromptEnabled: state.pushPromptEnabled ?? true,
      pushPromptTitle: state.pushPromptTitle ?? defaultSettings.pushPromptTitle,
      pushPromptBody: state.pushPromptBody ?? defaultSettings.pushPromptBody,
      pushPromptButtonText: state.pushPromptButtonText ?? defaultSettings.pushPromptButtonText,
      pushSubscribedPopupEnabled: state.pushSubscribedPopupEnabled ?? true,
      pushSubscribedPopupHeading: state.pushSubscribedPopupHeading ?? defaultSettings.pushSubscribedPopupHeading,
      pushSubscribedCouponCode: state.pushSubscribedCouponCode ?? defaultSettings.pushSubscribedCouponCode,
      smsResellerEnabled: state.smsResellerEnabled ?? true,
      pushPromptResellerEnabled: state.pushPromptResellerEnabled ?? false,
      pushSections: state.pushSections ?? defaultSettings.pushSections,
      productsCacheVersion: state.productsCacheVersion ?? 1,
      mohasagorCacheVersion: state.mohasagorCacheVersion ?? 1,
    };
    try { await api.put('/admin/site-settings', allSettings); } catch (e) { console.warn('[siteSettings save] failed', e); }
  },

  addHomepageSection: (section) => {
    set((s) => ({ homepageSections: [...s.homepageSections, section] }));
    setTimeout(() => get().updateSettings({}), 0);
  },
  removeHomepageSection: (id) => {
    set((s) => ({ homepageSections: s.homepageSections.filter((sec) => sec.id !== id) }));
    setTimeout(() => get().updateSettings({}), 0);
  },
  updateHomepageSection: (id, updates) => {
    set((s) => ({ homepageSections: s.homepageSections.map((sec) => sec.id === id ? { ...sec, ...updates } : sec) }));
    setTimeout(() => get().updateSettings({}), 0);
  },
  reorderHomepageSections: (sections) => {
    set({ homepageSections: sections });
    setTimeout(() => get().updateSettings({}), 0);
  },
    }),
    {
      name: 'cache-site-settings',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except transient loading flag
      partialize: ({ loading, ...rest }) => rest as any,
    }
  )
);
