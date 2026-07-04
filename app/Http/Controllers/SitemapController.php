<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use App\Models\Category;
use App\Models\DigitalProduct;
use App\Models\Product;
use App\Models\ShortLink;
use Illuminate\Http\Response;
use Illuminate\Http\Request;

class SitemapController extends Controller
{
    public function sitemap(Request $request): Response
    {
        $base = rtrim($request->getSchemeAndHttpHost(), '/');
        $now  = now()->toDateString();

        $urls = [];

        // Static pages
        foreach ([
            ['/',              1.0, 'daily'],
            ['/shop',          0.9, 'daily'],
            ['/blog',          0.8, 'daily'],
            ['/digital-shop',  0.7, 'weekly'],
        ] as [$path, $priority, $freq]) {
            $urls[] = ['loc' => $base . $path, 'lastmod' => $now, 'freq' => $freq, 'priority' => $priority];
        }

        // Products
        Product::where('status', 'active')
            ->select('slug', 'updated_at')
            ->orderByDesc('updated_at')
            ->each(function ($p) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/product/' . rawurlencode($p->slug),
                    'lastmod'  => $p->updated_at?->toDateString(),
                    'freq'     => 'weekly',
                    'priority' => 0.8,
                ];
            });

        // Blog posts
        BlogPost::where('status', 'published')
            ->where('type', '!=', 'page')
            ->select('slug', 'updated_at')
            ->orderByDesc('updated_at')
            ->each(function ($p) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/blog/' . rawurlencode($p->slug),
                    'lastmod'  => $p->updated_at?->toDateString(),
                    'freq'     => 'weekly',
                    'priority' => 0.7,
                ];
            });

        // Static pages stored as blog posts (type = 'page')
        BlogPost::where('status', 'published')
            ->where('type', 'page')
            ->select('slug', 'updated_at')
            ->each(function ($p) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/page/' . rawurlencode($p->slug),
                    'lastmod'  => $p->updated_at?->toDateString(),
                    'freq'     => 'monthly',
                    'priority' => 0.5,
                ];
            });

        // Digital products
        DigitalProduct::where('status', 'active')
            ->select('slug', 'updated_at')
            ->orderByDesc('updated_at')
            ->each(function ($p) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/digital-product/' . rawurlencode($p->slug),
                    'lastmod'  => $p->updated_at?->toDateString(),
                    'freq'     => 'weekly',
                    'priority' => 0.7,
                ];
            });

        // Categories → /shop?category={slug}
        Category::select('slug', 'updated_at')
            ->orderBy('sort_order')
            ->each(function ($c) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/shop?category=' . rawurlencode($c->slug),
                    'lastmod'  => $c->updated_at?->toDateString(),
                    'freq'     => 'weekly',
                    'priority' => 0.6,
                ];
            });

        // Short link gateway pages
        ShortLink::where('is_active', true)
            ->select('slug', 'updated_at')
            ->each(function ($s) use ($base, &$urls) {
                $urls[] = [
                    'loc'      => $base . '/go/' . rawurlencode($s->slug),
                    'lastmod'  => $s->updated_at?->toDateString(),
                    'freq'     => 'monthly',
                    'priority' => 0.4,
                ];
            });

        $xml = $this->buildXml($urls);

        return response($xml, 200, [
            'Content-Type'  => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function robots(Request $request): Response
    {
        $base = rtrim($request->getSchemeAndHttpHost(), '/');

        $content = <<<TXT
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /admin
Disallow: /reseller
Disallow: /checkout
Disallow: /cart
Disallow: /thank-you

Sitemap: {$base}/sitemap.xml
TXT;

        return response($content, 200, ['Content-Type' => 'text/plain']);
    }

    private function buildXml(array $urls): string
    {
        $items = '';
        foreach ($urls as $u) {
            $loc      = htmlspecialchars($u['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $lastmod  = $u['lastmod'] ?? '';
            $freq     = $u['freq']    ?? 'weekly';
            $priority = number_format($u['priority'] ?? 0.5, 1);

            $items .= "  <url>\n";
            $items .= "    <loc>{$loc}</loc>\n";
            if ($lastmod) $items .= "    <lastmod>{$lastmod}</lastmod>\n";
            $items .= "    <changefreq>{$freq}</changefreq>\n";
            $items .= "    <priority>{$priority}</priority>\n";
            $items .= "  </url>\n";
        }

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{$items}</urlset>
XML;
    }
}
