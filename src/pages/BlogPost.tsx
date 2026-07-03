import { useParams, Link } from "react-router-dom";
import { useBlogStore } from "@/stores/useBlogStore";
import { useMemo, useState, useEffect, useRef } from "react";
import { Loader2, Play, Youtube, ChevronDown, ChevronUp, Maximize2, RectangleHorizontal, RectangleVertical } from "lucide-react";
import SEOHead, { DOMAIN } from "@/components/SEOHead";
import BlogContentWithAds from "@/components/BlogContentWithAds";
import { extractYouTubeId, getYouTubeThumbnail, getYouTubeEmbedUrl, resolveVideo } from "@/lib/youtube";
import { useIsMobile } from "@/hooks/use-mobile";
import AdSlot from "@/components/AdSlot";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import type { BlogPost as BlogPostType } from "@/data/store-data";

// ---------------- Category view tracking ----------------
const CAT_VIEW_KEY = "blog-cat-views";

const trackCategoryView = (category?: string) => {
  if (!category || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CAT_VIEW_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[category] = (map[category] || 0) + 1;
    localStorage.setItem(CAT_VIEW_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

const getCategoryWeights = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CAT_VIEW_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Weighted shuffle: posts in user's preferred categories surface more often,
// but other categories are still mixed in for variety.
const weightedShuffle = (
  pool: BlogPostType[],
  weights: Record<string, number>
): BlogPostType[] => {
  return [...pool]
    .map((p) => {
      const w = (weights[p.category || ""] || 0) + 1; // base weight 1
      // Random key biased by weight (higher weight => smaller key => earlier)
      const key = -Math.log(Math.random()) / w;
      return { p, key };
    })
    .sort((a, b) => a.key - b.key)
    .map((x) => x.p);
};

const formatRelativeDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘন্টা আগে`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} দিন আগে`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} সপ্তাহ আগে`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} মাস আগে`;
  return `${Math.floor(diff / 31536000)} বছর আগে`;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, fetchPostBySlug, fetchPosts } = useBlogStore();
  const post = posts.find((b) => b.slug === slug);
  const [slugFetchDone, setSlugFetchDone] = useState(false);
  const [videoStarted, setVideoStarted] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { adsenseCode } = useSiteSettingsStore();

  // Category filter + infinite scroll state for sidebar list
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [visibleCount, setVisibleCount] = useState(15);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sticky offsets for mobile (video sticks below site header)
  const [headerH, setHeaderH] = useState(0);
  const [videoH, setVideoH] = useState(0);
  const stickyVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile) return;
    const headerEl = document.querySelector('header') as HTMLElement | null;
    const measure = () => {
      if (headerEl) setHeaderH(headerEl.offsetHeight);
      if (stickyVideoRef.current) setVideoH(stickyVideoRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerEl) ro.observe(headerEl);
    if (stickyVideoRef.current) ro.observe(stickyVideoRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [isMobile, post?.id]);


  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!slug) return;
    if (post) { setSlugFetchDone(true); return; }
    fetchPostBySlug(slug, 'post').then(() => setSlugFetchDone(true));
  }, [slug]);

  const ytId = useMemo(() => extractYouTubeId(post?.videoUrl), [post?.videoUrl]);
  const video = useMemo(() => resolveVideo(post?.videoUrl), [post?.videoUrl]);

  // Reset autoplay flag when navigating to a new post
  useEffect(() => {
    setVideoStarted(true);
  }, [slug]);

  // Track category view for personalised related-post mixing
  useEffect(() => {
    if (post?.category) trackCategoryView(post.category);
  }, [post?.id, post?.category]);

  // Detect if description content overflows the collapsed height (~4 lines)
  useEffect(() => {
    if (!descRef.current || descExpanded) return;
    const el = descRef.current;
    // Compare scrollHeight to clientHeight when collapsed
    if (el.scrollHeight > el.clientHeight + 4) {
      setDescOverflows(true);
    } else {
      setDescOverflows(false);
    }
  }, [post?.content, descExpanded]);

  const articleJsonLd = useMemo(() => post ? ({
    '@context': 'https://schema.org',
    '@type': ytId ? 'VideoObject' : 'Article',
    headline: post.title,
    name: post.title,
    description: post.metaDescription || post.excerpt,
    image: post.image || (ytId ? getYouTubeThumbnail(ytId, 'maxresdefault') : undefined),
    thumbnailUrl: ytId ? getYouTubeThumbnail(ytId, 'maxresdefault') : undefined,
    embedUrl: ytId ? getYouTubeEmbedUrl(ytId) : undefined,
    uploadDate: post.date,
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'BongoBe' },
    mainEntityOfPage: `${DOMAIN}/blog/${post.slug}`,
  }) : undefined, [post, ytId]);

  // All unique categories from published posts (for the filter slider)
  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.status === "published" && p.type === "post" && p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [posts]);

  // Full filtered + weighted-shuffled pool (no slice). Slice happens at render.
  const filteredPool = useMemo(() => {
    if (!post) return [] as BlogPostType[];
    let pool = posts.filter(
      (p) => p.id !== post.id && p.status === "published" && p.type === "post"
    );
    if (selectedCat !== "All") {
      pool = pool.filter((p) => p.category === selectedCat);
    }
    const weights = getCategoryWeights();
    return weightedShuffle(pool, weights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, post?.id, selectedCat]);

  const sidebarRelated = useMemo(
    () => filteredPool.slice(0, visibleCount),
    [filteredPool, visibleCount]
  );

  // Reset visible count whenever the filter or post changes
  useEffect(() => {
    setVisibleCount(15);
  }, [selectedCat, post?.id]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredPool.length) {
          setVisibleCount((c) => c + 15);
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [visibleCount, filteredPool.length]);

  if (!post) {
    if (!slugFetchDone) {
      return (
        <div className="container-box py-20 text-center flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold">একটু অপেক্ষা করুন...🙏</h1>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="container-box py-20 text-center">
        <h1 className="text-2xl font-bold">পোস্ট পাওয়া যায়নি</h1>
      </div>
    );
  }

  const heroImage = post.image || (ytId ? getYouTubeThumbnail(ytId, 'maxresdefault') : '');

  const videoSrc = useMemo(
    () => (video && video.isIframe ? video.src({ autoplay: true }) : ''),
    [video]
  );
  const fileSrc = useMemo(
    () => (video && !video.isIframe ? video.src() : ''),
    [video]
  );
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  // true = portrait/reel (9:16), false = landscape (16:9). Default landscape.
  const [isPortraitVideo, setIsPortraitVideo] = useState<boolean>(() => {
    const url = post?.videoUrl || '';
    return /\/shorts\//i.test(url);
  });

  useEffect(() => {
    const url = post?.videoUrl || '';
    if (/\/shorts\//i.test(url)) setIsPortraitVideo(true);
  }, [post?.videoUrl]);

  useEffect(() => {
    const el = videoWrapRef.current;
    if (!el) return;
    const onFsChange = async () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isFs = !!fsEl && (fsEl === el || el.contains(fsEl as Node));
      const so: any = (window.screen as any)?.orientation;
      try {
        if (isFs) {
          if (so?.lock) await so.lock(isPortraitVideo ? 'portrait' : 'landscape');
        } else {
          if (so?.unlock) so.unlock();
        }
      } catch {
        /* orientation lock not supported / permission denied */
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
      const so: any = (window.screen as any)?.orientation;
      try { so?.unlock?.(); } catch { /* noop */ }
    };
  }, [videoStarted, isPortraitVideo]);

  const goFullscreen = () => {
    const el: any = videoWrapRef.current;
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen;
    try { req?.call(el); } catch { /* noop */ }
  };

  const videoPlayer = video ? (
    <div
      ref={videoWrapRef}
      className="relative w-full bg-black overflow-hidden"
      style={{
        aspectRatio: isPortraitVideo ? '9 / 16' : '16 / 9',
        maxHeight: isPortraitVideo ? '85vh' : undefined,
      }}
    >
      {videoStarted ? (
        video.isIframe ? (
          <>
            <iframe
              key={videoSrc}
              src={videoSrc}
              title={post.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
            {/* Block Google Drive's top-right "Open in new tab" / popout icon */}
            {video.kind === 'gdrive' && (
              <div
                className="absolute top-0 right-0 z-10 bg-black"
                style={{ width: 44, height: 44 }}
                aria-hidden="true"
              />
            )}
            {/* Mobile-friendly aspect & fullscreen controls overlay */}
            <div className="absolute bottom-2 left-2 z-20 flex gap-2">
              <button
                type="button"
                onClick={() => setIsPortraitVideo((v) => !v)}
                className="bg-black/70 hover:bg-black/90 text-white rounded-md p-1.5 backdrop-blur-sm"
                aria-label="ভিডিও অরিয়েন্টেশন পরিবর্তন করুন"
                title={isPortraitVideo ? 'Landscape (16:9)' : 'Portrait (9:16)'}
              >
                {isPortraitVideo
                  ? <RectangleHorizontal className="w-4 h-4" />
                  : <RectangleVertical className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={goFullscreen}
                className="bg-black/70 hover:bg-black/90 text-white rounded-md p-1.5 backdrop-blur-sm"
                aria-label="ফুলস্ক্রিন"
                title="ফুলস্ক্রিন"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <video
            key={fileSrc}
            src={fileSrc}
            controls
            controlsList="nodownload"
            autoPlay
            playsInline
            poster={heroImage || undefined}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setIsPortraitVideo(v.videoHeight > v.videoWidth);
              }
            }}
            className="absolute inset-0 w-full h-full bg-black object-contain"
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setVideoStarted(true)}
          className="absolute inset-0 w-full h-full group"
          aria-label="ভিডিও প্লে করুন"
        >
          {(video.thumbnail || heroImage) && (
            <img src={video.thumbnail || heroImage} alt={post.title} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="w-9 h-9 text-white fill-white ml-1" />
            </div>
          </div>
        </button>
      )}
    </div>
  ) : null;

  // Top media: video if videoUrl is set, otherwise image (if any), otherwise nothing.
  const topMediaBlock = video
    ? videoPlayer
    : heroImage ? (
        <div className="aspect-video overflow-hidden">
          <img src={heroImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      ) : null;

  const titleAndMeta = (
    <>
      <h1 className={`text-xl sm:text-2xl font-bold mb-2 text-foreground ${isMobile ? "px-3 pt-3" : ""}`}>{post.title}</h1>
      <div className={`flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-5 flex-wrap ${isMobile ? "px-3" : ""}`}>
        {ytId && (
          <span className="inline-flex items-center gap-1 bg-red-600/10 text-red-600 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Youtube className="w-3 h-3" /> ভিডিও
          </span>
        )}
        {post.category && <span>{post.category}</span>}
        <span>·</span>
        <span>{formatRelativeDate(post.date)}</span>
        <span>·</span>
        <span>{post.author}</span>
      </div>
    </>
  );

  const descriptionBlock = post.content ? (
    <div className={isMobile ? "px-3" : ""}>
      <div
        ref={descRef}
        className="relative overflow-hidden transition-[max-height] duration-300"
        style={{ maxHeight: descExpanded ? '100000px' : '7.5em' }}
      >
        <BlogContentWithAds content={post.content} />
        {!descExpanded && descOverflows && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
      {descOverflows && (
        <button
          type="button"
          onClick={() => setDescExpanded(v => !v)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {descExpanded ? (
            <>সংক্ষিপ্ত দেখুন <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>...Read more <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  ) : null;

  // ----- Category chips (YouTube-style) -----
  const categoryChips = categories.length > 1 ? (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => setSelectedCat(cat)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            selectedCat === cat
              ? "bg-foreground text-background"
              : "bg-muted text-foreground hover:bg-muted/70"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  ) : null;

  // ----- Related video list -----
  // `layout` controls card style: "stacked" (mobile, large YouTube-style vertical cards)
  // or "horizontal" (desktop sidebar, compact horizontal cards).
  const renderRelatedList = (layout: "stacked" | "horizontal") => {
    if (filteredPool.length === 0) return null;
    const items: JSX.Element[] = [];
    sidebarRelated.forEach((rp, idx) => {
      const rpYt = extractYouTubeId(rp.videoUrl);
      const rpThumb = rp.image || (rpYt ? getYouTubeThumbnail(rpYt, "hqdefault") : "");
      if (layout === "stacked") {
        items.push(
          <Link key={rp.id} to={`/blog/${rp.slug}`} className="flex flex-col gap-2 group">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
              {rpThumb && (
                <img
                  src={rpThumb}
                  alt={rp.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              )}
              {rpYt && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                  <Play className="w-12 h-12 text-white fill-red-600 opacity-90 drop-shadow" />
                </div>
              )}
            </div>
            <div className="min-w-0 px-0.5">
              <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground">{rp.title}</h3>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{rp.author || "BongoBe"}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{formatRelativeDate(rp.date)}</div>
            </div>
          </Link>
        );
      } else {
        items.push(
          <Link key={rp.id} to={`/blog/${rp.slug}`} className="flex gap-3 group">
            <div className="relative w-44 sm:w-52 aspect-video shrink-0 rounded-lg overflow-hidden bg-muted">
              {rpThumb && (
                <img
                  src={rpThumb}
                  alt={rp.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                />
              )}
              {rpYt && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                  <Play className="w-7 h-7 text-white fill-red-600 opacity-90 drop-shadow" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-[14px] font-semibold leading-snug line-clamp-2 text-foreground">{rp.title}</h3>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{rp.author || "BongoBe"}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{formatRelativeDate(rp.date)}</div>
            </div>
          </Link>
        );
      }
      if (adsenseCode && (idx + 1) % 3 === 0 && idx !== sidebarRelated.length - 1) {
        items.push(
          <AdSlot key={`ad-side-${idx}`} html={adsenseCode} className="w-full" />
        );
      }
    });
    return (
      <>
        <div className={`flex flex-col ${layout === "stacked" ? "gap-5" : "gap-3"}`}>{items}</div>
        {/* Infinite scroll sentinel */}
        {visibleCount < filteredPool.length && (
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </>
    );
  };

  const hasRelatedSection = filteredPool.length > 0 || categories.length > 1;

  // Banner ad rendered at the start of the article body (under title/meta).
  // AdSlot returns null when adsenseCode is empty or for internal users.
  const playerBannerAd = adsenseCode ? (
    <AdSlot html={adsenseCode} className="w-full mb-4" />
  ) : null;

  // Ad above the right-side related list (desktop only).
  const sidebarTopAd = adsenseCode ? (
    <AdSlot html={adsenseCode} className="w-full mb-4" />
  ) : null;

  return (
    <div className="bg-background min-h-screen">
      <SEOHead
        title={post.title}
        description={post.metaDescription || post.excerpt}
        keywords={post.metaKeywords}
        canonical={`${DOMAIN}/blog/${post.slug}`}
        ogImage={heroImage}
        ogType="article"
        jsonLd={articleJsonLd!}
      />
      {isMobile ? (
        <div className="pb-6 relative">
          <div ref={stickyVideoRef} className="sticky z-40 bg-background" style={{ top: headerH }}>
            {topMediaBlock}
          </div>
          {/* Sticky YouTube-style category chips, pinned just under the player */}
          {categoryChips && (
            <div className="sticky z-30 bg-background border-b border-border px-3 py-2" style={{ top: headerH + videoH }}>
              {categoryChips}
            </div>
          )}

          <article className="min-w-0 pt-3">
            {titleAndMeta}
            {playerBannerAd && (
              <div className="px-3 mb-3">{playerBannerAd}</div>
            )}
            {descriptionBlock}
          </article>
          {hasRelatedSection && (
            <section className="pt-4 px-3">
              {renderRelatedList("stacked")}
            </section>
          )}
        </div>
      ) : (
        <div className="container-box pt-0 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="lg:col-span-2 min-w-0">
              {topMediaBlock && <div className="mb-4">{topMediaBlock}</div>}
              {titleAndMeta}
              {playerBannerAd}
              {descriptionBlock}
            </article>
            {hasRelatedSection && (
              <aside className="lg:col-span-1 pt-[15px]">
                {sidebarTopAd}
                {categoryChips && <div className="pb-3 mb-3">{categoryChips}</div>}
                {renderRelatedList("horizontal")}
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPost;