<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Category;
use App\Models\BlogPost;
use App\Models\LandingPage;
use App\Models\ShortLink;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function categories(): JsonResponse
    {
        return response()->json(Category::where('featured', true)->orWhere('sort_order', '>', 0)
            ->orderBy('sort_order')->get());
    }

    public function allCategories(): JsonResponse
    {
        return response()->json(Category::orderBy('sort_order')->get())
            ->header('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    }

    public function products(Request $request): JsonResponse
    {
        $query = Product::whereIn('status', ['published', 'active']);
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', '%'.$request->search.'%')
                  ->orWhere('name', 'like', '%'.$request->search.'%');
            });
        }
        return response()->json($query->orderByDesc('created_at')->paginate($request->get('per_page', 24)))
            ->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    public function product(string $slug): JsonResponse
    {
        $product = Product::where('slug', $slug)
            ->whereIn('status', ['published', 'active'])
            ->firstOrFail();
        return response()->json($product)
            ->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    public function siteSettings(): JsonResponse
    {
        $general = SiteSetting::get('general', []);
        $headerFooter = SiteSetting::get('header_footer', []);
        return response()->json(['general' => $general, 'header_footer' => $headerFooter])
            ->header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    }

    public function blog(Request $request): JsonResponse
    {
        $query = BlogPost::where('status', 'published')->where('type', 'post');
        if ($request->filled('search')) $query->where('title', 'like', '%'.$request->search.'%');
        return response()->json($query->orderByDesc('published_at')->paginate(12))
            ->header('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    }

    public function blogPost(string $slug): JsonResponse
    {
        $post = BlogPost::where('slug', $slug)->where('status', 'published')->firstOrFail();
        return response()->json($post)
            ->header('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    }

    public function page(string $slug): JsonResponse
    {
        $page = BlogPost::where('slug', $slug)->where('type', 'page')->where('status', 'published')->firstOrFail();
        return response()->json($page);
    }

    public function landingPage(string $slug): JsonResponse
    {
        $page = LandingPage::with('product')->where('slug', $slug)->whereIn('status', ['active', 'published'])->firstOrFail();
        return response()->json($page);
    }

    // Lookup only (no increment) — the frontend counts the click separately
    // via the click endpoint so gateway visits aren't double-counted.
    public function redirectShortLink(string $slug): JsonResponse
    {
        $link = ShortLink::where('slug', $slug)->first();
        if (!$link) {
            return response()->json(['target_url' => null, 'product_id' => null]);
        }
        $target = $link->target_url ?: $link->destination_url;
        return response()->json([
            'target_url' => $target,
            'product_id' => $link->product_id,
            'url' => $target,
        ]);
    }

    // Increment click_count (replaces the increment_short_link_click RPC).
    public function incrementShortLinkClick(string $slug): JsonResponse
    {
        ShortLink::where('slug', $slug)->increment('click_count');
        return response()->json(['ok' => true]);
    }
}
