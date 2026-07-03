<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasUuids;

    protected $fillable = [
        'name', 'slug', 'image', 'featured', 'sort_order',
        'icon', 'lucide_icon', 'parent_id', 'is_main', 'custom_link', 'product_count',
    ];

    protected function casts(): array
    {
        return [
            'featured' => 'boolean',
            'is_main' => 'boolean',
            'product_count' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
