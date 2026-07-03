import { useParams, Link } from "react-router-dom";
import { useBlogStore } from "@/stores/useBlogStore";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import SEOHead, { DOMAIN } from "@/components/SEOHead";
import BlogContentWithAds from "@/components/BlogContentWithAds";

const PageView = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, fetchPostBySlug } = useBlogStore();
  const page = posts.find((p) => p.slug === slug && p.type === 'page');
  const [slugFetchDone, setSlugFetchDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (page) { setSlugFetchDone(true); return; }
    fetchPostBySlug(slug, 'page').then(() => setSlugFetchDone(true));
  }, [slug]);

  if (!page) {
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
        <h1 className="text-2xl font-bold">পেজ পাওয়া যায়নি</h1>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <SEOHead
        title={`${page.title} — BongoBe`}
        description={page.metaDescription || page.excerpt}
        canonical={`${DOMAIN}/page/${page.slug}`}
      />
      <div className="container-box py-8 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          হোমপেজে ফিরুন
        </Link>

        <article>
          {page.image && (
            <div className="aspect-video rounded-2xl overflow-hidden mb-6">
              <img src={page.image} alt={page.title} className="w-full h-full object-cover" />
            </div>
          )}

          <h1 className="text-3xl font-bold mb-6">{page.title}</h1>

          <BlogContentWithAds content={page.content} />
        </article>
      </div>
    </div>
  );
};

export default PageView;
