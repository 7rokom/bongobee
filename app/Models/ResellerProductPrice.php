<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ResellerProductPrice extends Model {
    use HasUuids;
    protected $fillable = ['reseller_id','product_id','custom_price'];
    protected function casts(): array { return ['custom_price'=>'decimal:2']; }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
