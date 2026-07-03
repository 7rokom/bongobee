<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class BlogPost extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'slug', 'excerpt', 'content', 'image', 'gallery_images',
        'author', 'category', 'date', 'type', 'status', 'meta_description',
        'meta_keywords', 'video_url', 'youtube_video_id', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'gallery_images' => 'array',
            'published_at' => 'datetime',
        ];
    }
}
