import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useBlogStore } from '@/stores/useBlogStore';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import BlogContentWithAds from '@/components/BlogContentWithAds';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Step = 1 | 2 | 3 | 4;

/**
 * Gateway-specific ad renderer. Unlike the global AdSlot, this does NOT
 * suppress ads for logged-in admins — gateway pages are public monetised
 * pages and must show ads to every visitor.
 *
 * The ad code stored in linkGatewayAdTop / linkGatewayAdBottom is ONLY
 * rendered here on /go/:slug pages and nowhere else in the app.
 */
const GatewayAdSlot = ({ html, className }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !html) return;
    el.innerHTML = html;
    // Re-execute <script> tags so AdSense / pixel scripts fire correctly.
    el.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      old.parentNode?.replaceChild(s, old);
    });
  }, [html]);
  if (!html) return null;
  return <div ref={ref} className={className} />;
};

const AdBox = ({ html, label }: { html: string; label: string }) => {
  if (!html) {
    return (
      <div className="my-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 py-3 text-center text-xs text-muted-foreground">
        {label}
      </div>
    );
  }
  return <GatewayAdSlot html={html} className="my-4 flex justify-center" />;
};

const TimerCard = ({
  seconds,
  onDone,
  buttonText,
  ready,
  onClick,
  adTop,
  adBottom,
}: {
  seconds: number;
  onDone: () => void;
  buttonText: string;
  ready: boolean;
  onClick: () => void;
  adTop: string;
  adBottom: string;
}) => {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) { onDone(); return; }
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); onDone(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <AdBox html={adTop} label="অ্যাড স্পেস (উপরে)" />
      <div className="flex flex-col items-center gap-3 py-4">
        {!ready ? (
          <>
            <div className="text-sm text-muted-foreground">🙏Please wait...</div>
            <div className="text-4xl font-bold tabular-nums text-primary">
              {remaining}
              <span className="text-base font-normal text-muted-foreground"> সেকেন্ড</span>
            </div>
          </>
        ) : (
          <Button size="lg" className="text-base px-8" onClick={onClick}>
            {buttonText} →
          </Button>
        )}
      </div>
      <AdBox html={adBottom} label="অ্যাড স্পেস (নিচে)" />
    </div>
  );
};

const isInternalUrl = (url: string): boolean => {
  try {
    return new URL(url).hostname === window.location.hostname;
  } catch {
    return false;
  }
};

