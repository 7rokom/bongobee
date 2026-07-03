import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Youtube } from "lucide-react";
import { useBlogStore } from "@/stores/useBlogStore";
import SEOHead, { DOMAIN } from "@/components/SEOHead";
import { useResellerSlug } from "@/contexts/ResellerRefContext";
import Breadcrumbs from "@/components/Breadcrumbs";
import { extractYouTubeId, getYouTubeThumbnail, resolveVideo } from "@/lib/youtube";

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

const Blog = () => {
  const { posts, fetchPosts, loading, initialized } = useBlogStore();
  const resellerRef = useResellerSlug();
  const [activeCat, setActiveCat] = useState('সব');
  // Random seed generated once per mount → posts re-shuffle on every page refresh
  const [seed] = useState(() => Math.random());

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const publishedPosts = useMemo(() => {
    const list = posts.filter((p) => p.status === 'published' && p.type === 'post');
    // Seeded Fisher-Yates shuffle so order is stable within a page view but
    // changes on every refresh.
    let s = Math.floor(seed * 2 ** 31) || 1;
    const rand = () => {
      // xorshift32
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 1_000_000) / 1_000_000;
    };
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [posts, seed]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    publishedPosts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['সব', ...Array.from(set)];
  }, [publishedPosts]);

  const filteredPosts = useMemo(
    () => (activeCat === 'সব' ? publishedPosts : publishedPosts.filter((p) => p.category === activeCat)),
    [publishedPosts, activeCat]
  );

  return (
    <div className="bg-background min-h-screen">
      <SEOHead
        title="ব্লগ ভিডিও — BongoBe"
        description="BongoBe ব্লগ — ভিডিও রিভিউ, টিপস এবং ট্রেন্ড YouTube স্টাইলে দেখুন।"
        canonical={`${DOMAIN}/blog`}
      />
      <div className="container-box py-6">
        <Breadcrumbs items={[{ label: 'ব্লগ' }]} />

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide -mx-3 px-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeCat === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-foreground hover:bg-muted/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading && !initialized ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            পোস্ট লোড হচ্ছে...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {filteredPosts.map((post) => {
                const ytId = extractYouTubeId(post.videoUrl);
                const hasVideo = !!resolveVideo(post.videoUrl);
                const thumb = post.image || (ytId ? getYouTubeThumbnail(ytId, 'hqdefault') : '');
                return (
                  <Link
                    key={post.id}
                    to={resellerRef ? `/r/${resellerRef}/blog/${post.slug}` : `/blog/${post.slug}`}
                    className="group flex flex-col"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                      {thumb && (
                        <img
                          src={thumb}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          loading="lazy"
                        />
                      )}
                      {hasVideo && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          <Youtube className="w-3 h-3" /> ভিডিও
                        </span>
                      )}
                      {hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                          <div className="w-14 h-14 rounded-full bg-red-600/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-3 px-1">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground">
                          {post.title}
                        </h2>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {post.author || 'BongoBe'}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {post.category && <>{post.category} · </>}
                          {formatRelativeDate(post.date)}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {filteredPosts.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                কোন ভিডিও/পোস্ট পাওয়া যায়নি
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Blog;