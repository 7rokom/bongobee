<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = BlogPost::query();
        if ($request->filled('type')) $query->where('type', $request->type);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) $query->where('title', 'like', '%'.$request->search.'%');
        return response()->json($query->orderByDesc('created_at')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:blog_posts',
            'excerpt' => 'nullable|string',
            'content' => 'nullable|string',
            'image' => 'nullable|string',
            'gallery_images' => 'nullable|array',
            'author' => 'nullable|string',
            'category' => 'nullable|string',
            'date' => 'nullable|string',
            'type' => 'nullable|in:post,page,video',
            'status' => 'nullable|in:published,draft',
            'meta_description' => 'nullable|string',
            'meta_keywords' => 'nullable|string',
            'video_url' => 'nullable|string',
            'published_at' => 'nullable|date',
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['title']);
        $base = $data['slug']; $i = 1;
        while (BlogPost::where('slug', $data['slug'])->exists()) { $data['slug'] = $base.'-'.$i++; }
        return response()->json(BlogPost::create($data), 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(BlogPost::findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $post = BlogPost::findOrFail($id);
        $data = $request->validate([
            'title' => 'sometimes|string',
            'slug' => 'sometimes|string|unique:blog_posts,slug,'.$id,
            'excerpt' => 'nullable|string',
            'content' => 'nullable|string',
            'image' => 'nullable|string',
            'gallery_images' => 'nullable|array',
            'author' => 'nullable|string',
            'category' => 'nullable|string',
            'date' => 'nullable|string',
            'type' => 'nullable|in:post,page,video',
            'status' => 'nullable|in:published,draft',
            'meta_description' => 'nullable|string',
            'meta_keywords' => 'nullable|string',
            'video_url' => 'nullable|string',
            'published_at' => 'nullable|date',
        ]);
        $post->update($data);
        return response()->json($post);
    }

    public function destroy(string $id): JsonResponse
    {
        BlogPost::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