const GoLink = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const directUrl = searchParams.get('url');
  const settings = useSiteSettingsStore();
  const { posts, fetchPosts, fetchPostBySlug } = useBlogStore();
  const [step, setStep] = useState<Step>(1);
  const [ready, setReady] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const incrementedRef = useRef(false);

  // Resolve target — either from ?url= (embed script) or short_links table (slug)
  useEffect(() => {
    // Direct external URL via ?url= (from embed snippet on third-party sites)
    if (directUrl) {
      try {
        const u = new URL(directUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          setLoadError('অসমর্থিত লিংক');
          return;
        }
        setTargetUrl(u.toString());
      } catch {
        setLoadError('সঠিক URL দিন');
      }
      return;
    }
    if (!slug) return;
    (async () => {
      let data: { target_url?: string | null } | null = null;
      try {
        data = await api.get(`/public/short-links/${slug}`);
      } catch {
        data = null;
      }
      if (!data?.target_url) {
        setLoadError('এই শর্ট লিংকটি পাওয়া যায়নি');
        return;
      }
      setTargetUrl(data.target_url);
      if (!incrementedRef.current) {
        incrementedRef.current = true;
        api.post(`/public/short-links/${slug}/click`, {}).catch(() => {});
      }
    })();
  }, [slug, directUrl]);

  // Bypass the gateway entirely for internal (same-domain) links
  useEffect(() => {
    if (targetUrl && isInternalUrl(targetUrl)) {
      window.location.replace(targetUrl);
    }
  }, [targetUrl]);

  // Load blog posts
  useEffect(() => {
    if (posts.length === 0) fetchPosts();
  }, []); // eslint-disable-line

  // Pick a random post per visit so different posts get traffic.
  // If linkGatewayPostSlug is set, treat it as a comma-separated allow-list
  // and pick randomly from those; otherwise pick from all published posts.
  const eligiblePosts = useMemo(() => {
    const all = posts.filter((p) => p.type !== 'page' && p.status !== 'draft');
    const raw = (settings.linkGatewayPostSlug || '').trim();
    if (!raw) return all;
    const allowed = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
    const filtered = all.filter((p) => allowed.has(p.slug));
    return filtered.length > 0 ? filtered : all;
  }, [posts, settings.linkGatewayPostSlug]);

  const gatewayPost = useMemo(() => {
    if (eligiblePosts.length === 0) return null;
    const idx = Math.floor(Math.random() * eligiblePosts.length);
    return eligiblePosts[idx];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligiblePosts.length, slug]);

  const recentPosts = useMemo(
    () => posts.filter((p) => p.type !== 'page' && p.status !== 'draft').slice(0, 6),
    [posts]
  );

  // Scroll to bottom when entering step 3
  useEffect(() => {
    if (step === 3) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const goNext = (n: Step) => {
    setReady(false);
    setStep(n);
  };

  if (loadError) {
    return (
      <>
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-bold text-destructive mb-2">404</h1>
            <p className="text-muted-foreground">{loadError}</p>
            <Link to="/" className="inline-block mt-4 text-primary hover:underline">হোমে ফিরে যান</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!targetUrl) {
    return (
      <>
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="bg-background">
        <div className="container max-w-3xl mx-auto px-3 py-6">
        {/* Step 1: Blog index style with top timer */}
        {step === 1 && (
          <>
            <TimerCard
              seconds={settings.linkGatewayTimer1}
              onDone={() => setReady(true)}
              ready={ready}
              buttonText={settings.linkGatewayBtn1Text}
              onClick={() => goNext(2)}
              adTop={settings.linkGatewayAdTop}
              adBottom={settings.linkGatewayAdBottom}
            />
            <h1 className="text-2xl font-bold mt-6 mb-4">ব্লগ</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentPosts.map((p) => (
                <div key={p.id} className="rounded-lg border bg-card overflow-hidden">
                  {p.image && <img src={p.image} alt={p.title} className="w-full h-40 object-cover" />}
                  <div className="p-3">
                    <h3 className="font-semibold line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.excerpt}</p>
                  </div>
                </div>
              ))}
              {recentPosts.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-6">কোনো পোস্ট নেই</p>
              )}
            </div>
          </>
        )}

        {/* Steps 2-3: blog post content */}
        {(step === 2 || step === 3) && gatewayPost && (
          <article>
            {step === 2 && (
              <TimerCard
                seconds={settings.linkGatewayTimer2}
                onDone={() => setReady(true)}
                ready={ready}
                buttonText={settings.linkGatewayBtn2Text}
                onClick={() => goNext(3)}
                adTop={settings.linkGatewayAdTop}
                adBottom={settings.linkGatewayAdBottom}
              />
            )}
            <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-3">{gatewayPost.title}</h1>
            {gatewayPost.image && (
              <img src={gatewayPost.image} alt={gatewayPost.title} className="w-full rounded-lg mb-4" />
            )}
            <div className="prose max-w-none">
              <BlogContentWithAds content={gatewayPost.content || ''} />
            </div>
            <div ref={bottomRef} className="mt-8">
              {step === 3 && (
                <TimerCard
                  seconds={settings.linkGatewayTimer3}
                  onDone={() => setReady(true)}
                  ready={ready}
                  buttonText={settings.linkGatewayBtn3Text}
                  onClick={() => goNext(4)}
                  adTop={settings.linkGatewayAdTop}
                  adBottom={settings.linkGatewayAdBottom}
                />
              )}
            </div>
          </article>
        )}

        {(step === 2 || step === 3) && !gatewayPost && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">গেটওয়ে পোস্ট কনফিগার করা হয়নি।</p>
            <Button onClick={() => goNext(4)}>এগিয়ে যান</Button>
          </div>
        )}
      </div>

      {/* Step 4: Popup */}
      {step === 4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
            <h2 className="text-xl font-bold mb-2">{settings.linkGatewayPopupTitle}</h2>
            <p className="text-sm text-muted-foreground mb-5">{settings.linkGatewayPopupText}</p>
            <AdBox html={settings.linkGatewayAdTop} label="অ্যাড স্পেস" />
            <Button
              size="lg"
              className="w-full text-base"
              onClick={() => { window.location.replace(targetUrl); }}
            >
              {settings.linkGatewayBtnFinalText} →
            </Button>
          </div>
        </div>
      )}
      </div>
      <Footer />
    </>
  );
};

export default GoLink;
