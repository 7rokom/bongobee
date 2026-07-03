import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Check, ExternalLink, Search, Loader2 } from 'lucide-react';
import { useLandingPageStore } from '@/stores/useLandingPageStore';
import { useProductStore } from '@/stores/useProductStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { toast } from '@/hooks/use-toast';

const getStoredResellerId = () => {
  const raw = localStorage.getItem('reseller-auth');
  if (!raw) return '';
  try { return JSON.parse(raw)?.id || ''; } catch { return ''; }
};

const ResellerLandingPages = () => {
  const { pages, fetchPages, loading } = useLandingPageStore();
  const { products } = useProductStore();
  const resellers = useResellerStore((s) => s.resellers);
  const fetchResellers = useResellerStore((s) => s.fetchResellers);

  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const resellerId = getStoredResellerId();
  const reseller = resellers.find((r) => r.id === resellerId);
  const ref = reseller?.serialNumber || resellerId;

  useEffect(() => {
    fetchPages();
    if (resellers.length === 0) fetchResellers();
  }, []);

  const published = useMemo(
    () => pages.filter((p) => p.status === 'published'),
    [pages],
  );

  const filtered = useMemo(
    () => published.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase())),
    [published, search],
  );

  const buildLink = (slug: string) => `${window.location.origin}/r/${ref}/lp/${slug}`;

  const handleCopy = (slug: string, id: string) => {
    navigator.clipboard.writeText(buildLink(slug)).then(() => {
      setCopiedId(id);
      toast({ title: 'লিংক কপি হয়েছে!' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">ল্যান্ডিং পেজ</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">আপনার নিজের লিংক শেয়ার করে অর্ডার নিন</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="সার্চ করুন..."
            className="pl-8"
          />
        </div>
      </div>

      {loading && pages.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            কোন ল্যান্ডিং পেজ পাওয়া যায়নি
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((page) => {
            const product = products.find((p) => p.id === page.productId);
            const link = buildLink(page.slug);
            const img = product?.featuredImage || product?.images?.[0] || '/placeholder.svg';
            return (
              <Card key={page.id} className="overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3">
                    <img src={img} alt={page.title} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-md shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{page.title}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">LP</Badge>
                      </div>
                      {product && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">৳{product.price}</p>
                      )}
                      <div className="mt-2 bg-muted/50 rounded px-2 py-1.5 text-[11px] sm:text-xs break-all font-mono text-muted-foreground">
                        {link}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCopy(page.slug, page.id)}
                          className="h-8 text-xs"
                        >
                          {copiedId === page.id ? <><Check className="h-3.5 w-3.5 mr-1" />কপি হয়েছে</> : <><Link2 className="h-3.5 w-3.5 mr-1" />লিংক কপি</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-8 text-xs"
                        >
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />ভিউ
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResellerLandingPages;
