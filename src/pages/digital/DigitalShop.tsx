import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDigitalProductStore } from '@/stores/useDigitalProductStore';
import { useDigitalCategoryStore } from '@/stores/useDigitalCategoryStore';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

const DigitalShop = () => {
  const { products, fetch } = useDigitalProductStore();
  const { categories: masterCategories, fetch: fetchCategories } = useDigitalCategoryStore();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');

  useEffect(() => {
    fetch();
    fetchCategories();
  }, []);

  const published = useMemo(
    () => products.filter((p) => p.status === 'published'),
    [products]
  );

  // Master list + any used categories (defensive backfill)
  const categories = useMemo(() => {
    const set = new Set<string>(masterCategories);
    published.forEach((p) => (p.categories || []).forEach((c) => set.add(c)));
    return Array.from(set).filter(Boolean).sort();
  }, [published, masterCategories]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return published.filter((p) => {
      if (activeCat !== 'all' && !(p.categories || []).includes(activeCat)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.shortDescription || '').toLowerCase().includes(q) ||
        (p.categories || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [published, query, activeCat]);

  return (
    <>
      <SEOHead title="ডিজিটাল প্রডাক্ট শপ" description="সকল ডিজিটাল প্রডাক্ট এক জায়গায় — লাইসেন্স কী, কোর্স, ই-বুক ও আরও অনেক কিছু।" />
      <section className="bg-gradient-to-br from-primary/10 via-secondary/10 to-background border-b">
        <div className="container-box py-8 md:py-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">সকল ডিজিটাল প্রডাক্ট</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            ইনস্ট্যান্ট অ্যাক্সেস ও সুরক্ষিত পেমেন্ট — অ্যাডমিন অ্যাপ্রুভ করার পরই অ্যাক্সেস/ডাউনলোড পেয়ে যাবেন।
          </p>

          {/* Search bar */}
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="প্রডাক্ট সার্চ করুন..."
              className="pl-9 pr-9 h-11 bg-background"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => setActiveCat('all')}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${
                  activeCat === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                সব
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCat(c)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition ${
                    activeCat === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container-box py-8">
        {list.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            {query || activeCat !== 'all' ? 'কোনো প্রডাক্ট পাওয়া যায়নি' : 'এখনও কোনো ডিজিটাল প্রডাক্ট নেই'}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {list.map((p) => (
              <Link key={p.id} to={`/digital-product/${p.slug}`}>
                <Card className="overflow-hidden h-full hover:shadow-lg transition-all hover:-translate-y-0.5 group">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={p.featuredImage || '/placeholder.svg'}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-2.5 md:p-3">
                    <h3 className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-base md:text-lg font-bold text-primary">৳{p.price}</span>
                      {p.originalPrice && p.originalPrice > p.price && (
                        <span className="text-xs line-through text-muted-foreground">৳{p.originalPrice}</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default DigitalShop;
