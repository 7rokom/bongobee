<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalProduct extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'slug', 'description', 'long_description', 'price', 'original_price',
        'images', 'featured_image', 'category_id', 'category', 'product_type',
        'download_file_path', 'access_link', 'access_code', 'status',
        'meta_description', 'meta_keywords',
    ];

    protected function casts(): array
    {
        return [
            'images' => 'array',
            'price' => 'decimal:2',
            'original_price' => 'decimal:2',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DigitalCategory::class);
    }
}
