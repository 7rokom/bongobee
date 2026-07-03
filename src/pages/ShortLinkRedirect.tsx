import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

const isExternalUrl = (target: string): boolean => {
  try {
    const u = new URL(target, window.location.origin);
    // Different hostname = external. Same hostname (or relative) = internal.
    return u.hostname !== window.location.hostname;
  } catch {
    return false;
  }
};

const ShortLinkRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);
  const gatewayEnabled = useSiteSettingsStore((s) => s.linkGatewayEnabled);

  useEffect(() => {
    if (!slug) {
      setError('লিংক পাওয়া যায়নি');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let data: { target_url?: string | null; product_id?: string | null } | null = null;
        try {
          data = await api.get(`/public/short-links/${slug}`);
        } catch {
          data = null;
        }
        if (cancelled) return;
        if (!data?.target_url) {
          setError('এই শর্ট লিংকটি পাওয়া যায়নি');
          return;
        }
        // Gateway only runs for EXTERNAL (non-own-site) URLs.
        // Own-site links (including product links) always redirect directly.
        const external = isExternalUrl(data.target_url);
        if (gatewayEnabled && external && !data.product_id) {
          window.location.replace(`/go/${slug}`);
          return;
        }
        // Direct redirect for internal / product / gateway-off links
        api.post(`/public/short-links/${slug}/click`, {}).catch(() => {});
        window.location.replace(data.target_url);
      } catch (e) {
        if (!cancelled) setError('লিংক লোড করতে সমস্যা হয়েছে');
      }
    })();
    return () => { cancelled = true; };
  }, [slug, gatewayEnabled]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-destructive mb-2">404</h1>
          <p className="text-muted-foreground">{error}</p>
          <a href="/" className="inline-block mt-4 text-primary hover:underline">হোমে ফিরে যান</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-sm">রিডাইরেক্ট হচ্ছে...</p>
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
