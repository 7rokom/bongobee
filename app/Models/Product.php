<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use HasUuids;

    protected $fillable = [
        'name', 'title', 'slug', 'category_id', 'category', 'brand',
        'description', 'long_description', 'short_description',
        'price', 'original_price', 'buy_price', 'reseller_price',
        'images', 'featured_image', 'featured_video',
        'colors', 'sizes', 'weights', 'variations', 'variation_prices',
        'audio_url', 'stock_type', 'stock_product_name', 'status',
        'in_stock', 'free_delivery', 'meta_description', 'meta_keywords',
        'rating', 'review_count', 'reviews', 'is_affiliate', 'affiliate_url', 'affiliate_button_text',
    ];

    protected function casts(): array
    {
        return [
            'images' => 'array',
            'colors' => 'array',
            'sizes' => 'array',
            'weights' => 'array',
            'variations' => 'array',
            'variation_prices' => 'array',
            'reviews' => 'array',
            'in_stock' => 'boolean',
            'free_delivery' => 'boolean',
            'is_affiliate' => 'boolean',
            'price' => 'decimal:2',
            'original_price' => 'decimal:2',
            'buy_price' => 'decimal:2',
            'reseller_price' => 'decimal:2',
            'rating' => 'decimal:2',
            'review_count' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
