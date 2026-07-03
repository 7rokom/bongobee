<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPage extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'slug', 'product_id', 'custom_price', 'custom_original_price',
        'content', 'custom_html', 'image', 'status',
    ];

    protected function casts(): array
    {
        return [
            'custom_price' => 'decimal:2',
            'custom_original_price' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
